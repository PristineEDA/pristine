import { describe, expect, it } from 'vitest';

import {
  fitWaveformViewport,
  getSignalValueAtTime,
  getWaveformSignalTestId,
  getWaveformTicks,
  panWaveformViewport,
  timeToX,
  xToTime,
  zoomWaveformViewport,
} from './waveformLayout';
import { mockWaveformData } from './waveformMockData';

describe('waveformLayout', () => {
  it('maps time and pixels through the current viewport', () => {
    const viewport = { startTime: 50, endTime: 150 };
    const x = timeToX(100, viewport, 500);

    expect(x).toBeCloseTo(250, 0);
    expect(xToTime(x, viewport, 500)).toBeCloseTo(100, 4);
  });

  it('zooms and pans without moving outside the waveform duration', () => {
    const fitted = fitWaveformViewport(mockWaveformData);
    const zoomed = zoomWaveformViewport(fitted, 100, 2, mockWaveformData.duration);
    const pannedLeft = panWaveformViewport(zoomed, -200, mockWaveformData.duration);
    const pannedRight = panWaveformViewport(zoomed, 500, mockWaveformData.duration);

    expect(zoomed).toEqual({ startTime: 50, endTime: 150 });
    expect(pannedLeft.startTime).toBe(0);
    expect(pannedRight.endTime).toBe(mockWaveformData.duration);
  });

  it('returns signal values at cursor time', () => {
    const signal = mockWaveformData.signals.find((candidate) => candidate.id === 'u_top_module1-counting');

    expect(signal).toBeDefined();
    expect(getSignalValueAtTime(signal!, 9)).toBe('x');
    expect(getSignalValueAtTime(signal!, 84)).toBe('2');
    expect(getSignalValueAtTime(signal!, 160)).toBe('4');
  });

  it('creates stable ticks and signal row ids', () => {
    expect(getWaveformTicks({ startTime: 0, endTime: 200 }, 640)).toContain(100);
    expect(getWaveformSignalTestId('tb_top_module1.done_counting')).toBe('waveform-signal-row-tb_top_module1-done_counting');
  });
});
