import { describe, expect, it } from 'vitest';

import { createWaveformScene, waveformLayerNames } from './createWaveformScene';
import { fitWaveformViewport, getWaveformDigitalPulseFillCount, getWaveformDisplayRows, getWaveformSignalLaneY } from './waveformLayout';
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
    expect(scene.layers.content.children).toHaveLength(mockWaveformData.signals.length);
    expect(scene.layers.status.children.length).toBeGreaterThan(0);
    expect(scene.layers.operation.children.length).toBeGreaterThan(0);
    expect(scene.firstSignalLaneY).toBe(getWaveformSignalLaneY(mockWaveformData, 'tb_top_module1-clk'));
    expect(scene.selectedSignalLaneY).toBe(getWaveformSignalLaneY(mockWaveformData, 'u_top_module1-counting'));
    expect(scene.digitalPulseFillCount).toBe(getWaveformDigitalPulseFillCount(mockWaveformData, fitWaveformViewport(mockWaveformData)));
    expect(scene.digitalPulseFillCount).toBeGreaterThan(0);
    expect(scene.stateCounts.xStateCount).toBeGreaterThan(0);
    expect(scene.stateCounts.zStateCount).toBeGreaterThan(0);

    scene.world.destroy({ children: true });
  });
});
