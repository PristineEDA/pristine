import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';

import {
  createWaveformScene,
  updateWaveformSceneCursor,
  updateWaveformSceneSelection,
  updateWaveformSceneVerticalScroll,
  waveformLayerNames,
  type WaveformScene,
  type WaveformSignalTextureCacheEntry,
} from './createWaveformScene';
import {
  clampTime,
  getWaveformDigitalPulseFillCount,
  getWaveformDisplayRows,
  getWaveformFirstSignalLaneY,
  getWaveformSignalLaneY,
  getWaveformShapeCounts,
  getWaveformStateCounts,
  getWaveformViewportSpan,
  panWaveformViewport,
  timeToX,
  waveformCanvasMinHeight,
  waveformCanvasMinWidth,
  waveformLaneHeight,
  xToTime,
  zoomWaveformViewport,
} from './waveformLayout';
import type {
  WaveformDataSet,
  WaveformRenderMetrics,
  WaveformRendererStatus,
  WaveformRenderStats,
  WaveformSceneUpdateMetrics,
  WaveformViewport,
} from './waveformTypes';

type PixiRendererPreference = 'webgpu' | 'webgl';

interface WaveformCanvasProps {
  cursorTime: number;
  data: WaveformDataSet;
  selectedSignalId: string | null;
  verticalScrollTop: number;
  viewport: WaveformViewport;
  onCursorTimeChange: (time: number) => void;
  onMetricsChange?: (metrics: WaveformRenderMetrics) => void;
  onRendererChange?: (renderer: WaveformRendererStatus) => void;
  onVerticalScrollDelta: (delta: number) => void;
  onViewportChange: (viewport: WaveformViewport) => void;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startViewport: WaveformViewport;
  moved: boolean;
}

const dragThreshold = 4;
const zoomWheelFactor = 1.18;
const waveformSignalTextureCacheLimit = 48;
const waveformSignalTextureCacheByteLimit = 32 * 1024 * 1024;
const waveformMetricSampleWindowSize = 30;

