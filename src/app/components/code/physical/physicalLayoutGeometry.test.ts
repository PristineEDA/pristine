import { describe, expect, it } from 'vitest';

import type { LspLayoutCatalog, LspLayoutGeometry, LspLayoutShape } from '../../../../../types/systemverilog-lsp';
import { layoutFixtureGdsGeometry, layoutFixtureGdsOpenResult, layoutFixtureGeometry, layoutFixtureOpenResult } from '../../../../test/layoutFixture';
import {
  applyLayoutWheel,
  findShapeAtLayoutPoint,
  findLayoutMacro,
  getFitLayoutCamera,
  getFirstLayoutMacroName,
  getMacroBounds,
  getShapesBounds,
  selectMacroShapes,
  selectLayoutTargetShapes,
} from './physicalLayoutGeometry';
import {
  createPhysicalLayout3DSceneInput,
  getPhysicalLayout3DCenter,
  getPhysicalLayout3DDepth,
  getPhysicalLayout3DBounds,
  getPhysicalLayout3DLayerZ,
} from './physicalLayout3dGeometry';
import {
  getPhysicalLayout3DBaseGridMaterialOptions,
  getPhysicalLayout3DBaseOutlineMaterialOptions,
  getPhysicalLayout3DEdgeMaterialOptions,
  getPhysicalLayout3DEdgeRenderOrder,
  getPhysicalLayout3DMeshMaterialOptions,
  getPhysicalLayout3DShapeRenderOrder,
  physicalLayout3DRenderOrders,
} from './physicalLayout3dRendering';
import {
  getPhysicalLayout3DViewHelperAxisColor,
  getPhysicalLayout3DViewHelperTargetOrbit,
  getPhysicalLayout3DViewHelperViewport,
  physicalLayout3DViewHelperSize,
} from './physicalLayout3dViewHelper';
import {
  createEmptyGdsTileGeometry,
  createGdsFullCellTileRequestPlan,
  createGdsTileAtlasUpdate,
  createGdsOverviewRetryTileRequestPlan,
  createGdsPreciseTileRequestPlan,
  createGdsTileFilterKey,
  createGdsTileMetricsSnapshot,
  createGdsTileRequestPlan,
  createGdsRetryTileRequestPlan,
  createGdsTileWindowPlan,
  createMergedGdsTileGeometry,
  doLayoutBoundsIntersect,
  estimateGdsDisplayedTileAtlasByteLength,
  estimateGdsTileByteLength,
  getGdsEmptyTileRetryKind,
  getLayoutBoundsIntersectionArea,
  getGdsTileLod,
  getGdsTileShapeStyle,
  PhysicalLayoutGdsTileLruCache,
  shouldRequestPreciseGdsTile,
  shouldUseFullCellGdsTile,
  getViewportWorldBounds,
  mergeGdsTileGeometryResults,
} from './physicalLayoutGdsTiles';
import { createPhysicalLayoutMinimapModel } from './physicalLayoutMinimap';
import {
  createEmptyPhysicalLayoutVisibility,
  createPhysicalLayoutLayerTree,
  createPhysicalLayoutPinLabels,
  createPhysicalLayoutVisibility,
  formatPhysicalLayoutLayerOpacitySummary,
  filterVisiblePhysicalLayoutShapes,
  getPhysicalLayoutLayerCategoryColor,
  getPhysicalLayoutLayerColor,
  getPhysicalLayoutLayerOpacity,
  getPhysicalLayoutOutlineColor,
  getVisiblePhysicalLayoutShapeCounts,
  isPhysicalLayoutLayerCategoryVisible,
  isPhysicalLayoutOutlineVisible,
  normalizePhysicalLayoutLayerOpacity,
} from './physicalLayoutLayers';

