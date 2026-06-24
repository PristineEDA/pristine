import type {
  LspLayoutBounds,
  LspLayoutShape,
  LspLayoutTileGeometry,
  LspLayoutTileGeometryOptions,
  LspLayoutTileMetrics,
} from '../../../../../types/systemverilog-lsp';
import type { PhysicalLayoutCamera, PhysicalLayoutViewport } from './physicalLayoutGeometry';
import {
  getPhysicalLayoutLayerOpacity,
  getPhysicalLayoutShapeCategory,
  isPhysicalLayoutLayerCategoryVisible,
  type PhysicalLayoutLayerCategory,
  type PhysicalLayoutVisibility,
} from './physicalLayoutLayers';

export interface PhysicalLayoutGdsTileMetrics {
  averageFps: number;
  atlasByteLength: number;
  blankFrameCount: number;
  bufferCapacityVertexCount: number;
  bufferDataReplaceCount: number;
  bufferReallocCount: number;
  bufferSubarrayCommitCount: number;
  bufferUpdateCount: number;
  bufferUpdateMs: number;
  tileLayerCreateCount: number;
  tileLayerReuseCount: number;
  tileLayerDestroyCount: number;
  batchCreateCount: number;
  batchReuseCount: number;
  batchDestroyCount: number;
  applyQueueDepth: number;
  applyChunkCount: number;
  applyBudgetOverrunCount: number;
  idleSnapshotMs: number;
  idleSnapshotSkippedCount: number;
  columnarByteLength: number;
  atlasGpuByteLength: number;
  bufferByteLength: number;
  cacheByteLength: number;
  cacheEntryCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  continuationCount: number;
  coverageRatio: number;
  displayedTileCount: number;
  emptyDisplayedTileCount: number;
  emptyVisibleFrameCount: number;
  frameP95Ms: number;
  inflightRequestCount: number;
  indexByteLength: number;
  lastFps: number;
  lastFrameMs: number;
  lastRenderMs: number;
  lastTileApplyMs: number;
  lastTileBuildMs: number;
  lastTileRoundtripMs: number;
  lastTileQueryMs: number;
  maxFrameP95Ms: number;
  maxTileApplyMs: number;
  maxTileBuildMs: number;
  maxTileRoundtripMs: number;
  meshBatchCount: number;
  meshDrawNodeCount: number;
  meshIndexCount: number;
  meshVertexCount: number;
  nonEmptyCoverageRatio: number;
  renderableShapeCount: number;
  reactSyncCount: number;
  retryCount: number;
  screenVisibleCoverageRatio: number;
  screenVisibleNonEmptyCoverageRatio: number;
  screenVisibleShapeCount: number;
  screenVisibleTileCount: number;
  cellIntersectionRatio: number;
  tileRequestCount: number;
  truncated: boolean;
  visualEmptyReason: string;
  visiblePointCount: number;
  visibleShapeCount: number;
}

export interface PhysicalLayoutGdsTileRequestPlan {
  bbox: LspLayoutBounds;
  cacheKey: string;
  empty: boolean;
  emptyReason: 'all-hidden' | 'outside-cell-bounds' | '';
  layerIndices: number[] | undefined;
  lod: number;
  options: LspLayoutTileGeometryOptions;
  shapeKinds: number[] | undefined;
}

export interface PhysicalLayoutGdsTileWindowPlan {
  cellBounds: LspLayoutBounds | null;
  prefetchPlans: PhysicalLayoutGdsTileRequestPlan[];
  primaryPlan: PhysicalLayoutGdsTileRequestPlan;
  tileWorldSize: number;
  visiblePlans: PhysicalLayoutGdsTileRequestPlan[];
  viewportBbox: LspLayoutBounds;
}

export type PhysicalLayoutGdsTileScope = 'full-cell' | 'viewport-window';

export interface PhysicalLayoutGdsTileCacheStats {
  byteLength: number;
  entryCount: number;
}

export interface PhysicalLayoutGdsTileRequestInput {
  camera: PhysicalLayoutCamera;
  rootCellIndex: number;
  selectedBounds?: LspLayoutBounds | null;
  sessionId: string;
  size: PhysicalLayoutViewport;
  visibility: PhysicalLayoutVisibility;
}

export interface PhysicalLayoutGdsTileShapeStyle {
  alpha: number;
  category: PhysicalLayoutLayerCategory;
  color: number;
  strokeAlpha: number;
  strokeWidth: number;
}

export interface PhysicalLayoutGdsDisplayedTile {
  plan: PhysicalLayoutGdsTileRequestPlan;
  tile: LspLayoutTileGeometry;
}

export interface PhysicalLayoutGdsTileAtlasUpdate {
  acceptedTileCount: number;
  cellIntersectionRatio: number;
  coverageRatio: number;
  keptPreviousTileCount: number;
  screenVisibleCoverageRatio: number;
  screenVisibleNonEmptyCoverageRatio: number;
  screenVisibleShapeCount: number;
  screenVisibleTileCount: number;
  tiles: Map<string, PhysicalLayoutGdsDisplayedTile>;
  visualEmptyReason: string;
}

export interface PhysicalLayoutGdsScreenCoverage {
  cellIntersectionRatio: number;
  screenVisibleCoverageRatio: number;
  screenVisibleNonEmptyCoverageRatio: number;
  screenVisibleShapeCount: number;
  screenVisibleTileCount: number;
  visualEmptyReason: string;
}

