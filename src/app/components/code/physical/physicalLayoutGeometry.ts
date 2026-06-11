import type {
  LspLayoutBounds,
  LspLayoutCatalog,
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

export const physicalLayoutZoomLimits = {
  max: 200,
  min: 2,
} as const;

export function getFirstLayoutMacroName(catalog: LspLayoutCatalog | null | undefined): string | null {
  return catalog?.macros[0]?.name ?? null;
}

export function findLayoutMacro(catalog: LspLayoutCatalog | null | undefined, macroName: string | null | undefined): LspLayoutMacro | null {
  if (!catalog || !macroName) {
    return null;
  }

  return catalog.macros.find((macro) => macro.name === macroName) ?? null;
}

export function getMacroBounds(macro: LspLayoutMacro): LspLayoutBounds {
  return {
    x0: macro.originX,
    y0: macro.originY,
    x1: macro.originX + macro.sizeX,
    y1: macro.originY + macro.sizeY,
  };
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

  const bounds = getMacroBounds(macro);
  return geometry.shapes.filter((shape) => {
    if (shape.ownerKind === 'obstruction' || shape.ownerKind === 'macro') {
      return shape.ownerIndex === macro.index;
    }

    if (shape.ownerKind === 'pin') {
      return shapeIntersectsBounds(shape, bounds);
    }

    return shapeIntersectsBounds(shape, bounds);
  });
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

function shapeIntersectsBounds(shape: LspLayoutShape, bounds: LspLayoutBounds): boolean {
  const shapeRect = shapeBounds(shape);
  return shapeRect.x0 <= bounds.x1
    && shapeRect.x1 >= bounds.x0
    && shapeRect.y0 <= bounds.y1
    && shapeRect.y1 >= bounds.y0;
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