describe('physicalLayoutGeometry', () => {
  const catalog = layoutFixtureOpenResult.catalog;

  it('selects the first available macro name', () => {
    expect(getFirstLayoutMacroName(catalog)).toBe('sg13g2_inv_1');
    expect(getFirstLayoutMacroName(null)).toBeNull();
  });

  it('finds macro bounds from catalog data', () => {
    const macro = findLayoutMacro(catalog, 'sg13g2_nand2_1');

    expect(macro?.name).toBe('sg13g2_nand2_1');
    expect(macro ? getMacroBounds(macro) : null).toEqual({ x0: 0, y0: 0, x1: 2.4, y1: 3.78 });
  });

  it('filters selected macro geometry using macro ownership', () => {
    const inverterShapes = selectMacroShapes(catalog, layoutFixtureGeometry, 'sg13g2_inv_1');
    const nandShapes = selectMacroShapes(catalog, layoutFixtureGeometry, 'sg13g2_nand2_1');

    expect(inverterShapes).toHaveLength(3);
    expect(inverterShapes.every((shape) => shape.macroIndex === 0)).toBe(true);
    expect(nandShapes).toHaveLength(1);
    expect(nandShapes.every((shape) => shape.macroIndex === 1)).toBe(true);
  });

  it('does not include overlapping shapes from other macros', () => {
    const inverterShapes = selectMacroShapes(catalog, layoutFixtureGeometry, 'sg13g2_inv_1');

    expect(inverterShapes.some((shape) => shape.ownerKind === 'obstruction' && shape.ownerIndex === 1)).toBe(false);
  });

  it('computes fit camera from layout bounds and viewport size', () => {
    const camera = getFitLayoutCamera({ x0: 0, y0: 0, x1: 2, y1: 4 }, { width: 400, height: 300 });

    expect(camera.zoom).toBeGreaterThan(2);
    expect(camera.panX).toBeGreaterThan(0);
    expect(camera.panY).toBeGreaterThan(0);
  });

  it('clamps fit camera zoom to the Physical layout maximum', () => {
    const camera = getFitLayoutCamera({ x0: 0, y0: 0, x1: 0.001, y1: 0.001 }, { width: 800, height: 600 });

    expect(camera.zoom).toBe(1000);
  });

  it('allows GDS callers to fit very large layout bounds below the default minimum zoom', () => {
    const camera = getFitLayoutCamera(
      { x0: 0, y0: 0, x1: 100_000, y1: 50_000 },
      { width: 800, height: 600 },
      { max: 1000, min: 0.000001 },
    );

    expect(camera.zoom).toBeGreaterThan(0);
    expect(camera.zoom).toBeLessThan(2);
    expect(camera.panX).toBeGreaterThan(0);
  });

  it('computes shape bounds with a fallback', () => {
    expect(getShapesBounds([], { x0: 0, y0: 0, x1: 1, y1: 1 })).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
    expect(getShapesBounds(layoutFixtureGeometry.shapes, null)).toEqual({ x0: 0.12, y0: 0.42, x1: 2.18, y1: 3.08 });
  });

  it('applies wheel pan and zoom shortcuts', () => {
    const camera = { panX: 10, panY: 20, zoom: 30 };

    expect(applyLayoutWheel(camera, {
      clientX: 100,
      clientY: 100,
      deltaX: 0,
      deltaY: 50,
    }, { x: 0, y: 0 }).panY).toBe(-30);

    expect(applyLayoutWheel(camera, {
      clientX: 100,
      clientY: 100,
      deltaX: 0,
      deltaY: 50,
      shiftKey: true,
    }, { x: 0, y: 0 }).panX).toBe(-40);

    expect(applyLayoutWheel(camera, {
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      deltaX: 0,
      deltaY: -120,
    }, { x: 0, y: 0 }).zoom).toBeGreaterThan(camera.zoom);
  });

  it('clamps wheel zoom to the Physical layout maximum', () => {
    expect(applyLayoutWheel({
      panX: 0,
      panY: 0,
      zoom: 980,
    }, {
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      deltaX: 0,
      deltaY: -500,
    }, { x: 0, y: 0 }).zoom).toBe(1000);
  });

  it('uses caller zoom limits when applying wheel zoom', () => {
    expect(applyLayoutWheel({
      panX: 0,
      panY: 0,
      zoom: 0.5,
    }, {
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      deltaX: 0,
      deltaY: 500,
    }, { x: 0, y: 0 }, { max: 1000, min: 0.01 }).zoom).toBeGreaterThanOrEqual(0.01);
  });

  it('plans GDS viewport tile requests without using full target geometry', () => {
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, layoutFixtureGdsGeometry.shapes);
    const camera = { panX: 20, panY: 30, zoom: 10 };
    const bounds = getViewportWorldBounds(camera, { width: 400, height: 200 }, 0);
    const plan = createGdsTileRequestPlan({
      camera,
      rootCellIndex: 1,
      sessionId: 'layout-gds',
      size: { width: 400, height: 200 },
      visibility,
    });

    expect(bounds).toEqual({ x0: -2, y0: -3, x1: 38, y1: 17 });
    expect(getGdsTileLod(2)).toBe(2);
    expect(getGdsTileLod(12)).toBe(1);
    expect(getGdsTileLod(48)).toBe(0);
    expect(plan.options).toEqual(expect.objectContaining({
      bbox: expect.objectContaining({ x0: expect.any(Number), x1: expect.any(Number) }),
      lod: 1,
      rootCellIndex: 1,
      sessionId: 'layout-gds',
    }));
    expect(plan.layerIndices).toBeUndefined();
    expect(plan.options.layerIndices).toBeUndefined();
    expect(plan.shapeKinds).toBeUndefined();
    expect(plan.options.shapeKinds).toBeUndefined();
  });

  it('clips GDS tile request bounds to the selected cell bounds', () => {
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, layoutFixtureGdsGeometry.shapes);
    const plan = createGdsTileRequestPlan({
      camera: { panX: 0, panY: 0, zoom: 1 },
      rootCellIndex: 1,
      selectedBounds: { x0: 10, y0: 20, x1: 30, y1: 40 },
      sessionId: 'layout-gds',
      size: { height: 200, width: 200 },
      visibility,
    });

    expect(plan.empty).toBe(false);
    expect(plan.bbox).toEqual({ x0: 10, y0: 20, x1: 30, y1: 40 });
    expect(plan.options.bbox).toEqual(plan.bbox);
  });

  it('uses a full-cell precise GDS tile for small cells', () => {
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, layoutFixtureGdsGeometry.shapes);
    const selectedBounds = { x0: 10, y0: 20, x1: 30, y1: 40 };
    const plan = createGdsFullCellTileRequestPlan({
      camera: { panX: -1000, panY: -500, zoom: 4 },
      rootCellIndex: 1,
      selectedBounds,
      sessionId: 'layout-gds',
      size: { height: 200, width: 200 },
      visibility,
    });

    expect(shouldUseFullCellGdsTile({ selectedBounds })).toBe(true);
    expect(shouldUseFullCellGdsTile({ selectedBounds: { x0: 0, y0: 0, x1: 1000, y1: 1000 } })).toBe(false);
    expect(plan.empty).toBe(false);
    expect(plan.lod).toBe(0);
    expect(plan.bbox).toEqual(selectedBounds);
    expect(plan.options.bbox).toEqual(selectedBounds);
    expect(plan.options.layerIndices).toBeUndefined();
    expect(plan.options.shapeKinds).toBeUndefined();
    expect(plan.cacheKey).toContain('full-cell');
  });

  it('plans a stable GDS tile window with visible and prefetch tiles', () => {
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, layoutFixtureGdsGeometry.shapes);
    const plan = createGdsTileWindowPlan({
      camera: { panX: 0, panY: 0, zoom: 8 },
      rootCellIndex: 1,
      selectedBounds: { x0: 0, y0: 0, x1: 200, y1: 160 },
      sessionId: 'layout-gds',
      size: { height: 300, width: 500 },
      visibility,
    });

    expect(plan.primaryPlan.empty).toBe(false);
    expect(plan.visiblePlans.length).toBeGreaterThan(1);
    expect(plan.prefetchPlans.length).toBeGreaterThan(0);
    expect(new Set(plan.visiblePlans.map((tilePlan) => tilePlan.cacheKey)).size).toBe(plan.visiblePlans.length);
    expect(plan.visiblePlans.every((tilePlan) => doLayoutBoundsIntersect(tilePlan.bbox, plan.viewportBbox))).toBe(true);
  });

  it('keeps GDS tile window keys stable for small pan changes inside the same quantized grid', () => {
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, layoutFixtureGdsGeometry.shapes);
    const baseInput = {
      rootCellIndex: 1,
      selectedBounds: { x0: 0, y0: 0, x1: 200, y1: 160 },
      sessionId: 'layout-gds',
      size: { height: 300, width: 500 },
      visibility,
    };
    const firstPlan = createGdsTileWindowPlan({
      ...baseInput,
      camera: { panX: 0, panY: 0, zoom: 8 },
    });
    const secondPlan = createGdsTileWindowPlan({
      ...baseInput,
      camera: { panX: 8, panY: 6, zoom: 8 },
    });
    const firstKeys = new Set(firstPlan.visiblePlans.map((tilePlan) => tilePlan.cacheKey));
    const secondKeys = new Set(secondPlan.visiblePlans.map((tilePlan) => tilePlan.cacheKey));
    const sharedKeyCount = Array.from(firstKeys).filter((key) => secondKeys.has(key)).length;

    expect(firstPlan.tileWorldSize).toBe(secondPlan.tileWorldSize);
    expect(sharedKeyCount).toBeGreaterThan(0);
  });

  it('creates a bounded empty GDS tile plan when the viewport is outside the selected cell', () => {
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, layoutFixtureGdsGeometry.shapes);
    const plan = createGdsTileRequestPlan({
      camera: { panX: -10_000, panY: -10_000, zoom: 1 },
      rootCellIndex: 1,
      selectedBounds: { x0: 0, y0: 0, x1: 10, y1: 10 },
      sessionId: 'layout-gds',
      size: { height: 100, width: 100 },
      visibility,
    });

    expect(plan.empty).toBe(true);
    expect(plan.emptyReason).toBe('outside-cell-bounds');
    expect(plan.options.layerIndices).toBeUndefined();
    expect(plan.options.shapeKinds).toBeUndefined();
  });

  it('merges GDS window tiles with unique shape indices and measurable coverage', () => {
    const shape = layoutFixtureGdsGeometry.shapes[0] as LspLayoutShape;
    const firstTile = {
      ...createEmptyGdsTileGeometry(1000),
      geometry: {
        polygonPointCount: shape.polygon?.length ?? 0,
        shapeCount: 1,
        shapes: [{ ...shape, index: 0 }],
        truncated: false,
        unitsPerMicron: 1000,
      },
      tileShapeCount: 1,
    };
    const secondTile = {
      ...createEmptyGdsTileGeometry(1000),
      geometry: {
        polygonPointCount: shape.polygon?.length ?? 0,
        shapeCount: 1,
        shapes: [{ ...shape, index: 0 }],
        truncated: false,
        unitsPerMicron: 1000,
      },
      tileShapeCount: 1,
    };
    const merged = createMergedGdsTileGeometry([firstTile, secondTile]);

    expect(merged?.geometry.shapes.map((mergedShape) => mergedShape.index)).toEqual([0, 1]);
    expect(getLayoutBoundsIntersectionArea(
      { x0: 0, y0: 0, x1: 10, y1: 10 },
      { x0: 5, y0: 5, x1: 15, y1: 20 },
    )).toBe(25);
  });

  it('updates a GDS displayed tile atlas without clearing older viewport coverage', () => {
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, layoutFixtureGdsGeometry.shapes);
    const shape = layoutFixtureGdsGeometry.shapes[0] as LspLayoutShape;
    const oldTile = {
      ...createEmptyGdsTileGeometry(1000),
      geometry: {
        polygonPointCount: shape.polygon?.length ?? 0,
        shapeCount: 1,
        shapes: [{ ...shape, index: 0 }],
        truncated: false,
        unitsPerMicron: 1000,
      },
      tileShapeCount: 1,
    };
    const plan = createGdsTileWindowPlan({
      camera: { panX: 0, panY: 0, zoom: 8 },
      rootCellIndex: 1,
      selectedBounds: { x0: 0, y0: 0, x1: 200, y1: 160 },
      sessionId: 'layout-gds',
      size: { height: 300, width: 500 },
      visibility,
    });
    const oldEntry = {
      plan: plan.visiblePlans[0] ?? plan.primaryPlan,
      tile: oldTile,
    };
    const update = createGdsTileAtlasUpdate({
      currentTiles: new Map([[oldEntry.plan.cacheKey, oldEntry]]),
      incomingTiles: [],
      windowPlan: plan,
    });

    expect(update.tiles.size).toBe(1);
    expect(update.keptPreviousTileCount).toBe(1);
    expect(update.coverageRatio).toBeGreaterThan(0);
    expect(estimateGdsDisplayedTileAtlasByteLength(update.tiles)).toBeGreaterThan(0);
  });

  it('keeps raw GDS tile cache keys independent of layer opacity', () => {
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, layoutFixtureGdsGeometry.shapes);
    const opacityVisibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, layoutFixtureGdsGeometry.shapes);
    opacityVisibility.layerOpacities.set(opacityVisibility.layerOpacities.keys().next().value as number, 0.35);
    const baseInput = {
      camera: { panX: 20, panY: 30, zoom: 10 },
      rootCellIndex: 1,
      sessionId: 'layout-gds',
      size: { height: 200, width: 400 },
    };

    expect(createGdsTileFilterKey(visibility)).toBe(createGdsTileFilterKey(opacityVisibility));
    expect(createGdsTileRequestPlan({ ...baseInput, visibility }).cacheKey)
      .toBe(createGdsTileRequestPlan({ ...baseInput, visibility: opacityVisibility }).cacheKey);
  });

  it('only sends GDS tile layer filters after the user hides a category', () => {
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, layoutFixtureGdsGeometry.shapes);
    const baseInput = {
      camera: { panX: 20, panY: 30, zoom: 48 },
      rootCellIndex: 1,
      sessionId: 'layout-gds',
      size: { height: 200, width: 400 },
    };
    const allVisiblePlan = createGdsTileRequestPlan({ ...baseInput, visibility });

    expect(allVisiblePlan.layerIndices).toBeUndefined();
    expect(allVisiblePlan.shapeKinds).toBeUndefined();

    visibility.visibleItems.delete('layer:0:path');
    visibility.visibleItems.delete('layer:1:path');
    const filteredPlan = createGdsTileRequestPlan({ ...baseInput, visibility });

    expect(filteredPlan.layerIndices).toEqual(expect.arrayContaining([0]));
    expect(filteredPlan.shapeKinds).toEqual(expect.arrayContaining([1, 2, 5]));
    expect(filteredPlan.shapeKinds).not.toContain(4);
  });

  it('does not send a GDS layer filter before tile visibility is initialized', () => {
    const visibility = createEmptyPhysicalLayoutVisibility();
    const plan = createGdsTileRequestPlan({
      camera: { panX: 20, panY: 30, zoom: 10 },
      rootCellIndex: 1,
      sessionId: 'layout-gds',
      size: { width: 400, height: 200 },
      visibility,
    });

    expect(plan.layerIndices).toBeUndefined();
    expect(plan.options.layerIndices).toBeUndefined();
  });

  it('merges paged GDS tile geometry and records metrics', () => {
    const tile = mergeGdsTileGeometryResults([
      {
        geometry: {
          polygonPointCount: 4,
          shapeCount: 1,
          shapes: [layoutFixtureGdsGeometry.shapes[0] as LspLayoutShape],
          truncated: false,
          unitsPerMicron: 1000,
        },
        metrics: {
          cacheHitCount: 1,
          cacheMissCount: 0,
          elementCandidateCount: 1,
          encodeMicros: 200,
          gridBinCount: 2,
          gridBuildMicros: 0,
          gridCandidateCount: 3,
          gridHitCount: 1,
          gridMissCount: 0,
          indexBuildMicros: 0,
          lodShapeCount: 1,
          queryMicros: 300,
          referenceCandidateCount: 0,
          traversedReferenceCount: 0,
          visitedCellCount: 1,
        },
        nextToken: 7,
        payloadSize: 128,
        tileShapeCount: 1,
        truncated: true,
      },
      {
        geometry: {
          polygonPointCount: 4,
          shapeCount: 1,
          shapes: [layoutFixtureGdsGeometry.shapes[1] as LspLayoutShape],
          truncated: false,
          unitsPerMicron: 1000,
        },
        metrics: {
          cacheHitCount: 0,
          cacheMissCount: 1,
          elementCandidateCount: 2,
          encodeMicros: 300,
          gridBinCount: 4,
          gridBuildMicros: 0,
          gridCandidateCount: 5,
          gridHitCount: 0,
          gridMissCount: 1,
          indexBuildMicros: 0,
          lodShapeCount: 1,
          queryMicros: 400,
          referenceCandidateCount: 0,
          traversedReferenceCount: 0,
          visitedCellCount: 1,
        },
        nextToken: null,
        payloadSize: 256,
        tileShapeCount: 1,
        truncated: false,
      },
    ]);

    expect(tile?.geometry.shapes).toHaveLength(2);
    expect(tile?.nextToken).toBeNull();
    expect(tile?.payloadSize).toBe(384);
    expect(tile?.metrics.queryMicros).toBe(700);
    expect(tile?.metrics.cacheHitCount).toBe(1);
    expect(tile?.metrics.cacheMissCount).toBe(1);

    const metrics = createGdsTileMetricsSnapshot({
      bufferCapacityVertexCount: 16,
      bufferReallocCount: 2,
      bufferUpdateCount: 1,
      bufferUpdateMs: 0.4,
      cacheStats: { byteLength: 1024, entryCount: 3 },
      frameDurationsMs: [16, 17, 18, 19],
      inflightRequestCount: 1,
      meshBatchCount: 2,
      meshDrawNodeCount: 3,
      meshIndexCount: 6,
      meshVertexCount: 4,
      renderMs: 1.2,
      retryCount: 1,
      tile,
      tileRequestCount: 2,
      tileRoundtripMs: 5,
    });

    expect(metrics.averageFps).toBeGreaterThan(50);
    expect(metrics.meshBatchCount).toBe(2);
    expect(metrics.meshDrawNodeCount).toBe(3);
    expect(metrics.meshVertexCount).toBe(4);
    expect(metrics.lastTileQueryMs).toBe(0.7);
    expect(metrics.tileRequestCount).toBe(2);
    expect(metrics.bufferCapacityVertexCount).toBe(16);
    expect(metrics.bufferReallocCount).toBe(2);
    expect(metrics.bufferUpdateCount).toBe(1);
    expect(metrics.cacheByteLength).toBe(1024);
    expect(metrics.cacheEntryCount).toBe(3);
    expect(metrics.inflightRequestCount).toBe(1);
    expect(metrics.retryCount).toBe(1);
    expect(estimateGdsTileByteLength(tile as NonNullable<typeof tile>)).toBeGreaterThan(0);

    const transformOnlyMetrics = createGdsTileMetricsSnapshot({
      bufferCapacityVertexCount: 16,
      bufferReallocCount: 0,
      bufferUpdateCount: 0,
      bufferUpdateMs: 0,
      cacheStats: { byteLength: 1024, entryCount: 1 },
      frameDurationsMs: [16, 17, 2000, 18],
      inflightRequestCount: 0,
      meshBatchCount: 1,
      meshDrawNodeCount: 1,
      meshIndexCount: 6,
      meshVertexCount: 4,
      renderMs: 1,
      retryCount: 0,
      tile,
      tileRequestCount: 1,
      tileRoundtripMs: 5,
    });

    expect(transformOnlyMetrics.averageFps).toBeGreaterThan(50);
    expect(transformOnlyMetrics.frameP95Ms).toBeLessThan(250);
  });

  it('bounds raw GDS tile cache by entry count and estimated bytes', () => {
    const cache = new PhysicalLayoutGdsTileLruCache();
    const baseTile = mergeGdsTileGeometryResults([{
      geometry: {
        polygonPointCount: 4,
        shapeCount: 1,
        shapes: [layoutFixtureGdsGeometry.shapes[0] as LspLayoutShape],
        truncated: false,
        unitsPerMicron: 1000,
      },
      metrics: {
        cacheHitCount: 0,
        cacheMissCount: 1,
        elementCandidateCount: 1,
        encodeMicros: 0,
        gridBinCount: 1,
        gridBuildMicros: 0,
        gridCandidateCount: 1,
        gridHitCount: 0,
        gridMissCount: 1,
        indexBuildMicros: 0,
        lodShapeCount: 1,
        queryMicros: 0,
        referenceCandidateCount: 0,
        traversedReferenceCount: 0,
        visitedCellCount: 1,
      },
      nextToken: null,
      payloadSize: 256,
      tileShapeCount: 1,
      truncated: false,
    }]);

    expect(baseTile).not.toBeNull();
    for (let index = 0; index < 140; index += 1) {
      cache.set(`tile-${index}`, baseTile as NonNullable<typeof baseTile>);
    }

    expect(cache.getStats().entryCount).toBeLessThanOrEqual(96);
    expect(cache.getStats().byteLength).toBeGreaterThan(0);
  });

  it('provides stable layer and outline colors', () => {
    const metal1Color = getPhysicalLayoutLayerColor(0);
    const metal1PinColor = getPhysicalLayoutLayerCategoryColor(0, 'pin');
    const metal1ObstructionColor = getPhysicalLayoutLayerCategoryColor(0, 'obstruction');
    const outlineColor = getPhysicalLayoutOutlineColor();

    expect(metal1Color).toEqual(getPhysicalLayoutLayerColor(0));
    expect(metal1PinColor).toEqual(metal1Color);
    expect(metal1ObstructionColor).toEqual({ cssColor: '#f472b6', pixiColor: 0xf472b6 });
    expect(metal1Color.cssColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(Number.parseInt(metal1Color.cssColor.slice(1), 16)).toBe(metal1Color.pixiColor);
    expect(outlineColor.cssColor).toBe('#e5eef8');
    expect(Number.parseInt(outlineColor.cssColor.slice(1), 16)).toBe(outlineColor.pixiColor);
  });

  it('creates category visibility, filters shapes, and allows all categories to hide', () => {
    const macro = findLayoutMacro(catalog, 'sg13g2_inv_1');
    const selectedShapes = selectMacroShapes(catalog, layoutFixtureGeometry, 'sg13g2_inv_1');
    const visibility = createPhysicalLayoutVisibility(catalog, Boolean(macro), selectedShapes);

    expect(isPhysicalLayoutOutlineVisible(visibility)).toBe(true);
    expect(isPhysicalLayoutLayerCategoryVisible(visibility, 0, 'pin')).toBe(true);
    expect(isPhysicalLayoutLayerCategoryVisible(visibility, 0, 'label')).toBe(true);
    expect(isPhysicalLayoutLayerCategoryVisible(visibility, 0, 'obstruction')).toBe(false);
    expect(isPhysicalLayoutLayerCategoryVisible(visibility, 1, 'obstruction')).toBe(true);
    expect(filterVisiblePhysicalLayoutShapes(selectedShapes, visibility)).toHaveLength(3);
    expect(getVisiblePhysicalLayoutShapeCounts(selectedShapes, visibility)).toMatchObject({ obstruction: 1, pin: 2 });

    expect(getPhysicalLayoutLayerOpacity(visibility, 0)).toBe(1);
    expect(formatPhysicalLayoutLayerOpacitySummary(visibility)).toBe('0:1.00|1:1.00');
    expect(normalizePhysicalLayoutLayerOpacity(0.333)).toBe(0.35);

    const hiddenVisibility = { layerOpacities: new Map<number, number>(), outlineVisible: false, visibleItems: new Set<string>() };

    expect(isPhysicalLayoutOutlineVisible(hiddenVisibility)).toBe(false);
    expect(filterVisiblePhysicalLayoutShapes(selectedShapes, hiddenVisibility)).toEqual([]);
    expect(createPhysicalLayoutPinLabels(catalog, selectedShapes, hiddenVisibility)).toEqual([]);
  });

  it('builds layer tree availability and real pin labels', () => {
    const selectedShapes = selectMacroShapes(catalog, layoutFixtureGeometry, 'sg13g2_inv_1');
    const visibility = createPhysicalLayoutVisibility(catalog, true, selectedShapes);
    const tree = createPhysicalLayoutLayerTree(catalog, selectedShapes);

    expect(tree).toHaveLength(2);
    expect(tree[0]?.categories).toMatchObject({ label: true, obstruction: false, pin: true });
    expect(tree[0]?.available).toBe(true);
    expect(tree[1]?.categories).toMatchObject({ label: false, obstruction: true, pin: false });
    expect(tree[1]?.available).toBe(true);
    expect(createPhysicalLayoutPinLabels(catalog, selectedShapes, visibility)).toEqual([
      expect.objectContaining({ layerIndex: 0, name: 'A', opacity: 1, ownerIndex: 0 }),
      expect.objectContaining({ layerIndex: 0, name: 'Y', opacity: 1, ownerIndex: 1 }),
    ]);
  });

  it('omits pin labels when the catalog has no matching pin table entry', () => {
    const selectedShapes = selectMacroShapes(catalog, layoutFixtureGeometry, 'sg13g2_inv_1');
    const visibility = createPhysicalLayoutVisibility(catalog, true, selectedShapes);
    const catalogWithoutPinNames = {
      ...catalog,
      pins: catalog.pins.filter((pin) => !(pin.macroIndex === 0 && pin.pinIndex === 1)),
    };

    expect(createPhysicalLayoutPinLabels(catalogWithoutPinNames, selectedShapes, visibility)).toEqual([
      expect.objectContaining({ layerIndex: 0, name: 'A', ownerIndex: 0 }),
    ]);

    const catalogWithoutSelectedPinNames = {
      ...catalog,
      pins: catalog.pins.filter((pin) => pin.macroIndex !== 0),
    };

    expect(createPhysicalLayoutLayerTree(catalogWithoutSelectedPinNames, selectedShapes)[0]?.categories.label).toBe(false);
    expect(createPhysicalLayoutPinLabels(catalogWithoutSelectedPinNames, selectedShapes, visibility)).toEqual([]);
  });

  it('uses source-aware GDS layer categories and text labels', () => {
    const gdsCatalog: LspLayoutCatalog = {
      ...catalog,
      defPins: [],
      gdsCells: [{
        bounds: { x0: 0, y0: 0, x1: 2, y1: 2 },
        elementCount: 3,
        firstElementIndex: 0,
        firstReferenceIndex: 0,
        index: 0,
        name: 'TOP',
        referenceCount: 0,
        top: true,
      }],
      gdsElements: [
        { cellIndex: 0, datatype: 0, firstPointIndex: 0, index: 0, kind: 0, layer: 0, pointCount: 4, referenceIndex: null, text: '', texttype: 0 },
        { cellIndex: 0, datatype: 0, firstPointIndex: 4, index: 1, kind: 1, layer: 0, pointCount: 2, referenceIndex: null, text: '', texttype: 0 },
        { cellIndex: 0, datatype: 0, firstPointIndex: 6, index: 2, kind: 3, layer: 0, pointCount: 1, referenceIndex: null, text: 'VSS', texttype: 0 },
      ],
      gdsPoints: [],
      gdsReferences: [],
      macros: [],
      pins: [],
      shapeCount: 3,
      sourceKind: 'gds',
      topCellIndex: 0,
    };
    const gdsGeometry: LspLayoutGeometry = {
      polygonPointCount: 0,
      shapeCount: 3,
      shapes: [
        { flags: 0, index: 0, kind: 'polygon', layerIndex: 0, macroIndex: 0, ownerIndex: 0, ownerKind: 'gdsElement', polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], rect: { x0: 0, y0: 0, x1: 1, y1: 1 } },
        { flags: 0, index: 1, kind: 'path', layerIndex: 0, macroIndex: 0, ownerIndex: 1, ownerKind: 'gdsElement', polygon: [{ x: 0.2, y: 0.2 }, { x: 1.2, y: 0.2 }], rect: { x0: 0.2, y0: 0.2, x1: 1.2, y1: 0.2 } },
        { flags: 0, index: 2, kind: 'text', layerIndex: 0, macroIndex: 0, ownerIndex: 2, ownerKind: 'gdsElement', rect: { x0: 0.4, y0: 0.4, x1: 0.6, y1: 0.6 } },
      ],
      truncated: false,
      unitsPerMicron: 1000,
    };
    const selectedShapes = gdsGeometry.shapes;
    const visibility = createPhysicalLayoutVisibility(gdsCatalog, true, selectedShapes);
    const tree = createPhysicalLayoutLayerTree(gdsCatalog, selectedShapes);

    expect(tree[0]?.categories).toMatchObject({ boundary: true, path: true, text: true });
    expect(filterVisiblePhysicalLayoutShapes(selectedShapes, visibility)).toHaveLength(3);
    expect(getVisiblePhysicalLayoutShapeCounts(selectedShapes, visibility)).toMatchObject({
      boundary: 1,
      path: 1,
      text: 1,
    });
    expect(createPhysicalLayoutPinLabels(gdsCatalog, selectedShapes, visibility)).toEqual([
      expect.objectContaining({ layerIndex: 0, name: 'VSS', ownerIndex: 2 }),
    ]);
  });

  it('keeps already-filtered GDS tile geometry even when shapes have no macro index', () => {
    const selectedTarget = { kind: 'gdsCell' as const, name: 'CHILD', index: 1 };
    const tileGeometry: LspLayoutGeometry = {
      ...layoutFixtureGdsGeometry,
      shapeCount: 2,
      shapes: layoutFixtureGdsGeometry.shapes.slice(0, 2).map((shape) => ({
        ...shape,
        macroIndex: null,
      })),
    };

    expect(selectLayoutTargetShapes(layoutFixtureGdsOpenResult.catalog, tileGeometry, selectedTarget)).toHaveLength(2);
  });

  it('classifies GDS tile shapes by shape kind when owner kind is incomplete', () => {
    const boundaryShape = layoutFixtureGdsGeometry.shapes.find((shape) => shape.kind === 'polygon');
    const pathShape = layoutFixtureGdsGeometry.shapes.find((shape) => shape.kind === 'path');
    const textShape = layoutFixtureGdsGeometry.shapes.find((shape) => shape.kind === 'text');
    expect(boundaryShape).toBeDefined();
    expect(pathShape).toBeDefined();
    expect(textShape).toBeDefined();

    const tileShapes = [boundaryShape, pathShape, textShape].map((shape) => ({
      ...(shape as LspLayoutShape),
      ownerKind: 'unknown' as const,
    }));
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, tileShapes);

    expect(filterVisiblePhysicalLayoutShapes(tileShapes, visibility, 'gds')).toHaveLength(3);
    expect(getVisiblePhysicalLayoutShapeCounts(tileShapes, visibility, 'gds')).toMatchObject({
      boundary: 1,
      path: 1,
      text: 1,
    });
  });

  it('keeps GDS layer categories available when the current filtered tile has no shapes', () => {
    const tree = createPhysicalLayoutLayerTree(layoutFixtureGdsOpenResult.catalog, []);

    expect(tree[0]?.categories).toMatchObject({
      boundary: true,
      path: true,
      text: true,
    });
  });

  it('keeps GDS placement overview shapes visible even when they use synthetic layers', () => {
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, []);
    const placementShape: LspLayoutShape = {
      flags: 0,
      index: 42,
      kind: 'placement',
      layerIndex: 9999,
      macroIndex: null,
      ownerIndex: 0,
      ownerKind: 'gdsReference',
      rect: { x0: 0, y0: 0, x1: 100, y1: 80 },
    };

    expect(filterVisiblePhysicalLayoutShapes([placementShape], visibility, 'gds')).toHaveLength(1);
    expect(getVisiblePhysicalLayoutShapeCounts([placementShape], visibility, 'gds')).toMatchObject({
      boundary: 1,
    });
    expect(getGdsTileShapeStyle(placementShape, visibility, getPhysicalLayoutLayerCategoryColor)).toMatchObject({
      category: 'boundary',
      alpha: expect.any(Number),
      strokeWidth: expect.any(Number),
    });
  });

  it('creates an empty GDS tile plan when all layer categories are hidden', () => {
    const selectedShapes = layoutFixtureGdsGeometry.shapes.filter((shape) => shape.macroIndex === 1);
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, selectedShapes);
    for (const key of Array.from(visibility.visibleItems)) {
      if (key.startsWith('layer:')) {
        visibility.visibleItems.delete(key);
      }
    }

    const plan = createGdsTileRequestPlan({
      camera: { panX: 0, panY: 0, zoom: 32 },
      rootCellIndex: 1,
      sessionId: 'layout-1',
      size: { height: 600, width: 800 },
      visibility,
    });

    expect(plan.empty).toBe(true);
    expect(plan.layerIndices).toEqual([]);
    expect(plan.options.layerIndices).toEqual([]);
    expect(plan.shapeKinds).toEqual([]);
    expect(plan.options.shapeKinds).toEqual([]);
    expect(createEmptyGdsTileGeometry(1000).geometry).toMatchObject({
      shapeCount: 0,
      shapes: [],
      unitsPerMicron: 1000,
    });
  });

  it('plans precise and retry GDS tiles without changing visibility filters', () => {
    const selectedShapes = layoutFixtureGdsGeometry.shapes.filter((shape) => shape.macroIndex === 1);
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, selectedShapes);
    const input = {
      camera: { panX: 20, panY: 30, zoom: 10 },
      rootCellIndex: 1,
      sessionId: 'layout-gds',
      size: { height: 200, width: 400 },
      visibility,
    };
    const coarsePlan = createGdsTileRequestPlan(input);
    const precisePlan = createGdsPreciseTileRequestPlan(input);
    const retryPlan = createGdsRetryTileRequestPlan(input);

    expect(coarsePlan.lod).toBe(1);
    expect(shouldRequestPreciseGdsTile(coarsePlan)).toBe(true);
    expect(precisePlan.lod).toBe(0);
    expect(precisePlan.layerIndices).toEqual(coarsePlan.layerIndices);
    expect(precisePlan.shapeKinds).toEqual(coarsePlan.shapeKinds);
    expect(retryPlan.lod).toBe(0);
    expect(retryPlan.layerIndices).toEqual(coarsePlan.layerIndices);
    expect(retryPlan.shapeKinds).toEqual(coarsePlan.shapeKinds);
    expect(retryPlan.bbox.x0).toBeLessThan(coarsePlan.bbox.x0);
    expect(retryPlan.bbox.x1).toBeGreaterThan(coarsePlan.bbox.x1);
    expect(getGdsEmptyTileRetryKind(coarsePlan, { x0: -10, y0: -10, x1: 50, y1: 50 })).toBe('precise');
    expect(doLayoutBoundsIntersect(coarsePlan.bbox, { x0: 0, y0: 0, x1: 4, y1: 4 })).toBe(true);
    expect(doLayoutBoundsIntersect(coarsePlan.bbox, { x0: 100, y0: 100, x1: 101, y1: 101 })).toBe(false);
  });

  it('does not force precise GDS tiles for very large overview bboxes', () => {
    const selectedShapes = layoutFixtureGdsGeometry.shapes.filter((shape) => shape.macroIndex === 1);
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, selectedShapes);
    const overviewPlan = createGdsTileRequestPlan({
      camera: { panX: 0, panY: 0, zoom: 0.1 },
      rootCellIndex: 1,
      sessionId: 'layout-gds',
      size: { height: 10_000, width: 10_000 },
      visibility,
    });

    expect(overviewPlan.lod).toBe(2);
    expect(shouldRequestPreciseGdsTile(overviewPlan)).toBe(false);
    expect(getGdsEmptyTileRetryKind(overviewPlan, { x0: -60_000, y0: -60_000, x1: 60_000, y1: 60_000 })).toBe('overview');

    const overviewRetryPlan = createGdsOverviewRetryTileRequestPlan({
      camera: { panX: 0, panY: 0, zoom: 0.1 },
      rootCellIndex: 1,
      sessionId: 'layout-gds',
      size: { height: 10_000, width: 10_000 },
      visibility,
    });
    expect(overviewRetryPlan.lod).toBeGreaterThan(0);
    expect(overviewRetryPlan.options.layerIndices).toBeUndefined();
  });

  it('maps GDS cell and viewport bounds into the minimap', () => {
    const model = createPhysicalLayoutMinimapModel({
      canvasSize: { height: 300, width: 500 },
      cellBounds: { x0: 0, y0: 0, x1: 100, y1: 50 },
      viewportBounds: { x0: 25, y0: 10, x1: 75, y1: 30 },
    });

    expect(model.visible).toBe(true);
    expect(model.panel).toMatchObject({ height: 84, width: 112, x: 376, y: 12 });
    expect(model.cellWorldWidth).toBe(100);
    expect(model.cellWorldHeight).toBe(50);
    expect(model.cell.width).toBeCloseTo(96);
    expect(model.cell.height).toBeCloseTo(48);
    expect(model.viewport.x).toBeGreaterThan(model.cell.x);
    expect(model.viewport.y).toBeGreaterThan(model.cell.y);
    expect(model.viewport.width).toBeCloseTo(48);
    expect(model.viewport.height).toBeCloseTo(19.2);
  });

  it('moves and scales the minimap viewport frame as the camera changes', () => {
    const cellBounds = { x0: 0, y0: 0, x1: 100, y1: 50 };
    const canvasSize = { height: 300, width: 500 };
    const initial = createPhysicalLayoutMinimapModel({
      canvasSize,
      cellBounds,
      viewportBounds: getViewportWorldBounds({ panX: 0, panY: 0, zoom: 2 }, { height: 200, width: 200 }, 0),
    });
    const panned = createPhysicalLayoutMinimapModel({
      canvasSize,
      cellBounds,
      viewportBounds: getViewportWorldBounds({ panX: -50, panY: -20, zoom: 2 }, { height: 200, width: 200 }, 0),
    });
    const zoomed = createPhysicalLayoutMinimapModel({
      canvasSize,
      cellBounds,
      viewportBounds: getViewportWorldBounds({ panX: 0, panY: 0, zoom: 8 }, { height: 200, width: 200 }, 0),
    });

    expect(panned.viewport.x).toBeGreaterThan(initial.viewport.x);
    expect(panned.viewport.y).toBeGreaterThan(initial.viewport.y);
    expect(zoomed.viewport.width).toBeLessThan(initial.viewport.width);
    expect(zoomed.viewport.height).toBeLessThan(initial.viewport.height);
  });

  it('clips and keeps the minimap viewport frame visible outside cell bounds', () => {
    const model = createPhysicalLayoutMinimapModel({
      canvasSize: { height: 300, width: 500 },
      cellBounds: { x0: 0, y0: 0, x1: 100, y1: 50 },
      viewportBounds: { x0: -100, y0: -100, x1: 1, y1: 1 },
    });
    const tiny = createPhysicalLayoutMinimapModel({
      canvasSize: { height: 300, width: 500 },
      cellBounds: { x0: 0, y0: 0, x1: 100, y1: 50 },
      viewportBounds: { x0: 10, y0: 10, x1: 10.01, y1: 10.01 },
    });

    expect(model.visible).toBe(true);
    expect(model.viewport.x).toBeCloseTo(model.cell.x);
    expect(model.viewport.y).toBeCloseTo(model.cell.y);
    expect(model.viewport.width).toBeGreaterThanOrEqual(4);
    expect(tiny.viewport.width).toBe(4);
    expect(tiny.viewport.height).toBe(4);
  });

  it('creates 2.5D mesh inputs for visible GDS cell shapes', () => {
    const selectedTarget = { kind: 'gdsCell' as const, name: 'CHILD', index: 1 };
    const selectedShapes = layoutFixtureGdsGeometry.shapes.filter((shape) => shape.macroIndex === selectedTarget.index);
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, selectedShapes);
    const sceneInput = createPhysicalLayout3DSceneInput(
      layoutFixtureGdsOpenResult.catalog,
      layoutFixtureGdsGeometry,
      selectedTarget,
      visibility,
    );

    expect(sceneInput.selectedShapeCount).toBe(3);
    expect(sceneInput.meshes).toHaveLength(3);
    expect(sceneInput.meshes.map((mesh) => mesh.category)).toEqual(['boundary', 'path', 'text']);
    expect(sceneInput.meshes[0]).toMatchObject({
      layerIndex: 0,
      points: [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 1, y: 2 }],
      z: getPhysicalLayout3DLayerZ(0, 'boundary'),
      depth: getPhysicalLayout3DDepth('boundary'),
    });
    const maxMeshZ = Math.max(...sceneInput.meshes.map((mesh) => mesh.z + mesh.depth));
    expect(sceneInput.bounds3D).toEqual({
      x0: 1,
      y0: 1,
      z0: getPhysicalLayout3DLayerZ(0, 'boundary'),
      x1: 3,
      y1: 2,
      z1: maxMeshZ,
    });
    expect(sceneInput.bounds3D ? getPhysicalLayout3DCenter(sceneInput.bounds3D) : null).toEqual({
      x: 2,
      y: 1.5,
      z: (getPhysicalLayout3DLayerZ(0, 'boundary') + maxMeshZ) / 2,
    });
    expect(sceneInput.meshes[1]?.points).toEqual([
      { x: 1.2, y: 1.4 },
      { x: 2.8, y: 1.4 },
      { x: 2.8, y: 1.55 },
      { x: 1.2, y: 1.55 },
    ]);

    visibility.visibleItems.delete('layer:0:boundary');
    const hiddenBoundaryInput = createPhysicalLayout3DSceneInput(
      layoutFixtureGdsOpenResult.catalog,
      layoutFixtureGdsGeometry,
      selectedTarget,
      visibility,
    );

    expect(hiddenBoundaryInput.meshes.map((mesh) => mesh.category)).toEqual(['path', 'text']);
  });

  it('uses stable 2.5D material depth settings and render ordering', () => {
    const selectedTarget = { kind: 'gdsCell' as const, name: 'CHILD', index: 1 };
    const selectedShapes = layoutFixtureGdsGeometry.shapes.filter((shape) => shape.macroIndex === selectedTarget.index);
    const visibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, selectedShapes);
    const sceneInput = createPhysicalLayout3DSceneInput(
      layoutFixtureGdsOpenResult.catalog,
      layoutFixtureGdsGeometry,
      selectedTarget,
      visibility,
    );
    const meshInput = sceneInput.meshes[0];
    const nextMeshInput = sceneInput.meshes[1];

    expect(meshInput).toBeDefined();
    expect(nextMeshInput).toBeDefined();
    if (!meshInput || !nextMeshInput) {
      return;
    }

    expect(getPhysicalLayout3DMeshMaterialOptions(meshInput, false)).toMatchObject({
      depthTest: true,
      depthWrite: true,
      opacity: 1,
      side: 2,
      transparent: false,
    });
    meshInput.opacity = 0.35;
    expect(getPhysicalLayout3DMeshMaterialOptions(meshInput, false)).toMatchObject({
      depthTest: true,
      depthWrite: false,
      opacity: 0.35,
      side: 2,
      transparent: true,
    });
    expect(getPhysicalLayout3DEdgeMaterialOptions(meshInput, false)).toMatchObject({
      depthTest: true,
      depthWrite: false,
      transparent: true,
    });
    expect(getPhysicalLayout3DBaseGridMaterialOptions()).toMatchObject({
      depthTest: true,
      depthWrite: false,
      side: 2,
      transparent: true,
    });
    expect(getPhysicalLayout3DBaseOutlineMaterialOptions()).toMatchObject({
      depthTest: true,
      depthWrite: false,
      transparent: true,
    });
    expect(physicalLayout3DRenderOrders.baseGrid).toBeLessThan(physicalLayout3DRenderOrders.shapeBase);
    expect(getPhysicalLayout3DShapeRenderOrder(meshInput, false)).toBeLessThan(getPhysicalLayout3DEdgeRenderOrder(meshInput, false));
    expect(getPhysicalLayout3DShapeRenderOrder(meshInput, true)).toBeGreaterThan(getPhysicalLayout3DEdgeRenderOrder(meshInput, false));
    expect(getPhysicalLayout3DShapeRenderOrder(meshInput, false)).toBeLessThan(getPhysicalLayout3DShapeRenderOrder(nextMeshInput, false));
  });

  it('defines the Physical 3D view helper viewport, colors, and axis targets', () => {
    expect(physicalLayout3DViewHelperSize).toBe(112);
    expect(getPhysicalLayout3DViewHelperViewport(500, 300)).toEqual({
      height: 112,
      left: 380,
      top: 8,
      width: 112,
    });
    expect(getPhysicalLayout3DViewHelperAxisColor('posX')).toBe(0xff4466);
    expect(getPhysicalLayout3DViewHelperAxisColor('posY')).toBe(0x88ff44);
    expect(getPhysicalLayout3DViewHelperAxisColor('posZ')).toBe(0x4488ff);
    expect(getPhysicalLayout3DViewHelperAxisColor('negX')).toBe(0x222222);
    expect(getPhysicalLayout3DViewHelperTargetOrbit('posZ')).toEqual({ angleX: 0, angleY: 0 });
    expect(getPhysicalLayout3DViewHelperTargetOrbit('negZ')).toEqual({ angleX: Math.PI, angleY: 0 });
    expect(getPhysicalLayout3DViewHelperTargetOrbit('posX').angleY).toBeCloseTo(-Math.PI / 2);
    expect(getPhysicalLayout3DViewHelperTargetOrbit('negY').angleY).toBeCloseTo(Math.PI);
  });

  it('finds the topmost visible shape at a layout point', () => {
    const bottomShape = layoutFixtureGeometry.shapes[0] as LspLayoutShape;
    const topShape = {
      ...layoutFixtureGeometry.shapes[1],
      index: 99,
      rect: { x0: 0.3, y0: 0.6, x1: 1.1, y1: 1.4 },
    } as LspLayoutShape;

    const bottomPoint = {
      x: (bottomShape.rect.x0 + bottomShape.rect.x1) / 2,
      y: (bottomShape.rect.y0 + bottomShape.rect.y1) / 2,
    };

    expect(findShapeAtLayoutPoint([bottomShape, topShape], { x: 0.5, y: 0.8 })?.index).toBe(99);
    expect(findShapeAtLayoutPoint([bottomShape], bottomPoint)?.index).toBe(bottomShape.index);
    expect(findShapeAtLayoutPoint([bottomShape], { x: -10, y: -10 })).toBeNull();
  });

  it('uses polygon hit testing for polygon shapes', () => {
    const polygonShape = {
      ...layoutFixtureGeometry.shapes[0],
      kind: 'polygon' as const,
      polygon: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 2 },
      ],
      rect: { x0: 0, y0: 0, x1: 2, y1: 2 },
    } as LspLayoutShape;

    expect(findShapeAtLayoutPoint([polygonShape], { x: 1, y: 1 })?.index).toBe(polygonShape.index);
    expect(findShapeAtLayoutPoint([polygonShape], { x: 0.1, y: 1.9 })).toBeNull();
  });

  it('uses fallback layout bounds when hidden 3D categories leave no meshes', () => {
    const bounds = getPhysicalLayout3DBounds([], { x0: 1, y0: 2, x1: 3, y1: 5 });

    expect(bounds).toEqual({
      x0: 1,
      y0: 2,
      z0: 0,
      x1: 3,
      y1: 5,
      z1: getPhysicalLayout3DDepth('boundary'),
    });
    expect(bounds ? getPhysicalLayout3DCenter(bounds) : null).toEqual({
      x: 2,
      y: 3.5,
      z: getPhysicalLayout3DDepth('boundary') / 2,
    });
  });
});