export const defaultPhysicalLayoutGdsTileMetrics: PhysicalLayoutGdsTileMetrics = {
  averageFps: 0,
  atlasByteLength: 0,
  blankFrameCount: 0,
  bufferCapacityVertexCount: 0,
  bufferDataReplaceCount: 0,
  bufferReallocCount: 0,
  bufferSubarrayCommitCount: 0,
  bufferUpdateCount: 0,
  bufferUpdateMs: 0,
  tileLayerCreateCount: 0,
  tileLayerReuseCount: 0,
  tileLayerDestroyCount: 0,
  batchCreateCount: 0,
  batchReuseCount: 0,
  batchDestroyCount: 0,
  applyQueueDepth: 0,
  applyChunkCount: 0,
  applyBudgetOverrunCount: 0,
  idleSnapshotMs: 0,
  idleSnapshotSkippedCount: 0,
  columnarByteLength: 0,
  atlasGpuByteLength: 0,
  bufferByteLength: 0,
  cacheByteLength: 0,
  cacheEntryCount: 0,
  cacheHitCount: 0,
  cacheMissCount: 0,
  continuationCount: 0,
  coverageRatio: 0,
  displayedTileCount: 0,
  emptyDisplayedTileCount: 0,
  emptyVisibleFrameCount: 0,
  frameP95Ms: 0,
  inflightRequestCount: 0,
  indexByteLength: 0,
  lastFps: 0,
  lastFrameMs: 0,
  lastRenderMs: 0,
  lastTileApplyMs: 0,
  lastTileBuildMs: 0,
  lastTileRoundtripMs: 0,
  lastTileQueryMs: 0,
  maxFrameP95Ms: 0,
  maxTileApplyMs: 0,
  maxTileBuildMs: 0,
  maxTileRoundtripMs: 0,
  meshBatchCount: 0,
  meshDrawNodeCount: 0,
  meshIndexCount: 0,
  meshVertexCount: 0,
  nonEmptyCoverageRatio: 0,
  renderableShapeCount: 0,
  reactSyncCount: 0,
  retryCount: 0,
  screenVisibleCoverageRatio: 0,
  screenVisibleNonEmptyCoverageRatio: 0,
  screenVisibleShapeCount: 0,
  screenVisibleTileCount: 0,
  cellIntersectionRatio: 0,
  tileRequestCount: 0,
  truncated: false,
  visualEmptyReason: '',
  visiblePointCount: 0,
  visibleShapeCount: 0,
};

const tileOverscanRatio = 0.18;
const retryTileOverscanRatio = 1;
const tileBboxRoundingMicrons = 0.25;
const gdsTileCacheMaxEntries = 96;
const gdsTileCacheMaxBytes = 192 * 1024 * 1024;
const gdsHotFrameMaxDurationMs = 250;
const tileMaxShapes = 80_000;
const tileMaxPoints = 400_000;
const tileMaxBytes = 8 * 1024 * 1024;
const preciseTileMaxAreaMicrons = 250_000;
const gdsTileWindowTargetScreenSizePx = 520;
const gdsTileWindowMaxVisiblePlans = 16;
const gdsTileWindowMaxPrefetchPlans = 24;
const gdsDisplayedAtlasMaxEntries = 48;
export const gdsTileMaxContinuationPages = 32;
export const gdsTileMaxMergedPayloadBytes = 64 * 1024 * 1024;

export class PhysicalLayoutGdsTileLruCache {
  private readonly entries = new Map<string, { byteLength: number; tile: LspLayoutTileGeometry }>();
  private byteLength = 0;

  public clear() {
    this.entries.clear();
    this.byteLength = 0;
  }

  public get(key: string): LspLayoutTileGeometry | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.tile;
  }

  public peek(key: string): LspLayoutTileGeometry | undefined {
    return this.entries.get(key)?.tile;
  }

  public set(key: string, tile: LspLayoutTileGeometry) {
    const byteLength = estimateGdsTileByteLength(tile);
    const existing = this.entries.get(key);
    if (existing) {
      this.byteLength -= existing.byteLength;
      this.entries.delete(key);
    }

    if (byteLength > gdsTileCacheMaxBytes) {
      return;
    }

    this.entries.set(key, { byteLength, tile });
    this.byteLength += byteLength;
    this.prune();
  }

  public getStats(): PhysicalLayoutGdsTileCacheStats {
    return {
      byteLength: this.byteLength,
      entryCount: this.entries.size,
    };
  }

  private prune() {
    while (this.entries.size > gdsTileCacheMaxEntries || this.byteLength > gdsTileCacheMaxBytes) {
      const firstKey = this.entries.keys().next().value as string | undefined;
      if (!firstKey) {
        break;
      }

      const entry = this.entries.get(firstKey);
      if (entry) {
        this.byteLength -= entry.byteLength;
      }
      this.entries.delete(firstKey);
    }
  }
}

export function isGdsTileModeEnabled(
  sourceKind: string | null | undefined,
  targetKind: string | null | undefined,
): boolean {
  return sourceKind === 'gds' && targetKind === 'gdsCell';
}

export function createGdsTileRequestPlan(input: PhysicalLayoutGdsTileRequestInput & {
  bboxOverride?: LspLayoutBounds;
  cacheKeyOverride?: string;
  cacheKeyTag?: string;
  layerFilterMode?: 'visible' | 'all';
  lod?: number;
  overscanRatio?: number;
}): PhysicalLayoutGdsTileRequestPlan {
  const viewportBbox = input.bboxOverride
    ?? getViewportWorldBounds(input.camera, input.size, input.overscanRatio ?? tileOverscanRatio);
  const clippedBbox = input.selectedBounds ? clipLayoutBounds(viewportBbox, input.selectedBounds) : viewportBbox;
  const lod = input.lod ?? getGdsTileLod(input.camera.zoom);
  const visibleFilter = getVisibleGdsTileFilter(input.visibility);
  const useVisibleLayerFilter = input.layerFilterMode !== 'all' && hasActiveGdsTileVisibilityFilter(input.visibility);
  const emptyByVisibility = useVisibleLayerFilter && visibleFilter.layerIndices.length === 0 && input.visibility.layerOpacities.size > 0;
  const emptyByBounds = clippedBbox === null;
  const empty = emptyByVisibility || emptyByBounds;
  const layerIndices = !useVisibleLayerFilter
    ? undefined
    : empty ? [] : visibleFilter.layerIndices.length > 0 ? visibleFilter.layerIndices : undefined;
  const shouldSendShapeKindFilter = useVisibleLayerFilter && lod === 0;
  const shapeKinds = !useVisibleLayerFilter
    ? undefined
    : empty ? [] : shouldSendShapeKindFilter && visibleFilter.shapeKinds.length > 0 ? visibleFilter.shapeKinds : undefined;
  const roundedBbox = roundTileBounds(clippedBbox ?? viewportBbox);
  const cacheKey = createGdsTileCacheKey({
    bbox: roundedBbox,
    layerIndices,
    lod,
    rootCellIndex: input.rootCellIndex,
    shapeKinds,
    sessionId: input.sessionId,
      visibilityKey: input.layerFilterMode === 'all' ? 'all' : createGdsTileFilterKey(input.visibility),
  });
  const taggedCacheKey = input.cacheKeyOverride ?? (input.cacheKeyTag ? `${cacheKey}|${input.cacheKeyTag}` : cacheKey);

  return {
    bbox: roundedBbox,
    cacheKey: taggedCacheKey,
    empty,
    emptyReason: emptyByVisibility ? 'all-hidden' : emptyByBounds ? 'outside-cell-bounds' : '',
    layerIndices,
    lod,
    options: {
      bbox: roundedBbox,
      layerIndices,
      lod,
      maxBytes: tileMaxBytes,
      maxPoints: tileMaxPoints,
      maxShapes: tileMaxShapes,
      rootCellIndex: input.rootCellIndex,
      sessionId: input.sessionId,
      shapeKinds,
    },
    shapeKinds,
  };
}

