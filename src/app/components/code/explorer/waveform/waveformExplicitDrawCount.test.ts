import { Geometry } from 'pixi.js';
import { describe, expect, it } from 'vitest';

import {
  getWaveformExplicitDrawCount,
  installWaveformExplicitDrawCountPatch,
  markWaveformExplicitDrawCountGeometry,
  setWaveformExplicitDrawCount,
} from './waveformExplicitDrawCount';

describe('waveform explicit draw count', () => {
  it('passes active index count to renderer encoder only for waveform geometries', () => {
    const calls: Array<{ geometry?: Geometry; size?: number }> = [];
    const renderer = {
      encoder: {
        draw: (options: { geometry?: Geometry; size?: number }) => {
          calls.push({ ...options });
          return options.size;
        },
      },
    };
    const regularGeometry = new Geometry();
    const waveformGeometry = new Geometry();

    markWaveformExplicitDrawCountGeometry(waveformGeometry);
    setWaveformExplicitDrawCount(waveformGeometry, 42);

    expect(getWaveformExplicitDrawCount(waveformGeometry)).toBe(42);
    expect(installWaveformExplicitDrawCountPatch(renderer)).toBe(true);
    expect(installWaveformExplicitDrawCountPatch(renderer)).toBe(false);

    const regularOptions = { geometry: regularGeometry };
    const waveformOptions = { geometry: waveformGeometry };
    const explicitOptions = { geometry: waveformGeometry, size: 12 };

    expect(renderer.encoder.draw(regularOptions)).toBeUndefined();
    expect(renderer.encoder.draw(waveformOptions)).toBe(42);
    expect(renderer.encoder.draw(explicitOptions)).toBe(42);

    expect(calls).toEqual([
      { geometry: regularGeometry },
      { geometry: waveformGeometry, size: 42 },
      { geometry: waveformGeometry, size: 42 },
    ]);
    expect('size' in waveformOptions).toBe(false);
    expect(explicitOptions.size).toBe(12);
  });
});
