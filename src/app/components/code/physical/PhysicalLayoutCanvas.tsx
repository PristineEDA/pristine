import { useEffect, useMemo, useRef, useState } from 'react';
import { Application, Container, Graphics, Mesh, MeshGeometry, Text, Texture } from 'pixi.js';

import type {
  LspLayoutCatalog,
  LspLayoutBounds,
  LspLayoutGeometry,
  LspLayoutShape,
  LspLayoutTileGeometry,
} from '../../../../../types/systemverilog-lsp';
import {
  applyLayoutWheel,
  findShapeAtLayoutPoint,
  getFitLayoutCamera,
  getLayoutTargetBounds,
  getShapesBounds,
  layoutClientPointToWorldPoint,
  selectLayoutTargetShapes,
  shapeBounds,
  type PhysicalLayoutCamera,
  type PhysicalLayoutTarget,
} from './physicalLayoutGeometry';
import {
  createGdsTileMetricsSnapshot,
  createEmptyGdsTileGeometry,
  createGdsPreciseTileRequestPlan,
  createGdsTileRequestPlan,
  createGdsRetryTileRequestPlan,
  defaultPhysicalLayoutGdsTileMetrics,
  doLayoutBoundsIntersect,
  getGdsTileShapeStyle,
  getViewportWorldBounds,
  isGdsTileModeEnabled,
  mergeGdsTileGeometryResults,
  shouldRequestPreciseGdsTile,
  type PhysicalLayoutGdsTileShapeStyle,
  type PhysicalLayoutGdsTileMetrics,
  type PhysicalLayoutGdsTileRequestInput,
  type PhysicalLayoutGdsTileRequestPlan,
} from './physicalLayoutGdsTiles';
import { createPhysicalLayoutMinimapModel, type PhysicalLayoutMinimapModel } from './physicalLayoutMinimap';
import {
  createPhysicalLayoutPinLabels,
  formatPhysicalLayoutLayerOpacitySummary,
  filterVisiblePhysicalLayoutShapes,
  getPhysicalLayoutLayerCategoryColor,
  getPhysicalLayoutLayerOpacity,
  getVisiblePhysicalLayoutCategoryCount,
  getVisiblePhysicalLayoutLayerCount,
  getVisiblePhysicalLayoutShapeCounts,
  isPhysicalLayoutOutlineVisible,
  type PhysicalLayoutLayerCategory,
  type PhysicalLayoutPinLabel,
  type PhysicalLayoutVisibility,
} from './physicalLayoutLayers';

type PixiRendererPreference = 'webgpu' | 'webgl';
type PixiRendererStatus = PixiRendererPreference | 'error' | 'initializing';

interface PhysicalLayoutCanvasProps {
  catalog: LspLayoutCatalog | null;
  geometry: LspLayoutGeometry | null;
  highlightedShapeIndex?: number | null;
  layoutSessionId?: string | null;
  selectedTarget: PhysicalLayoutTarget | null;
  layoutVisibility: PhysicalLayoutVisibility;
  onGdsTileGeometryChange?: (geometry: LspLayoutGeometry | null) => void;
  onGdsTileMetricsChange?: (metrics: PhysicalLayoutGdsTileMetrics) => void;
  onHighlightedShapeChange?: (shapeIndex: number | null) => void;
}

const defaultCamera: PhysicalLayoutCamera = { panX: 0, panY: 0, zoom: 24 };
const minimumCanvasWidth = 240;
const minimumCanvasHeight = 180;
const gridMajorStep = 1;
const gridMinorStep = 0.2;
const clickDistanceThresholdPx = 4;
const GDS_TILE_ORDER_BUCKET_SIZE = 512;
const GDS_TILE_PRECISE_ORDER_SHAPE_LIMIT = 2_048;