export function shouldUseFullCellGdsTile(input: Pick<PhysicalLayoutGdsTileRequestInput, 'selectedBounds'>): boolean {
  return Boolean(input.selectedBounds && getLayoutBoundsArea(input.selectedBounds) <= preciseTileMaxAreaMicrons);
}

export function createGdsFullCellTileRequestPlan(input: PhysicalLayoutGdsTileRequestInput): PhysicalLayoutGdsTileRequestPlan {
  return createGdsTileRequestPlan({
    ...input,
    bboxOverride: input.selectedBounds ?? undefined,
    cacheKeyTag: 'full-cell',
    layerFilterMode: 'all',
    lod: 0,
  });
}

export function createGdsTileWindowPlan(input: PhysicalLayoutGdsTileRequestInput): PhysicalLayoutGdsTileWindowPlan {
  const primaryPlan = createGdsTileRequestPlan(input);
  const viewportBbox = getViewportWorldBounds(input.camera, input.size, tileOverscanRatio);
  if (primaryPlan.empty || !input.selectedBounds) {
    return {
      cellBounds: input.selectedBounds ?? null,
      prefetchPlans: [],
      primaryPlan,
      tileWorldSize: 0,
      visiblePlans: [primaryPlan],
      viewportBbox,
    };
  }

  const lod = primaryPlan.lod;
  const tileWorldSize = getGdsTileWindowWorldSize(input.camera.zoom, primaryPlan.bbox);
  const originX = input.selectedBounds.x0;
  const originY = input.selectedBounds.y0;
  const visibleRange = getGdsTileCoordRange(primaryPlan.bbox, originX, originY, tileWorldSize);
  const visiblePlans: PhysicalLayoutGdsTileRequestPlan[] = [];
  const prefetchPlans: PhysicalLayoutGdsTileRequestPlan[] = [];

  for (let tileY = visibleRange.y0 - 1; tileY <= visibleRange.y1 + 1; tileY += 1) {
    for (let tileX = visibleRange.x0 - 1; tileX <= visibleRange.x1 + 1; tileX += 1) {
      const tileBbox = {
        x0: originX + tileX * tileWorldSize,
        y0: originY + tileY * tileWorldSize,
        x1: originX + (tileX + 1) * tileWorldSize,
        y1: originY + (tileY + 1) * tileWorldSize,
      };
      if (!doLayoutBoundsIntersect(tileBbox, input.selectedBounds)) {
        continue;
      }

      const isVisible = tileX >= visibleRange.x0
        && tileX <= visibleRange.x1
        && tileY >= visibleRange.y0
        && tileY <= visibleRange.y1;
      const plan = createGdsTileRequestPlan({
        ...input,
        bboxOverride: tileBbox,
        cacheKeyOverride: createGdsTileWindowCacheKey({
          lod,
          rootCellIndex: input.rootCellIndex,
          sessionId: input.sessionId,
          tileWorldSize,
          tileX,
          tileY,
          visibilityKey: createGdsTileFilterKey(input.visibility),
        }),
        lod,
      });
      if (plan.empty) {
        continue;
      }

      if (isVisible) {
        if (visiblePlans.length < gdsTileWindowMaxVisiblePlans) {
          visiblePlans.push(plan);
        }
      } else if (prefetchPlans.length < gdsTileWindowMaxPrefetchPlans) {
        prefetchPlans.push(plan);
      }
    }
  }

  if (visiblePlans.length === 0) {
    visiblePlans.push(primaryPlan);
  }

  return {
    cellBounds: input.selectedBounds,
    prefetchPlans,
    primaryPlan,
    tileWorldSize,
    visiblePlans,
    viewportBbox,
  };
}

export function createGdsTileAtlasUpdate(input: {
  currentTiles: ReadonlyMap<string, PhysicalLayoutGdsDisplayedTile>;
  incomingTiles: readonly PhysicalLayoutGdsDisplayedTile[];
  windowPlan: PhysicalLayoutGdsTileWindowPlan;
}): PhysicalLayoutGdsTileAtlasUpdate {
  const visibleKeys = new Set(input.windowPlan.visiblePlans.map((plan) => plan.cacheKey));
  const nextTiles = new Map<string, PhysicalLayoutGdsDisplayedTile>();
  let keptPreviousTileCount = 0;
  let acceptedTileCount = 0;

  for (const [key, entry] of input.currentTiles) {
    if (
      visibleKeys.has(key)
      || doLayoutBoundsIntersect(entry.plan.bbox, input.windowPlan.viewportBbox)
    ) {
      nextTiles.set(key, entry);
      keptPreviousTileCount += 1;
    }
  }

  for (const entry of input.incomingTiles) {
    if (entry.tile.geometry.shapes.length === 0) {
      continue;
    }
    if (
      !visibleKeys.has(entry.plan.cacheKey)
      && !doLayoutBoundsIntersect(entry.plan.bbox, input.windowPlan.viewportBbox)
    ) {
      continue;
    }
    nextTiles.set(entry.plan.cacheKey, entry);
    acceptedTileCount += 1;
  }

  let nextTileValues = Array.from(nextTiles.values());
  let coverageRatio = calculateGdsTileCoverageRatio(nextTileValues, input.windowPlan.viewportBbox);
  if (nextTiles.size > gdsDisplayedAtlasMaxEntries) {
    pruneGdsDisplayedTileAtlas(nextTiles, input.windowPlan, gdsDisplayedAtlasMaxEntries);
    nextTileValues = Array.from(nextTiles.values());
    coverageRatio = calculateGdsTileCoverageRatio(nextTileValues, input.windowPlan.viewportBbox);
  }
  const screenCoverage = calculateGdsScreenVisibleCoverage({
    cellBounds: input.windowPlan.cellBounds,
    tiles: nextTileValues,
    viewportBbox: input.windowPlan.viewportBbox,
  });

  return {
    acceptedTileCount,
    cellIntersectionRatio: screenCoverage.cellIntersectionRatio,
    coverageRatio,
    keptPreviousTileCount,
    screenVisibleCoverageRatio: screenCoverage.screenVisibleCoverageRatio,
    screenVisibleNonEmptyCoverageRatio: screenCoverage.screenVisibleNonEmptyCoverageRatio,
    screenVisibleShapeCount: screenCoverage.screenVisibleShapeCount,
    screenVisibleTileCount: screenCoverage.screenVisibleTileCount,
    tiles: nextTiles,
    visualEmptyReason: screenCoverage.visualEmptyReason,
  };
}

