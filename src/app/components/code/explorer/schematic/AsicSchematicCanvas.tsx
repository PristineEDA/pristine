import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Application, Container } from 'pixi.js';

import { readAsicSchematicPalette } from './asicSchematicPalette';
import { createAsicSchematicScene } from './createAsicSchematicScene';
import type { SchematicLayoutBounds, SchematicLayoutResult, SchematicNodeLayout, SchematicPoint } from './asicSchematicTypes';

type PixiRendererPreference = 'webgpu' | 'webgl';
type PixiRendererStatus = PixiRendererPreference | 'error' | 'initializing';

interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

interface ScreenPoint {
  x: number;
  y: number;
}

type DragState =
  | {
    mode: 'pan';
    pointerId: number;
    startClient: ScreenPoint;
    cameraStart: Pick<CameraState, 'x' | 'y'>;
  }
  | {
    mode: 'node';
    pointerId: number;
    nodeId: string;
    startClient: ScreenPoint;
    nodeStart: ScreenPoint;
    currentPosition: ScreenPoint;
    moved: boolean;
  };

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
  onNodePositionChange?: (nodeId: string, position: SchematicPoint) => void;
  onRendererChange?: (renderer: PixiRendererStatus) => void;
}

const minZoom = 0.28;
const maxZoom = 2.4;
const dragThreshold = 4;
const wheelLinePixels = 40;
const defaultCamera: CameraState = { x: 24, y: 24, zoom: 1 };