export function PhysicalLayoutCanvas({
  catalog,
  geometry,
  highlightedShapeIndex = null,
  layoutSessionId = null,
  selectedTarget,
  layoutVisibility,
  onGdsTileGeometryChange,
  onGdsTileMetricsChange,
  onHighlightedShapeChange,
}: PhysicalLayoutCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const backgroundRef = useRef<Container | null>(null);
  const overlayRef = useRef<Container | null>(null);
  const minimapGraphicsRef = useRef<Graphics | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const cameraRef = useRef<PhysicalLayoutCamera>(defaultCamera);
  const isGdsTileModeRef = useRef(false);
  const layoutSessionIdRef = useRef<string | null>(layoutSessionId);
  const layoutVisibilityRef = useRef(layoutVisibility);
  const selectedTargetRef = useRef<PhysicalLayoutTarget | null>(selectedTarget);
  const sizeRef = useRef({ width: minimumCanvasWidth, height: minimumCanvasHeight });
  const selectedBoundsRef = useRef<LspLayoutBounds | null>(null);
  const selectedShapesRef = useRef<LspLayoutShape[]>([]);
  const selectedLabelsRef = useRef<PhysicalLayoutPinLabel[]>([]);
  const gdsTileGenerationRef = useRef(0);
  const gdsTileRequestTimeoutRef = useRef<number | null>(null);
  const gdsTileCacheRef = useRef(new Map<string, LspLayoutTileGeometry>());
  const gdsLatestRequestKeyRef = useRef('');
  const gdsLastGoodTileRef = useRef<LspLayoutTileGeometry | null>(null);
  const gdsTileDiagnosticsRef = useRef({
    displayedState: 'empty',
    emptyReason: '',
    finalLod: -1,
    lastGoodShapeCount: 0,
    precisePending: false,
    tileLod: -1,
  });
  const gdsCameraSyncTimeoutRef = useRef<number | null>(null);
  const gdsMetricsSyncTimeoutRef = useRef<number | null>(null);
  const minimapSyncTimeoutRef = useRef<number | null>(null);
  const gdsRenderCountSyncTimeoutRef = useRef<number | null>(null);
  const frameDurationsRef = useRef<number[]>([]);
  const lastFrameAtRef = useRef<number | null>(null);
  const lastRenderDurationMsRef = useRef(0);
  const lastRenderCountSyncAtRef = useRef(0);
  const lastGdsMetricsSyncAtRef = useRef(0);
  const lastMinimapSyncAtRef = useRef(0);
  const lastTileRoundtripMsRef = useRef(0);
  const tileRequestCountRef = useRef(0);
  const meshStatsRef = useRef({ drawNodeCount: 0, indexCount: 0, meshBatchCount: 0, orderBucketSize: 0, vertexCount: 0 });
  const minimapModelRef = useRef<PhysicalLayoutMinimapModel | null>(null);
  const renderCountRef = useRef(0);
  const outlineVisibleRef = useRef(false);
  const highlightedShapeIndexRef = useRef<number | null>(highlightedShapeIndex);
  const onHighlightedShapeChangeRef = useRef(onHighlightedShapeChange);
  const onGdsTileGeometryChangeRef = useRef(onGdsTileGeometryChange);
  const onGdsTileMetricsChangeRef = useRef(onGdsTileMetricsChange);
  const [renderer, setRenderer] = useState<PixiRendererStatus>('initializing');
  const [camera, setCamera] = useState<PhysicalLayoutCamera>(defaultCamera);
  const [renderCount, setRenderCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastPick, setLastPick] = useState<{ shapeIndex: number | null; worldX: number; worldY: number } | null>(null);
  const [size, setSize] = useState({ width: minimumCanvasWidth, height: minimumCanvasHeight });
  const [gdsTileGeometry, setGdsTileGeometry] = useState<LspLayoutGeometry | null>(null);
  const [gdsTileMetrics, setGdsTileMetrics] = useState<PhysicalLayoutGdsTileMetrics>(defaultPhysicalLayoutGdsTileMetrics);
  const [cameraSync, setCameraSync] = useState<PhysicalLayoutCamera>(defaultCamera);
  const [gdsTileDiagnostics, setGdsTileDiagnostics] = useState(gdsTileDiagnosticsRef.current);
  const [minimapModel, setMinimapModel] = useState<PhysicalLayoutMinimapModel | null>(null);

  const isGdsTileMode = isGdsTileModeEnabled(catalog?.sourceKind, selectedTarget?.kind);
  const activeGeometry = isGdsTileMode ? gdsTileGeometry : geometry;

  const selectedShapes = useMemo(
    () => selectLayoutTargetShapes(catalog, activeGeometry, selectedTarget),
    [activeGeometry, catalog, selectedTarget],
  );
  const visibleShapes = useMemo(
    () => filterVisiblePhysicalLayoutShapes(selectedShapes, layoutVisibility, catalog?.sourceKind),
    [catalog?.sourceKind, selectedShapes, layoutVisibility],
  );
  const visibleLabels = useMemo(
    () => createPhysicalLayoutPinLabels(catalog, selectedShapes, layoutVisibility),
    [catalog, selectedShapes, layoutVisibility],
  );
  const visibleShapeCounts = useMemo(
    () => getVisiblePhysicalLayoutShapeCounts(selectedShapes, layoutVisibility, catalog?.sourceKind),
    [catalog?.sourceKind, selectedShapes, layoutVisibility],
  );
  const selectedBounds = useMemo(
    () => {
      if (isGdsTileMode) {
        return getLayoutTargetBounds(catalog, selectedTarget, null);
      }

      return getShapesBounds(selectedShapes, getLayoutTargetBounds(catalog, selectedTarget, activeGeometry ? getShapesBounds(activeGeometry.shapes, null) : null));
    },
    [activeGeometry, catalog, isGdsTileMode, selectedShapes, selectedTarget],
  );
  const layerCount = catalog?.layers.length ?? 0;
  const catalogPinCount = catalog?.pins.length ?? 0;
  const selectedPinCount = catalog && selectedTarget?.kind === 'macro' && selectedTarget.index !== null
    ? catalog.pins.filter((pin) => pin.macroIndex === selectedTarget.index).length
    : catalog?.defPins.length ?? 0;
  const visibleLayerCount = getVisiblePhysicalLayoutLayerCount(catalog, layoutVisibility);
  const visibleCategoryCount = getVisiblePhysicalLayoutCategoryCount(catalog, layoutVisibility);
  const outlineVisible = isPhysicalLayoutOutlineVisible(layoutVisibility);
  const pickableShape = useMemo(
    () => getPickableVisibleShape(visibleShapes, camera, size),
    [camera, size, visibleShapes],
  );

  selectedBoundsRef.current = selectedBounds;
  selectedShapesRef.current = visibleShapes;
  selectedLabelsRef.current = visibleLabels;
  isGdsTileModeRef.current = isGdsTileMode;
  layoutSessionIdRef.current = layoutSessionId;
  layoutVisibilityRef.current = layoutVisibility;
  selectedTargetRef.current = selectedTarget;
  sizeRef.current = size;
  outlineVisibleRef.current = outlineVisible;
  highlightedShapeIndexRef.current = highlightedShapeIndex;
  onHighlightedShapeChangeRef.current = onHighlightedShapeChange;
  onGdsTileGeometryChangeRef.current = onGdsTileGeometryChange;
  onGdsTileMetricsChangeRef.current = onGdsTileMetricsChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    let disposed = false;
    void createPixiApp(host).then(({ app, renderer: pixiRenderer }) => {
      if (disposed) {
        app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
        return;
      }

      appRef.current = app;
      backgroundRef.current = new Container();
      worldRef.current = new Container();
      overlayRef.current = new Container();
      minimapGraphicsRef.current = new Graphics();
      app.stage.addChild(backgroundRef.current);
      app.stage.addChild(worldRef.current);
      app.stage.addChild(overlayRef.current);
      overlayRef.current.addChild(minimapGraphicsRef.current);
      setRenderer(pixiRenderer);
      setSize({ width: app.renderer.width, height: app.renderer.height });
      redrawScene();
      requestRender();
    }).catch((cause: unknown) => {
      if (disposed) {
        return;
      }

      setRenderer('error');
      setError(cause instanceof Error ? cause.message : 'Unable to initialize layout renderer.');
    });

    return () => {
      disposed = true;
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
      if (gdsTileRequestTimeoutRef.current !== null) {
        window.clearTimeout(gdsTileRequestTimeoutRef.current);
        gdsTileRequestTimeoutRef.current = null;
      }
      if (gdsCameraSyncTimeoutRef.current !== null) {
        window.clearTimeout(gdsCameraSyncTimeoutRef.current);
        gdsCameraSyncTimeoutRef.current = null;
      }
      if (gdsMetricsSyncTimeoutRef.current !== null) {
        window.clearTimeout(gdsMetricsSyncTimeoutRef.current);
        gdsMetricsSyncTimeoutRef.current = null;
      }
      if (minimapSyncTimeoutRef.current !== null) {
        window.clearTimeout(minimapSyncTimeoutRef.current);
        minimapSyncTimeoutRef.current = null;
      }
      if (gdsRenderCountSyncTimeoutRef.current !== null) {
        window.clearTimeout(gdsRenderCountSyncTimeoutRef.current);
        gdsRenderCountSyncTimeoutRef.current = null;
      }
      appRef.current?.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
      appRef.current = null;
      worldRef.current = null;
      backgroundRef.current = null;
      overlayRef.current = null;
      minimapGraphicsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      const app = appRef.current;
      if (!app) {
        return;
      }

      const width = Math.max(minimumCanvasWidth, Math.floor(host.clientWidth));
      const height = Math.max(minimumCanvasHeight, Math.floor(host.clientHeight));
      app.renderer.resize(width, height);
      setSize({ width, height });
      requestRender();
    });
    resizeObserver.observe(host);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const nextCamera = getFitLayoutCamera(selectedBounds, size);
    cameraRef.current = nextCamera;
    setCamera(nextCamera);
    setCameraSync(nextCamera);
    redrawScene();
    requestRender();
    scheduleGdsTileRequest();
  }, [selectedBounds, selectedTarget, size.height, size.width]);

  useEffect(() => {
    redrawScene();
    requestRender();
  }, [highlightedShapeIndex, layoutVisibility, outlineVisible, visibleLabels, visibleShapes]);

  useEffect(() => {
    gdsTileGenerationRef.current += 1;
    gdsTileCacheRef.current.clear();
    gdsLatestRequestKeyRef.current = '';
    gdsLastGoodTileRef.current = null;
    updateGdsTileDiagnostics({
      displayedState: 'empty',
      emptyReason: '',
      finalLod: -1,
      lastGoodShapeCount: 0,
      precisePending: false,
      tileLod: -1,
    });
    setGdsTileGeometry(null);
    onGdsTileGeometryChangeRef.current?.(null);
    setGdsTileMetrics(defaultPhysicalLayoutGdsTileMetrics);
    onGdsTileMetricsChangeRef.current?.(defaultPhysicalLayoutGdsTileMetrics);
    if (isGdsTileMode) {
      scheduleGdsTileRequest();
    }
  }, [isGdsTileMode, layoutSessionId, selectedTarget?.index]);

  useEffect(() => {
    if (!isGdsTileMode) {
      return;
    }

    gdsTileGenerationRef.current += 1;
    gdsTileCacheRef.current.clear();
    gdsLatestRequestKeyRef.current = '';
    scheduleGdsTileRequest();
  }, [isGdsTileMode, layoutVisibility]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const dragState = {
      downCamera: defaultCamera,
      downX: 0,
      downY: 0,
      moved: false,
      pointerId: -1,
      previousX: 0,
      previousY: 0,
      totalDistance: 0,
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const bounds = host.getBoundingClientRect();
      updateCamera(applyLayoutWheel(cameraRef.current, event, { x: bounds.left, y: bounds.top }));
      scheduleGdsTileRequest();
    };
    const selectShapeAtClientPoint = (
      clientX: number,
      clientY: number,
      camera: PhysicalLayoutCamera,
      options: { clearWhenEmpty: boolean } = { clearWhenEmpty: true },
    ) => {
      const bounds = host.getBoundingClientRect();
      const point = layoutClientPointToWorldPoint(
        { x: clientX, y: clientY },
        bounds,
        camera,
      );
      const shape = findShapeAtLayoutPoint(selectedShapesRef.current, point, 4 / camera.zoom);
      setLastPick({ shapeIndex: shape?.index ?? null, worldX: point.x, worldY: point.y });
      if (shape || options.clearWhenEmpty) {
        onHighlightedShapeChangeRef.current?.(shape?.index ?? null);
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      dragState.moved = false;
      dragState.pointerId = event.pointerId;
      dragState.downCamera = cameraRef.current;
      dragState.downX = event.clientX;
      dragState.downY = event.clientY;
      dragState.previousX = event.clientX;
      dragState.previousY = event.clientY;
      dragState.totalDistance = 0;
      host.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      const dx = event.clientX - dragState.previousX;
      const dy = event.clientY - dragState.previousY;
      dragState.previousX = event.clientX;
      dragState.previousY = event.clientY;
      dragState.totalDistance += Math.hypot(dx, dy);
      dragState.moved = dragState.totalDistance > clickDistanceThresholdPx;
      updateCamera({
        ...cameraRef.current,
        panX: cameraRef.current.panX + dx,
        panY: cameraRef.current.panY + dy,
      });
      scheduleGdsTileRequest();
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      dragState.pointerId = -1;
      if (!dragState.moved) {
        selectShapeAtClientPoint(dragState.downX, dragState.downY, dragState.downCamera);
      }

      if (host.hasPointerCapture(event.pointerId)) {
        host.releasePointerCapture(event.pointerId);
      }
    };
    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0 || dragState.moved) {
        return;
      }

      selectShapeAtClientPoint(event.clientX, event.clientY, cameraRef.current, { clearWhenEmpty: false });
    };

    host.addEventListener('wheel', handleWheel, { passive: false });
    host.addEventListener('pointerdown', handlePointerDown, true);
    host.addEventListener('pointermove', handlePointerMove, true);
    host.addEventListener('pointerup', handlePointerUp, true);
    host.addEventListener('pointercancel', handlePointerUp, true);
    host.addEventListener('click', handleClick, true);
    return () => {
      host.removeEventListener('wheel', handleWheel);
      host.removeEventListener('pointerdown', handlePointerDown, true);
      host.removeEventListener('pointermove', handlePointerMove, true);
      host.removeEventListener('pointerup', handlePointerUp, true);
      host.removeEventListener('pointercancel', handlePointerUp, true);
      host.removeEventListener('click', handleClick, true);
    };
  }, []);

  const requestRender = () => {
    if (renderFrameRef.current !== null) {
      return;
    }

    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      const frameStartedAt = performance.now();
      const app = appRef.current;
      if (!app) {
        return;
      }

      updateTransforms();
      updateMinimapOverlay();
      app.render();
      const frameEndedAt = performance.now();
      lastRenderDurationMsRef.current = frameEndedAt - frameStartedAt;
      if (lastFrameAtRef.current !== null) {
        frameDurationsRef.current.push(frameEndedAt - lastFrameAtRef.current);
        if (frameDurationsRef.current.length > 120) {
          frameDurationsRef.current.shift();
        }
      }
      lastFrameAtRef.current = frameEndedAt;
      renderCountRef.current += 1;
      syncRenderCountState();
      updateGdsTileMetrics();
    });
  };

  const updateCamera = (nextCamera: PhysicalLayoutCamera) => {
    cameraRef.current = nextCamera;
    if (isGdsTileMode) {
      syncGdsCameraState();
    } else {
      setCamera(nextCamera);
      setCameraSync(nextCamera);
    }
    requestRender();
  };

  const syncRenderCountState = (force = false) => {
    const now = performance.now();
    if (!isGdsTileModeRef.current || force || now - lastRenderCountSyncAtRef.current >= 120) {
      if (gdsRenderCountSyncTimeoutRef.current !== null) {
        window.clearTimeout(gdsRenderCountSyncTimeoutRef.current);
        gdsRenderCountSyncTimeoutRef.current = null;
      }
      lastRenderCountSyncAtRef.current = now;
      setRenderCount(renderCountRef.current);
      return;
    }

    if (gdsRenderCountSyncTimeoutRef.current === null) {
      gdsRenderCountSyncTimeoutRef.current = window.setTimeout(() => {
        gdsRenderCountSyncTimeoutRef.current = null;
        lastRenderCountSyncAtRef.current = performance.now();
        setRenderCount(renderCountRef.current);
      }, Math.max(16, 120 - (now - lastRenderCountSyncAtRef.current)));
    }
  };

  const syncGdsCameraState = (force = false) => {
    if (!isGdsTileModeRef.current || force) {
      if (gdsCameraSyncTimeoutRef.current !== null) {
        window.clearTimeout(gdsCameraSyncTimeoutRef.current);
        gdsCameraSyncTimeoutRef.current = null;
      }
      setCamera(cameraRef.current);
      setCameraSync(cameraRef.current);
      return;
    }

    if (gdsCameraSyncTimeoutRef.current !== null) {
      return;
    }

    gdsCameraSyncTimeoutRef.current = window.setTimeout(() => {
      gdsCameraSyncTimeoutRef.current = null;
      setCamera(cameraRef.current);
      setCameraSync(cameraRef.current);
    }, 80);
  };

  const syncGdsFullCameraState = () => {
    setCamera(cameraRef.current);
    setCameraSync(cameraRef.current);
  };

  const scheduleGdsTileRequest = () => {
    const currentTarget = selectedTargetRef.current;
    if (!isGdsTileModeRef.current || !layoutSessionIdRef.current || currentTarget?.index === null || currentTarget?.index === undefined) {
      return;
    }

    if (gdsTileRequestTimeoutRef.current !== null) {
      window.clearTimeout(gdsTileRequestTimeoutRef.current);
    }

    gdsTileRequestTimeoutRef.current = window.setTimeout(() => {
      gdsTileRequestTimeoutRef.current = null;
      void requestGdsTileGeometry();
    }, 80);
  };

  const requestGdsTileGeometry = async () => {
    const lsp = window.electronAPI?.lsp;
    const currentSessionId = layoutSessionIdRef.current;
    const currentTarget = selectedTargetRef.current;
    if (!lsp?.layoutTileGeometry || !currentSessionId || currentTarget?.index === null || currentTarget?.index === undefined) {
      return;
    }

    const generation = gdsTileGenerationRef.current;
    const input = createGdsTileRequestInput(currentSessionId, currentTarget.index);
    const plan = createGdsTileRequestPlan(input);
    gdsLatestRequestKeyRef.current = plan.cacheKey;
    updateGdsTileDiagnostics({
      displayedState: gdsLastGoodTileRef.current ? 'pending-last-good' : 'pending',
      emptyReason: '',
      precisePending: false,
      tileLod: plan.lod,
    });
    if (plan.empty) {
      const emptyTile = createEmptyGdsTileGeometry(catalog?.unitsPerMicron);
      gdsTileCacheRef.current.set(plan.cacheKey, emptyTile);
      gdsLastGoodTileRef.current = null;
      applyGdsTile(emptyTile, plan, generation, 0, { acceptEmpty: true, state: 'empty-hidden' });
      return;
    }

    void requestGdsTilePlan(input, plan, generation, { requestPreciseAfterSuccess: true });
  };

  const createGdsTileRequestInput = (sessionId: string, rootCellIndex: number): PhysicalLayoutGdsTileRequestInput => ({
      camera: cameraRef.current,
      rootCellIndex,
      sessionId,
      size: sizeRef.current,
      visibility: layoutVisibilityRef.current,
    });

  const requestGdsTilePlan = async (
    input: PhysicalLayoutGdsTileRequestInput,
    plan: PhysicalLayoutGdsTileRequestPlan,
    generation: number,
    options: { acceptEmpty?: boolean; requestPreciseAfterSuccess?: boolean; retryEmpty?: boolean },
  ) => {
    const lsp = window.electronAPI?.lsp;
    if (!lsp?.layoutTileGeometry) {
      return;
    }

    const cachedTile = gdsTileCacheRef.current.get(plan.cacheKey);
    if (cachedTile) {
      handleGdsTileResult(cachedTile, input, plan, generation, 0, options);
      return;
    }

    const startedAt = performance.now();
    const results: LspLayoutTileGeometry[] = [];
    let continuationToken: number | null | undefined = undefined;
    try {
      do {
        const tile = await lsp.layoutTileGeometry({
          ...plan.options,
          continuationToken,
        });
        if (gdsTileGenerationRef.current !== generation) {
          return;
        }
        results.push(tile);
        continuationToken = tile.nextToken;
      } while (continuationToken !== null && continuationToken !== undefined);

      const mergedTile = mergeGdsTileGeometryResults(results);
      if (!mergedTile) {
        return;
      }

      gdsTileCacheRef.current.set(plan.cacheKey, mergedTile);
      tileRequestCountRef.current += 1;
      handleGdsTileResult(mergedTile, input, plan, generation, performance.now() - startedAt, options);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load GDS viewport tile.');
    }
  };

  const handleGdsTileResult = (
    tile: LspLayoutTileGeometry,
    input: PhysicalLayoutGdsTileRequestInput,
    plan: PhysicalLayoutGdsTileRequestPlan,
    generation: number,
    roundtripMs: number,
    options: { acceptEmpty?: boolean; requestPreciseAfterSuccess?: boolean; retryEmpty?: boolean },
  ) => {
    if (gdsTileGenerationRef.current !== generation) {
      return;
    }

    if (gdsLatestRequestKeyRef.current !== plan.cacheKey) {
      return;
    }

    if (tile.geometry.shapes.length === 0 && !options.acceptEmpty) {
      if (options.retryEmpty !== false && doLayoutBoundsIntersect(plan.bbox, selectedBoundsRef.current)) {
        const retryPlan = createGdsRetryTileRequestPlan(input);
        gdsLatestRequestKeyRef.current = retryPlan.cacheKey;
        updateGdsTileDiagnostics({
          displayedState: gdsLastGoodTileRef.current ? 'empty-retry-last-good' : 'empty-retry',
          emptyReason: 'retry-expanded-lod0',
          precisePending: true,
          tileLod: plan.lod,
        });
        void requestGdsTilePlan(input, retryPlan, generation, {
          acceptEmpty: true,
          retryEmpty: false,
        });
        return;
      }

      if (gdsLastGoodTileRef.current) {
        updateGdsTileDiagnostics({
          displayedState: 'empty-kept-last-good',
          emptyReason: 'empty-current-tile',
          precisePending: false,
          tileLod: plan.lod,
        });
        updateGdsTileMetrics(tile);
        return;
      }
    }

    applyGdsTile(tile, plan, generation, roundtripMs, {
      acceptEmpty: Boolean(options.acceptEmpty),
      state: tile.geometry.shapes.length > 0 ? 'ready' : 'empty-confirmed',
    });

    if (tile.geometry.shapes.length > 0 && options.requestPreciseAfterSuccess && shouldRequestPreciseGdsTile(plan)) {
      const precisePlan = createGdsPreciseTileRequestPlan(input);
      updateGdsTileDiagnostics({
        precisePending: true,
      });
      window.setTimeout(() => {
        if (gdsTileGenerationRef.current !== generation || gdsLatestRequestKeyRef.current !== plan.cacheKey) {
          return;
        }
        gdsLatestRequestKeyRef.current = precisePlan.cacheKey;
        void requestGdsTilePlan(input, precisePlan, generation, {
          acceptEmpty: false,
          retryEmpty: true,
        });
      }, 120);
    }
  };

  const applyGdsTile = (
    tile: LspLayoutTileGeometry,
    plan: PhysicalLayoutGdsTileRequestPlan,
    generation: number,
    roundtripMs: number,
    options: { acceptEmpty: boolean; state: string },
  ) => {
    if (gdsTileGenerationRef.current !== generation) {
      return;
    }

    lastTileRoundtripMsRef.current = roundtripMs;
    if (tile.geometry.shapes.length > 0) {
      gdsLastGoodTileRef.current = tile;
    }
    setGdsTileGeometry(tile.geometry);
    onGdsTileGeometryChangeRef.current?.(tile.geometry);
    redrawScene(tile.geometry);
    requestRender();
    syncGdsFullCameraState();
    syncRenderCountState(true);
    updateGdsTileMetrics(tile);
    updateGdsTileDiagnostics({
      displayedState: options.state,
      emptyReason: tile.geometry.shapes.length === 0
        ? options.acceptEmpty ? 'accepted-empty' : 'empty-current-tile'
        : '',
      finalLod: plan.lod,
      lastGoodShapeCount: gdsLastGoodTileRef.current?.geometry.shapes.length ?? 0,
      precisePending: false,
      tileLod: plan.lod,
    });
  };

  const updateGdsTileDiagnostics = (updates: Partial<typeof gdsTileDiagnosticsRef.current>) => {
    const nextDiagnostics = {
      ...gdsTileDiagnosticsRef.current,
      ...updates,
    };
    gdsTileDiagnosticsRef.current = nextDiagnostics;
    setGdsTileDiagnostics(nextDiagnostics);
  };

  const updateGdsTileMetrics = (tile?: LspLayoutTileGeometry | null) => {
    if (!isGdsTileModeRef.current) {
      return;
    }

    const now = performance.now();
    if (!tile && now - lastGdsMetricsSyncAtRef.current < 250) {
      if (gdsMetricsSyncTimeoutRef.current === null) {
        gdsMetricsSyncTimeoutRef.current = window.setTimeout(() => {
          gdsMetricsSyncTimeoutRef.current = null;
          updateGdsTileMetrics();
        }, Math.max(16, 250 - (now - lastGdsMetricsSyncAtRef.current)));
      }
      return;
    }
    if (gdsMetricsSyncTimeoutRef.current !== null) {
      window.clearTimeout(gdsMetricsSyncTimeoutRef.current);
      gdsMetricsSyncTimeoutRef.current = null;
    }
    lastGdsMetricsSyncAtRef.current = now;

    const nextMetrics = createGdsTileMetricsSnapshot({
      frameDurationsMs: frameDurationsRef.current,
      meshBatchCount: meshStatsRef.current.meshBatchCount,
      meshDrawNodeCount: meshStatsRef.current.drawNodeCount,
      meshIndexCount: meshStatsRef.current.indexCount,
      meshVertexCount: meshStatsRef.current.vertexCount,
      renderMs: lastRenderDurationMsRef.current,
      tile: tile ?? null,
      tileRequestCount: tileRequestCountRef.current,
      tileRoundtripMs: lastTileRoundtripMsRef.current,
    });
    setGdsTileMetrics(nextMetrics);
    onGdsTileMetricsChangeRef.current?.(nextMetrics);
  };

  const updateTransforms = () => {
    const world = worldRef.current;
    if (!world) {
      return;
    }

    const nextCamera = cameraRef.current;
    world.position.set(nextCamera.panX, nextCamera.panY);
    world.scale.set(nextCamera.zoom);
  };

  const updateMinimapOverlay = () => {
    const minimap = minimapGraphicsRef.current;
    if (!minimap) {
      return;
    }

    minimap.clear();
    const model = createCurrentMinimapModel();
    minimapModelRef.current = model;
    syncMinimapModelState();
    if (!model.visible) {
      return;
    }

    drawGdsMinimap(minimap, model);
  };

  const createCurrentMinimapModel = () => createPhysicalLayoutMinimapModel({
    canvasSize: sizeRef.current,
    cellBounds: isGdsTileModeRef.current ? selectedBoundsRef.current : null,
    viewportBounds: isGdsTileModeRef.current
      ? getViewportWorldBounds(cameraRef.current, sizeRef.current, 0)
      : null,
  });

  const syncMinimapModelState = (force = false) => {
    const nextModel = minimapModelRef.current;
    const now = performance.now();
    if (!isGdsTileModeRef.current || force || now - lastMinimapSyncAtRef.current >= 120) {
      if (minimapSyncTimeoutRef.current !== null) {
        window.clearTimeout(minimapSyncTimeoutRef.current);
        minimapSyncTimeoutRef.current = null;
      }
      lastMinimapSyncAtRef.current = now;
      setMinimapModel((previousModel) => areMinimapModelsEqual(previousModel, nextModel) ? previousModel : nextModel);
      return;
    }

    if (minimapSyncTimeoutRef.current === null) {
      minimapSyncTimeoutRef.current = window.setTimeout(() => {
        minimapSyncTimeoutRef.current = null;
        lastMinimapSyncAtRef.current = performance.now();
        const currentModel = minimapModelRef.current;
        setMinimapModel((previousModel) => areMinimapModelsEqual(previousModel, currentModel) ? previousModel : currentModel);
      }, Math.max(16, 120 - (now - lastMinimapSyncAtRef.current)));
    }
  };

  const redrawScene = (overrideGeometry?: LspLayoutGeometry | null) => {
    const background = backgroundRef.current;
    const world = worldRef.current;
    const app = appRef.current;
    if (!background || !world || !app) {
      return;
    }

    background.removeChildren().forEach((child) => child.destroy({ children: true }));
    world.removeChildren().forEach((child) => child.destroy({ children: true }));
    background.addChild(drawBackground(size.width, size.height));

    const bounds = selectedBoundsRef.current;
    if (!bounds) {
      return;
    }

    world.addChild(drawGrid(bounds));
    if (outlineVisibleRef.current) {
      world.addChild(drawLayoutOutline(bounds));
    }
    const nextShapes = overrideGeometry
      ? selectLayoutTargetShapes(catalog, overrideGeometry, selectedTarget)
      : selectedShapesRef.current;
    const visibleNextShapes = overrideGeometry
      ? filterVisiblePhysicalLayoutShapes(nextShapes, layoutVisibility, catalog?.sourceKind)
      : selectedShapesRef.current;
    const shapeDisplay = isGdsTileMode
      ? drawGdsTileShapes(visibleNextShapes, layoutVisibility)
      : drawShapes(visibleNextShapes, layoutVisibility);
    meshStatsRef.current = shapeDisplay.stats;
    world.addChild(shapeDisplay.node);
    const highlightedShape = selectedShapesRef.current.find((shape) => shape.index === highlightedShapeIndexRef.current) ?? null;
    if (highlightedShape) {
      world.addChild(drawHighlightedShape(highlightedShape));
    }
    const labels = drawPinLabels(selectedLabelsRef.current);
    if (labels.length > 0) {
      world.addChild(...labels);
    }
  };

  return (
    <div
      ref={hostRef}
      aria-label="Physical layout editor canvas"
      className="relative h-full min-h-0 w-full overflow-hidden bg-[#101317] outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [&>canvas]:outline-none [&>canvas]:focus:outline-none [&>canvas]:focus:ring-0 [&>canvas]:focus-visible:outline-none [&>canvas]:focus-visible:ring-0"
      data-catalog-pin-count={catalogPinCount}
      data-gds-average-fps={gdsTileMetrics.averageFps.toFixed(1)}
      data-gds-frame-p95-ms={gdsTileMetrics.frameP95Ms.toFixed(1)}
      data-gds-draw-node-count={meshStatsRef.current.drawNodeCount}
      data-gds-displayed-tile-state={gdsTileDiagnostics.displayedState}
      data-gds-empty-tile-reason={gdsTileDiagnostics.emptyReason}
      data-gds-final-tile-lod={gdsTileDiagnostics.finalLod}
      data-gds-last-good-shape-count={gdsTileDiagnostics.lastGoodShapeCount}
      data-gds-mesh-buffer-bytes={gdsTileMetrics.bufferByteLength + gdsTileMetrics.indexByteLength}
      data-gds-mesh-batch-count={meshStatsRef.current.meshBatchCount}
      data-gds-minimap-cell-height={minimapModel?.visible ? minimapModel.cellWorldHeight.toFixed(4) : ''}
      data-gds-minimap-cell-width={minimapModel?.visible ? minimapModel.cellWorldWidth.toFixed(4) : ''}
      data-gds-minimap-viewport-height={minimapModel?.visible ? minimapModel.viewport.height.toFixed(2) : ''}
      data-gds-minimap-viewport-width={minimapModel?.visible ? minimapModel.viewport.width.toFixed(2) : ''}
      data-gds-minimap-viewport-world-height={minimapModel?.visible ? minimapModel.viewportWorldHeight.toFixed(4) : ''}
      data-gds-minimap-viewport-world-width={minimapModel?.visible ? minimapModel.viewportWorldWidth.toFixed(4) : ''}
      data-gds-minimap-viewport-world-x={minimapModel?.visible ? minimapModel.viewportWorld.x0.toFixed(4) : ''}
      data-gds-minimap-viewport-world-y={minimapModel?.visible ? minimapModel.viewportWorld.y0.toFixed(4) : ''}
      data-gds-minimap-viewport-x={minimapModel?.visible ? minimapModel.viewport.x.toFixed(2) : ''}
      data-gds-minimap-viewport-y={minimapModel?.visible ? minimapModel.viewport.y.toFixed(2) : ''}
      data-gds-minimap-visible={minimapModel?.visible ? 'true' : 'false'}
      data-gds-precise-tile-pending={gdsTileDiagnostics.precisePending ? 'true' : 'false'}
      data-gds-render-batch-mode={isGdsTileMode ? 'order-bucket' : 'none'}
      data-gds-render-bucket-size={isGdsTileMode ? meshStatsRef.current.orderBucketSize : 0}
      data-gds-render-mode={isGdsTileMode ? 'tile-mesh' : 'full-graphics'}
      data-gds-tile-lod={gdsTileDiagnostics.tileLod}
      data-gds-render-ms={gdsTileMetrics.lastRenderMs.toFixed(2)}
      data-gds-tile-query-ms={gdsTileMetrics.lastTileQueryMs.toFixed(2)}
      data-gds-tile-request-count={tileRequestCountRef.current}
      data-gds-tile-roundtrip-ms={gdsTileMetrics.lastTileRoundtripMs.toFixed(2)}
      data-gds-tile-shape-count={gdsTileGeometry?.shapes.length ?? 0}
      data-gds-truncated={gdsTileMetrics.truncated ? 'true' : 'false'}
      data-geometry-shape-count={activeGeometry?.shapes.length ?? 0}
      data-hidden-layer-count={Math.max(0, layerCount - visibleLayerCount)}
      data-highlighted-shape-index={highlightedShapeIndex ?? ''}
      data-layer-opacity-summary={formatPhysicalLayoutLayerOpacitySummary(layoutVisibility)}
      data-outline-visible={outlineVisible ? 'true' : 'false'}
      data-layer-count={layerCount}
      data-last-pick-shape-index={lastPick?.shapeIndex ?? ''}
      data-last-pick-world-x={lastPick ? lastPick.worldX.toFixed(4) : ''}
      data-last-pick-world-y={lastPick ? lastPick.worldY.toFixed(4) : ''}
      data-macro-count={catalog?.macros.length ?? 0}
      data-pan-x={cameraSync.panX.toFixed(2)}
      data-pan-y={cameraSync.panY.toFixed(2)}
      data-render-count={renderCount}
      data-renderer={renderer}
      data-selected-macro-name={selectedTarget?.kind === 'macro' ? selectedTarget.name : ''}
      data-selected-target-kind={selectedTarget?.kind ?? ''}
      data-selected-target-name={selectedTarget?.name ?? ''}
      data-selected-pin-count={selectedPinCount}
      data-selected-shape-count={selectedShapes.length}
      data-shape-count={selectedShapes.length}
      data-testid="physical-layout-canvas"
      data-visible-category-count={visibleCategoryCount}
      data-first-visible-shape-index={visibleShapes[0]?.index ?? ''}
      data-first-visible-shape-screen-x={formatShapeScreenX(visibleShapes[0], camera)}
      data-first-visible-shape-screen-y={formatShapeScreenY(visibleShapes[0], camera)}
      data-pick-visible-shape-category={pickableShape ? getCanvasShapeCategory(pickableShape.shape) : ''}
      data-pick-visible-shape-index={pickableShape?.shape.index ?? ''}
      data-pick-visible-shape-layer-index={pickableShape?.shape.layerIndex ?? ''}
      data-pick-visible-shape-screen-x={formatPickScreenX(pickableShape, camera)}
      data-pick-visible-shape-screen-y={formatPickScreenY(pickableShape, camera)}
      data-visible-label-count={visibleLabels.length}
      data-visible-label-names={visibleLabels.map((label) => label.name).join('|')}
      data-visible-layer-count={visibleLayerCount}
      data-visible-obstruction-shape-count={visibleShapeCounts.obstruction}
      data-visible-pin-shape-count={visibleShapeCounts.pin}
      data-source-kind={catalog?.sourceKind ?? ''}
      data-visible-shape-count={visibleShapes.length}
      data-zoom={cameraSync.zoom.toFixed(4)}
      role="img"
      tabIndex={-1}
    >
      {renderer === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-[12px] text-ide-error">
          {error ?? 'Layout renderer unavailable'}
        </div>
      )}
    </div>
  );
}

