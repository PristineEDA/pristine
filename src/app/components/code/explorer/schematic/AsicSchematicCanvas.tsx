import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Application, Container } from 'pixi.js';

import { readAsicSchematicPalette } from './asicSchematicPalette';
import { createAsicSchematicScene } from './createAsicSchematicScene';
import type { SchematicLayoutBounds, SchematicLayoutResult } from './asicSchematicTypes';

type PixiRendererPreference = 'webgpu' | 'webgl';
type PixiRendererStatus = PixiRendererPreference | 'error' | 'initializing';

interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface AsicSchematicCanvasHandle {
  fitToView: () => void;
  resetView: () => void;
}

interface AsicSchematicCanvasProps {
  layout: SchematicLayoutResult;
  selectedNodeId: string | null;
  themeKey: string;
  onCameraChange?: (camera: CameraState) => void;
  onModuleOpen?: (moduleId: string) => void;
  onNodeSelect?: (nodeId: string | null) => void;
  onRendererChange?: (renderer: PixiRendererStatus) => void;
}

const minZoom = 0.28;
const maxZoom = 2.4;
const defaultCamera: CameraState = { x: 24, y: 24, zoom: 1 };

export const AsicSchematicCanvas = forwardRef<AsicSchematicCanvasHandle, AsicSchematicCanvasProps>(function AsicSchematicCanvas({
  layout,
  selectedNodeId,
  themeKey,
  onCameraChange,
  onModuleOpen,
  onNodeSelect,
  onRendererChange,
}, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const interactionCleanupRef = useRef<(() => void) | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const renderCountRef = useRef(0);
  const initializedRef = useRef(false);
  const cameraRef = useRef<CameraState>(defaultCamera);
  const [renderer, setRenderer] = useState<PixiRendererStatus>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState(defaultCamera);
  const [tickerActive, setTickerActive] = useState(false);

  const moduleKey = useMemo(() => `${layout.module.id}:${layout.nodes.length}:${layout.edges.length}`, [layout]);

  useImperativeHandle(ref, () => ({
    fitToView,
    resetView: () => setCameraState(defaultCamera),
  }));

  useEffect(() => {
    const host = hostRef.current;

    if (!host || initializedRef.current) {
      return undefined;
    }

    let cancelled = false;
    const hostElement = host;
    initializedRef.current = true;

    async function initialize() {
      try {
        const result = await createPixiApp(hostElement);

        if (cancelled) {
          result.app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
          return;
        }

        appRef.current = result.app;
        setRenderer(result.renderer);
        setTickerActive(result.app.ticker.started);
        onRendererChange?.(result.renderer);
        setError(null);
        interactionCleanupRef.current = installCanvasInteractions(result.app);
        drawCurrentScene();
        fitToView();
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : 'Unable to initialize Pixi renderer.';
        setRenderer('error');
        onRendererChange?.('error');
        setError(message);
      }
    }

    void initialize();

    const resizeObserver = new ResizeObserver(() => {
      resizeAppToHost();
      drawCurrentScene();
      applyCamera();
    });
    resizeObserver.observe(hostElement);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      interactionCleanupRef.current?.();
      interactionCleanupRef.current = null;
      cancelQueuedRender();
      appRef.current?.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
      appRef.current = null;
      worldRef.current = null;
    };
  }, []);

  useEffect(() => {
    onRendererChange?.(renderer);
  }, [onRendererChange, renderer]);

  useEffect(() => {
    drawCurrentScene();
    applyCamera();
  }, [moduleKey, selectedNodeId, themeKey]);

  useEffect(() => {
    fitToView();
  }, [moduleKey]);

  function drawCurrentScene() {
    const app = appRef.current;

    if (!app) {
      return;
    }

    const previousWorld = worldRef.current;
    if (previousWorld) {
      app.stage.removeChild(previousWorld);
      previousWorld.destroy({ children: true });
    }

    const world = createAsicSchematicScene({
      layout,
      palette: readAsicSchematicPalette(),
      selectedNodeId,
      onModuleOpen,
      onNodeSelect,
    });
    worldRef.current = world;
    app.stage.addChild(world);
    requestRender();
  }

  function installCanvasInteractions(app: Application) {
    const canvas = app.canvas;
    let dragging = false;
    let dragStart = { x: 0, y: 0 };
    let cameraStart = { x: 0, y: 0 };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const current = cameraRef.current;
      const nextZoom = clamp(current.zoom * (event.deltaY > 0 ? 0.9 : 1.1), minZoom, maxZoom);
      const worldX = (pointerX - current.x) / current.zoom;
      const worldY = (pointerY - current.y) / current.zoom;

      setCameraState({
        zoom: nextZoom,
        x: pointerX - worldX * nextZoom,
        y: pointerY - worldY * nextZoom,
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      dragging = true;
      dragStart = { x: event.clientX, y: event.clientY };
      cameraStart = { x: cameraRef.current.x, y: cameraRef.current.y };
      canvas.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }

      setCameraState({
        ...cameraRef.current,
        x: cameraStart.x + event.clientX - dragStart.x,
        y: cameraStart.y + event.clientY - dragStart.y,
      });
    };

    const stopDragging = (event: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', stopDragging);
    canvas.addEventListener('pointercancel', stopDragging);
    canvas.dataset.schematicCanvas = 'true';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', stopDragging);
      canvas.removeEventListener('pointercancel', stopDragging);
    };
  }

  function fitToView() {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const rect = host.getBoundingClientRect();
    setCameraState(getFitCamera(layout.bounds, rect.width, rect.height));
  }

  function resizeAppToHost() {
    const app = appRef.current;
    const host = hostRef.current;

    if (!app || !host) {
      return;
    }

    app.renderer.resize(Math.max(320, Math.floor(host.clientWidth)), Math.max(220, Math.floor(host.clientHeight)));
  }

  function setCameraState(nextCamera: CameraState) {
    const normalizedCamera = {
      x: Math.round(nextCamera.x * 100) / 100,
      y: Math.round(nextCamera.y * 100) / 100,
      zoom: Math.round(clamp(nextCamera.zoom, minZoom, maxZoom) * 1000) / 1000,
    };

    cameraRef.current = normalizedCamera;
    setCamera(normalizedCamera);
    onCameraChange?.(normalizedCamera);
    applyCamera();
  }

  function applyCamera() {
    const world = worldRef.current;
    if (!world) {
      return;
    }

    const nextCamera = cameraRef.current;
    world.position.set(nextCamera.x, nextCamera.y);
    world.scale.set(nextCamera.zoom);
    requestRender();
  }

  function requestRender() {
    if (renderFrameRef.current !== null) {
      return;
    }

    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      const app = appRef.current;
      if (!app) {
        return;
      }

      app.render();
      renderCountRef.current += 1;
      hostRef.current?.setAttribute('data-render-count', String(renderCountRef.current));
    });
  }

  function cancelQueuedRender() {
    if (renderFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(renderFrameRef.current);
    renderFrameRef.current = null;
  }

  return (
    <div
      ref={hostRef}
      data-testid="asic-schematic-canvas"
      data-renderer={renderer}
      data-error={error ?? undefined}
      data-zoom={camera.zoom.toFixed(3)}
      data-pan-x={camera.x.toFixed(1)}
      data-pan-y={camera.y.toFixed(1)}
      data-ticker-active={tickerActive ? 'true' : 'false'}
      data-render-count={renderCountRef.current}
      className="relative min-h-0 flex-1 overflow-hidden bg-ide-bg"
    >
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[12px] text-ide-text-muted">
          {error}
        </div>
      ) : null}
    </div>
  );
});

async function createPixiApp(host: HTMLElement) {
  const width = Math.max(320, Math.floor(host.clientWidth));
  const height = Math.max(220, Math.floor(host.clientHeight));
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

  throw lastError instanceof Error ? lastError : new Error('Unable to initialize WebGPU or WebGL renderer.');
}

function getFitCamera(bounds: SchematicLayoutBounds, viewportWidth: number, viewportHeight: number): CameraState {
  const padding = 48;
  const zoom = clamp(Math.min((viewportWidth - padding * 2) / bounds.width, (viewportHeight - padding * 2) / bounds.height), minZoom, 1.35);

  return {
    zoom,
    x: viewportWidth / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: viewportHeight / 2 - (bounds.y + bounds.height / 2) * zoom,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
