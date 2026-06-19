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
  bufferByteLength: number;
  cacheHitCount: number;
  cacheMissCount: number;
  continuationCount: number;
  frameP95Ms: number;
  indexByteLength: number;
  lastFps: number;
  lastFrameMs: number;
  lastRenderMs: number;
  lastTileRoundtripMs: number;
  lastTileQueryMs: number;
  meshIndexCount: number;
  meshVertexCount: number;
  tileRequestCount: number;
  truncated: boolean;
  visiblePointCount: number;
  visibleShapeCount: number;
}

export interface PhysicalLayoutGdsTileRequestPlan {
  bbox: LspLayoutBounds;
  cacheKey: string;
  layerIndices: number[] | undefined;
  lod: number;
  options: LspLayoutTileGeometryOptions;
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
  bufferByteLength: 0,
  cacheHitCount: 0,
  cacheMissCount: 0,
  continuationCount: 0,
  frameP95Ms: 0,
  indexByteLength: 0,
  lastFps: 0,
  lastFrameMs: 0,
  lastRenderMs: 0,
  lastTileRoundtripMs: 0,
  lastTileQueryMs: 0,
  meshIndexCount: 0,
  meshVertexCount: 0,
  tileRequestCount: 0,
  truncated: false,
  visiblePointCount: 0,
  visibleShapeCount: 0,
};

const tileOverscanRatio = 0.18;
const tileBboxRoundingMicrons = 0.25;
const tileMaxShapes = 80_000;
const tileMaxPoints = 400_000;
const tileMaxBytes = 8 * 1024 * 1024;

export function isGdsTileModeEnabled(
  sourceKind: string | null | undefined,
  targetKind: string | null | undefined,
): boolean {
  return sourceKind === 'gds' && targetKind === 'gdsCell';
}

export function createGdsTileRequestPlan(input: {
  camera: PhysicalLayoutCamera;
  rootCellIndex: number;
  sessionId: string;
  size: PhysicalLayoutViewport;
  visibility: PhysicalLayoutVisibility;
}): PhysicalLayoutGdsTileRequestPlan {
  const bbox = getViewportWorldBounds(input.camera, input.size, tileOverscanRatio);
  const lod = getGdsTileLod(input.camera.zoom);
  const visibleLayerIndices = getVisibleGdsTileLayerIndices(input.visibility);
  const layerIndices = visibleLayerIndices.length > 0 ? visibleLayerIndices : undefined;
  const roundedBbox = roundTileBounds(bbox);
  const cacheKey = createGdsTileCacheKey({
    bbox: roundedBbox,
    layerIndices,
    lod,
    rootCellIndex: input.rootCellIndex,
    sessionId: input.sessionId,
    visibilityKey: createGdsTileVisibilityKey(input.visibility),
  });

  return {
    bbox: roundedBbox,
    cacheKey,
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
    },
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
  frameDurationsMs: readonly number[];
  meshIndexCount: number;
  meshVertexCount: number;
  renderMs: number;
  tile: LspLayoutTileGeometry | null;
  tileRequestCount: number;
  tileRoundtripMs: number;
}): PhysicalLayoutGdsTileMetrics {
  const frameDurations = input.frameDurationsMs.filter((value) => Number.isFinite(value) && value > 0);
  const lastFrameMs = frameDurations[frameDurations.length - 1] ?? 0;
  const fpsValues = frameDurations.map((value) => 1000 / value);
  const lastFps = fpsValues[fpsValues.length - 1] ?? 0;
  const averageFps = fpsValues.length > 0
    ? fpsValues.reduce((sum, value) => sum + value, 0) / fpsValues.length
    : 0;

  return {
    averageFps,
    bufferByteLength: input.meshVertexCount * 2 * Float32Array.BYTES_PER_ELEMENT,
    cacheHitCount: input.tile?.metrics.cacheHitCount ?? 0,
    cacheMissCount: input.tile?.metrics.cacheMissCount ?? 0,
    continuationCount: input.tile?.nextToken === null ? 0 : 1,
    frameP95Ms: percentile(frameDurations, 0.95),
    indexByteLength: input.meshIndexCount * Uint32Array.BYTES_PER_ELEMENT,
    lastFps,
    lastFrameMs,
    lastRenderMs: input.renderMs,
    lastTileRoundtripMs: input.tileRoundtripMs,
    lastTileQueryMs: microsToMs(input.tile?.metrics.queryMicros ?? 0),
    meshIndexCount: input.meshIndexCount,
    meshVertexCount: input.meshVertexCount,
    tileRequestCount: input.tileRequestCount,
    truncated: input.tile?.truncated ?? false,
    visiblePointCount: input.tile?.geometry.polygonPointCount ?? 0,
    visibleShapeCount: input.tile?.geometry.shapes.length ?? 0,
  };
}

export function getGdsTileShapeStyle(
  shape: LspLayoutShape,
  visibility: PhysicalLayoutVisibility,
  getColor: (layerIndex: number, category: PhysicalLayoutLayerCategory) => { pixiColor: number },
): PhysicalLayoutGdsTileShapeStyle | null {
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

function getVisibleGdsTileLayerIndices(visibility: PhysicalLayoutVisibility): number[] {
  const layerIndices = new Set<number>();

  for (const key of visibility.visibleItems) {
    const match = /^layer:(-?\d+):(boundary|path|text)$/.exec(key);
    if (!match) {
      continue;
    }

    const layerIndex = Number(match[1]);
    if (Number.isInteger(layerIndex)) {
      layerIndices.add(layerIndex);
    }
  }

  return Array.from(layerIndices).sort((left, right) => left - right);
}

function createGdsTileCacheKey(input: {
  bbox: LspLayoutBounds;
  layerIndices: readonly number[] | undefined;
  lod: number;
  rootCellIndex: number;
  sessionId: string;
  visibilityKey: string;
}): string {
  return [
    input.sessionId,
    input.rootCellIndex,
    input.lod,
    input.layerIndices ? input.layerIndices.join(',') : 'all',
    input.visibilityKey,
    input.bbox.x0,
    input.bbox.y0,
    input.bbox.x1,
    input.bbox.y1,
  ].join('|');
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
