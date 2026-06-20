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
  bufferCapacityVertexCount: number;
  bufferReallocCount: number;
  bufferUpdateCount: number;
  bufferUpdateMs: number;
  bufferByteLength: number;
  cacheByteLength: number;
  cacheEntryCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  continuationCount: number;
  frameP95Ms: number;
  inflightRequestCount: number;
  indexByteLength: number;
  lastFps: number;
  lastFrameMs: number;
  lastRenderMs: number;
  lastTileRoundtripMs: number;
  lastTileQueryMs: number;
  meshBatchCount: number;
  meshDrawNodeCount: number;
  meshIndexCount: number;
  meshVertexCount: number;
  retryCount: number;
  tileRequestCount: number;
  truncated: boolean;
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

export const defaultPhysicalLayoutGdsTileMetrics: PhysicalLayoutGdsTileMetrics = {
  averageFps: 0,
  bufferCapacityVertexCount: 0,
  bufferReallocCount: 0,
  bufferUpdateCount: 0,
  bufferUpdateMs: 0,
  bufferByteLength: 0,
  cacheByteLength: 0,
  cacheEntryCount: 0,
  cacheHitCount: 0,
  cacheMissCount: 0,
  continuationCount: 0,
  frameP95Ms: 0,
  inflightRequestCount: 0,
  indexByteLength: 0,
  lastFps: 0,
  lastFrameMs: 0,
  lastRenderMs: 0,
  lastTileRoundtripMs: 0,
  lastTileQueryMs: 0,
  meshBatchCount: 0,
  meshDrawNodeCount: 0,
  meshIndexCount: 0,
  meshVertexCount: 0,
  retryCount: 0,
  tileRequestCount: 0,
  truncated: false,
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
  layerFilterMode?: 'visible' | 'all';
  lod?: number;
  overscanRatio?: number;
}): PhysicalLayoutGdsTileRequestPlan {
  const viewportBbox = getViewportWorldBounds(input.camera, input.size, input.overscanRatio ?? tileOverscanRatio);
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
    visibilityKey: createGdsTileFilterKey(input.visibility),
  });

  return {
    bbox: roundedBbox,
    cacheKey,
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
  bufferCapacityVertexCount?: number;
  bufferReallocCount?: number;
  bufferUpdateCount?: number;
  bufferUpdateMs?: number;
  cacheStats?: PhysicalLayoutGdsTileCacheStats;
  continuationCount?: number;
  frameDurationsMs: readonly number[];
  inflightRequestCount?: number;
  meshBatchCount?: number;
  meshDrawNodeCount?: number;
  meshIndexCount: number;
  meshVertexCount: number;
  renderMs: number;
  retryCount?: number;
  tile: LspLayoutTileGeometry | null;
  tileRequestCount: number;
  tileRoundtripMs: number;
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
    bufferCapacityVertexCount: input.bufferCapacityVertexCount ?? input.meshVertexCount,
    bufferReallocCount: input.bufferReallocCount ?? 0,
    bufferUpdateCount: input.bufferUpdateCount ?? 0,
    bufferUpdateMs: input.bufferUpdateMs ?? 0,
    bufferByteLength: input.meshVertexCount * 2 * Float32Array.BYTES_PER_ELEMENT,
    cacheByteLength: input.cacheStats?.byteLength ?? 0,
    cacheEntryCount: input.cacheStats?.entryCount ?? 0,
    cacheHitCount: input.tile?.metrics.cacheHitCount ?? 0,
    cacheMissCount: input.tile?.metrics.cacheMissCount ?? 0,
    continuationCount: input.continuationCount ?? (input.tile?.nextToken === null ? 0 : 1),
    frameP95Ms: percentile(frameDurations, 0.95),
    inflightRequestCount: input.inflightRequestCount ?? 0,
    indexByteLength: input.meshIndexCount * Uint32Array.BYTES_PER_ELEMENT,
    lastFps,
    lastFrameMs,
    lastRenderMs: input.renderMs,
    lastTileRoundtripMs: input.tileRoundtripMs,
    lastTileQueryMs: microsToMs(input.tile?.metrics.queryMicros ?? 0),
    meshBatchCount: input.meshBatchCount ?? 0,
    meshDrawNodeCount: input.meshDrawNodeCount ?? 0,
    meshIndexCount: input.meshIndexCount,
    meshVertexCount: input.meshVertexCount,
    retryCount: input.retryCount ?? 0,
    tileRequestCount: input.tileRequestCount,
    truncated: input.tile?.truncated ?? false,
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
