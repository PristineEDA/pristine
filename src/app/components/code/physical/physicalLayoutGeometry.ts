import type {
  LspLayoutBounds,
  LspLayoutCatalog,
  LspLayoutGdsCell,
  LspLayoutGeometry,
  LspLayoutMacro,
  LspLayoutShape,
} from '../../../../../types/systemverilog-lsp';

export interface PhysicalLayoutCamera {
  panX: number;
  panY: number;
  zoom: number;
}

export interface PhysicalLayoutViewport {
  height: number;
  width: number;
}

export interface PhysicalLayoutPoint {
  x: number;
  y: number;
}

export type PhysicalLayoutTargetKind = 'macro' | 'gdsCell' | 'design';

export interface PhysicalLayoutTarget {
  kind: PhysicalLayoutTargetKind;
  name: string;
  index: number | null;
}

export const physicalLayoutZoomLimits = {
  max: 200,
  min: 2,
} as const;

export function getFirstLayoutMacroName(catalog: LspLayoutCatalog | null | undefined): string | null {
  return catalog?.macros[0]?.name ?? null;
}

export function getDefaultLayoutTarget(catalog: LspLayoutCatalog | null | undefined): PhysicalLayoutTarget | null {
  if (!catalog) {
    return null;
  }

  if (catalog.sourceKind === 'gds') {
    const topCell = catalog.topCellIndex !== null
      ? catalog.gdsCells.find((cell) => cell.index === catalog.topCellIndex)
      : null;
    const cell = topCell ?? catalog.gdsCells[0] ?? null;
    return cell ? { kind: 'gdsCell', name: cell.name, index: cell.index } : null;
  }

  if (catalog.defPins.length > 0 || catalog.components.length > 0 || catalog.nets.length > 0) {
    return { kind: 'design', name: 'Design', index: null };
  }

  const macro = catalog.macros[0] ?? null;
  return macro ? { kind: 'macro', name: macro.name, index: macro.index } : null;
}

export function findLayoutMacro(catalog: LspLayoutCatalog | null | undefined, macroName: string | null | undefined): LspLayoutMacro | null {
  if (!catalog || !macroName) {
    return null;
  }

  return catalog.macros.find((macro) => macro.name === macroName) ?? null;
}

export function findLayoutGdsCell(catalog: LspLayoutCatalog | null | undefined, cellName: string | null | undefined): LspLayoutGdsCell | null {
  if (!catalog || !cellName) {
    return null;
  }

  return catalog.gdsCells.find((cell) => cell.name === cellName) ?? null;
}

export function getMacroBounds(macro: LspLayoutMacro): LspLayoutBounds {
  return {
    x0: macro.originX,
    y0: macro.originY,
    x1: macro.originX + macro.sizeX,
    y1: macro.originY + macro.sizeY,
  };
}

export function getLayoutTargetBounds(
  catalog: LspLayoutCatalog | null | undefined,
  target: PhysicalLayoutTarget | null | undefined,
  fallback: LspLayoutBounds | null,
): LspLayoutBounds | null {
  if (!catalog || !target) {
    return fallback;
  }

  if (target.kind === 'macro') {
    const macro = findLayoutMacro(catalog, target.name);
    return macro ? getMacroBounds(macro) : fallback;
  }

  if (target.kind === 'gdsCell') {
    return findLayoutGdsCell(catalog, target.name)?.bounds ?? fallback;
  }

  return fallback;
}

export function selectMacroShapes(
  catalog: LspLayoutCatalog | null | undefined,
  geometry: LspLayoutGeometry | null | undefined,
  macroName: string | null | undefined,
): LspLayoutShape[] {
  const macro = findLayoutMacro(catalog, macroName);
  if (!macro || !geometry) {
    return [];
  }

  return geometry.shapes.filter((shape) => shape.macroIndex === macro.index);
}

export function selectLayoutTargetShapes(
  catalog: LspLayoutCatalog | null | undefined,
  geometry: LspLayoutGeometry | null | undefined,
  target: PhysicalLayoutTarget | null | undefined,
): LspLayoutShape[] {
  if (!catalog || !geometry || !target) {
    return [];
  }

  if (target.kind === 'design') {
    return geometry.shapes;
  }

  if (target.index === null) {
    return [];
  }

  if (catalog.sourceKind === 'gds' && target.kind === 'gdsCell') {
    const matchingShapes = geometry.shapes.filter((shape) => shape.macroIndex === target.index);
    return matchingShapes.length > 0 ? matchingShapes : geometry.shapes;
  }

  return geometry.shapes.filter((shape) => shape.macroIndex === target.index);
}

export function getShapesBounds(shapes: readonly LspLayoutShape[], fallback: LspLayoutBounds | null): LspLayoutBounds | null {
  if (shapes.length === 0) {
    return fallback;
  }

  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;

  for (const shape of shapes) {
    const bounds = shapeBounds(shape);
    x0 = Math.min(x0, bounds.x0);
    y0 = Math.min(y0, bounds.y0);
    x1 = Math.max(x1, bounds.x1);
    y1 = Math.max(y1, bounds.y1);
  }

  if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) {
    return fallback;
  }

  return { x0, y0, x1, y1 };
}