export function WaveformCanvas({
  cursorTime,
  data,
  selectedSignalId,
  verticalScrollTop,
  viewport,
  onCursorTimeChange,
  onMetricsChange,
  onRendererChange,
  onVerticalScrollDelta,
  onViewportChange,
}: WaveformCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<WaveformScene | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const signalTextureCacheRef = useRef(new Map<string, WaveformSignalTextureCacheEntry>());
  const signalTextureCacheBytesRef = useRef(0);
  const textureCacheDataIdRef = useRef(data.id);
  const dataRef = useRef(data);
  const renderStatsRef = useRef<WaveformRenderStats>(createEmptyRenderStats());
  const renderMetricHistoryRef = useRef<{
    durations: number[];
    fps: number[];
    previousCompletedAt: number | null;
  }>({ durations: [], fps: [], previousCompletedAt: null });
  const sceneUpdateMetricsRef = useRef<WaveformSceneUpdateMetrics>(createEmptySceneUpdateMetrics());
  const viewportRef = useRef(viewport);
  const cursorTimeRef = useRef(cursorTime);
  const selectedSignalIdRef = useRef(selectedSignalId);
  const onCursorTimeChangeRef = useRef(onCursorTimeChange);
  const onMetricsChangeRef = useRef(onMetricsChange);
  const onVerticalScrollDeltaRef = useRef(onVerticalScrollDelta);
  const onViewportChangeRef = useRef(onViewportChange);
  const verticalScrollTopRef = useRef(verticalScrollTop);
  const [renderer, setRenderer] = useState<WaveformRendererStatus>('initializing');
  const [renderCount, setRenderCount] = useState(0);
  const [renderMetrics, setRenderMetrics] = useState<WaveformRenderMetrics>(createEmptyRenderMetrics());
  const [renderStats, setRenderStats] = useState<WaveformRenderStats>(createEmptyRenderStats());
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  dataRef.current = data;
  renderStatsRef.current = renderStats;
  viewportRef.current = viewport;
  cursorTimeRef.current = cursorTime;
  selectedSignalIdRef.current = selectedSignalId;
  onCursorTimeChangeRef.current = onCursorTimeChange;
  onMetricsChangeRef.current = onMetricsChange;
  onVerticalScrollDeltaRef.current = onVerticalScrollDelta;
  onViewportChangeRef.current = onViewportChange;
  verticalScrollTopRef.current = verticalScrollTop;

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let activeApp: Application | null = null;

    async function initialize() {
      const host = hostRef.current;

      if (!host) {
        return;
      }

      try {
        const result = await createPixiApp(host);

        if (disposed) {
          result.app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
          return;
        }

        activeApp = result.app;
        appRef.current = result.app;
        setRenderer(result.renderer);
        onRendererChange?.(result.renderer);
        rebuildScene();

        resizeObserver = new ResizeObserver(() => {
          rebuildScene();
        });
        resizeObserver.observe(host);
      } catch {
        if (!disposed) {
          setRenderer('error');
          onRendererChange?.('error');
        }
      }
    }

    initialize();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();

      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }

      clearSignalTextureCache();
      sceneRef.current?.world.destroy({ children: true });
      sceneRef.current = null;
      appRef.current = null;
      renderMetricHistoryRef.current = {
        durations: [],
        fps: [],
        previousCompletedAt: null,
      };
      sceneUpdateMetricsRef.current = createEmptySceneUpdateMetrics();
      activeApp?.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
    };
  }, [onRendererChange]);

  useEffect(() => {
    rebuildScene();
  }, [data, viewport]);

  useEffect(() => {
    const scene = sceneRef.current;

    if (!scene || scene.state.cursorTime === cursorTime) {
      return;
    }

    updateWaveformSceneCursor(scene, cursorTime);
    sceneUpdateMetricsRef.current.cursorUpdateCount += 1;
    applyRenderStats(scene.renderStats);
    requestRender();
  }, [cursorTime]);

  useEffect(() => {
    const scene = sceneRef.current;

    if (!scene || scene.state.selectedSignalId === selectedSignalId) {
      return;
    }

    updateWaveformSceneSelection(scene, selectedSignalId);
    sceneUpdateMetricsRef.current.selectionUpdateCount += 1;
    applyRenderStats(scene.renderStats);
    requestRender();
  }, [selectedSignalId]);

  useEffect(() => {
    const scene = sceneRef.current;

    if (!scene || scene.state.verticalScrollTop === verticalScrollTop) {
      return;
    }

    updateWaveformSceneVerticalScroll(scene, verticalScrollTop);
    sceneUpdateMetricsRef.current.verticalScrollUpdateCount += 1;
    applyRenderStats(scene.renderStats);
    requestRender();
  }, [verticalScrollTop]);

  useEffect(() => {
    const hostElement = hostRef.current;

    if (!hostElement) {
      return;
    }

    const host = hostElement;

    function handleWheel(event: WheelEvent) {
      const currentViewport = viewportRef.current;
      const currentData = dataRef.current;
      const width = Math.max(waveformCanvasMinWidth, host.clientWidth);

      if (event.ctrlKey || event.metaKey || event.altKey) {
        event.preventDefault();
        const centerTime = clampTime(getPointerTime(event.clientX), currentData.duration);
        const zoomFactor = event.deltaY > 0 ? 1 / zoomWheelFactor : zoomWheelFactor;
        onViewportChangeRef.current(zoomWaveformViewport(currentViewport, centerTime, zoomFactor, currentData.duration));
        return;
      }

      if (event.shiftKey) {
        event.preventDefault();
        const deltaPixels = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        const deltaTime = deltaPixels * getWaveformViewportSpan(currentViewport) / Math.max(1, width);
        onViewportChangeRef.current(panWaveformViewport(currentViewport, deltaTime, currentData.duration));
        return;
      }

      event.preventDefault();
      onVerticalScrollDeltaRef.current(event.deltaY || event.deltaX);
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) {
        return;
      }

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startViewport: viewportRef.current,
        moved: false,
      };
      host.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent) {
      const drag = dragRef.current;

      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      if (!drag.moved && Math.hypot(dx, dy) < dragThreshold) {
        return;
      }

      drag.moved = true;
      const width = Math.max(waveformCanvasMinWidth, host.clientWidth);
      const deltaTime = -dx * getWaveformViewportSpan(drag.startViewport) / Math.max(1, width);
      onViewportChangeRef.current(panWaveformViewport(drag.startViewport, deltaTime, dataRef.current.duration));
    }

    function handlePointerUp(event: PointerEvent) {
      const drag = dragRef.current;

      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      dragRef.current = null;
      host.releasePointerCapture(event.pointerId);

      if (!drag.moved) {
        onCursorTimeChangeRef.current(clampTime(getPointerTime(event.clientX), dataRef.current.duration));
      }
    }

    function getPointerTime(clientX: number) {
      const rect = host.getBoundingClientRect();
      const x = clientX - rect.left;
      return xToTime(x, viewportRef.current, Math.max(waveformCanvasMinWidth, rect.width));
    }

    host.addEventListener('wheel', handleWheel, { passive: false });
    host.addEventListener('pointerdown', handlePointerDown);
    host.addEventListener('pointermove', handlePointerMove);
    host.addEventListener('pointerup', handlePointerUp);
    host.addEventListener('pointercancel', handlePointerUp);

    return () => {
      host.removeEventListener('wheel', handleWheel);
      host.removeEventListener('pointerdown', handlePointerDown);
      host.removeEventListener('pointermove', handlePointerMove);
      host.removeEventListener('pointerup', handlePointerUp);
      host.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  function rebuildScene() {
    const app = appRef.current;
    const host = hostRef.current;

    if (!app || !host) {
      return;
    }

    const width = Math.max(waveformCanvasMinWidth, Math.floor(host.clientWidth));
    const height = Math.max(waveformCanvasMinHeight, Math.floor(host.clientHeight));

    if (textureCacheDataIdRef.current !== dataRef.current.id) {
      clearSignalTextureCache();
      textureCacheDataIdRef.current = dataRef.current.id;
    }

    app.renderer.resize(width, height);
    Object.assign(app.canvas.style, {
      display: 'block',
      height: '100%',
      width: '100%',
    });
    setCanvasSize({ width, height });
    const previousScene = sceneRef.current;
    app.stage.removeChildren();
    sceneRef.current = null;
    previousScene?.world.destroy({ children: true });

    const renderResolution = getRendererResolution(app);
    sceneRef.current = createWaveformScene({
      cursorTime: cursorTimeRef.current,
      data: dataRef.current,
      height,
      renderResolution,
      selectedSignalId: selectedSignalIdRef.current,
      signalTextureCache: {
        get: getCachedSignalTexture,
        set: setCachedSignalTexture,
      },
      textureRenderer: app.renderer,
      verticalScrollTop: verticalScrollTopRef.current,
      viewport: viewportRef.current,
      width,
    });
    sceneUpdateMetricsRef.current.fullSceneRebuildCount += 1;
    applyRenderStats(sceneRef.current.renderStats);
    app.stage.addChild(sceneRef.current.world);
    requestRender();
  }

  function applyRenderStats(baseStats: WaveformRenderStats) {
    const nextRenderStats = {
      ...baseStats,
      textureCacheBytes: signalTextureCacheBytesRef.current,
      textureCacheSize: signalTextureCacheRef.current.size,
      ...sceneUpdateMetricsRef.current,
    };

    renderStatsRef.current = nextRenderStats;
    setRenderStats(nextRenderStats);
  }

  function getCachedSignalTexture(key: string) {
    const entry = signalTextureCacheRef.current.get(key);

    if (!entry) {
      return null;
    }

    signalTextureCacheRef.current.delete(key);
    signalTextureCacheRef.current.set(key, entry);

    return entry;
  }

  function setCachedSignalTexture(key: string, entry: WaveformSignalTextureCacheEntry) {
    const existing = signalTextureCacheRef.current.get(key);

    if (existing) {
      removeCachedSignalTexture(key);
    }

    signalTextureCacheRef.current.set(key, entry);
    signalTextureCacheBytesRef.current += entry.estimatedBytes;

    while (signalTextureCacheRef.current.size > waveformSignalTextureCacheLimit || signalTextureCacheBytesRef.current > waveformSignalTextureCacheByteLimit) {
      const oldestKey = signalTextureCacheRef.current.keys().next().value;

      if (typeof oldestKey !== 'string') {
        break;
      }

      removeCachedSignalTexture(oldestKey);
    }
  }

  function removeCachedSignalTexture(key: string) {
    const entry = signalTextureCacheRef.current.get(key);

    if (!entry) {
      return;
    }

    signalTextureCacheRef.current.delete(key);
    signalTextureCacheBytesRef.current = Math.max(0, signalTextureCacheBytesRef.current - entry.estimatedBytes);
    destroyCachedTexture(entry);
  }

  function clearSignalTextureCache() {
    for (const entry of signalTextureCacheRef.current.values()) {
      destroyCachedTexture(entry);
    }

    signalTextureCacheRef.current.clear();
    signalTextureCacheBytesRef.current = 0;
  }

  function requestRender() {
    const app = appRef.current;

    if (!app || renderFrameRef.current !== null) {
      return;
    }

    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      const renderStartedAt = performance.now();
      app.render();
      publishRenderMetrics(performance.now() - renderStartedAt);
      setRenderCount((currentRenderCount) => currentRenderCount + 1);
    });
  }

  function publishRenderMetrics(renderDurationMs: number) {
    const history = renderMetricHistoryRef.current;
    const completedAt = performance.now();
    const lastFps = history.previousCompletedAt === null
      ? null
      : 1000 / Math.max(1, completedAt - history.previousCompletedAt);

    history.previousCompletedAt = completedAt;
    pushMetricSample(history.durations, renderDurationMs);

    if (lastFps !== null) {
      pushMetricSample(history.fps, lastFps);
    }

    const nextMetrics: WaveformRenderMetrics = {
      lastRenderDurationMs: renderDurationMs,
      averageRenderDurationMs: getAverageMetric(history.durations),
      lastFps,
      averageFps: history.fps.length > 0 ? getAverageMetric(history.fps) : null,
      visiblePrimitiveCount: getVisiblePrimitiveCount(sceneRef.current, renderStatsRef.current),
    };

    setRenderMetrics(nextMetrics);
    onMetricsChangeRef.current?.(nextMetrics);
  }

  const zoomLevel = data.duration / getWaveformViewportSpan(viewport);
  const cursorX = timeToX(cursorTime, viewport, waveformCanvasMinWidth);
  const displayRows = getWaveformDisplayRows(data);
  const firstSignalLaneY = getWaveformFirstSignalLaneY(data);
  const selectedSignalLaneY = getWaveformSignalLaneY(data, selectedSignalId);
  const selectedSignalVisibleY = selectedSignalLaneY === null ? null : selectedSignalLaneY - verticalScrollTop;
  const stateCounts = getWaveformStateCounts(data);
  const shapeCounts = getWaveformShapeCounts(data, viewport);
  const pulseFillCount = getWaveformDigitalPulseFillCount(data, viewport);

  return (
    <div
      ref={hostRef}
      aria-label="Waveform canvas"
      className="relative h-full min-h-0 w-full flex-1 cursor-crosshair overflow-hidden bg-[#111111] outline-none"
      data-cursor-time={cursorTime.toFixed(2)}
      data-cursor-x={cursorX.toFixed(2)}
      data-layer-count={waveformLayerNames.length}
      data-layer-names={waveformLayerNames.join(',')}
      data-bus-hexagon-count={shapeCounts.busHexagonCount}
      data-cache-hit-count={renderStats.cacheHitCount}
      data-cache-miss-count={renderStats.cacheMissCount}
      data-cacheable-signal-count={renderStats.cacheableSignalCount}
      data-cached-signal-count={renderStats.cachedSignalCount}
      data-compact-signal-count={renderStats.compactSignalCount}
      data-canvas-height={canvasSize.height.toFixed(2)}
      data-canvas-width={canvasSize.width.toFixed(2)}
      data-coalesced-segment-count={renderStats.coalescedSegmentCount}
      data-culled-row-count={renderStats.culledRowCount}
      data-dense-column-count={renderStats.denseColumnCount}
      data-dense-run-count={renderStats.denseRunCount}
      data-dense-signal-count={renderStats.denseSignalCount}
      data-full-scene-rebuild-count={renderStats.fullSceneRebuildCount}
      data-detail-signal-count={renderStats.detailSignalCount}
      data-first-signal-lane-y={formatOptionalNumber(firstSignalLaneY)}
      data-header-background="opaque"
      data-average-fps={formatOptionalNumber(renderMetrics.averageFps)}
      data-average-render-ms={formatOptionalNumber(renderMetrics.averageRenderDurationMs)}
      data-last-fps={formatOptionalNumber(renderMetrics.lastFps)}
      data-last-render-ms={formatOptionalNumber(renderMetrics.lastRenderDurationMs)}
      data-pulse-fill-count={pulseFillCount}
      data-render-count={renderCount}
      data-render-resolution={renderStats.renderResolution.toFixed(2)}
      data-rendered-label-count={renderStats.renderedLabelCount}
      data-rendered-segment-count={renderStats.renderedSegmentCount}
      data-rendered-signal-count={renderStats.renderedSignalCount}
      data-renderer={renderer}
      data-row-count={displayRows.length}
      data-row-height={waveformLaneHeight}
      data-selected-signal-lane-y={formatOptionalNumber(selectedSignalLaneY)}
      data-testid="waveform-canvas"
      data-visible-window-end={viewport.endTime.toFixed(2)}
      data-visible-window-start={viewport.startTime.toFixed(2)}
      data-visible-row-count={renderStats.visibleRowCount}
      data-x-state-count={stateCounts.xStateCount}
      data-source-segment-count={renderStats.sourceSegmentCount}
      data-selected-signal-visible-y={formatOptionalNumber(selectedSignalVisibleY)}
      data-selection-update-count={renderStats.selectionUpdateCount}
      data-suppressed-label-count={renderStats.suppressedLabelCount}
      data-texture-cache-bytes={renderStats.textureCacheBytes}
      data-texture-cache-size={renderStats.textureCacheSize}
      data-cursor-update-count={renderStats.cursorUpdateCount}
      data-vertical-scroll-top={verticalScrollTop.toFixed(2)}
      data-vertical-scroll-update-count={renderStats.verticalScrollUpdateCount}
      data-visible-primitive-count={renderMetrics.visiblePrimitiveCount}
      data-viewport-content-update-count={renderStats.viewportContentUpdateCount}
      data-x-state-block-count={shapeCounts.xStateBlockCount}
      data-z-state-block-count={shapeCounts.zStateBlockCount}
      data-z-state-count={stateCounts.zStateCount}
      data-zoom={zoomLevel.toFixed(2)}
      role="img"
      style={{ minHeight: waveformCanvasMinHeight }}
      tabIndex={0}
    >
      {renderer === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-[12px] text-ide-error">
          Waveform renderer unavailable
        </div>
      )}
    </div>
  );
}

