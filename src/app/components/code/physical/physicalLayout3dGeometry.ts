import type {
  LspLayoutCatalog,
  LspLayoutGeometry,
  LspLayoutShape,
} from '../../../../../types/systemverilog-lsp';
import {
  getLayoutTargetBounds,
  getShapesBounds,
  selectLayoutTargetShapes,
  shapeBounds,
  type PhysicalLayoutTarget,
} from './physicalLayoutGeometry';
import {
  filterVisiblePhysicalLayoutShapes,
  getPhysicalLayoutLayerCategoryColor,
  getPhysicalLayoutShapeCategory,
  type PhysicalLayoutLayerCategory,
  type PhysicalLayoutVisibility,
} from './physicalLayoutLayers';

export interface PhysicalLayout3DPoint {
  x: number;
  y: number;
}

export interface PhysicalLayout3DMeshInput {
  category: PhysicalLayoutLayerCategory;
  color: number;
  depth: number;
  id: string;
  layerIndex: number;
  opacity: number;
  points: PhysicalLayout3DPoint[];
  shapeIndex: number;
  z: number;
}

export interface PhysicalLayout3DSceneInput {
  bounds: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null;
  meshes: PhysicalLayout3DMeshInput[];
  selectedShapeCount: number;
}

const layerZStep = 0.18;
const categoryZOffsets: Partial<Record<PhysicalLayoutLayerCategory, number>> = {
  boundary: 0,
  path: 0.045,
  text: 0.09,
};
const categoryDepths: Partial<Record<PhysicalLayoutLayerCategory, number>> = {
  boundary: 0.09,
  path: 0.12,
  text: 0.035,
};
const minimumShapeSize = 0.01;

export function createPhysicalLayout3DSceneInput(
  catalog: LspLayoutCatalog | null | undefined,
  geometry: LspLayoutGeometry | null | undefined,
  selectedTarget: PhysicalLayoutTarget | null | undefined,
  layoutVisibility: PhysicalLayoutVisibility,
): PhysicalLayout3DSceneInput {
  if (catalog?.sourceKind !== 'gds' || selectedTarget?.kind !== 'gdsCell' || !geometry) {
    return {
      bounds: null,
      meshes: [],
      selectedShapeCount: 0,
    };
  }

  const selectedShapes = selectLayoutTargetShapes(catalog, geometry, selectedTarget);
  const visibleShapes = filterVisiblePhysicalLayoutShapes(selectedShapes, layoutVisibility);
  const meshes = visibleShapes.flatMap((shape) => createMeshInput(shape));
  const fallbackBounds = geometry ? getShapesBounds(geometry.shapes, null) : null;
  const bounds = getShapesBounds(selectedShapes, getLayoutTargetBounds(catalog, selectedTarget, fallbackBounds));

  return {
    bounds,
    meshes,
    selectedShapeCount: selectedShapes.length,
  };
}

export function getPhysicalLayout3DLayerZ(layerIndex: number, category: PhysicalLayoutLayerCategory): number {
  return layerIndex * layerZStep + (categoryZOffsets[category] ?? 0);
}

export function getPhysicalLayout3DDepth(category: PhysicalLayoutLayerCategory): number {
  return categoryDepths[category] ?? 0.08;
}

function createMeshInput(shape: LspLayoutShape): PhysicalLayout3DMeshInput[] {
  const category = getPhysicalLayoutShapeCategory(shape);
  if (category !== 'boundary' && category !== 'path' && category !== 'text') {
    return [];
  }

  const points = shape.polygon && shape.polygon.length >= 3
    ? normalizePolygonPoints(shape.polygon)
    : createRectPoints(shape);

  if (points.length < 3) {
    return [];
  }

  return [{
    category,
    color: getPhysicalLayoutLayerCategoryColor(shape.layerIndex, category).pixiColor,
    depth: getPhysicalLayout3DDepth(category),
    id: `${shape.index}:${shape.layerIndex}:${category}`,
    layerIndex: shape.layerIndex,
    opacity: category === 'text' ? 0.82 : 0.72,
    points,
    shapeIndex: shape.index,
    z: getPhysicalLayout3DLayerZ(shape.layerIndex, category),
  }];
}

function normalizePolygonPoints(points: readonly PhysicalLayout3DPoint[]): PhysicalLayout3DPoint[] {
  const normalized = points.map((point) => ({ x: point.x, y: point.y }));
  const first = normalized[0];
  const last = normalized[normalized.length - 1];

  if (first && last && Math.abs(first.x - last.x) < 0.000001 && Math.abs(first.y - last.y) < 0.000001) {
    normalized.pop();
  }

  return normalized;
}

function createRectPoints(shape: LspLayoutShape): PhysicalLayout3DPoint[] {
  const bounds = shapeBounds(shape);
  const width = Math.max(bounds.x1 - bounds.x0, minimumShapeSize);
  const height = Math.max(bounds.y1 - bounds.y0, minimumShapeSize);
  const x1 = bounds.x0 + width;
  const y1 = bounds.y0 + height;

  return [
    { x: bounds.x0, y: bounds.y0 },
    { x: x1, y: bounds.y0 },
    { x: x1, y: y1 },
    { x: bounds.x0, y: y1 },
  ];
}