export function calculateGdsTileCoverageRatio(
  tiles: readonly PhysicalLayoutGdsDisplayedTile[],
  viewportBbox: LspLayoutBounds,
): number {
  const viewportArea = getLayoutBoundsArea(viewportBbox);
  if (viewportArea <= 0) {
    return 0;
  }

  const coveredArea = tiles.reduce((sum, entry) => (
    sum + getLayoutBoundsIntersectionArea(entry.plan.bbox, viewportBbox)
  ), 0);
  return Math.max(0, Math.min(1, coveredArea / viewportArea));
}

export function calculateGdsNonEmptyTileCoverageRatio(
  tiles: readonly PhysicalLayoutGdsDisplayedTile[],
  viewportBbox: LspLayoutBounds,
): number {
  return calculateGdsTileCoverageRatio(
    tiles.filter((entry) => entry.tile.geometry.shapes.length > 0),
    viewportBbox,
  );
}

export function calculateGdsScreenVisibleCoverage(input: {
  allHidden?: boolean;
  cellBounds?: LspLayoutBounds | null;
  tiles: readonly PhysicalLayoutGdsDisplayedTile[];
  viewportBbox: LspLayoutBounds;
}): PhysicalLayoutGdsScreenCoverage {
  const viewportArea = getLayoutBoundsArea(input.viewportBbox);
  if (viewportArea <= 0) {
    return {
      cellIntersectionRatio: 0,
      screenVisibleCoverageRatio: 0,
      screenVisibleNonEmptyCoverageRatio: 0,
      screenVisibleShapeCount: 0,
      screenVisibleTileCount: 0,
      visualEmptyReason: 'invalid-viewport-bbox',
    };
  }

  const cellIntersectionArea = input.cellBounds
    ? getLayoutBoundsIntersectionArea(input.viewportBbox, input.cellBounds)
    : viewportArea;
  const cellIntersectionRatio = Math.max(0, Math.min(1, cellIntersectionArea / viewportArea));
  if (input.cellBounds && cellIntersectionArea <= 0) {
    return {
      cellIntersectionRatio: 0,
      screenVisibleCoverageRatio: 0,
      screenVisibleNonEmptyCoverageRatio: 0,
      screenVisibleShapeCount: 0,
      screenVisibleTileCount: 0,
      visualEmptyReason: 'outside-cell-bounds',
    };
  }

  const coverageArea = input.cellBounds ? cellIntersectionArea : viewportArea;
  let coveredArea = 0;
  let nonEmptyCoveredArea = 0;
  let screenVisibleShapeCount = 0;
  let screenVisibleTileCount = 0;

  for (const entry of input.tiles) {
    const visibleArea = getLayoutBoundsIntersectionArea(entry.plan.bbox, input.viewportBbox);
    if (visibleArea <= 0) {
      continue;
    }
    screenVisibleTileCount += 1;
    coveredArea += visibleArea;
    if (entry.tile.geometry.shapes.length > 0) {
      const tileVisibleShapeCount = entry.tile.geometry.shapes.reduce((count, shape) => (
        count + (doLayoutBoundsIntersect(shape.rect, input.viewportBbox) ? 1 : 0)
      ), 0);
      if (tileVisibleShapeCount > 0) {
        nonEmptyCoveredArea += visibleArea;
        screenVisibleShapeCount += tileVisibleShapeCount;
      }
    }
  }

  const screenVisibleCoverageRatio = coverageArea > 0
    ? Math.max(0, Math.min(1, coveredArea / coverageArea))
    : 0;
  const screenVisibleNonEmptyCoverageRatio = coverageArea > 0
    ? Math.max(0, Math.min(1, nonEmptyCoveredArea / coverageArea))
    : 0;
  let visualEmptyReason = '';
  if (input.allHidden) {
    visualEmptyReason = screenVisibleShapeCount === 0 ? 'all-hidden' : '';
  } else if (screenVisibleTileCount === 0) {
    visualEmptyReason = 'no-screen-visible-tiles';
  } else if (screenVisibleShapeCount === 0) {
    visualEmptyReason = 'no-screen-visible-shapes';
  }

  return {
    cellIntersectionRatio,
    screenVisibleCoverageRatio,
    screenVisibleNonEmptyCoverageRatio,
    screenVisibleShapeCount,
    screenVisibleTileCount,
    visualEmptyReason,
  };
}

export function filterGdsScreenVisibleDisplayedTiles(
  tiles: ReadonlyMap<string, PhysicalLayoutGdsDisplayedTile>,
  viewportBbox: LspLayoutBounds,
  cellBounds?: LspLayoutBounds | null,
): Map<string, PhysicalLayoutGdsDisplayedTile> {
  if (cellBounds && getLayoutBoundsIntersectionArea(viewportBbox, cellBounds) <= 0) {
    return new Map();
  }

  const visibleTiles = new Map<string, PhysicalLayoutGdsDisplayedTile>();
  for (const [key, entry] of tiles) {
    if (getLayoutBoundsIntersectionArea(entry.plan.bbox, viewportBbox) > 0) {
      visibleTiles.set(key, entry);
    }
  }
  return visibleTiles;
}

export function estimateGdsDisplayedTileAtlasByteLength(
  tiles: ReadonlyMap<string, PhysicalLayoutGdsDisplayedTile>,
): number {
  let byteLength = 0;
  for (const entry of tiles.values()) {
    byteLength += estimateGdsTileByteLength(entry.tile);
  }
  return byteLength;
}