async function createPixiApp(host: HTMLElement) {
  const width = Math.max(minimumCanvasWidth, Math.floor(host.clientWidth));
  const height = Math.max(minimumCanvasHeight, Math.floor(host.clientHeight));
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
      app.canvas.dataset.physicalLayoutCanvas = 'true';
      app.canvas.tabIndex = -1;
      host.appendChild(app.canvas);
      return { app, renderer: preference };
    } catch (cause) {
      lastError = cause;
      app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to initialize layout renderer.');
}

function formatShapeScreenX(shape: LspLayoutShape | undefined, camera: PhysicalLayoutCamera): string {
  if (!shape) {
    return '';
  }

  const bounds = shapeBounds(shape);
  return (camera.panX + ((bounds.x0 + bounds.x1) / 2) * camera.zoom).toFixed(2);
}

function formatShapeScreenY(shape: LspLayoutShape | undefined, camera: PhysicalLayoutCamera): string {
  if (!shape) {
    return '';
  }

  const bounds = shapeBounds(shape);
  return (camera.panY + ((bounds.y0 + bounds.y1) / 2) * camera.zoom).toFixed(2);
}

interface PickableLayoutShape {
  point: { x: number; y: number };
  shape: LspLayoutShape;
}

function getPickableVisibleShape(
  shapes: readonly LspLayoutShape[],
  camera: PhysicalLayoutCamera,
  size: { width: number; height: number },
): PickableLayoutShape | null {
  const tolerance = 4 / camera.zoom;
  for (let shapeIndex = shapes.length - 1; shapeIndex >= 0; shapeIndex -= 1) {
    const shape = shapes[shapeIndex];
    if (!shape || shape.kind === 'path' || shape.kind === 'text') {
      continue;
    }

    for (const point of getShapePickCandidatePoints(shape)) {
      const topShape = findShapeAtLayoutPoint(shapes, point, tolerance);
      if (topShape?.index !== shape.index) {
        continue;
      }

      const screenX = camera.panX + point.x * camera.zoom;
      const screenY = camera.panY + point.y * camera.zoom;
      if (screenX >= 2 && screenX <= size.width - 2 && screenY >= 2 && screenY <= size.height - 2) {
        return { point, shape };
      }
    }
  }

  return null;
}

