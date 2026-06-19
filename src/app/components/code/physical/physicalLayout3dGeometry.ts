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
  getPhysicalLayoutLayerOpacity,
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
  bounds3D: PhysicalLayout3DBounds | null;
  meshes: PhysicalLayout3DMeshInput[];
  selectedShapeCount: number;
}

export interface PhysicalLayout3DBounds {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}

export interface PhysicalLayout3DCenter {
  x: number;
  y: number;
  z: number;
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
      bounds3D: null,
      meshes: [],
      selectedShapeCount: 0,
    };
  }

  const selectedShapes = selectLayoutTargetShapes(catalog, geometry, selectedTarget);
  const visibleShapes = filterVisiblePhysicalLayoutShapes(selectedShapes, layoutVisibility, catalog.sourceKind);
  const meshes = visibleShapes.flatMap((shape) => createMeshInput(shape, layoutVisibility));
  const fallbackBounds = geometry ? getShapesBounds(geometry.shapes, null) : null;
  const bounds = getShapesBounds(selectedShapes, getLayoutTargetBounds(catalog, selectedTarget, fallbackBounds));

  return {
    bounds,
    bounds3D: getPhysicalLayout3DBounds(meshes, bounds),
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

export function getPhysicalLayout3DBounds(
  meshes: readonly PhysicalLayout3DMeshInput[],
  fallbackBounds: PhysicalLayout3DSceneInput['bounds'],
): PhysicalLayout3DBounds | null {
  let bounds: PhysicalLayout3DBounds | null = null;

  for (const mesh of meshes) {
    for (const point of mesh.points) {
      bounds = extendPhysicalLayout3DBounds(bounds, point.x, point.y, mesh.z);
      bounds = extendPhysicalLayout3DBounds(bounds, point.x, point.y, mesh.z + mesh.depth);
    }
  }

  if (bounds) {
    return normalizePhysicalLayout3DBounds(bounds);
  }

  if (!fallbackBounds) {
    return null;
  }

  return normalizePhysicalLayout3DBounds({
    x0: fallbackBounds.x0,
    y0: fallbackBounds.y0,
    z0: 0,
    x1: fallbackBounds.x1,
    y1: fallbackBounds.y1,
    z1: getPhysicalLayout3DDepth('boundary'),
  });
}

export function getPhysicalLayout3DCenter(bounds: PhysicalLayout3DBounds): PhysicalLayout3DCenter {
  return {
    x: (bounds.x0 + bounds.x1) / 2,
    y: (bounds.y0 + bounds.y1) / 2,
    z: (bounds.z0 + bounds.z1) / 2,
  };
}

function createMeshInput(shape: LspLayoutShape, layoutVisibility: PhysicalLayoutVisibility): PhysicalLayout3DMeshInput[] {
  const category = getPhysicalLayoutShapeCategory(shape, 'gds');
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
    opacity: getPhysicalLayoutLayerOpacity(layoutVisibility, shape.layerIndex),
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

function extendPhysicalLayout3DBounds(
  bounds: PhysicalLayout3DBounds | null,
  x: number,
  y: number,
  z: number,
): PhysicalLayout3DBounds {
  if (!bounds) {
    return { x0: x, y0: y, z0: z, x1: x, y1: y, z1: z };
  }

  return {
    x0: Math.min(bounds.x0, x),
    y0: Math.min(bounds.y0, y),
    z0: Math.min(bounds.z0, z),
    x1: Math.max(bounds.x1, x),
    y1: Math.max(bounds.y1, y),
    z1: Math.max(bounds.z1, z),
  };
}

function normalizePhysicalLayout3DBounds(bounds: PhysicalLayout3DBounds): PhysicalLayout3DBounds {
  return {
    x0: bounds.x0,
    y0: bounds.y0,
    z0: bounds.z0,
    x1: bounds.x1 === bounds.x0 ? bounds.x0 + minimumShapeSize : bounds.x1,
    y1: bounds.y1 === bounds.y0 ? bounds.y0 + minimumShapeSize : bounds.y1,
    z1: bounds.z1 === bounds.z0 ? bounds.z0 + minimumShapeSize : bounds.z1,
  };
}