export function createGdsPreciseTileRequestPlan(input: PhysicalLayoutGdsTileRequestInput): PhysicalLayoutGdsTileRequestPlan {
  return createGdsTileRequestPlan({
    ...input,
    lod: 0,
  });
}

export function createGdsRetryTileRequestPlan(input: PhysicalLayoutGdsTileRequestInput): PhysicalLayoutGdsTileRequestPlan {
  return createGdsTileRequestPlan({
    ...input,
    lod: 0,
    overscanRatio: retryTileOverscanRatio,
  });
}

export function createGdsOverviewRetryTileRequestPlan(input: PhysicalLayoutGdsTileRequestInput): PhysicalLayoutGdsTileRequestPlan {
  return createGdsTileRequestPlan({
    ...input,
    layerFilterMode: 'all',
    lod: Math.max(1, getGdsTileLod(input.camera.zoom)),
    overscanRatio: retryTileOverscanRatio,
  });
}

export function shouldRequestPreciseGdsTile(plan: PhysicalLayoutGdsTileRequestPlan): boolean {
  return !plan.empty && plan.lod > 0 && getLayoutBoundsArea(plan.bbox) <= preciseTileMaxAreaMicrons;
}

export type PhysicalLayoutGdsEmptyRetryKind = 'none' | 'overview' | 'precise';

export function getGdsEmptyTileRetryKind(
  plan: PhysicalLayoutGdsTileRequestPlan,
  selectedBounds: LspLayoutBounds | null | undefined,
): PhysicalLayoutGdsEmptyRetryKind {
  if (plan.empty || !doLayoutBoundsIntersect(plan.bbox, selectedBounds)) {
    return 'none';
  }

  if (getLayoutBoundsArea(plan.bbox) <= preciseTileMaxAreaMicrons) {
    return 'precise';
  }

  return plan.lod > 0 ? 'overview' : 'none';
}

export function doLayoutBoundsIntersect(left: LspLayoutBounds | null | undefined, right: LspLayoutBounds | null | undefined): boolean {
  if (!left || !right) {
    return false;
  }

  return left.x0 <= right.x1
    && left.x1 >= right.x0
    && left.y0 <= right.y1
    && left.y1 >= right.y0;
}

export function getLayoutBoundsArea(bounds: LspLayoutBounds): number {
  return Math.max(0, bounds.x1 - bounds.x0) * Math.max(0, bounds.y1 - bounds.y0);
}

export function getLayoutBoundsIntersectionArea(left: LspLayoutBounds | null | undefined, right: LspLayoutBounds | null | undefined): number {
  if (!left || !right) {
    return 0;
  }

  const x0 = Math.max(left.x0, right.x0);
  const y0 = Math.max(left.y0, right.y0);
  const x1 = Math.min(left.x1, right.x1);
  const y1 = Math.min(left.y1, right.y1);
  return Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
}

export function createMergedGdsTileGeometry(tiles: readonly LspLayoutTileGeometry[]): LspLayoutTileGeometry | null {
  const merged = mergeGdsTileGeometryResults(tiles);
  if (!merged) {
    return null;
  }

  let nextIndex = 0;
  const shapes = merged.geometry.shapes.map((shape) => ({
    ...shape,
    index: nextIndex++,
  }));

  return {
    ...merged,
    geometry: {
      ...merged.geometry,
      polygonPointCount: shapes.reduce((count, shape) => count + (shape.polygon?.length ?? 0), 0),
      shapeCount: shapes.length,
      shapes,
    },
    tileShapeCount: shapes.length,
  };
}

export function createEmptyGdsTileGeometry(unitsPerMicron = 1): LspLayoutTileGeometry {
  return {
    geometry: {
      polygonPointCount: 0,
      shapeCount: 0,
      shapes: [],
      truncated: false,
      unitsPerMicron,
    },
    metrics: {
      cacheHitCount: 0,
      cacheMissCount: 0,
      elementCandidateCount: 0,
      encodeMicros: 0,
      gridBinCount: 0,
      gridBuildMicros: 0,
      gridCandidateCount: 0,
      gridHitCount: 0,
      gridMissCount: 0,
      indexBuildMicros: 0,
      lodShapeCount: 0,
      queryMicros: 0,
      referenceCandidateCount: 0,
      traversedReferenceCount: 0,
      visitedCellCount: 0,
    },
    nextToken: null,
    payloadSize: 0,
    tileShapeCount: 0,
    truncated: false,
  };
}

export function mergeGdsTileGeometryResults(results: readonly LspLayoutTileGeometry[]): LspLayoutTileGeometry | null {
  if (results.length === 0) {
    return null;
  }

  const [first] = results;
  if (!first) {
    return null;
  }

  const shapes = results.flatMap((result) => result.geometry.shapes);
  const polygonPointCount = shapes.reduce((count, shape) => count + (shape.polygon?.length ?? 0), 0);

  return {
    geometry: {
      polygonPointCount,
      shapeCount: shapes.length,
      shapes,
      truncated: results.some((result) => result.geometry.truncated),
      unitsPerMicron: first.geometry.unitsPerMicron,
    },
    metrics: mergeGdsTileMetrics(results.map((result) => result.metrics)),
    nextToken: results[results.length - 1]?.nextToken ?? null,
    payloadSize: results.reduce((sum, result) => sum + result.payloadSize, 0),
    tileShapeCount: shapes.length,
    truncated: results.some((result) => result.truncated),
  };
}