function getShapePickCandidatePoints(shape: LspLayoutShape): Array<{ x: number; y: number }> {
  const bounds = shapeBounds(shape);
  const candidates: Array<{ x: number; y: number }> = [
    {
      x: (bounds.x0 + bounds.x1) / 2,
      y: (bounds.y0 + bounds.y1) / 2,
    },
  ];

  if (shape.polygon && shape.polygon.length > 0) {
    const centroid = shape.polygon.reduce(
      (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
      { x: 0, y: 0 },
    );
    candidates.push({
      x: centroid.x / shape.polygon.length,
      y: centroid.y / shape.polygon.length,
    });
  }

  for (const xFraction of [0.25, 0.5, 0.75]) {
    for (const yFraction of [0.25, 0.5, 0.75]) {
      candidates.push({
        x: bounds.x0 + (bounds.x1 - bounds.x0) * xFraction,
        y: bounds.y0 + (bounds.y1 - bounds.y0) * yFraction,
      });
    }
  }

  return candidates;
}

function formatPickScreenX(pickableShape: PickableLayoutShape | null, camera: PhysicalLayoutCamera): string {
  if (!pickableShape) {
    return '';
  }

  return (camera.panX + pickableShape.point.x * camera.zoom).toFixed(2);
}

function formatPickScreenY(pickableShape: PickableLayoutShape | null, camera: PhysicalLayoutCamera): string {
  if (!pickableShape) {
    return '';
  }

  return (camera.panY + pickableShape.point.y * camera.zoom).toFixed(2);
}

function drawBackground(width: number, height: number) {
  return new Graphics()
    .rect(0, 0, width, height)
    .fill({ color: 0x101317, alpha: 1 });
}

function drawGdsMinimap(graphics: Graphics, model: PhysicalLayoutMinimapModel) {
  graphics
    .roundRect(model.panel.x, model.panel.y, model.panel.width, model.panel.height, 6)
    .fill({ color: 0x0b1117, alpha: 0.78 })
    .stroke({ color: 0x34404c, alpha: 0.8, width: 1 });
  graphics
    .rect(model.cell.x, model.cell.y, model.cell.width, model.cell.height)
    .fill({ color: 0x5b7286, alpha: 0.2 })
    .stroke({ color: 0x94a3b8, alpha: 0.9, width: 1 });
  graphics
    .rect(model.viewport.x, model.viewport.y, model.viewport.width, model.viewport.height)
    .stroke({ color: 0xf8fafc, alpha: 0.98, width: 1.5 });
}

function areMinimapModelsEqual(
  left: PhysicalLayoutMinimapModel | null,
  right: PhysicalLayoutMinimapModel | null,
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.visible === right.visible
    && areMinimapRectsEqual(left.panel, right.panel)
    && areMinimapRectsEqual(left.cell, right.cell)
    && areMinimapRectsEqual(left.viewport, right.viewport)
    && Math.abs(left.cellWorldWidth - right.cellWorldWidth) < 0.001
    && Math.abs(left.cellWorldHeight - right.cellWorldHeight) < 0.001
    && Math.abs(left.viewportWorld.x0 - right.viewportWorld.x0) < 0.001
    && Math.abs(left.viewportWorld.y0 - right.viewportWorld.y0) < 0.001
    && Math.abs(left.viewportWorld.x1 - right.viewportWorld.x1) < 0.001
    && Math.abs(left.viewportWorld.y1 - right.viewportWorld.y1) < 0.001;
}

function areMinimapRectsEqual(left: { x: number; y: number; width: number; height: number }, right: { x: number; y: number; width: number; height: number }): boolean {
  return Math.abs(left.x - right.x) < 0.01
    && Math.abs(left.y - right.y) < 0.01
    && Math.abs(left.width - right.width) < 0.01
    && Math.abs(left.height - right.height) < 0.01;
}

function drawGrid(bounds: LspLayoutBounds) {
  const graphics = new Graphics();

  for (let x = Math.floor(bounds.x0 / gridMinorStep) * gridMinorStep; x <= bounds.x1 + 0.001; x += gridMinorStep) {
    const isMajor = Math.abs(Math.round(x / gridMajorStep) - x / gridMajorStep) < 0.001;
    graphics
      .moveTo(x, bounds.y0)
      .lineTo(x, bounds.y1)
      .stroke({ color: isMajor ? 0x34404c : 0x1e2730, alpha: isMajor ? 0.5 : 0.28, width: 0.008 });
  }

  for (let y = Math.floor(bounds.y0 / gridMinorStep) * gridMinorStep; y <= bounds.y1 + 0.001; y += gridMinorStep) {
    const isMajor = Math.abs(Math.round(y / gridMajorStep) - y / gridMajorStep) < 0.001;
    graphics
      .moveTo(bounds.x0, y)
      .lineTo(bounds.x1, y)
      .stroke({ color: isMajor ? 0x34404c : 0x1e2730, alpha: isMajor ? 0.5 : 0.28, width: 0.008 });
  }

  return graphics;
}

function drawLayoutOutline(bounds: LspLayoutBounds) {
  return new Graphics()
    .rect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0)
    .fill({ color: 0x151c24, alpha: 0.48 })
    .stroke({ color: 0xe5eef8, alpha: 0.9, width: 0.025 });
}