async function createPixiApp(host: HTMLElement) {
  const width = Math.max(waveformCanvasMinWidth, Math.floor(host.clientWidth));
  const height = Math.max(waveformCanvasMinHeight, Math.floor(host.clientHeight));
  const preferences: PixiRendererPreference[] = ['webgpu', 'webgl'];
  let lastError: unknown;

  for (const preference of preferences) {
    const app = new Application();

    try {
      await app.init({
        width,
        height,
        autoDensity: true,
        antialias: true,
        autoStart: false,
        backgroundAlpha: 0,
        preference,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      app.stop();
      host.appendChild(app.canvas);
      return { app, renderer: preference };
    } catch (error) {
      lastError = error;
      app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to initialize waveform renderer.');
}

function formatOptionalNumber(value: number | null) {
  return value === null ? '' : value.toFixed(2);
}

function createEmptyRenderStats(): WaveformRenderStats {
  return {
    visibleRowCount: 0,
    culledRowCount: 0,
    renderedSignalCount: 0,
    sourceSegmentCount: 0,
    renderedSegmentCount: 0,
    coalescedSegmentCount: 0,
    renderedLabelCount: 0,
    cacheableSignalCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    cachedSignalCount: 0,
    compactSignalCount: 0,
    denseColumnCount: 0,
    denseRunCount: 0,
    denseSignalCount: 0,
    detailSignalCount: 0,
    renderResolution: 1,
    suppressedLabelCount: 0,
    textureCacheBytes: 0,
    textureCacheSize: 0,
    fullSceneRebuildCount: 0,
    viewportContentUpdateCount: 0,
    verticalScrollUpdateCount: 0,
    cursorUpdateCount: 0,
    selectionUpdateCount: 0,
  };
}

function createEmptySceneUpdateMetrics(): WaveformSceneUpdateMetrics {
  return {
    fullSceneRebuildCount: 0,
    viewportContentUpdateCount: 0,
    verticalScrollUpdateCount: 0,
    selectionUpdateCount: 0,
    cursorUpdateCount: 0,
  };
}

function createEmptyRenderMetrics(): WaveformRenderMetrics {
  return {
    lastRenderDurationMs: null,
    averageRenderDurationMs: null,
    lastFps: null,
    averageFps: null,
    visiblePrimitiveCount: 0,
  };
}

function getRendererResolution(app: Application) {
  const renderer = app.renderer as { resolution?: number };

  return Math.max(1, renderer.resolution ?? Math.min(window.devicePixelRatio || 1, 2));
}

function getVisiblePrimitiveCount(scene: WaveformScene | null, renderStats: WaveformRenderStats) {
  if (!scene) {
    return 0;
  }

  return renderStats.renderedSegmentCount
    + renderStats.renderedLabelCount
    + scene.shapeCounts.busHexagonCount
    + scene.shapeCounts.xStateBlockCount
    + scene.shapeCounts.zStateBlockCount
    + scene.digitalPulseFillCount;
}

function pushMetricSample(samples: number[], nextValue: number) {
  samples.push(nextValue);

  if (samples.length > waveformMetricSampleWindowSize) {
    samples.splice(0, samples.length - waveformMetricSampleWindowSize);
  }
}

function getAverageMetric(samples: number[]) {
  if (samples.length === 0) {
    return null;
  }

  const total = samples.reduce((sum, sample) => sum + sample, 0);

  return total / samples.length;
}

function destroyCachedTexture(entry: WaveformSignalTextureCacheEntry) {
  if (!entry.texture.destroyed) {
    entry.texture.destroy(true);
  }
}
