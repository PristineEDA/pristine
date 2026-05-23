import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Application } from 'pixi.js';

import { readAsicSchematicPalette } from './asicSchematicPalette';
import { createAsicSchematicScene, type AsicSchematicScene, type SchematicTextZoomState, type SchematicWorldRect } from './createAsicSchematicScene';
import { resolveSchematicNodeOverlaps, schematicGridSize, snapSchematicNodePositions, type SchematicNodePositionOverrides } from './asicSchematicLayout';
import type { SchematicEdgeLayout, SchematicLayoutBounds, SchematicLayoutResult, SchematicNodeLayout, SchematicPoint } from './asicSchematicTypes';

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
    mode: 'marquee';
    pointerId: number;
    startClient: ScreenPoint;
    additive: boolean;
    moved: boolean;
    currentRect: SchematicWorldRect | null;
  }
  | {
    mode: 'node';
    pointerId: number;
    nodeIds: string[];
    startClient: ScreenPoint;
    nodeStarts: SchematicNodePositionOverrides;
    currentPositions: SchematicNodePositionOverrides;
    additive: boolean;
    moved: boolean;
  }
  | {
    mode: 'edge';
    pointerId: number;
    edgeId: string;
    startClient: ScreenPoint;
    additive: boolean;
    moved: boolean;
  };

export interface AsicSchematicCanvasHandle {
  fitToView: () => void;
  resetView: () => void;
}

interface AsicSchematicCanvasProps {
  layout: SchematicLayoutResult;
  selectedNodeIds: readonly string[];
  selectedEdgeIds: readonly string[];
  themeKey: string;
  onCameraChange?: (camera: CameraState) => void;
  onModuleOpen?: (moduleId: string) => void;
  onNodeSelectionChange?: (nodeIds: string[]) => void;
  onEdgeSelectionChange?: (edgeIds: string[]) => void;
  onNodePositionsChange?: (positions: SchematicNodePositionOverrides, selectedNodeIds: readonly string[]) => void;
  onRendererChange?: (renderer: PixiRendererStatus) => void;
}

const minZoom = 0.28;
const maxZoom = 2.4;
const dragThreshold = 4;
const wheelLinePixels = 40;
const defaultCamera: CameraState = { x: 24, y: 24, zoom: 1 };