interface PhysicalLayoutShapeDisplay {
  node: Container;
  stats: {
    drawNodeCount: number;
    indexCount: number;
    orderBucketSize: number;
    meshBatchCount: number;
    vertexCount: number;
  };
}

interface PhysicalLayoutMeshBatch {
  alpha: number;
  color: number;
  indices: number[];
  positions: number[];
}

interface PhysicalLayoutGdsTileOrderBucket {
  batches: Map<string, PhysicalLayoutMeshBatch>;
  fallbackGraphics: Graphics;
  hasFallbackGraphics: boolean;
}

function drawShapes(shapes: readonly LspLayoutShape[], layoutVisibility: PhysicalLayoutVisibility): PhysicalLayoutShapeDisplay {
  const graphics = new Graphics();

  for (const shape of shapes) {
    const category = getCanvasShapeCategory(shape);
    const color = getPhysicalLayoutLayerCategoryColor(shape.layerIndex, category).pixiColor;
    const layerOpacity = getPhysicalLayoutLayerOpacity(layoutVisibility, shape.layerIndex);
    const alpha = (category === 'obstruction' || category === 'blockage' ? 0.28 : 0.7) * layerOpacity;

    if (shape.kind === 'polygon' && shape.polygon && shape.polygon.length >= 3) {
      graphics
        .poly(shape.polygon.flatMap((point) => [point.x, point.y]), true)
        .fill({ color, alpha })
        .stroke({ color, alpha: 0.9 * layerOpacity, width: 0.018 });
      continue;
    }

    const x0 = Math.min(shape.rect.x0, shape.rect.x1);
    const y0 = Math.min(shape.rect.y0, shape.rect.y1);
    const width = Math.max(Math.abs(shape.rect.x1 - shape.rect.x0), 0.01);
    const height = Math.max(Math.abs(shape.rect.y1 - shape.rect.y0), 0.01);
    graphics
      .rect(x0, y0, width, height)
      .fill({ color, alpha })
      .stroke({ color, alpha: 0.92 * layerOpacity, width: 0.015 });
  }

  const container = new Container({ label: 'layout-shapes-graphics' });
  container.addChild(graphics);
  return {
    node: container,
    stats: {
      drawNodeCount: 1,
      indexCount: 0,
      orderBucketSize: 0,
      meshBatchCount: 0,
      vertexCount: 0,
    },
  };
}