export const AsicSchematicCanvas = forwardRef<AsicSchematicCanvasHandle, AsicSchematicCanvasProps>(function AsicSchematicCanvas({
  layout,
  selectedNodeId,
  themeKey,
  onCameraChange,
  onModuleOpen,
  onNodeSelect,
  onNodePositionChange,
  onRendererChange,
}, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const nodeContainersRef = useRef<Map<string, Container>>(new Map());
  const interactionCleanupRef = useRef<(() => void) | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const renderCountRef = useRef(0);
  const initializedRef = useRef(false);
  const layoutRef = useRef(layout);
  const onNodePositionChangeRef = useRef(onNodePositionChange);
  const cameraRef = useRef<CameraState>(defaultCamera);
  const [renderer, setRenderer] = useState<PixiRendererStatus>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState(defaultCamera);
  const [tickerActive, setTickerActive] = useState(false);

  layoutRef.current = layout;
  onNodePositionChangeRef.current = onNodePositionChange;

  const moduleId = layout.module.id;
  const firstDraggableNode = useMemo(() => layout.nodes.find((node) => node.kind === 'module') ?? null, [layout]);

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
  }, [layout, selectedNodeId, themeKey]);

  useEffect(() => {
    fitToView();
  }, [moduleId]);

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

    nodeContainersRef.current.clear();
    const world = createAsicSchematicScene({
      layout,
      palette: readAsicSchematicPalette(),
      selectedNodeId,
      onNodeContainerCreated: (node, container) => {
        if (node.kind === 'module') {
          nodeContainersRef.current.set(node.id, container);
        }
      },
      onModuleOpen,
      onNodeSelect,
    });
    worldRef.current = world;
    app.stage.addChild(world);
    requestRender();
  }

  function installCanvasInteractions(app: Application) {
    const canvas = app.canvas;
    let dragState: DragState | null = null;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = getNormalizedWheelDelta(event, canvas);
      const current = cameraRef.current;

      if (event.ctrlKey || event.metaKey) {
        const pointer = getCanvasPoint(event, canvas);
        const nextZoom = clamp(current.zoom * (delta.y > 0 ? 0.9 : 1.1), minZoom, maxZoom);
        const worldX = (pointer.x - current.x) / current.zoom;
        const worldY = (pointer.y - current.y) / current.zoom;

        setCameraState({
          zoom: nextZoom,
          x: pointer.x - worldX * nextZoom,
          y: pointer.y - worldY * nextZoom,
        });
        return;
      }

      if (event.shiftKey) {
        const horizontalDelta = delta.x !== 0 ? delta.x : delta.y;
        setCameraState({
          ...current,
          x: current.x - horizontalDelta,
        });
        return;
      }

      setCameraState({
        ...current,
        y: current.y - delta.y,
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      const clientPoint = { x: event.clientX, y: event.clientY };
      const node = findDraggableNodeAt(clientPoint, canvas);

      if (node) {
        dragState = {
          mode: 'node',
          pointerId: event.pointerId,
          nodeId: node.id,
          startClient: clientPoint,
          nodeStart: { x: node.x, y: node.y },
          currentPosition: { x: node.x, y: node.y },
          moved: false,
        };
        canvas.style.cursor = 'grabbing';
      } else {
        dragState = {
          mode: 'pan',
          pointerId: event.pointerId,
          startClient: clientPoint,
          cameraStart: { x: cameraRef.current.x, y: cameraRef.current.y },
        };
      }

      canvas.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const delta = {
        x: event.clientX - dragState.startClient.x,
        y: event.clientY - dragState.startClient.y,
      };

      if (dragState.mode === 'node') {
        const moved = dragState.moved || Math.hypot(delta.x, delta.y) >= dragThreshold;

        if (!moved) {
          return;
        }

        const nextPosition = {
          x: roundLayoutCoordinate(dragState.nodeStart.x + delta.x / cameraRef.current.zoom),
          y: roundLayoutCoordinate(dragState.nodeStart.y + delta.y / cameraRef.current.zoom),
        };
        const container = nodeContainersRef.current.get(dragState.nodeId);

        dragState = {
          ...dragState,
          moved: true,
          currentPosition: nextPosition,
        };
        container?.position.set(nextPosition.x, nextPosition.y);
        setActiveDragDataAttributes(dragState.nodeId, nextPosition);
        requestRender();
        return;
      }

      setCameraState({
        ...cameraRef.current,
        x: dragState.cameraStart.x + delta.x,
        y: dragState.cameraStart.y + delta.y,
      });
    };

    const stopDragging = (event: PointerEvent) => {
      if (dragState?.mode === 'node') {
        if (dragState.moved) {
          onNodePositionChangeRef.current?.(dragState.nodeId, dragState.currentPosition);
          setLastDragDataAttributes(dragState.nodeId, dragState.currentPosition);
        }
        clearActiveDragDataAttributes();
        canvas.style.cursor = '';
      }

      dragState = null;
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

  function findDraggableNodeAt(clientPoint: ScreenPoint, canvas: HTMLCanvasElement): SchematicNodeLayout | null {
    const canvasRect = canvas.getBoundingClientRect();
    const worldPoint = screenToWorld({
      x: clientPoint.x - canvasRect.left,
      y: clientPoint.y - canvasRect.top,
    }, cameraRef.current);
    const nodes = layoutRef.current.nodes;

    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index];

      if (!node) {
        continue;
      }

      if (node.kind !== 'module') {
        continue;
      }

      if (
        worldPoint.x >= node.x
        && worldPoint.x <= node.x + node.width
        && worldPoint.y >= node.y
        && worldPoint.y <= node.y + node.height
      ) {
        return node;
      }
    }

    return null;
  }

  function setActiveDragDataAttributes(nodeId: string, position: ScreenPoint) {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    host.setAttribute('data-active-drag-node-id', nodeId);
    host.setAttribute('data-active-drag-node-x', position.x.toFixed(1));
    host.setAttribute('data-active-drag-node-y', position.y.toFixed(1));
  }

  function setLastDragDataAttributes(nodeId: string, position: ScreenPoint) {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    host.setAttribute('data-last-drag-node-id', nodeId);
    host.setAttribute('data-last-drag-node-x', position.x.toFixed(1));
    host.setAttribute('data-last-drag-node-y', position.y.toFixed(1));
  }

  function clearActiveDragDataAttributes() {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    host.removeAttribute('data-active-drag-node-id');
    host.removeAttribute('data-active-drag-node-x');
    host.removeAttribute('data-active-drag-node-y');
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
      data-first-module-id={firstDraggableNode?.id}
      data-first-module-center-x={firstDraggableNode ? (firstDraggableNode.x + firstDraggableNode.width / 2).toFixed(1) : undefined}
      data-first-module-center-y={firstDraggableNode ? (firstDraggableNode.y + firstDraggableNode.height / 2).toFixed(1) : undefined}
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

function getCanvasPoint(point: { clientX: number; clientY: number }, canvas: HTMLCanvasElement): ScreenPoint {
  const rect = canvas.getBoundingClientRect();

  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top,
  };
}

function screenToWorld(point: ScreenPoint, camera: CameraState): ScreenPoint {
  return {
    x: (point.x - camera.x) / camera.zoom,
    y: (point.y - camera.y) / camera.zoom,
  };
}

function getNormalizedWheelDelta(event: WheelEvent, canvas: HTMLCanvasElement): ScreenPoint {
  const rect = canvas.getBoundingClientRect();
  const multiplier = event.deltaMode === 1
    ? wheelLinePixels
    : event.deltaMode === 2
      ? Math.max(rect.width, rect.height)
      : 1;

  return {
    x: event.deltaX * multiplier,
    y: event.deltaY * multiplier,
  };
}

function roundLayoutCoordinate(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
