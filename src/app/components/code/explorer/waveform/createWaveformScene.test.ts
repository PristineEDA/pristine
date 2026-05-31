import { describe, expect, it } from 'vitest';
import { Container, Text } from 'pixi.js';

import { createWaveformScene, getWaveformBusHexagonBevel, waveformLayerNames } from './createWaveformScene';
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

    scene.world.destroy({ children: true });
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