function drawGdsTileShapes(shapes: readonly LspLayoutShape[], layoutVisibility: PhysicalLayoutVisibility): PhysicalLayoutShapeDisplay {
  const container = new Container({ label: 'gds-tile-shapes' });
  const buckets: PhysicalLayoutGdsTileOrderBucket[] = [];
  const orderBucketSize = getGdsTileOrderBucketSize(shapes.length);
  let visibleShapeOrdinal = 0;

  for (const shape of shapes) {
    const style = getGdsTileShapeStyle(shape, layoutVisibility, getPhysicalLayoutLayerCategoryColor);
    if (!style) {
      continue;
    }

    const bucketIndex = Math.floor(visibleShapeOrdinal / orderBucketSize);
    visibleShapeOrdinal += 1;
    const bucket = getGdsTileOrderBucket(buckets, bucketIndex);
    const points = getMeshableShapePoints(shape);
    if (points && isConvexPolygon(points)) {
      const batchKey = getGdsTileMeshBatchKey(shape, style);
      const batch = bucket.batches.get(batchKey) ?? {
        alpha: style.alpha,
        color: style.color,
        indices: [],
        positions: [],
      };
      addPolygonToMeshBatch(batch, points);
      bucket.batches.set(batchKey, batch);
      drawGdsTileShapeStroke(bucket.fallbackGraphics, shape, style);
      bucket.hasFallbackGraphics = true;
      continue;
    }

    drawGdsTileShapeGraphics(bucket.fallbackGraphics, shape, style);
    bucket.hasFallbackGraphics = true;
  }

  let vertexCount = 0;
  let indexCount = 0;
  let meshBatchCount = 0;
  let drawNodeCount = 0;
  for (const bucket of buckets) {
    const bucketContainer = new Container({ label: 'gds-tile-order-bucket' });
    for (const batch of bucket.batches.values()) {
      if (batch.positions.length === 0 || batch.indices.length === 0) {
        continue;
      }

      vertexCount += batch.positions.length / 2;
      indexCount += batch.indices.length;
      meshBatchCount += 1;
      drawNodeCount += 1;
      const geometry = new MeshGeometry({
        indices: new Uint32Array(batch.indices),
        positions: new Float32Array(batch.positions),
        shrinkBuffersToFit: false,
        topology: 'triangle-list',
        uvs: createZeroUvs(batch.positions.length / 2),
      });
      const mesh = new Mesh({
        geometry,
        label: 'gds-tile-fill-mesh',
        texture: Texture.WHITE,
      });
      mesh.tint = batch.color;
      mesh.alpha = batch.alpha;
      bucketContainer.addChild(mesh);
    }

    if (bucket.hasFallbackGraphics || bucket.batches.size > 0) {
      bucketContainer.addChild(bucket.fallbackGraphics);
      drawNodeCount += 1;
    }
    if (bucketContainer.children.length > 0) {
      container.addChild(bucketContainer);
    } else {
      bucket.fallbackGraphics.destroy();
      bucketContainer.destroy({ children: true });
    }
  }

  return {
    node: container,
    stats: {
      drawNodeCount,
      indexCount,
      orderBucketSize,
      meshBatchCount,
      vertexCount,
    },
  };
}

