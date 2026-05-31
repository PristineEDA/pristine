import { describe, expect, it } from 'vitest';
import { Container, Text, Texture } from 'pixi.js';

import { clipWaveformLineToBounds, createWaveformScene, getWaveformBusHexagonBevel, waveformHighImpedanceStripeSpacing, waveformLayerNames, waveformUnknownStripeSpacing, type WaveformSignalTextureCacheEntry } from './createWaveformScene';
import { fitWaveformViewport, getWaveformCanvasHeightForData, getWaveformDigitalPulseFillCount, getWaveformDisplayRows, getWaveformShapeCounts, getWaveformSignalLaneY } from './waveformLayout';
import { mockWaveformData } from './waveformMockData';

describe('createWaveformScene', () => {
  it('builds explicit render layers and reports X/Z state coverage', () => {
    const scene = createWaveformScene({
      cursorTime: mockWaveformData.cursorTime,
      data: mockWaveformData,
      height: 320,
      selectedSignalId: 'u_top_module1-counting',
      viewport: fitWaveformViewport(mockWaveformData),
      width: 900,
    });

    expect(Object.keys(scene.layers)).toEqual(waveformLayerNames);
    expect(scene.world.children).toHaveLength(waveformLayerNames.length);
    expect(scene.rowCount).toBe(getWaveformDisplayRows(mockWaveformData).length);
    expect(scene.layers.content.children.length).toBeGreaterThan(0);
    expect(scene.layers.content.children.length).toBeLessThan(mockWaveformData.signals.length);
    expect(scene.layers.status.children.length).toBeGreaterThan(0);
    expect(scene.layers.status.children.some((child) => child instanceof Container && child.label === 'waveform-header-overlay')).toBe(true);
    expect(scene.layers.operation.children.length).toBeGreaterThan(0);
    expect(scene.firstSignalLaneY).toBe(getWaveformSignalLaneY(mockWaveformData, 'tb_top_module1-clk'));
    expect(scene.selectedSignalLaneY).toBe(getWaveformSignalLaneY(mockWaveformData, 'u_top_module1-counting'));
    expect(scene.shapeCounts).toEqual(getWaveformShapeCounts(mockWaveformData, fitWaveformViewport(mockWaveformData)));
    expect(scene.shapeCounts.busHexagonCount).toBeGreaterThan(0);
    expect(scene.shapeCounts.xStateBlockCount).toBeGreaterThan(0);
    expect(scene.shapeCounts.zStateBlockCount).toBeGreaterThan(0);
    expect(scene.digitalPulseFillCount).toBe(getWaveformDigitalPulseFillCount(mockWaveformData, fitWaveformViewport(mockWaveformData)));
    expect(scene.digitalPulseFillCount).toBeGreaterThan(0);
    expect(scene.stateCounts.xStateCount).toBeGreaterThan(0);
    expect(scene.stateCounts.zStateCount).toBeGreaterThan(0);
    expect(scene.renderStats.visibleRowCount).toBeGreaterThan(0);
    expect(scene.renderStats.culledRowCount).toBeGreaterThan(0);
    expect(scene.renderStats.renderedSignalCount).toBeGreaterThan(0);
    expect(scene.renderStats.renderedSignalCount).toBeLessThan(mockWaveformData.signals.length);
    expect(scene.renderStats.sourceSegmentCount).toBeGreaterThan(scene.renderStats.renderedSegmentCount);
    expect(scene.renderStats.coalescedSegmentCount).toBeGreaterThan(0);

    scene.world.destroy({ children: true });
  });

  it('records cache misses and hits for cacheable dense signal textures', () => {
    const cache = new Map<string, WaveformSignalTextureCacheEntry>();
    const signalTextureCache = {
      get: (key: string) => cache.get(key),
      set: (key: string, entry: WaveformSignalTextureCacheEntry) => cache.set(key, entry),
    };
    const textureRenderer = {
      generateTexture: () => Texture.EMPTY,
    };
    const baseOptions = {
      cursorTime: mockWaveformData.cursorTime,
      data: mockWaveformData,
      height: 420,
      selectedSignalId: null,
      signalTextureCache,
      textureRenderer,
      viewport: fitWaveformViewport(mockWaveformData),
      width: 900,
    };

    const firstScene = createWaveformScene(baseOptions);
    firstScene.world.destroy({ children: true });
    const secondScene = createWaveformScene(baseOptions);

    expect(firstScene.renderStats.cacheableSignalCount).toBeGreaterThan(0);
    expect(firstScene.renderStats.cacheMissCount).toBeGreaterThan(0);
    expect(firstScene.renderStats.cachedSignalCount).toBeGreaterThan(0);
    expect(secondScene.renderStats.cacheHitCount).toBeGreaterThan(0);

    secondScene.world.destroy({ children: true });
  });

  it('draws a single X or Z text label per special-state block', () => {
    const viewport = fitWaveformViewport(mockWaveformData);
    const scene = createWaveformScene({
      cursorTime: mockWaveformData.cursorTime,
      data: mockWaveformData,
      height: getWaveformCanvasHeightForData(mockWaveformData),
      selectedSignalId: null,
      viewport,
      width: 900,
    });
    const stateLabels = collectText(scene.layers.content).filter((text) => text === 'x' || text === 'z');
    const xLabels = stateLabels.filter((text) => text === 'x');
    const zLabels = stateLabels.filter((text) => text === 'z');
    const shapeCounts = getWaveformShapeCounts(mockWaveformData, viewport);

    expect(xLabels.length).toBeGreaterThan(0);
    expect(zLabels.length).toBeGreaterThan(0);
    expect(xLabels.length).toBeLessThanOrEqual(shapeCounts.xStateBlockCount);
    expect(zLabels.length).toBeLessThanOrEqual(shapeCounts.zStateBlockCount);
    expect(stateLabels.every((text) => text.length === 1)).toBe(true);

    scene.world.destroy({ children: true });
  });

  it('keeps bus hexagon bevel consistent across normal-width bus segments', () => {
    expect(getWaveformBusHexagonBevel(32, 20)).toBe(getWaveformBusHexagonBevel(160, 20));
    expect(getWaveformBusHexagonBevel(160, 20)).toBe(getWaveformBusHexagonBevel(400, 20));
    expect(getWaveformBusHexagonBevel(5, 20)).toBeLessThan(getWaveformBusHexagonBevel(32, 20));
  });

  it('uses denser chevrons for Z hatches while preserving the X hatch spacing', () => {
    expect(waveformUnknownStripeSpacing).toBe(8);
    expect(waveformHighImpedanceStripeSpacing).toBe(6);
    expect(waveformHighImpedanceStripeSpacing).toBeLessThan(waveformUnknownStripeSpacing);
  });

  it('clips Z chevron strokes to the state rectangle without changing their slope', () => {
    const clipped = clipWaveformLineToBounds(10, 2, 17, 10, { bottom: 18, left: 1, right: 12, top: 2 });

    expect(clipped).not.toBeNull();
    expect(clipped?.x1).toBe(10);
    expect(clipped?.y1).toBe(2);
    expect(clipped?.x2).toBe(12);
    expect(clipped?.y2).toBeCloseTo(4.2857, 4);
  });
});

function collectText(container: Container): string[] {
  const texts: string[] = [];

  for (const child of container.children) {
    if (child instanceof Text) {
      texts.push(String(child.text));
    }

    if (child instanceof Container) {
      texts.push(...collectText(child));
    }
  }

  return texts;
}
