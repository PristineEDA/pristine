import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';

import {
  createWaveformScene,
  updateWaveformSceneCursor,
  updateWaveformScenePan,
  updateWaveformSceneSelection,
  updateWaveformSceneVerticalScroll,
  updateWaveformSceneViewport,
  waveformLayerNames,
  type WaveformScene,
  type WaveformSignalTextureCacheEntry,
} from './createWaveformScene';
import {
  clampTime,
  getWaveformDigitalPulseFillCount,
  getWaveformDisplayRows,
  getWaveformFirstSignalLaneY,
  getWaveformRulerScrollIndicatorMetrics,
  getWaveformSignalLaneY,
  getWaveformShapeCounts,
  getWaveformStateCounts,
  getWaveformViewportForRulerScrollIndicator,
  getWaveformViewportSpan,
  panWaveformViewport,
  timeToX,
  waveformCanvasMinHeight,
  waveformCanvasMinWidth,
  waveformHeaderHeight,
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
import { waveformBinaryFrameSignalTableStride, type ParsedWaveformFrame } from './waveformBinaryFrame';

type PixiRendererPreference = 'webgpu' | 'webgl';

interface WaveformCanvasProps {
  cursorTime: number;
  data: WaveformDataSet;
  frame?: ParsedWaveformFrame | null;
  frameParseMs?: number;
  interactionFrameRequestCount?: number;
  pipeRoundtripMs?: number;
  preparedRangeHitCount?: number;
  preparedRangeMissCount?: number;
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

interface RulerScrollDragState {
  indicatorOffsetX: number;
  pointerId: number;
}

const dragThreshold = 4;
const zoomWheelFactor = 1.18;
const waveformSignalTextureCacheLimit = 48;
const waveformSignalTextureCacheByteLimit = 32 * 1024 * 1024;
const waveformMetricSampleWindowSize = 30;
const waveformViewportCommitDelayMs = 120;
const waveformReactMetricPublishIntervalMs = 250;
const waveformDroppedFrameThresholdMs = 24;

export function WaveformCanvas({
  cursorTime,
  data,
  frame,
  frameParseMs = 0,
  interactionFrameRequestCount = 0,
  pipeRoundtripMs = 0,
  preparedRangeHitCount = 0,
  preparedRangeMissCount = 0,
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
  const rulerScrollDragRef = useRef<RulerScrollDragState | null>(null);
  const viewportChangeFrameRef = useRef<number | null>(null);
  const viewportCommitTimeoutRef = useRef<number | null>(null);
  const pendingViewportRef = useRef<WaveformViewport | null>(null);
  const signalTextureCacheRef = useRef(new Map<string, WaveformSignalTextureCacheEntry>());
  const signalTextureCacheBytesRef = useRef(0);
  const textureCacheDataIdRef = useRef(data.id);
  const dataRef = useRef(data);
  const renderStatsRef = useRef<WaveformRenderStats>(createEmptyRenderStats());
  const renderMetricHistoryRef = useRef<{
    durations: number[];
    frameIntervals: number[];
    fps: number[];
    previousCompletedAt: number | null;
  }>({ durations: [], frameIntervals: [], fps: [], previousCompletedAt: null });
  const sceneUpdateMetricsRef = useRef<WaveformSceneUpdateMetrics>(createEmptySceneUpdateMetrics());
  const renderCountRef = useRef(0);
  const lastReactMetricPublishAtRef = useRef(0);
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
  sceneUpdateMetricsRef.current.frameParseMs = frameParseMs;
  sceneUpdateMetricsRef.current.pipeRoundtripMs = pipeRoundtripMs;
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
      if (viewportChangeFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportChangeFrameRef.current);
        viewportChangeFrameRef.current = null;
      }
      if (viewportCommitTimeoutRef.current !== null) {
        window.clearTimeout(viewportCommitTimeoutRef.current);
        viewportCommitTimeoutRef.current = null;
      }
      pendingViewportRef.current = null;

      clearSignalTextureCache();
      sceneRef.current?.world.destroy({ children: true });
      sceneRef.current = null;
      appRef.current = null;
      renderMetricHistoryRef.current = {
        durations: [],
        frameIntervals: [],
        fps: [],
        previousCompletedAt: null,
      };
      sceneUpdateMetricsRef.current = createEmptySceneUpdateMetrics();
      activeApp?.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
    };
  }, [onRendererChange]);

  useEffect(() => {
    rebuildScene();
  }, [data, frame]);

  useEffect(() => {
    sceneUpdateMetricsRef.current.reactViewportCommitCount += 1;
    applyViewportToScene(viewport, { countDisplayUpdate: false });
  }, [viewport]);

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
    accumulateRowLifecycleMetrics(scene.renderStats);
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
        scheduleViewportChange(zoomWaveformViewport(currentViewport, centerTime, zoomFactor, currentData.duration));
        return;
      }

      if (event.shiftKey) {
        event.preventDefault();
        const deltaPixels = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        const deltaTime = deltaPixels * getWaveformViewportSpan(currentViewport) / Math.max(1, width);
        scheduleViewportChange(panWaveformViewport(currentViewport, deltaTime, currentData.duration));
        return;
      }

      event.preventDefault();
      onVerticalScrollDeltaRef.current(event.deltaY || event.deltaX);
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) {
        return;
      }

      const rect = host.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      if (pointerY >= 0 && pointerY <= waveformHeaderHeight) {
        const width = Math.max(waveformCanvasMinWidth, rect.width);
        const currentViewport = viewportRef.current;
        const metrics = getWaveformRulerScrollIndicatorMetrics(currentViewport, dataRef.current.duration, width);
        const pointerInsideIndicator = pointerX >= metrics.left && pointerX <= metrics.left + metrics.width;
        const indicatorOffsetX = pointerInsideIndicator ? pointerX - metrics.left : metrics.width / 2;

        rulerScrollDragRef.current = {
          indicatorOffsetX,
          pointerId: event.pointerId,
        };
        host.setPointerCapture(event.pointerId);

        if (!pointerInsideIndicator) {
          updateViewportFromRulerPointer(pointerX, indicatorOffsetX, width);
        }

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
      const rulerDrag = rulerScrollDragRef.current;

      if (rulerDrag && rulerDrag.pointerId === event.pointerId) {
        const rect = host.getBoundingClientRect();
        updateViewportFromRulerPointer(event.clientX - rect.left, rulerDrag.indicatorOffsetX, Math.max(waveformCanvasMinWidth, rect.width));
        return;
      }

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
      scheduleViewportChange(panWaveformViewport(drag.startViewport, deltaTime, dataRef.current.duration));
    }

    function handlePointerUp(event: PointerEvent) {
      const rulerDrag = rulerScrollDragRef.current;

      if (rulerDrag && rulerDrag.pointerId === event.pointerId) {
        rulerScrollDragRef.current = null;
        host.releasePointerCapture(event.pointerId);
        return;
      }

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

    function updateViewportFromRulerPointer(pointerX: number, indicatorOffsetX: number, width: number) {
      const nextLeft = pointerX - indicatorOffsetX;
      scheduleViewportChange(getWaveformViewportForRulerScrollIndicator(viewportRef.current, dataRef.current.duration, width, nextLeft));
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

  function scheduleViewportChange(nextViewport: WaveformViewport) {
    pendingViewportRef.current = nextViewport;
    viewportRef.current = nextViewport;

    if (viewportChangeFrameRef.current !== null) {
      scheduleReactViewportCommit();
      return;
    }

    viewportChangeFrameRef.current = window.requestAnimationFrame(() => {
      viewportChangeFrameRef.current = null;
      const pendingViewport = pendingViewportRef.current;

      if (pendingViewport) {
        applyViewportToScene(pendingViewport, { countDisplayUpdate: true });
        scheduleReactViewportCommit();
      }
    });
  }

  function scheduleReactViewportCommit() {
    if (viewportCommitTimeoutRef.current !== null) {
      window.clearTimeout(viewportCommitTimeoutRef.current);
    }

    viewportCommitTimeoutRef.current = window.setTimeout(() => {
      viewportCommitTimeoutRef.current = null;
      flushPendingViewportCommit();
    }, waveformViewportCommitDelayMs);
  }

  function flushPendingViewportCommit() {
    const pendingViewport = pendingViewportRef.current;
    pendingViewportRef.current = null;

    if (pendingViewport && !areViewportsEqual(pendingViewport, viewport)) {
      onViewportChangeRef.current(pendingViewport);
    }
  }

  function applyViewportToScene(nextViewport: WaveformViewport, options: { countDisplayUpdate: boolean }) {
    const scene = sceneRef.current;

    if (!scene || areViewportsEqual(scene.state.viewport, nextViewport)) {
      return;
    }

    const sceneUpdateStartedAt = performance.now();
    const handledAsPan = updateWaveformScenePan(scene, nextViewport);

    if (!handledAsPan) {
      updateWaveformSceneViewport(scene, nextViewport);
      flushPendingViewportCommit();
    }

    sceneUpdateMetricsRef.current.sceneUpdateMs = Math.max(0, performance.now() - sceneUpdateStartedAt);
    sceneUpdateMetricsRef.current.viewportContentUpdateCount += 1;
    if (options.countDisplayUpdate) {
      sceneUpdateMetricsRef.current.displayViewportUpdateCount += 1;
    }
    accumulateRowLifecycleMetrics(scene.renderStats);
    applyRenderStats(scene.renderStats);
    requestRender();
  }

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
      frame: frame ?? null,
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
    accumulateRowLifecycleMetrics(sceneRef.current.renderStats);
    applyRenderStats(sceneRef.current.renderStats);
    app.stage.addChild(sceneRef.current.world);
    requestRender();
  }

  function accumulateRowLifecycleMetrics(baseStats: WaveformRenderStats) {
    sceneUpdateMetricsRef.current.rowAttachCount += baseStats.rowAttachCount;
    sceneUpdateMetricsRef.current.rowReuseCount += baseStats.rowReuseCount;
    sceneUpdateMetricsRef.current.rowRecycleCount += baseStats.rowRecycleCount;
    sceneUpdateMetricsRef.current.rowContentRedrawCount += baseStats.rowContentRedrawCount;
    sceneUpdateMetricsRef.current.rowContentSkipCount += baseStats.rowContentSkipCount;
    sceneUpdateMetricsRef.current.panBufferHitCount += baseStats.panBufferHitCount;
    sceneUpdateMetricsRef.current.panBufferMissCount += baseStats.panBufferMissCount;
    sceneUpdateMetricsRef.current.panPixelShiftCount += baseStats.panPixelShiftCount;
    sceneUpdateMetricsRef.current.gpuBufferUpdateCount += baseStats.gpuBufferUpdateCount;
    sceneUpdateMetricsRef.current.gpuBufferUpdateMs += baseStats.gpuBufferUpdateMs;
    sceneUpdateMetricsRef.current.gpuBufferCapacityVertexCount = baseStats.gpuBufferCapacityVertexCount;
    sceneUpdateMetricsRef.current.gpuBufferReallocCount += baseStats.gpuBufferReallocCount;
    sceneUpdateMetricsRef.current.gpuDrawLayerCount = baseStats.gpuDrawLayerCount;
    sceneUpdateMetricsRef.current.gpuLayerCount = baseStats.gpuLayerCount;
    sceneUpdateMetricsRef.current.gpuVertexCount = baseStats.gpuVertexCount;
    sceneUpdateMetricsRef.current.labelPoolSize = baseStats.labelPoolSize;
    sceneUpdateMetricsRef.current.labelTextureUpdateCount += baseStats.labelTextureUpdateCount;
    sceneUpdateMetricsRef.current.meshBufferUpdateMs = sceneUpdateMetricsRef.current.gpuBufferUpdateMs;
    sceneUpdateMetricsRef.current.meshVertexCount = sceneUpdateMetricsRef.current.gpuVertexCount;
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
      const renderDurationMs = performance.now() - renderStartedAt;
      renderCountRef.current += 1;
      sceneUpdateMetricsRef.current.pixiRenderMs = renderDurationMs;
      publishRenderMetrics(renderDurationMs);
    });
  }

  function publishRenderMetrics(renderDurationMs: number) {
    const history = renderMetricHistoryRef.current;
    const completedAt = performance.now();
    const frameIntervalMs = history.previousCompletedAt === null
      ? null
      : completedAt - history.previousCompletedAt;
    const lastFps = frameIntervalMs === null
      ? null
      : 1000 / Math.max(1, frameIntervalMs);

    history.previousCompletedAt = completedAt;
    pushMetricSample(history.durations, renderDurationMs);

    if (lastFps !== null) {
      pushMetricSample(history.fps, lastFps);
    }
    if (frameIntervalMs !== null) {
      pushMetricSample(history.frameIntervals, frameIntervalMs);
      if (frameIntervalMs > waveformDroppedFrameThresholdMs) {
        sceneUpdateMetricsRef.current.droppedFrameCount += 1;
      }
    }

    const nextMetrics: WaveformRenderMetrics = {
      lastRenderDurationMs: renderDurationMs,
      averageRenderDurationMs: getAverageMetric(history.durations),
      lastFps,
      averageFps: history.fps.length > 0 ? getAverageMetric(history.fps) : null,
      visiblePrimitiveCount: getVisiblePrimitiveCount(sceneRef.current, renderStatsRef.current),
    };

    sceneUpdateMetricsRef.current.frameIntervalP95Ms = getPercentileMetric(history.frameIntervals, 0.95);
    writeHotRenderDataset(nextMetrics);

    if (completedAt - lastReactMetricPublishAtRef.current >= waveformReactMetricPublishIntervalMs) {
      lastReactMetricPublishAtRef.current = completedAt;
      setRenderCount(renderCountRef.current);
      setRenderMetrics(nextMetrics);
      onMetricsChangeRef.current?.(nextMetrics);
    }
  }

  function writeHotRenderDataset(nextMetrics: WaveformRenderMetrics) {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const latestStats = {
      ...renderStatsRef.current,
      ...sceneUpdateMetricsRef.current,
    };

    host.dataset.averageFps = formatOptionalNumber(nextMetrics.averageFps);
    host.dataset.averageRenderMs = formatOptionalNumber(nextMetrics.averageRenderDurationMs);
    host.dataset.displayViewportUpdateCount = String(latestStats.displayViewportUpdateCount);
    host.dataset.droppedFrameCount = String(latestStats.droppedFrameCount);
    host.dataset.frameIntervalP95Ms = latestStats.frameIntervalP95Ms.toFixed(3);
    host.dataset.gpuBufferCapacityVertexCount = String(latestStats.gpuBufferCapacityVertexCount);
    host.dataset.gpuBufferReallocCount = String(latestStats.gpuBufferReallocCount);
    host.dataset.gpuBufferUpdateCount = String(latestStats.gpuBufferUpdateCount);
    host.dataset.gpuBufferUpdateMs = latestStats.gpuBufferUpdateMs.toFixed(3);
    host.dataset.gpuDrawLayerCount = String(latestStats.gpuDrawLayerCount);
    host.dataset.gpuLayerCount = String(latestStats.gpuLayerCount);
    host.dataset.gpuVertexCount = String(latestStats.gpuVertexCount);
    host.dataset.labelTextureUpdateCount = String(latestStats.labelTextureUpdateCount);
    host.dataset.lastFps = formatOptionalNumber(nextMetrics.lastFps);
    host.dataset.lastRenderMs = formatOptionalNumber(nextMetrics.lastRenderDurationMs);
    host.dataset.pixiRenderMs = latestStats.pixiRenderMs.toFixed(3);
    host.dataset.reactViewportCommitCount = String(latestStats.reactViewportCommitCount);
    host.dataset.renderCount = String(renderCountRef.current);
    host.dataset.sceneUpdateMs = latestStats.sceneUpdateMs.toFixed(3);
    host.dataset.visiblePrimitiveCount = String(nextMetrics.visiblePrimitiveCount);
  }

  const zoomLevel = data.duration / getWaveformViewportSpan(viewport);
  const effectiveCanvasWidth = Math.max(waveformCanvasMinWidth, canvasSize.width || waveformCanvasMinWidth);
  const cursorX = timeToX(cursorTime, viewport, effectiveCanvasWidth);
  const cursorVisible = cursorTime >= viewport.startTime && cursorTime <= viewport.endTime;
  const displayRows = getWaveformDisplayRows(data);
  const firstSignalLaneY = getWaveformFirstSignalLaneY(data);
  const selectedSignalLaneY = getWaveformSignalLaneY(data, selectedSignalId);
  const selectedSignalVisibleY = selectedSignalLaneY === null ? null : selectedSignalLaneY - verticalScrollTop;
  const stateCounts = getWaveformStateCounts(data);
  const shapeCounts = getWaveformShapeCounts(data, viewport);
  const emptyVisibleSignalCount = getWaveformEmptyVisibleSignalCount(frame);
  const pulseFillCount = getWaveformDigitalPulseFillCount(data, viewport);
  const rulerIndicatorMetrics = getWaveformRulerScrollIndicatorMetrics(viewport, data.duration, effectiveCanvasWidth);

  return (
    <div
      ref={hostRef}
      aria-label="Waveform canvas"
      className="relative h-full min-h-0 w-full flex-1 cursor-default overflow-hidden bg-[#111111] outline-none"
      data-cursor-time={cursorTime.toFixed(2)}
      data-cursor-visible={String(cursorVisible)}
      data-cursor-x={cursorX.toFixed(2)}
      data-layer-count={waveformLayerNames.length}
      data-layer-names={waveformLayerNames.join(',')}
      data-bus-hexagon-count={shapeCounts.busHexagonCount}
      data-cache-hit-count={renderStats.cacheHitCount}
      data-cache-miss-count={renderStats.cacheMissCount}
      data-cacheable-signal-count={renderStats.cacheableSignalCount}
      data-cached-signal-count={renderStats.cachedSignalCount}
      data-bus-fold-only-count={renderStats.busFoldOnlyCount}
      data-bus-full-hexagon-count={renderStats.busFullHexagonCount}
      data-bus-special-state-hexagon-count={renderStats.busSpecialStateHexagonCount}
      data-bus-special-state-label-count={renderStats.busSpecialStateLabelCount}
      data-bus-special-state-width-aligned-label-count={renderStats.busSpecialStateWidthAlignedLabelCount}
      data-bus-truncated-label-count={renderStats.busTruncatedLabelCount}
      data-bus-label-dot-replacement-count={renderStats.busLabelDotReplacementCount}
      data-bus-vertical-fallback-count={renderStats.busVerticalFallbackCount}
      data-canvas-height={canvasSize.height.toFixed(2)}
      data-canvas-width={canvasSize.width.toFixed(2)}
      data-collapsed-segment-count={renderStats.collapsedSegmentCount}
      data-culled-row-count={renderStats.culledRowCount}
      data-drawn-horizontal-segment-count={renderStats.drawnHorizontalSegmentCount}
      data-drawn-transition-edge-count={renderStats.drawnTransitionEdgeCount}
      data-full-scene-rebuild-count={renderStats.fullSceneRebuildCount}
      data-first-signal-lane-y={formatOptionalNumber(firstSignalLaneY)}
      data-header-background="opaque"
      data-average-fps={formatOptionalNumber(renderMetrics.averageFps)}
      data-average-render-ms={formatOptionalNumber(renderMetrics.averageRenderDurationMs)}
      data-display-viewport-update-count={renderStats.displayViewportUpdateCount}
      data-dropped-frame-count={renderStats.droppedFrameCount}
      data-frame-interval-p95-ms={renderStats.frameIntervalP95Ms.toFixed(3)}
      data-frame-parse-ms={renderStats.frameParseMs.toFixed(3)}
      data-last-fps={formatOptionalNumber(renderMetrics.lastFps)}
      data-last-render-ms={formatOptionalNumber(renderMetrics.lastRenderDurationMs)}
      data-interaction-frame-request-count={interactionFrameRequestCount}
      data-gpu-buffer-capacity-vertex-count={renderStats.gpuBufferCapacityVertexCount}
      data-gpu-buffer-realloc-count={renderStats.gpuBufferReallocCount}
      data-gpu-buffer-update-count={renderStats.gpuBufferUpdateCount}
      data-gpu-buffer-update-ms={renderStats.gpuBufferUpdateMs.toFixed(3)}
      data-gpu-draw-layer-count={renderStats.gpuDrawLayerCount}
      data-gpu-layer-count={renderStats.gpuLayerCount}
      data-gpu-vertex-count={renderStats.gpuVertexCount}
      data-label-pool-size={renderStats.labelPoolSize}
      data-label-texture-update-count={renderStats.labelTextureUpdateCount}
      data-mesh-buffer-update-ms={renderStats.meshBufferUpdateMs.toFixed(3)}
      data-mesh-vertex-count={renderStats.meshVertexCount}
      data-pipe-roundtrip-ms={renderStats.pipeRoundtripMs.toFixed(3)}
      data-pixi-render-ms={renderStats.pixiRenderMs.toFixed(3)}
      data-pulse-fill-count={pulseFillCount}
      data-render-count={renderCount}
      data-react-viewport-commit-count={renderStats.reactViewportCommitCount}
      data-render-resolution={renderStats.renderResolution.toFixed(2)}
      data-pan-buffer-hit-count={renderStats.panBufferHitCount}
      data-pan-buffer-miss-count={renderStats.panBufferMissCount}
      data-pan-pixel-shift-count={renderStats.panPixelShiftCount}
      data-row-attach-count={renderStats.rowAttachCount}
      data-row-content-redraw-count={renderStats.rowContentRedrawCount}
      data-row-content-skip-count={renderStats.rowContentSkipCount}
      data-row-recycle-count={renderStats.rowRecycleCount}
      data-row-reuse-count={renderStats.rowReuseCount}
      data-prepared-range-end={frame?.preparedRange?.endTime.toFixed(2) ?? ''}
      data-prepared-range-hit-count={preparedRangeHitCount}
      data-prepared-range-miss-count={preparedRangeMissCount}
      data-prepared-range-start={frame?.preparedRange?.startTime.toFixed(2) ?? ''}
      data-rendered-label-count={renderStats.renderedLabelCount}
      data-rendered-segment-count={renderStats.renderedSegmentCount}
      data-rendered-signal-count={renderStats.renderedSignalCount}
      data-renderer={renderer}
      data-row-count={displayRows.length}
      data-row-height={waveformLaneHeight}
      data-ruler-scroll-indicator-color={`#${rulerIndicatorMetrics.color.toString(16).padStart(6, '0')}`}
      data-ruler-scroll-indicator-height={rulerIndicatorMetrics.height.toFixed(2)}
      data-ruler-scroll-indicator-left={rulerIndicatorMetrics.left.toFixed(2)}
      data-ruler-scroll-indicator-radius={rulerIndicatorMetrics.cornerRadius.toFixed(2)}
      data-ruler-scroll-indicator-scrollable={String(rulerIndicatorMetrics.scrollable)}
      data-ruler-scroll-indicator-width={rulerIndicatorMetrics.width.toFixed(2)}
      data-selected-signal-lane-y={formatOptionalNumber(selectedSignalLaneY)}
      data-testid="waveform-canvas"
      data-visible-window-end={viewport.endTime.toFixed(2)}
      data-visible-window-start={viewport.startTime.toFixed(2)}
      data-visible-row-count={renderStats.visibleRowCount}
      data-waveform-header-height={waveformHeaderHeight.toFixed(2)}
      data-x-state-count={stateCounts.xStateCount}
      data-source-segment-count={renderStats.sourceSegmentCount}
      data-selected-signal-visible-y={formatOptionalNumber(selectedSignalVisibleY)}
      data-selection-update-count={renderStats.selectionUpdateCount}
      data-scene-update-ms={renderStats.sceneUpdateMs.toFixed(3)}
      data-skipped-horizontal-segment-count={renderStats.skippedHorizontalSegmentCount}
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
      data-waveform-empty-visible-signal-count={emptyVisibleSignalCount}
      data-waveform-frame-protocol-version={frame?.version ?? ''}
      data-waveform-frame-segment-count={frame?.segmentCount ?? 0}
      data-waveform-frame-truncated={String(frame?.truncated ?? false)}
      data-waveform-frame-version={frame?.version ?? ''}
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

function areViewportsEqual(left: WaveformViewport, right: WaveformViewport) {
  return left.startTime === right.startTime && left.endTime === right.endTime;
}

function createEmptyRenderStats(): WaveformRenderStats {
  return {
    visibleRowCount: 0,
    culledRowCount: 0,
    rowAttachCount: 0,
    rowReuseCount: 0,
    rowRecycleCount: 0,
    rowContentRedrawCount: 0,
    rowContentSkipCount: 0,
    panBufferHitCount: 0,
    panBufferMissCount: 0,
    panPixelShiftCount: 0,
    gpuBufferUpdateCount: 0,
    gpuBufferUpdateMs: 0,
    gpuBufferCapacityVertexCount: 0,
    gpuBufferReallocCount: 0,
    gpuDrawLayerCount: 0,
    gpuLayerCount: 0,
    gpuVertexCount: 0,
    labelTextureUpdateCount: 0,
    meshBufferUpdateMs: 0,
    meshVertexCount: 0,
    labelPoolSize: 0,
    renderedSignalCount: 0,
    sourceSegmentCount: 0,
    renderedSegmentCount: 0,
    collapsedSegmentCount: 0,
    drawnHorizontalSegmentCount: 0,
    skippedHorizontalSegmentCount: 0,
    drawnTransitionEdgeCount: 0,
    busFullHexagonCount: 0,
    busFoldOnlyCount: 0,
    busSpecialStateHexagonCount: 0,
    busSpecialStateLabelCount: 0,
    busSpecialStateWidthAlignedLabelCount: 0,
    busTruncatedLabelCount: 0,
    busLabelDotReplacementCount: 0,
    busVerticalFallbackCount: 0,
    renderedLabelCount: 0,
    cacheableSignalCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    cachedSignalCount: 0,
    renderResolution: 1,
    suppressedLabelCount: 0,
    textureCacheBytes: 0,
    textureCacheSize: 0,
    fullSceneRebuildCount: 0,
    viewportContentUpdateCount: 0,
    verticalScrollUpdateCount: 0,
    cursorUpdateCount: 0,
    selectionUpdateCount: 0,
    displayViewportUpdateCount: 0,
    droppedFrameCount: 0,
    frameIntervalP95Ms: 0,
    frameParseMs: 0,
    pipeRoundtripMs: 0,
    pixiRenderMs: 0,
    reactViewportCommitCount: 0,
    sceneUpdateMs: 0,
  };
}

function createEmptySceneUpdateMetrics(): WaveformSceneUpdateMetrics {
  return {
    fullSceneRebuildCount: 0,
    viewportContentUpdateCount: 0,
    verticalScrollUpdateCount: 0,
    selectionUpdateCount: 0,
    cursorUpdateCount: 0,
    rowAttachCount: 0,
    rowReuseCount: 0,
    rowRecycleCount: 0,
    rowContentRedrawCount: 0,
    rowContentSkipCount: 0,
    panBufferHitCount: 0,
    panBufferMissCount: 0,
    panPixelShiftCount: 0,
    gpuBufferUpdateCount: 0,
    gpuBufferUpdateMs: 0,
    gpuBufferCapacityVertexCount: 0,
    gpuBufferReallocCount: 0,
    gpuDrawLayerCount: 0,
    gpuLayerCount: 0,
    gpuVertexCount: 0,
    labelTextureUpdateCount: 0,
    meshBufferUpdateMs: 0,
    meshVertexCount: 0,
    labelPoolSize: 0,
    displayViewportUpdateCount: 0,
    droppedFrameCount: 0,
    frameIntervalP95Ms: 0,
    frameParseMs: 0,
    pipeRoundtripMs: 0,
    pixiRenderMs: 0,
    reactViewportCommitCount: 0,
    sceneUpdateMs: 0,
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
    + renderStats.busFullHexagonCount
    + renderStats.busFoldOnlyCount
    + renderStats.busVerticalFallbackCount
    + scene.shapeCounts.xStateBlockCount
    + scene.shapeCounts.zStateBlockCount
    + scene.digitalPulseFillCount;
}

function getWaveformEmptyVisibleSignalCount(frame: ParsedWaveformFrame | null | undefined) {
  if (!frame) {
    return 0;
  }

  let emptySignalCount = 0;

  for (let tableEntryIndex = 0; tableEntryIndex < frame.signalCount; tableEntryIndex += 1) {
    const segmentCount = frame.signalTable[tableEntryIndex * waveformBinaryFrameSignalTableStride + 2] ?? 0;
    if (segmentCount === 0) {
      emptySignalCount += 1;
    }
  }

  return emptySignalCount;
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

function getPercentileMetric(samples: number[], percentile: number) {
  if (samples.length === 0) {
    return 0;
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentile) - 1));

  return sorted[index] ?? 0;
}

function destroyCachedTexture(entry: WaveformSignalTextureCacheEntry) {
  if (!entry.texture.destroyed) {
    entry.texture.destroy(true);
  }
}
