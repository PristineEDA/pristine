import type { Geometry } from 'pixi.js';

const physicalExplicitDrawCountGeometryKey = '__pristinePhysicalExplicitDrawCountGeometry';
const physicalActiveIndexCountKey = '__pristinePhysicalActiveIndexCount';
const physicalExplicitDrawCountPatchedKey = '__pristinePhysicalExplicitDrawCountPatched';

type PhysicalExplicitDrawCountGeometry = Geometry & {
  [physicalActiveIndexCountKey]?: number;
  [physicalExplicitDrawCountGeometryKey]?: true;
};

interface PhysicalDrawOptions {
  geometry?: PhysicalExplicitDrawCountGeometry;
  size?: number;
}

interface PhysicalRendererEncoder {
  draw: (options: PhysicalDrawOptions) => unknown;
  [physicalExplicitDrawCountPatchedKey]?: true;
}

export function markPhysicalExplicitDrawCountGeometry(geometry: Geometry) {
  const physicalGeometry = geometry as PhysicalExplicitDrawCountGeometry;
  physicalGeometry[physicalExplicitDrawCountGeometryKey] = true;
  physicalGeometry[physicalActiveIndexCountKey] = 0;
}

export function setPhysicalExplicitDrawCount(geometry: Geometry, activeIndexCount: number) {
  const physicalGeometry = geometry as PhysicalExplicitDrawCountGeometry;
  physicalGeometry[physicalActiveIndexCountKey] = Math.max(0, Math.floor(activeIndexCount));
}

function getPhysicalExplicitDrawCount(geometry: Geometry) {
  return (geometry as PhysicalExplicitDrawCountGeometry)[physicalActiveIndexCountKey] ?? 0;
}

function isPhysicalExplicitDrawCountGeometry(geometry: Geometry) {
  return (geometry as PhysicalExplicitDrawCountGeometry)[physicalExplicitDrawCountGeometryKey] === true;
}

export function installPhysicalExplicitDrawCountPatch(renderer: unknown) {
  const encoder = (renderer as { encoder?: PhysicalRendererEncoder } | null)?.encoder;

  if (!encoder || typeof encoder.draw !== 'function' || encoder[physicalExplicitDrawCountPatchedKey]) {
    return false;
  }

  const draw = encoder.draw.bind(encoder);

  encoder.draw = (options: PhysicalDrawOptions) => {
    const geometry = options.geometry;

    if (!geometry || !isPhysicalExplicitDrawCountGeometry(geometry)) {
      return draw(options);
    }

    const previousSize = options.size;
    options.size = getPhysicalExplicitDrawCount(geometry);

    try {
      return draw(options);
    } finally {
      if (previousSize === undefined) {
        delete options.size;
      } else {
        options.size = previousSize;
      }
    }
  };
  encoder[physicalExplicitDrawCountPatchedKey] = true;
  return true;
}
