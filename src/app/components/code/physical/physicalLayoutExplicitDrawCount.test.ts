import { Geometry } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';

import {
  installPhysicalExplicitDrawCountPatch,
  markPhysicalExplicitDrawCountGeometry,
  setPhysicalExplicitDrawCount,
} from './physicalLayoutExplicitDrawCount';

describe('physicalLayoutExplicitDrawCount', () => {
  it('patches renderer draw size for marked geometry', () => {
    const geometry = new Geometry();
    const drawSizes: Array<number | undefined> = [];
    const draw = vi.fn((options: { size?: number }) => {
      drawSizes.push(options.size);
    });
    const renderer = {
      encoder: { draw },
    };

    expect(installPhysicalExplicitDrawCountPatch(renderer)).toBe(true);
    expect(installPhysicalExplicitDrawCountPatch(renderer)).toBe(false);

    markPhysicalExplicitDrawCountGeometry(geometry);
    setPhysicalExplicitDrawCount(geometry, 42);

    const options: { geometry: Geometry; size?: number } = { geometry, size: 7 };
    renderer.encoder.draw(options);

    expect(drawSizes).toEqual([42]);
    expect(options.size).toBe(7);
  });

  it('leaves unmarked geometry untouched', () => {
    const geometry = new Geometry();
    const draw = vi.fn();
    const renderer = {
      encoder: { draw },
    };

    installPhysicalExplicitDrawCountPatch(renderer);
    renderer.encoder.draw({ geometry, size: 7 });

    expect(draw).toHaveBeenCalledWith({ geometry, size: 7 });
  });
});