function getGdsTileOrderBucket(
  buckets: PhysicalLayoutGdsTileOrderBucket[],
  bucketIndex: number,
): PhysicalLayoutGdsTileOrderBucket {
  let bucket = buckets[bucketIndex];
  if (!bucket) {
    bucket = {
      batches: new Map<string, PhysicalLayoutMeshBatch>(),
      fallbackGraphics: new Graphics(),
      hasFallbackGraphics: false,
    };
    buckets[bucketIndex] = bucket;
  }
  return bucket;
}

function getGdsTileOrderBucketSize(shapeCount: number): number {
  return shapeCount <= GDS_TILE_PRECISE_ORDER_SHAPE_LIMIT ? 1 : GDS_TILE_ORDER_BUCKET_SIZE;
}

function getGdsTileMeshBatchKey(shape: LspLayoutShape, style: PhysicalLayoutGdsTileShapeStyle): string {
  return [
    shape.layerIndex,
    getCanvasShapeCategory(shape),
    style.color,
    style.alpha.toFixed(3),
    style.strokeAlpha.toFixed(3),
    style.strokeWidth.toFixed(4),
  ].join(':');
}

function getMeshableShapePoints(shape: LspLayoutShape): Array<{ x: number; y: number }> | null {
  if (shape.kind === 'polygon' && shape.polygon && shape.polygon.length >= 3) {
    return shape.polygon;
  }

  if (shape.kind === 'rect') {
    const bounds = shapeBounds(shape);
    return [
      { x: bounds.x0, y: bounds.y0 },
      { x: bounds.x1, y: bounds.y0 },
      { x: bounds.x1, y: bounds.y1 },
      { x: bounds.x0, y: bounds.y1 },
    ];
  }

  return null;
}