export function createGdsTileMetricsSnapshot(input: {
  atlasByteLength?: number;
  blankFrameCount?: number;
  bufferCapacityVertexCount?: number;
  bufferDataReplaceCount?: number;
  bufferReallocCount?: number;
  bufferSubarrayCommitCount?: number;
  bufferUpdateCount?: number;
  bufferUpdateMs?: number;
  tileLayerCreateCount?: number;
  tileLayerReuseCount?: number;
  tileLayerDestroyCount?: number;
  batchCreateCount?: number;
  batchReuseCount?: number;
  batchDestroyCount?: number;
  applyQueueDepth?: number;
  applyChunkCount?: number;
  applyBudgetOverrunCount?: number;
  idleSnapshotMs?: number;
  idleSnapshotSkippedCount?: number;
  columnarByteLength?: number;
  atlasGpuByteLength?: number;
  cacheStats?: PhysicalLayoutGdsTileCacheStats;
  continuationCount?: number;
  coverageRatio?: number;
  displayedTileCount?: number;
  emptyDisplayedTileCount?: number;
  emptyVisibleFrameCount?: number;
  frameDurationsMs: readonly number[];
  inflightRequestCount?: number;
  tileApplyMs?: number;
  tileBuildMs?: number;
  meshBatchCount?: number;
  meshDrawNodeCount?: number;
  meshIndexCount: number;
  meshVertexCount: number;
  reactSyncCount?: number;
  renderMs: number;
  retryCount?: number;
  tile: LspLayoutTileGeometry | null;
  tileRequestCount: number;
  tileRoundtripMs: number;
  maxFrameP95Ms?: number;
  maxTileApplyMs?: number;
  maxTileBuildMs?: number;
  maxTileRoundtripMs?: number;
  nonEmptyCoverageRatio?: number;
  renderableShapeCount?: number;
  screenVisibleCoverageRatio?: number;
  screenVisibleNonEmptyCoverageRatio?: number;
  screenVisibleShapeCount?: number;
  screenVisibleTileCount?: number;
  cellIntersectionRatio?: number;
  visualEmptyReason?: string;
}): PhysicalLayoutGdsTileMetrics {
  const frameDurations = input.frameDurationsMs.filter((value) => (
    Number.isFinite(value)
    && value > 0
    && value <= gdsHotFrameMaxDurationMs
  ));
  const lastFrameMs = frameDurations[frameDurations.length - 1] ?? 0;
  const fpsValues = frameDurations.map((value) => 1000 / value);
  const lastFps = fpsValues[fpsValues.length - 1] ?? 0;
  const averageFps = fpsValues.length > 0
    ? fpsValues.reduce((sum, value) => sum + value, 0) / fpsValues.length
    : 0;

  return {
    averageFps,
    atlasByteLength: input.atlasByteLength ?? 0,
    blankFrameCount: input.blankFrameCount ?? 0,
    bufferCapacityVertexCount: input.bufferCapacityVertexCount ?? input.meshVertexCount,
    bufferDataReplaceCount: input.bufferDataReplaceCount ?? 0,
    bufferReallocCount: input.bufferReallocCount ?? 0,
    bufferSubarrayCommitCount: input.bufferSubarrayCommitCount ?? 0,
    bufferUpdateCount: input.bufferUpdateCount ?? 0,
    bufferUpdateMs: input.bufferUpdateMs ?? 0,
    tileLayerCreateCount: input.tileLayerCreateCount ?? 0,
    tileLayerReuseCount: input.tileLayerReuseCount ?? 0,
    tileLayerDestroyCount: input.tileLayerDestroyCount ?? 0,
    batchCreateCount: input.batchCreateCount ?? 0,
    batchReuseCount: input.batchReuseCount ?? 0,
    batchDestroyCount: input.batchDestroyCount ?? 0,
    applyQueueDepth: input.applyQueueDepth ?? 0,
    applyChunkCount: input.applyChunkCount ?? 0,
    applyBudgetOverrunCount: input.applyBudgetOverrunCount ?? 0,
    idleSnapshotMs: input.idleSnapshotMs ?? 0,
    idleSnapshotSkippedCount: input.idleSnapshotSkippedCount ?? 0,
    columnarByteLength: input.columnarByteLength ?? 0,
    atlasGpuByteLength: input.atlasGpuByteLength ?? 0,
    bufferByteLength: input.meshVertexCount * 2 * Float32Array.BYTES_PER_ELEMENT,
    cacheByteLength: input.cacheStats?.byteLength ?? 0,
    cacheEntryCount: input.cacheStats?.entryCount ?? 0,
    cacheHitCount: input.tile?.metrics.cacheHitCount ?? 0,
    cacheMissCount: input.tile?.metrics.cacheMissCount ?? 0,
    continuationCount: input.continuationCount ?? (input.tile?.nextToken === null ? 0 : 1),
    coverageRatio: input.coverageRatio ?? 0,
    displayedTileCount: input.displayedTileCount ?? 0,
    emptyDisplayedTileCount: input.emptyDisplayedTileCount ?? 0,
    emptyVisibleFrameCount: input.emptyVisibleFrameCount ?? 0,
    frameP95Ms: percentile(frameDurations, 0.95),
    inflightRequestCount: input.inflightRequestCount ?? 0,
    indexByteLength: input.meshIndexCount * Uint32Array.BYTES_PER_ELEMENT,
    lastFps,
    lastFrameMs,
    lastRenderMs: input.renderMs,
    lastTileApplyMs: input.tileApplyMs ?? 0,
    lastTileBuildMs: input.tileBuildMs ?? 0,
    lastTileRoundtripMs: input.tileRoundtripMs,
    lastTileQueryMs: microsToMs(input.tile?.metrics.queryMicros ?? 0),
    maxFrameP95Ms: input.maxFrameP95Ms ?? percentile(frameDurations, 0.95),
    maxTileApplyMs: input.maxTileApplyMs ?? (input.tileApplyMs ?? 0),
    maxTileBuildMs: input.maxTileBuildMs ?? (input.tileBuildMs ?? 0),
    maxTileRoundtripMs: input.maxTileRoundtripMs ?? input.tileRoundtripMs,
    meshBatchCount: input.meshBatchCount ?? 0,
    meshDrawNodeCount: input.meshDrawNodeCount ?? 0,
    meshIndexCount: input.meshIndexCount,
    meshVertexCount: input.meshVertexCount,
    nonEmptyCoverageRatio: input.nonEmptyCoverageRatio ?? 0,
    renderableShapeCount: input.renderableShapeCount ?? (input.tile?.geometry.shapes.length ?? 0),
    reactSyncCount: input.reactSyncCount ?? 0,
    retryCount: input.retryCount ?? 0,
    screenVisibleCoverageRatio: input.screenVisibleCoverageRatio ?? 0,
    screenVisibleNonEmptyCoverageRatio: input.screenVisibleNonEmptyCoverageRatio ?? 0,
    screenVisibleShapeCount: input.screenVisibleShapeCount ?? 0,
    screenVisibleTileCount: input.screenVisibleTileCount ?? 0,
    cellIntersectionRatio: input.cellIntersectionRatio ?? 0,
    tileRequestCount: input.tileRequestCount,
    truncated: input.tile?.truncated ?? false,
    visualEmptyReason: input.visualEmptyReason ?? '',
    visiblePointCount: input.tile?.geometry.polygonPointCount ?? 0,
    visibleShapeCount: input.tile?.geometry.shapes.length ?? 0,
  };
}

