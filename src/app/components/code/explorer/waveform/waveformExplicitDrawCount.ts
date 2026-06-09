import type { Geometry } from 'pixi.js';

const waveformExplicitDrawCountGeometryKey = '__pristineWaveformExplicitDrawCountGeometry';
const waveformActiveIndexCountKey = '__pristineWaveformActiveIndexCount';
const waveformExplicitDrawCountPatchedKey = '__pristineWaveformExplicitDrawCountPatched';

type WaveformExplicitDrawCountGeometry = Geometry & {
  [waveformActiveIndexCountKey]?: number;
  [waveformExplicitDrawCountGeometryKey]?: true;
};

interface WaveformDrawOptions {
  geometry?: WaveformExplicitDrawCountGeometry;
  size?: number;
}

interface WaveformRendererEncoder {
  draw: (options: WaveformDrawOptions) => unknown;
  [waveformExplicitDrawCountPatchedKey]?: true;
}

export function markWaveformExplicitDrawCountGeometry(geometry: Geometry) {
  const waveformGeometry = geometry as WaveformExplicitDrawCountGeometry;
  waveformGeometry[waveformExplicitDrawCountGeometryKey] = true;
  waveformGeometry[waveformActiveIndexCountKey] = 0;
}

export function setWaveformExplicitDrawCount(geometry: Geometry, activeIndexCount: number) {
  const waveformGeometry = geometry as WaveformExplicitDrawCountGeometry;
  waveformGeometry[waveformActiveIndexCountKey] = Math.max(0, Math.floor(activeIndexCount));
}

export function getWaveformExplicitDrawCount(geometry: Geometry) {
  return (geometry as WaveformExplicitDrawCountGeometry)[waveformActiveIndexCountKey] ?? 0;
}

export function isWaveformExplicitDrawCountGeometry(geometry: Geometry) {
  return (geometry as WaveformExplicitDrawCountGeometry)[waveformExplicitDrawCountGeometryKey] === true;
}

export function installWaveformExplicitDrawCountPatch(renderer: unknown) {
  const encoder = (renderer as { encoder?: WaveformRendererEncoder } | null)?.encoder;

  if (!encoder || typeof encoder.draw !== 'function' || encoder[waveformExplicitDrawCountPatchedKey]) {
    return false;
  }

  const draw = encoder.draw.bind(encoder);

  encoder.draw = (options: WaveformDrawOptions) => {
    const geometry = options.geometry;

    if (!geometry || !isWaveformExplicitDrawCountGeometry(geometry)) {
      return draw(options);
    }

    const previousSize = options.size;
    options.size = getWaveformExplicitDrawCount(geometry);

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
  encoder[waveformExplicitDrawCountPatchedKey] = true;
  return true;
}
