import { describe, expect, it } from 'vitest';

import {
  analyzeTinyQvViewportPixelsFromRgba,
  findTinyQvViewportColorfulAnchorFromRgba,
} from './tinyQvVisualAnalysis';

function createRgba(width: number, height: number, color: readonly [number, number, number, number]) {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = color[3];
  }

  return pixels;
}

function fillRect(
  pixels: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  rectWidth: number,
  rectHeight: number,
  color: readonly [number, number, number, number],
) {
  for (let y = y0; y < y0 + rectHeight; y += 1) {
    for (let x = x0; x < x0 + rectWidth; x += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }
}

describe('tinyQvVisualAnalysis', () => {
  it('treats a pure dark viewport as visually blank', () => {
    const pixels = createRgba(100, 80, [11, 17, 22, 255]);
    const analysis = analyzeTinyQvViewportPixelsFromRgba(pixels, 100, 80);

    expect(analysis.visualIsNonBlank).toBe(false);
    expect(analysis.visualFailureReason).toBe('no-non-background-pixels');
    expect(analysis.visualColorfulPixelCount).toBe(0);
  });

  it('does not count a white outline as a real GDS shape', () => {
    const pixels = createRgba(100, 80, [11, 17, 22, 255]);
    fillRect(pixels, 100, 20, 20, 60, 2, [225, 235, 245, 255]);
    fillRect(pixels, 100, 20, 58, 60, 2, [225, 235, 245, 255]);
    fillRect(pixels, 100, 20, 20, 2, 40, [225, 235, 245, 255]);
    fillRect(pixels, 100, 78, 20, 2, 40, [225, 235, 245, 255]);

    const analysis = analyzeTinyQvViewportPixelsFromRgba(pixels, 100, 80);

    expect(analysis.visualNonBackgroundPixelCount).toBeGreaterThan(0);
    expect(analysis.visualColorfulPixelCount).toBe(0);
    expect(analysis.visualIsNonBlank).toBe(false);
    expect(analysis.visualFailureReason).toBe('no-colorful-pixels');
  });

  it('counts saturated GDS layer pixels as visually nonblank', () => {
    const pixels = createRgba(100, 80, [11, 17, 22, 255]);
    fillRect(pixels, 100, 30, 25, 20, 16, [120, 220, 70, 220]);
    fillRect(pixels, 100, 54, 25, 14, 16, [60, 170, 245, 210]);
    fillRect(pixels, 100, 70, 25, 10, 16, [245, 150, 40, 230]);

    const analysis = analyzeTinyQvViewportPixelsFromRgba(pixels, 100, 80);

    expect(analysis.visualIsNonBlank).toBe(true);
    expect(analysis.visualFailureReason).toBe('');
    expect(analysis.visualColorfulPixelRatio).toBeGreaterThanOrEqual(0.0005);
  });

  it('ignores minimap pixels in the upper-right corner', () => {
    const pixels = createRgba(120, 90, [11, 17, 22, 255]);
    fillRect(pixels, 120, 96, 10, 16, 16, [120, 220, 70, 255]);

    const analysis = analyzeTinyQvViewportPixelsFromRgba(pixels, 120, 90, {
      minimapExclusionHeightPx: 40,
      minimapExclusionWidthPx: 40,
    });

    expect(analysis.visualIsNonBlank).toBe(false);
    expect(analysis.visualColorfulPixelCount).toBe(0);
  });

  it('finds an anchor inside colorful GDS content', () => {
    const pixels = createRgba(100, 80, [11, 17, 22, 255]);
    fillRect(pixels, 100, 20, 20, 10, 10, [120, 220, 70, 255]);
    fillRect(pixels, 100, 60, 30, 8, 8, [60, 170, 245, 255]);

    const anchor = findTinyQvViewportColorfulAnchorFromRgba(pixels, 100, 80);

    expect(anchor).not.toBeNull();
    expect(anchor?.colorfulPixelCount).toBeGreaterThan(0);
    expect(anchor?.x).toBeGreaterThan(20);
    expect(anchor?.x).toBeLessThan(68);
    expect(anchor?.y).toBeGreaterThan(20);
    expect(anchor?.y).toBeLessThan(38);
  });

  it('uses the densest colorful region as the zoom anchor instead of averaging sparse regions', () => {
    const pixels = createRgba(240, 160, [11, 17, 22, 255]);
    fillRect(pixels, 240, 20, 30, 12, 12, [120, 220, 70, 255]);
    fillRect(pixels, 240, 170, 110, 36, 28, [60, 170, 245, 255]);

    const anchor = findTinyQvViewportColorfulAnchorFromRgba(pixels, 240, 160);
    const isInsideLeftCluster = (anchor?.x ?? 0) >= 20
      && (anchor?.x ?? 0) <= 32
      && (anchor?.y ?? 0) >= 30
      && (anchor?.y ?? 0) <= 42;
    const isInsideRightCluster = (anchor?.x ?? 0) >= 170
      && (anchor?.x ?? 0) <= 206
      && (anchor?.y ?? 0) >= 110
      && (anchor?.y ?? 0) <= 138;

    expect(anchor).not.toBeNull();
    expect(anchor?.colorfulPixelCount).toBeGreaterThan(0);
    expect(isInsideLeftCluster || isInsideRightCluster).toBe(true);
  });

  it('does not use minimap pixels as a zoom anchor', () => {
    const pixels = createRgba(120, 90, [11, 17, 22, 255]);
    fillRect(pixels, 120, 96, 10, 16, 16, [120, 220, 70, 255]);

    const anchor = findTinyQvViewportColorfulAnchorFromRgba(pixels, 120, 90, {
      minimapExclusionHeightPx: 40,
      minimapExclusionWidthPx: 40,
    });

    expect(anchor).toBeNull();
  });
});