export function estimateGdsTileByteLength(tile: LspLayoutTileGeometry): number {
  const payloadSize = Math.max(0, tile.payloadSize);
  const shapeBytes = tile.geometry.shapes.reduce((sum, shape) => (
    sum
    + 96
    + ((shape.polygon?.length ?? 0) * 16)
  ), 0);
  const geometryBytes = shapeBytes + tile.geometry.polygonPointCount * 16;

  return Math.max(payloadSize, geometryBytes);
}

export function getGdsTileShapeStyle(
  shape: LspLayoutShape,
  visibility: PhysicalLayoutVisibility,
  getColor: (layerIndex: number, category: PhysicalLayoutLayerCategory) => { pixiColor: number },
): PhysicalLayoutGdsTileShapeStyle | null {
  if (shape.kind === 'placement') {
    const category: PhysicalLayoutLayerCategory = 'boundary';
    const layerOpacity = getPhysicalLayoutLayerOpacity(visibility, shape.layerIndex);
    return {
      alpha: 0.7 * layerOpacity,
      category,
      color: getColor(shape.layerIndex, category).pixiColor,
      strokeAlpha: 0.92 * layerOpacity,
      strokeWidth: 0.015,
    };
  }

  const category = getPhysicalLayoutShapeCategory(shape, 'gds');
  if (!category || !isPhysicalLayoutLayerCategoryVisible(visibility, shape.layerIndex, category)) {
    return null;
  }

  const layerOpacity = getPhysicalLayoutLayerOpacity(visibility, shape.layerIndex);
  return {
    alpha: (category === 'blockage' ? 0.28 : 0.7) * layerOpacity,
    category,
    color: getColor(shape.layerIndex, category).pixiColor,
    strokeAlpha: 0.92 * layerOpacity,
    strokeWidth: category === 'path' ? 0.018 : 0.015,
  };
}

export function getViewportWorldBounds(
  camera: PhysicalLayoutCamera,
  viewport: PhysicalLayoutViewport,
  overscanRatio = 0,
): LspLayoutBounds {
  const overscanX = viewport.width * overscanRatio;
  const overscanY = viewport.height * overscanRatio;
  const x0 = (-overscanX - camera.panX) / camera.zoom;
  const y0 = (-overscanY - camera.panY) / camera.zoom;
  const x1 = (viewport.width + overscanX - camera.panX) / camera.zoom;
  const y1 = (viewport.height + overscanY - camera.panY) / camera.zoom;

  return {
    x0: Math.min(x0, x1),
    y0: Math.min(y0, y1),
    x1: Math.max(x0, x1),
    y1: Math.max(y0, y1),
  };
}

export function getGdsTileLod(zoom: number): number {
  if (zoom < 6) {
    return 2;
  }

  if (zoom < 24) {
    return 1;
  }

  return 0;
}

export function createGdsTileVisibilityKey(visibility: PhysicalLayoutVisibility): string {
  return [
    Array.from(visibility.visibleItems).sort().join(','),
    Array.from(visibility.layerOpacities.entries())
      .sort(([left], [right]) => left - right)
      .map(([layerIndex, opacity]) => `${layerIndex}:${opacity}`)
      .join(','),
  ].join('|');
}

export function createGdsTileFilterKey(visibility: PhysicalLayoutVisibility): string {
  const filter = getVisibleGdsTileFilter(visibility);
  return [
    hasActiveGdsTileVisibilityFilter(visibility) ? 'filtered' : 'all-visible',
    filter.layerIndices.join(','),
    filter.shapeKinds.join(','),
    visibility.layerOpacities.size > 0 ? 'initialized' : 'uninitialized',
  ].join('|');
}

export function hasActiveGdsTileVisibilityFilter(visibility: PhysicalLayoutVisibility): boolean {
  if (visibility.layerOpacities.size === 0) {
    return false;
  }

  for (const layerIndex of visibility.layerOpacities.keys()) {
    if (!visibility.visibleItems.has(`layer:${layerIndex}:boundary`)
      || !visibility.visibleItems.has(`layer:${layerIndex}:path`)
      || !visibility.visibleItems.has(`layer:${layerIndex}:text`)) {
      return true;
    }
  }

  return false;
}

function getVisibleGdsTileFilter(visibility: PhysicalLayoutVisibility): {
  layerIndices: number[];
  shapeKinds: number[];
} {
  const layerIndices = new Set<number>();
  const shapeKinds = new Set<number>();

  for (const key of visibility.visibleItems) {
    const match = /^layer:(-?\d+):(boundary|path|text)$/.exec(key);
    if (!match) {
      continue;
    }

    const layerIndex = Number(match[1]);
    if (Number.isInteger(layerIndex)) {
      layerIndices.add(layerIndex);
    }

    const category = match[2];
    if (!category) {
      continue;
    }

    for (const shapeKind of getGdsShapeKindCodesForCategory(category)) {
      shapeKinds.add(shapeKind);
    }
  }

  return {
    layerIndices: Array.from(layerIndices).sort((left, right) => left - right),
    shapeKinds: Array.from(shapeKinds).sort((left, right) => left - right),
  };
}

function getGdsShapeKindCodesForCategory(category: string): number[] {
  if (category === 'boundary') {
    return [1, 2];
  }
  if (category === 'path') {
    return [4];
  }
  if (category === 'text') {
    return [5];
  }
  return [];
}

function createGdsTileCacheKey(input: {
  bbox: LspLayoutBounds;
  layerIndices: readonly number[] | undefined;
  lod: number;
  rootCellIndex: number;
  shapeKinds: readonly number[] | undefined;
  sessionId: string;
  visibilityKey: string;
}): string {
  return [
    input.sessionId,
    input.rootCellIndex,
    input.lod,
    input.layerIndices ? input.layerIndices.join(',') : 'all',
    input.shapeKinds ? input.shapeKinds.join(',') : 'all',
    input.visibilityKey,
    input.bbox.x0,
    input.bbox.y0,
    input.bbox.x1,
    input.bbox.y1,
  ].join('|');
}