export function getFitLayoutCamera(bounds: LspLayoutBounds | null, viewport: PhysicalLayoutViewport): PhysicalLayoutCamera {
  if (!bounds || viewport.width <= 0 || viewport.height <= 0) {
    return { panX: 0, panY: 0, zoom: 24 };
  }

  const width = Math.max(bounds.x1 - bounds.x0, 0.001);
  const height = Math.max(bounds.y1 - bounds.y0, 0.001);
  const padding = 48;
  const availableWidth = Math.max(viewport.width - padding * 2, 24);
  const availableHeight = Math.max(viewport.height - padding * 2, 24);
  const zoom = clamp(Math.min(availableWidth / width, availableHeight / height), physicalLayoutZoomLimits.min, physicalLayoutZoomLimits.max);

  return {
    panX: viewport.width / 2 - (bounds.x0 + width / 2) * zoom,
    panY: viewport.height / 2 - (bounds.y0 + height / 2) * zoom,
    zoom,
  };
}

export function applyLayoutWheel(camera: PhysicalLayoutCamera, event: {
  clientX: number;
  clientY: number;
  ctrlKey?: boolean;
  deltaMode?: number;
  deltaX: number;
  deltaY: number;
  metaKey?: boolean;
  shiftKey?: boolean;
}, viewportOrigin: { x: number; y: number }): PhysicalLayoutCamera {
  const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode);
  const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode);

  if (event.ctrlKey || event.metaKey) {
    const localX = event.clientX - viewportOrigin.x;
    const localY = event.clientY - viewportOrigin.y;
    const worldX = (localX - camera.panX) / camera.zoom;
    const worldY = (localY - camera.panY) / camera.zoom;
    const zoomFactor = Math.exp(-deltaY * 0.002);
    const zoom = clamp(camera.zoom * zoomFactor, physicalLayoutZoomLimits.min, physicalLayoutZoomLimits.max);

    return {
      panX: localX - worldX * zoom,
      panY: localY - worldY * zoom,
      zoom,
    };
  }

  if (event.shiftKey) {
    return {
      ...camera,
      panX: camera.panX - (deltaY || deltaX),
    };
  }

  return {
    ...camera,
    panY: camera.panY - deltaY,
  };
}

export function layoutClientPointToWorldPoint(
  clientPoint: PhysicalLayoutPoint,
  viewportBounds: Pick<DOMRect, 'left' | 'top'>,
  camera: PhysicalLayoutCamera,
): PhysicalLayoutPoint {
  return {
    x: (clientPoint.x - viewportBounds.left - camera.panX) / camera.zoom,
    y: (clientPoint.y - viewportBounds.top - camera.panY) / camera.zoom,
  };
}

export function findShapeAtLayoutPoint(
  shapes: readonly LspLayoutShape[],
  point: PhysicalLayoutPoint,
  tolerance = 0,
): LspLayoutShape | null {
  for (let index = shapes.length - 1; index >= 0; index -= 1) {
    const shape = shapes[index];
    if (shape && containsLayoutShapePoint(shape, point, tolerance)) {
      return shape;
    }
  }

  return null;
}

export function containsLayoutShapePoint(
  shape: LspLayoutShape,
  point: PhysicalLayoutPoint,
  tolerance = 0,
): boolean {
  if (shape.kind === 'polygon' && shape.polygon && shape.polygon.length >= 3) {
    return pointInPolygon(point, shape.polygon)
      || (tolerance > 0 && pointInBounds(point, expandBounds(shapeBounds(shape), tolerance)));
  }

  return pointInBounds(point, expandBounds(shapeBounds(shape), tolerance));
}

export function shapeBounds(shape: LspLayoutShape): LspLayoutBounds {
  if (shape.polygon && shape.polygon.length > 0) {
    let x0 = shape.polygon[0]?.x ?? shape.rect.x0;
    let y0 = shape.polygon[0]?.y ?? shape.rect.y0;
    let x1 = x0;
    let y1 = y0;
    for (const point of shape.polygon) {
      x0 = Math.min(x0, point.x);
      y0 = Math.min(y0, point.y);
      x1 = Math.max(x1, point.x);
      y1 = Math.max(y1, point.y);
    }

    return { x0, y0, x1, y1 };
  }

  return {
    x0: Math.min(shape.rect.x0, shape.rect.x1),
    y0: Math.min(shape.rect.y0, shape.rect.y1),
    x1: Math.max(shape.rect.x0, shape.rect.x1),
    y1: Math.max(shape.rect.y0, shape.rect.y1),
  };
}

function pointInPolygon(point: PhysicalLayoutPoint, polygon: readonly PhysicalLayoutPoint[]): boolean {
  let inside = false;
  for (let currentIndex = 0, previousIndex = polygon.length - 1; currentIndex < polygon.length; previousIndex = currentIndex, currentIndex += 1) {
    const current = polygon[currentIndex];
    const previous = polygon[previousIndex];
    if (!current || !previous) {
      continue;
    }

    const intersects = ((current.y > point.y) !== (previous.y > point.y))
      && point.x < ((previous.x - current.x) * (point.y - current.y)) / ((previous.y - current.y) || Number.EPSILON) + current.x;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function expandBounds(bounds: LspLayoutBounds, tolerance: number): LspLayoutBounds {
  return {
    x0: bounds.x0 - tolerance,
    y0: bounds.y0 - tolerance,
    x1: bounds.x1 + tolerance,
    y1: bounds.y1 + tolerance,
  };
}

function pointInBounds(point: PhysicalLayoutPoint, bounds: LspLayoutBounds): boolean {
  return point.x >= bounds.x0
    && point.x <= bounds.x1
    && point.y >= bounds.y0
    && point.y <= bounds.y1;
}

function normalizeWheelDelta(value: number, deltaMode = 0): number {
  if (deltaMode === 1) {
    return value * 16;
  }

  if (deltaMode === 2) {
    return value * 240;
  }

  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