export const AsicSchematicCanvas = forwardRef<AsicSchematicCanvasHandle, AsicSchematicCanvasProps>(function AsicSchematicCanvas({
  layout,
  selectedNodeIds,
  selectedEdgeIds,
  themeKey,
  onCameraChange,
  onModuleOpen,
  onNodeSelectionChange,
  onEdgeSelectionChange,
  onNodePositionsChange,
  onRendererChange,
}, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<AsicSchematicScene | null>(null);
  const interactionCleanupRef = useRef<(() => void) | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const renderCountRef = useRef(0);
  const initializedRef = useRef(false);
  const layoutRef = useRef(layout);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const selectedEdgeIdsRef = useRef(selectedEdgeIds);
  const onModuleOpenRef = useRef(onModuleOpen);
  const onNodeSelectionChangeRef = useRef(onNodeSelectionChange);
  const onEdgeSelectionChangeRef = useRef(onEdgeSelectionChange);
  const onNodePositionsChangeRef = useRef(onNodePositionsChange);
  const cameraRef = useRef<CameraState>(defaultCamera);
  const [renderer, setRenderer] = useState<PixiRendererStatus>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState(defaultCamera);
  const [textZoom, setTextZoom] = useState<SchematicTextZoomState>({ labelScale: 1, textResolution: 2 });
  const [tickerActive, setTickerActive] = useState(false);
  const [layerNames, setLayerNames] = useState<string[]>([]);

  layoutRef.current = layout;
  selectedNodeIdsRef.current = selectedNodeIds;
  selectedEdgeIdsRef.current = selectedEdgeIds;
  onModuleOpenRef.current = onModuleOpen;
  onNodeSelectionChangeRef.current = onNodeSelectionChange;
  onEdgeSelectionChangeRef.current = onEdgeSelectionChange;
  onNodePositionsChangeRef.current = onNodePositionsChange;

  const moduleId = layout.module.id;
  const moduleNodes = useMemo(() => layout.nodes.filter((node) => node.kind === 'module'), [layout]);
  const firstDraggableNode = moduleNodes[0] ?? null;
  const secondDraggableNode = moduleNodes[1] ?? null;
  const firstDrillableNode = useMemo(() => moduleNodes.find((node) => node.canDrillDown && node.moduleId) ?? null, [moduleNodes]);
  const moduleNodeSnapshot = useMemo(() => JSON.stringify(moduleNodes.map((node) => ({
    id: node.id,
    x: roundLayoutCoordinate(node.x),
    y: roundLayoutCoordinate(node.y),
    width: roundLayoutCoordinate(node.width),
    height: roundLayoutCoordinate(node.height),
    centerX: roundLayoutCoordinate(node.x + node.width / 2),
    centerY: roundLayoutCoordinate(node.y + node.height / 2),
    canDrillDown: node.canDrillDown,
  }))), [moduleNodes]);
  const firstSelectableEdge = useMemo(() => layout.edges.find((edge) => edge.points.length > 1) ?? null, [layout.edges]);
  const firstSignalEdge = useMemo(() => layout.edges.find((edge) => !edge.isBus && edge.points.length > 1) ?? null, [layout.edges]);
  const firstBusEdge = useMemo(() => layout.edges.find((edge) => edge.isBus && edge.points.length > 1) ?? null, [layout.edges]);
  const firstSelectableEdgePoint = firstSelectableEdge ? getEdgeHitPoint(firstSelectableEdge) : null;
  const firstSignalEdgePoint = firstSignalEdge ? getEdgeHitPoint(firstSignalEdge) : null;
  const firstBusEdgePoint = firstBusEdge ? getEdgeHitPoint(firstBusEdge) : null;
  const edgeRouteSnapshot = useMemo(() => JSON.stringify(layout.edges.map((edge) => ({
    id: edge.id,
    isBus: edge.isBus,
    signalWidth: edge.signalWidth,
    style: edge.isBus ? 'bus' : 'signal',
    fromNodeId: edge.from.instanceId ?? `io:${edge.from.portId}`,
    toNodeId: edge.to.instanceId ?? `io:${edge.to.portId}`,
    points: edge.points.map((point) => ({ x: roundLayoutCoordinate(point.x), y: roundLayoutCoordinate(point.y) })),
  }))), [layout.edges]);
  const selectedNodeIdsKey = selectedNodeIds.join(',');
  const selectedEdgeIdsKey = selectedEdgeIds.join(',');

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
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    onRendererChange?.(renderer);
  }, [onRendererChange, renderer]);

  useEffect(() => {
    drawCurrentScene();
    applyCamera();
  }, [layout, themeKey]);

  useEffect(() => {
    sceneRef.current?.updateSelection(selectedNodeIds);
    requestRender();
  }, [selectedNodeIdsKey]);

  useEffect(() => {
    sceneRef.current?.updateEdgeSelection(selectedEdgeIds);
    requestRender();
  }, [selectedEdgeIdsKey]);

  useEffect(() => {
    fitToView();
  }, [moduleId]);

  function drawCurrentScene() {
    const app = appRef.current;

    if (!app) {
      return;
    }

    const previousScene = sceneRef.current;
    if (previousScene) {
      app.stage.removeChild(previousScene.world);
      previousScene.world.destroy({ children: true });
    }

    const scene = createAsicSchematicScene({
      layout,
      palette: readAsicSchematicPalette(),
      selectedNodeIds,
      selectedEdgeIds,
      onModuleOpen,
    });
    sceneRef.current = scene;
    setLayerNames(Object.keys(scene.layers));
    app.stage.addChild(scene.world);
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
        const selectedSet = new Set(selectedNodeIdsRef.current);
        const additive = event.ctrlKey || event.metaKey;
        const isSelectedNode = selectedSet.has(node.id);
        const nodeIds = selectedSet.has(node.id)
          ? selectedNodeIdsRef.current.filter((nodeId) => getModuleNodeById(nodeId))
          : [node.id];

        if (!isSelectedNode && !additive) {
          commitSelection([node.id]);
        }

        dragState = {
          mode: 'node',
          pointerId: event.pointerId,
          nodeIds,
          startClient: clientPoint,
          nodeStarts: getNodeStartPositions(nodeIds),
          currentPositions: getNodeStartPositions(nodeIds),
          additive,
          moved: false,
        };
        canvas.style.cursor = 'grabbing';
      } else {
        const edge = findSelectableEdgeAt(clientPoint, canvas);

        if (edge) {
          dragState = {
            mode: 'edge',
            pointerId: event.pointerId,
            edgeId: edge.id,
            startClient: clientPoint,
            additive: event.ctrlKey || event.metaKey,
            moved: false,
          };
          canvas.style.cursor = 'pointer';
        } else {
          dragState = {
            mode: 'marquee',
            pointerId: event.pointerId,
            startClient: clientPoint,
            additive: event.ctrlKey || event.metaKey,
            moved: false,
            currentRect: null,
          };
          hostRef.current?.setAttribute('data-marquee-active', 'true');
        }
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

        const nextPositions = resolveSchematicNodeOverlaps(
          layoutRef.current,
          getDraggedNodePositions(dragState.nodeStarts, delta),
          { selectedNodeIds: dragState.nodeIds, snapToGrid: true, gridSize: schematicGridSize },
        );

        dragState = {
          ...dragState,
          moved: true,
          currentPositions: nextPositions,
        };

        Object.entries(nextPositions).forEach(([nodeId, position]) => {
          if (!position) {
            return;
          }

          sceneRef.current?.nodeContainers.get(nodeId)?.position.set(position.x, position.y);
        });
        sceneRef.current?.updateSelection(dragState.nodeIds, nextPositions);
        setActiveDragDataAttributes(dragState.nodeIds, nextPositions);
        requestRender();
        return;
      }

      if (dragState.mode === 'edge') {
        const moved = dragState.moved || Math.hypot(delta.x, delta.y) >= dragThreshold;

        if (moved) {
          const rect = getWorldRectFromClientPoints(dragState.startClient, { x: event.clientX, y: event.clientY }, canvas);

          dragState = {
            mode: 'marquee',
            pointerId: dragState.pointerId,
            startClient: dragState.startClient,
            additive: dragState.additive,
            moved: true,
            currentRect: rect,
          };
          hostRef.current?.setAttribute('data-marquee-active', 'true');
          sceneRef.current?.updateMarquee(rect);
          requestRender();
        }

        return;
      }

      const moved = dragState.moved || Math.hypot(delta.x, delta.y) >= dragThreshold;

      if (!moved) {
        return;
      }

      const rect = getWorldRectFromClientPoints(dragState.startClient, { x: event.clientX, y: event.clientY }, canvas);

      dragState = {
        ...dragState,
        moved: true,
        currentRect: rect,
      };
      sceneRef.current?.updateMarquee(rect);
      requestRender();
    };

    const stopDragging = (event: PointerEvent) => {
      if (dragState?.mode === 'node') {
        if (dragState.moved) {
          onNodePositionsChangeRef.current?.(dragState.currentPositions, dragState.nodeIds);
          setLastDragDataAttributes(dragState.nodeIds, dragState.currentPositions);
        } else {
          applyClickSelection(dragState.nodeIds[0] ?? null, dragState.additive);
        }
        clearActiveDragDataAttributes();
        canvas.style.cursor = '';
      }

      if (dragState?.mode === 'edge') {
        if (!dragState.moved) {
          commitEdgeSelection([dragState.edgeId]);
        }

        canvas.style.cursor = '';
      }

      if (dragState?.mode === 'marquee') {
        if (dragState.moved && dragState.currentRect) {
          applyMarqueeSelection(dragState.currentRect, dragState.additive);
        } else if (!dragState.additive) {
          commitSelection([]);
          commitEdgeSelection([]);
        }

        sceneRef.current?.updateMarquee(null);
        hostRef.current?.setAttribute('data-marquee-active', 'false');
      }

      dragState = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    const handleDoubleClick = (event: MouseEvent) => {
      const node = findDraggableNodeAt({ x: event.clientX, y: event.clientY }, canvas);

      if (!node?.canDrillDown || !node.moduleId) {
        return;
      }

      event.preventDefault();
      onModuleOpenRef.current?.(node.moduleId);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', stopDragging);
    canvas.addEventListener('pointercancel', stopDragging);
    canvas.addEventListener('dblclick', handleDoubleClick);
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
      canvas.removeEventListener('dblclick', handleDoubleClick);
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

  function findSelectableEdgeAt(clientPoint: ScreenPoint, canvas: HTMLCanvasElement): SchematicEdgeLayout | null {
    const canvasRect = canvas.getBoundingClientRect();
    const worldPoint = screenToWorld({
      x: clientPoint.x - canvasRect.left,
      y: clientPoint.y - canvasRect.top,
    }, cameraRef.current);
    const hitTolerance = Math.max(4, 8 / cameraRef.current.zoom);
    const edges = layoutRef.current.edges;

    for (let index = edges.length - 1; index >= 0; index -= 1) {
      const edge = edges[index];

      if (!edge || edge.points.length < 2) {
        continue;
      }

      if (getDistanceToPolyline(worldPoint, edge.points) <= hitTolerance) {
        return edge;
      }
    }

    return null;
  }

  function getModuleNodeById(nodeId: string) {
    return layoutRef.current.nodes.find((node) => node.kind === 'module' && node.id === nodeId) ?? null;
  }

  function getNodeStartPositions(nodeIds: readonly string[]): SchematicNodePositionOverrides {
    return Object.fromEntries(nodeIds.flatMap((nodeId) => {
      const node = getModuleNodeById(nodeId);

      return node ? [[nodeId, { x: node.x, y: node.y }]] : [];
    }));
  }

  function getDraggedNodePositions(nodeStarts: SchematicNodePositionOverrides, delta: ScreenPoint): SchematicNodePositionOverrides {
    return snapSchematicNodePositions(Object.fromEntries(Object.entries(nodeStarts).flatMap(([nodeId, startPosition]) => {
      if (!startPosition) {
        return [];
      }

      return [[nodeId, {
        x: roundLayoutCoordinate(startPosition.x + delta.x / cameraRef.current.zoom),
        y: roundLayoutCoordinate(startPosition.y + delta.y / cameraRef.current.zoom),
      }]];
    })), schematicGridSize);
  }

  function getWorldRectFromClientPoints(startClient: ScreenPoint, endClient: ScreenPoint, canvas: HTMLCanvasElement): SchematicWorldRect {
    const canvasRect = canvas.getBoundingClientRect();
    const startWorld = screenToWorld({ x: startClient.x - canvasRect.left, y: startClient.y - canvasRect.top }, cameraRef.current);
    const endWorld = screenToWorld({ x: endClient.x - canvasRect.left, y: endClient.y - canvasRect.top }, cameraRef.current);
    const x = Math.min(startWorld.x, endWorld.x);
    const y = Math.min(startWorld.y, endWorld.y);

    return {
      x,
      y,
      width: Math.abs(endWorld.x - startWorld.x),
      height: Math.abs(endWorld.y - startWorld.y),
    };
  }

  function getModuleNodesInRect(rect: SchematicWorldRect) {
    return layoutRef.current.nodes.filter((node) => {
      if (node.kind !== 'module') {
        return false;
      }

      return node.x < rect.x + rect.width
        && node.x + node.width > rect.x
        && node.y < rect.y + rect.height
        && node.y + node.height > rect.y;
    });
  }

  function applyClickSelection(nodeId: string | null, additive: boolean) {
    if (!nodeId) {
      if (!additive) {
        commitSelection([]);
      }
      return;
    }

    const currentSelection = selectedNodeIdsRef.current;

    if (!additive) {
      commitSelection([nodeId]);
      return;
    }

    commitSelection(currentSelection.includes(nodeId)
      ? currentSelection.filter((selectedNodeId) => selectedNodeId !== nodeId)
      : [...currentSelection, nodeId]);
  }

  function applyMarqueeSelection(rect: SchematicWorldRect, additive: boolean) {
    const hitNodeIds = getModuleNodesInRect(rect).map((node) => node.id);

    if (!additive) {
      commitSelection(hitNodeIds);
      return;
    }

    const nextSelection = new Set(selectedNodeIdsRef.current);
    hitNodeIds.forEach((nodeId) => {
      if (nextSelection.has(nodeId)) {
        nextSelection.delete(nodeId);
      } else {
        nextSelection.add(nodeId);
      }
    });
    commitSelection([...nextSelection]);
  }

  function commitSelection(nodeIds: readonly string[]) {
    const nextNodeIds = normalizeSelectedNodeIds(nodeIds);
    selectedNodeIdsRef.current = nextNodeIds;
    if (selectedEdgeIdsRef.current.length > 0) {
      selectedEdgeIdsRef.current = [];
      sceneRef.current?.updateEdgeSelection([]);
      onEdgeSelectionChangeRef.current?.([]);
    }
    sceneRef.current?.updateSelection(nextNodeIds);
    onNodeSelectionChangeRef.current?.(nextNodeIds);
    requestRender();
  }

  function commitEdgeSelection(edgeIds: readonly string[]) {
    const nextEdgeIds = normalizeSelectedEdgeIds(edgeIds);

    if (nextEdgeIds.length > 0 && selectedNodeIdsRef.current.length > 0) {
      selectedNodeIdsRef.current = [];
      sceneRef.current?.updateSelection([]);
      onNodeSelectionChangeRef.current?.([]);
    }

    selectedEdgeIdsRef.current = nextEdgeIds;
    sceneRef.current?.updateEdgeSelection(nextEdgeIds);
    onEdgeSelectionChangeRef.current?.(nextEdgeIds);
    requestRender();
  }

  function normalizeSelectedNodeIds(nodeIds: readonly string[]) {
    const moduleNodeIds = new Set(layoutRef.current.nodes.filter((node) => node.kind === 'module').map((node) => node.id));
    const uniqueNodeIds = new Set<string>();

    nodeIds.forEach((nodeId) => {
      if (moduleNodeIds.has(nodeId)) {
        uniqueNodeIds.add(nodeId);
      }
    });

    return [...uniqueNodeIds].sort((first, second) => first.localeCompare(second));
  }

  function normalizeSelectedEdgeIds(edgeIds: readonly string[]) {
    const edgeIdSet = new Set(layoutRef.current.edges.map((edge) => edge.id));
    const uniqueEdgeIds = new Set<string>();

    edgeIds.forEach((edgeId) => {
      if (edgeIdSet.has(edgeId)) {
        uniqueEdgeIds.add(edgeId);
      }
    });

    return [...uniqueEdgeIds].sort((first, second) => first.localeCompare(second));
  }

  function setActiveDragDataAttributes(nodeIds: readonly string[], positions: SchematicNodePositionOverrides) {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const firstNodeId = nodeIds[0];
    const firstPosition = firstNodeId ? positions[firstNodeId] : undefined;

    if (!firstNodeId || !firstPosition) {
      return;
    }

    host.setAttribute('data-active-drag-node-id', firstNodeId);
    host.setAttribute('data-active-drag-node-ids', nodeIds.join(','));
    host.setAttribute('data-active-drag-node-x', firstPosition.x.toFixed(1));
    host.setAttribute('data-active-drag-node-y', firstPosition.y.toFixed(1));
  }

  function setLastDragDataAttributes(nodeIds: readonly string[], positions: SchematicNodePositionOverrides) {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const firstNodeId = nodeIds[0];
    const firstPosition = firstNodeId ? positions[firstNodeId] : undefined;

    if (!firstNodeId || !firstPosition) {
      return;
    }

    host.setAttribute('data-last-drag-node-id', firstNodeId);
    host.setAttribute('data-last-drag-node-ids', nodeIds.join(','));
    host.setAttribute('data-last-drag-node-x', firstPosition.x.toFixed(1));
    host.setAttribute('data-last-drag-node-y', firstPosition.y.toFixed(1));
  }

  function clearActiveDragDataAttributes() {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    host.removeAttribute('data-active-drag-node-id');
    host.removeAttribute('data-active-drag-node-ids');
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
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }

    const nextCamera = cameraRef.current;
    scene.world.position.set(nextCamera.x, nextCamera.y);
    scene.world.scale.set(nextCamera.zoom);
    const nextTextZoom = scene.updateZoom(nextCamera.zoom);
    setTextZoom((currentTextZoom) => currentTextZoom.labelScale === nextTextZoom.labelScale
      && currentTextZoom.textResolution === nextTextZoom.textResolution
      ? currentTextZoom
      : nextTextZoom);
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
      data-layer-count={layerNames.length}
      data-layer-names={layerNames.join(',')}
      data-grid-size={schematicGridSize}
      data-label-scale={textZoom.labelScale.toFixed(3)}
      data-text-resolution={textZoom.textResolution}
      data-selected-node-count={selectedNodeIds.length}
      data-selected-node-ids={selectedNodeIds.join(',')}
      data-selected-edge-count={selectedEdgeIds.length}
      data-selected-edge-ids={selectedEdgeIds.join(',')}
      data-marquee-active="false"
      data-module-node-snapshot={moduleNodeSnapshot}
      data-edge-route-snapshot={edgeRouteSnapshot}
      data-first-edge-id={firstSelectableEdge?.id}
      data-first-edge-center-x={firstSelectableEdgePoint ? firstSelectableEdgePoint.x.toFixed(1) : undefined}
      data-first-edge-center-y={firstSelectableEdgePoint ? firstSelectableEdgePoint.y.toFixed(1) : undefined}
      data-first-signal-edge-id={firstSignalEdge?.id}
      data-first-signal-edge-center-x={firstSignalEdgePoint ? firstSignalEdgePoint.x.toFixed(1) : undefined}
      data-first-signal-edge-center-y={firstSignalEdgePoint ? firstSignalEdgePoint.y.toFixed(1) : undefined}
      data-first-signal-edge-style={firstSignalEdge ? 'signal' : undefined}
      data-first-bus-edge-id={firstBusEdge?.id}
      data-first-bus-edge-center-x={firstBusEdgePoint ? firstBusEdgePoint.x.toFixed(1) : undefined}
      data-first-bus-edge-center-y={firstBusEdgePoint ? firstBusEdgePoint.y.toFixed(1) : undefined}
      data-first-bus-edge-style={firstBusEdge ? 'bus' : undefined}
      data-first-module-id={firstDraggableNode?.id}
      data-first-module-center-x={firstDraggableNode ? (firstDraggableNode.x + firstDraggableNode.width / 2).toFixed(1) : undefined}
      data-first-module-center-y={firstDraggableNode ? (firstDraggableNode.y + firstDraggableNode.height / 2).toFixed(1) : undefined}
      data-second-module-id={secondDraggableNode?.id}
      data-second-module-center-x={secondDraggableNode ? (secondDraggableNode.x + secondDraggableNode.width / 2).toFixed(1) : undefined}
      data-second-module-center-y={secondDraggableNode ? (secondDraggableNode.y + secondDraggableNode.height / 2).toFixed(1) : undefined}
      data-drillable-module-id={firstDrillableNode?.id}
      data-drillable-module-target-id={firstDrillableNode?.moduleId}
      data-drillable-module-center-x={firstDrillableNode ? (firstDrillableNode.x + firstDrillableNode.width / 2).toFixed(1) : undefined}
      data-drillable-module-center-y={firstDrillableNode ? (firstDrillableNode.y + firstDrillableNode.height / 2).toFixed(1) : undefined}
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

function getEdgeHitPoint(edge: SchematicEdgeLayout): SchematicPoint {
  const segments = edge.points.slice(1).map((point, index) => ({
    start: edge.points[index]!,
    end: point,
  }));
  const firstSegment = segments[0];

  if (!firstSegment) {
    return edge.points[0] ?? { x: 0, y: 0 };
  }

  const longestSegment = segments.slice(1).reduce((longest, segment) => {
    const longestLength = Math.hypot(longest.end.x - longest.start.x, longest.end.y - longest.start.y);
    const segmentLength = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);

    return segmentLength > longestLength ? segment : longest;
  }, firstSegment);

  return {
    x: roundLayoutCoordinate(longestSegment.start.x + (longestSegment.end.x - longestSegment.start.x) / 2),
    y: roundLayoutCoordinate(longestSegment.start.y + (longestSegment.end.y - longestSegment.start.y) / 2),
  };
}

function getDistanceToPolyline(point: SchematicPoint, points: readonly SchematicPoint[]) {
  let shortestDistance = Number.POSITIVE_INFINITY;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];

    if (start && end) {
      shortestDistance = Math.min(shortestDistance, getDistanceToSegment(point, start, end));
    }
  }

  return shortestDistance;
}

function getDistanceToSegment(point: SchematicPoint, start: SchematicPoint, end: SchematicPoint) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = clamp(((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared, 0, 1);
  const closestPoint = {
    x: start.x + projection * deltaX,
    y: start.y + projection * deltaY,
  };

  return Math.hypot(point.x - closestPoint.x, point.y - closestPoint.y);
}

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
