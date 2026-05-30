import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';

import { createWaveformScene, waveformLayerNames, type WaveformScene } from './createWaveformScene';
import {
  clampTime,
  getWaveformCanvasHeightForData,
  getWaveformDigitalPulseFillCount,
  getWaveformDisplayRows,
  getWaveformFirstSignalLaneY,
  getWaveformSignalLaneY,
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
import type { WaveformDataSet, WaveformRendererStatus, WaveformViewport } from './waveformTypes';

type PixiRendererPreference = 'webgpu' | 'webgl';

interface WaveformCanvasProps {
  cursorTime: number;
  data: WaveformDataSet;
  selectedSignalId: string | null;
  viewport: WaveformViewport;
  onCursorTimeChange: (time: number) => void;
  onRendererChange?: (renderer: WaveformRendererStatus) => void;
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

export function WaveformCanvas({
  cursorTime,
  data,
  selectedSignalId,
  viewport,
  onCursorTimeChange,
  onRendererChange,
  onViewportChange,
}: WaveformCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<WaveformScene | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dataRef = useRef(data);
  const viewportRef = useRef(viewport);
  const cursorTimeRef = useRef(cursorTime);
  const selectedSignalIdRef = useRef(selectedSignalId);
  const onCursorTimeChangeRef = useRef(onCursorTimeChange);
  const onViewportChangeRef = useRef(onViewportChange);
  const [renderer, setRenderer] = useState<WaveformRendererStatus>('initializing');
  const [renderCount, setRenderCount] = useState(0);

  dataRef.current = data;
  viewportRef.current = viewport;
  cursorTimeRef.current = cursorTime;
  selectedSignalIdRef.current = selectedSignalId;
  onCursorTimeChangeRef.current = onCursorTimeChange;
  onViewportChangeRef.current = onViewportChange;

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
        resizeAndDraw();

        resizeObserver = new ResizeObserver(() => {
          resizeAndDraw();
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

      sceneRef.current?.world.destroy({ children: true });
      sceneRef.current = null;
      appRef.current = null;
      activeApp?.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
    };
  }, [onRendererChange]);

  useEffect(() => {
    resizeAndDraw();
  }, [cursorTime, data, selectedSignalId, viewport]);

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

      event.preventDefault();

      if (event.ctrlKey || event.metaKey || event.altKey) {
        const centerTime = clampTime(getPointerTime(event.clientX), currentData.duration);
        const zoomFactor = event.deltaY > 0 ? 1 / zoomWheelFactor : zoomWheelFactor;
        onViewportChangeRef.current(zoomWaveformViewport(currentViewport, centerTime, zoomFactor, currentData.duration));
        return;
      }

      const deltaPixels = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const deltaTime = deltaPixels * getWaveformViewportSpan(currentViewport) / Math.max(1, width);
      onViewportChangeRef.current(panWaveformViewport(currentViewport, deltaTime, currentData.duration));
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

  function resizeAndDraw() {
    const app = appRef.current;
    const host = hostRef.current;

    if (!app || !host) {
      return;
    }

    const width = Math.max(waveformCanvasMinWidth, Math.floor(host.clientWidth));
    const height = Math.max(waveformCanvasMinHeight, getWaveformCanvasHeightForData(dataRef.current), Math.floor(host.clientHeight));

    app.renderer.resize(width, height);
    sceneRef.current?.world.destroy({ children: true });
    sceneRef.current = createWaveformScene({
      cursorTime: cursorTimeRef.current,
      data: dataRef.current,
      height,
      selectedSignalId: selectedSignalIdRef.current,
      viewport: viewportRef.current,
      width,
    });
    app.stage.removeChildren();
    app.stage.addChild(sceneRef.current.world);
    requestRender();
  }

  function requestRender() {
    const app = appRef.current;

    if (!app || renderFrameRef.current !== null) {
      return;
    }

    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      app.render();
      setRenderCount((currentRenderCount) => currentRenderCount + 1);
    });
  }

  const zoomLevel = data.duration / getWaveformViewportSpan(viewport);
  const cursorX = timeToX(cursorTime, viewport, waveformCanvasMinWidth);
  const displayRows = getWaveformDisplayRows(data);
  const firstSignalLaneY = getWaveformFirstSignalLaneY(data);
  const selectedSignalLaneY = getWaveformSignalLaneY(data, selectedSignalId);
  const stateCounts = getWaveformStateCounts(data);
  const pulseFillCount = getWaveformDigitalPulseFillCount(data, viewport);

  return (
    <div
      ref={hostRef}
      aria-label="Waveform canvas"
      className="relative h-full min-h-0 flex-1 cursor-crosshair overflow-hidden bg-[#111111] outline-none"
      data-cursor-time={cursorTime.toFixed(2)}
      data-cursor-x={cursorX.toFixed(2)}
      data-layer-count={waveformLayerNames.length}
      data-layer-names={waveformLayerNames.join(',')}
      data-first-signal-lane-y={formatOptionalNumber(firstSignalLaneY)}
      data-pulse-fill-count={pulseFillCount}
      data-render-count={renderCount}
      data-renderer={renderer}
      data-row-count={displayRows.length}
      data-row-height={waveformLaneHeight}
      data-selected-signal-lane-y={formatOptionalNumber(selectedSignalLaneY)}
      data-testid="waveform-canvas"
      data-visible-window-end={viewport.endTime.toFixed(2)}
      data-visible-window-start={viewport.startTime.toFixed(2)}
      data-x-state-count={stateCounts.xStateCount}
      data-z-state-count={stateCounts.zStateCount}
      data-zoom={zoomLevel.toFixed(2)}
      role="img"
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