function addPolygonToMeshBatch(batch: PhysicalLayoutMeshBatch, points: readonly { x: number; y: number }[]) {
  const baseIndex = batch.positions.length / 2;
  for (const point of points) {
    batch.positions.push(point.x, point.y);
  }

  for (let pointIndex = 1; pointIndex < points.length - 1; pointIndex += 1) {
    batch.indices.push(baseIndex, baseIndex + pointIndex, baseIndex + pointIndex + 1);
  }
}

function drawGdsTileShapeStroke(
  graphics: Graphics,
  shape: LspLayoutShape,
  style: PhysicalLayoutGdsTileShapeStyle,
) {
  if (shape.kind === 'polygon' && shape.polygon && shape.polygon.length >= 3) {
    graphics
      .poly(shape.polygon.flatMap((point) => [point.x, point.y]), true)
      .stroke({ color: style.color, alpha: style.strokeAlpha, width: style.strokeWidth });
    return;
  }

  const bounds = shapeBounds(shape);
  graphics
    .rect(bounds.x0, bounds.y0, Math.max(bounds.x1 - bounds.x0, 0.01), Math.max(bounds.y1 - bounds.y0, 0.01))
    .stroke({ color: style.color, alpha: style.strokeAlpha, width: style.strokeWidth });
}

function drawGdsTileShapeGraphics(
  graphics: Graphics,
  shape: LspLayoutShape,
  style: PhysicalLayoutGdsTileShapeStyle,
) {
  if (shape.kind === 'polygon' && shape.polygon && shape.polygon.length >= 3) {
    graphics
      .poly(shape.polygon.flatMap((point) => [point.x, point.y]), true)
      .fill({ color: style.color, alpha: style.alpha })
      .stroke({ color: style.color, alpha: style.strokeAlpha, width: style.strokeWidth });
    return;
  }

  const bounds = shapeBounds(shape);
  graphics
    .rect(bounds.x0, bounds.y0, Math.max(bounds.x1 - bounds.x0, 0.01), Math.max(bounds.y1 - bounds.y0, 0.01))
    .fill({ color: style.color, alpha: style.alpha })
    .stroke({ color: style.color, alpha: style.strokeAlpha, width: style.strokeWidth });
}

function createZeroUvs(vertexCount: number): Float32Array {
  return new Float32Array(vertexCount * 2);
}

function isConvexPolygon(points: readonly { x: number; y: number }[]): boolean {
  if (points.length < 3) {
    return false;
  }

  let sign = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const c = points[(index + 2) % points.length];
    if (!a || !b || !c) {
      continue;
    }

    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) {
      continue;
    }

    const nextSign = Math.sign(cross);
    if (sign === 0) {
      sign = nextSign;
      continue;
    }

    if (sign !== nextSign) {
      return false;
    }
  }

  return true;
}

function drawHighlightedShape(shape: LspLayoutShape) {
  const graphics = new Graphics();
  const highlightColor = 0xf8fafc;

  if (shape.kind === 'polygon' && shape.polygon && shape.polygon.length >= 3) {
    return graphics
      .poly(shape.polygon.flatMap((point) => [point.x, point.y]), true)
      .fill({ color: highlightColor, alpha: 0.2 })
      .stroke({ color: highlightColor, alpha: 1, width: 0.045 });
  }

  const bounds = shapeBounds(shape);
  return graphics
    .rect(bounds.x0, bounds.y0, Math.max(bounds.x1 - bounds.x0, 0.01), Math.max(bounds.y1 - bounds.y0, 0.01))
    .fill({ color: highlightColor, alpha: 0.2 })
    .stroke({ color: highlightColor, alpha: 1, width: 0.045 });
}

function getCanvasShapeCategory(shape: LspLayoutShape): PhysicalLayoutLayerCategory {
  if (shape.ownerKind === 'obstruction') {
    return 'obstruction';
  }
  if (shape.ownerKind === 'net') {
    return 'net';
  }
  if (shape.ownerKind === 'specialNet') {
    return 'specialNet';
  }
  if (shape.ownerKind === 'blockage') {
    return 'blockage';
  }
  if (shape.ownerKind === 'gdsElement') {
    if (shape.kind === 'text') {
      return 'text';
    }
    if (shape.kind === 'path') {
      return 'path';
    }
    return 'boundary';
  }

  return 'pin';
}

function drawPinLabels(labels: readonly PhysicalLayoutPinLabel[]) {
  const baseFontSize = 14;
  const worldFontSize = 0.16;

  return labels.map((label) => {
    const text = new Text({
      text: label.name,
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: baseFontSize,
        fontWeight: '600',
        fill: label.color,
        stroke: { color: 0x101317, width: 3 },
      },
    });

    text.anchor.set(0.5);
    text.alpha = label.opacity;
    text.position.set(label.x, label.y);
    text.scale.set(worldFontSize / baseFontSize);
    text.resolution = 2;
    return text;
  });
}