function createGdsTileWindowCacheKey(input: {
  lod: number;
  rootCellIndex: number;
  sessionId: string;
  tileWorldSize: number;
  tileX: number;
  tileY: number;
  visibilityKey: string;
}): string {
  return [
    input.sessionId,
    input.rootCellIndex,
    input.lod,
    input.visibilityKey,
    'window',
    input.tileWorldSize.toFixed(6),
    input.tileX,
    input.tileY,
  ].join('|');
}

function getGdsTileWindowWorldSize(zoom: number, viewportBbox: LspLayoutBounds): number {
  const screenDerivedSize = gdsTileWindowTargetScreenSizePx / Math.max(zoom, 0.000001);
  const viewportDerivedSize = Math.max(
    Math.max(0.001, viewportBbox.x1 - viewportBbox.x0) / 2,
    Math.max(0.001, viewportBbox.y1 - viewportBbox.y0) / 2,
  );
  const targetSize = Math.max(screenDerivedSize, viewportDerivedSize, 0.001);
  const exponent = Math.round(Math.log2(targetSize));
  return Math.max(0.001, 2 ** exponent);
}

function getGdsTileCoordRange(
  bbox: LspLayoutBounds,
  originX: number,
  originY: number,
  tileWorldSize: number,
): { x0: number; x1: number; y0: number; y1: number } {
  return {
    x0: Math.floor((bbox.x0 - originX) / tileWorldSize),
    x1: Math.floor((bbox.x1 - originX) / tileWorldSize),
    y0: Math.floor((bbox.y0 - originY) / tileWorldSize),
    y1: Math.floor((bbox.y1 - originY) / tileWorldSize),
  };
}

function clipLayoutBounds(bounds: LspLayoutBounds, clip: LspLayoutBounds): LspLayoutBounds | null {
  const x0 = Math.max(bounds.x0, clip.x0);
  const y0 = Math.max(bounds.y0, clip.y0);
  const x1 = Math.min(bounds.x1, clip.x1);
  const y1 = Math.min(bounds.y1, clip.y1);
  if (x1 <= x0 || y1 <= y0) {
    return null;
  }

  return { x0, y0, x1, y1 };
}

function roundTileBounds(bounds: LspLayoutBounds): LspLayoutBounds {
  return {
    x0: roundDown(bounds.x0),
    y0: roundDown(bounds.y0),
    x1: roundUp(bounds.x1),
    y1: roundUp(bounds.y1),
  };
}

function roundDown(value: number): number {
  return Math.floor(value / tileBboxRoundingMicrons) * tileBboxRoundingMicrons;
}

function roundUp(value: number): number {
  return Math.ceil(value / tileBboxRoundingMicrons) * tileBboxRoundingMicrons;
}

function pruneGdsDisplayedTileAtlas(
  tiles: Map<string, PhysicalLayoutGdsDisplayedTile>,
  windowPlan: PhysicalLayoutGdsTileWindowPlan,
  maxEntries: number,
) {
  const visibleKeys = new Set(windowPlan.visiblePlans.map((plan) => plan.cacheKey));
  const sortedEntries = Array.from(tiles.entries()).sort((left, right) => {
    const leftKey = left[0];
    const rightKey = right[0];
    const leftRank = getDisplayedTileRetentionRank(leftKey, left[1], visibleKeys, windowPlan.viewportBbox);
    const rightRank = getDisplayedTileRetentionRank(rightKey, right[1], visibleKeys, windowPlan.viewportBbox);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return estimateGdsTileByteLength(right[1].tile) - estimateGdsTileByteLength(left[1].tile);
  });

  tiles.clear();
  for (const [key, entry] of sortedEntries.slice(0, maxEntries)) {
    tiles.set(key, entry);
  }
}

function getDisplayedTileRetentionRank(
  key: string,
  entry: PhysicalLayoutGdsDisplayedTile,
  visibleKeys: ReadonlySet<string>,
  viewportBbox: LspLayoutBounds,
): number {
  if (visibleKeys.has(key)) {
    return 0;
  }
  if (doLayoutBoundsIntersect(entry.plan.bbox, viewportBbox)) {
    return 1;
  }
  return 2;
}

function mergeGdsTileMetrics(metrics: readonly LspLayoutTileMetrics[]): LspLayoutTileMetrics {
  return metrics.reduce((merged, current) => ({
    cacheHitCount: merged.cacheHitCount + current.cacheHitCount,
    cacheMissCount: merged.cacheMissCount + current.cacheMissCount,
    elementCandidateCount: merged.elementCandidateCount + current.elementCandidateCount,
    encodeMicros: merged.encodeMicros + current.encodeMicros,
    gridBinCount: Math.max(merged.gridBinCount, current.gridBinCount),
    gridBuildMicros: merged.gridBuildMicros + current.gridBuildMicros,
    gridCandidateCount: merged.gridCandidateCount + current.gridCandidateCount,
    gridHitCount: merged.gridHitCount + current.gridHitCount,
    gridMissCount: merged.gridMissCount + current.gridMissCount,
    indexBuildMicros: merged.indexBuildMicros + current.indexBuildMicros,
    lodShapeCount: merged.lodShapeCount + current.lodShapeCount,
    queryMicros: merged.queryMicros + current.queryMicros,
    referenceCandidateCount: merged.referenceCandidateCount + current.referenceCandidateCount,
    traversedReferenceCount: merged.traversedReferenceCount + current.traversedReferenceCount,
    visitedCellCount: merged.visitedCellCount + current.visitedCellCount,
  }), {
    cacheHitCount: 0,
    cacheMissCount: 0,
    elementCandidateCount: 0,
    encodeMicros: 0,
    gridBinCount: 0,
    gridBuildMicros: 0,
    gridCandidateCount: 0,
    gridHitCount: 0,
    gridMissCount: 0,
    indexBuildMicros: 0,
    lodShapeCount: 0,
    queryMicros: 0,
    referenceCandidateCount: 0,
    traversedReferenceCount: 0,
    visitedCellCount: 0,
  });
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

function microsToMs(value: number): number {
  return value / 1000;
}
