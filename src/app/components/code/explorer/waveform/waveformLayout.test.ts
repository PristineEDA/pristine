import { describe, expect, it } from 'vitest';

import {
  fitWaveformViewport,
  getWaveformCanvasHeightForData,
  getWaveformDigitalPulseFillCount,
  getWaveformDisplayRows,
  getWaveformFirstSignalLaneY,
  getWaveformRenderSegments,
  getWaveformSignalLaneY,
  getWaveformShapeCounts,
  getSignalValueAtTime,
  getWaveformStateCounts,
  getWaveformSignalTestId,
  getWaveformTicks,
  getVisibleWaveformRows,
  isHighImpedanceWaveformValue,
  isUnknownWaveformValue,
  panWaveformViewport,
  timeToX,
  waveformBottomPadding,
  waveformHeaderHeight,
  waveformLaneHeight,
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

  it('detects X and Z states from parsed waveform data', () => {
    const shiftEnable = mockWaveformData.signals.find((candidate) => candidate.id === 'u_top_module1-shift_ena');
    const counts = getWaveformStateCounts(mockWaveformData);

    expect(shiftEnable).toBeDefined();
    expect(isUnknownWaveformValue('X')).toBe(true);
    expect(isHighImpedanceWaveformValue(getSignalValueAtTime(shiftEnable!, 5))).toBe(true);
    expect(counts.xStateCount).toBeGreaterThan(0);
    expect(counts.zStateCount).toBeGreaterThan(0);
  });

  it('keeps signal lanes aligned with group rows in the shared row model', () => {
    const rows = getWaveformDisplayRows(mockWaveformData);
    const countingLaneY = getWaveformSignalLaneY(mockWaveformData, 'u_top_module1-counting');

    expect(rows).toHaveLength(171);
    expect(rows.filter((row) => row.kind === 'signal')).toHaveLength(168);
    expect(rows.filter((row) => row.kind === 'group').map((row) => row.rowIndex)).toEqual([0, 5, 10]);
    expect(getWaveformFirstSignalLaneY(mockWaveformData)).toBe(waveformHeaderHeight + waveformLaneHeight);
    expect(getWaveformSignalLaneY(mockWaveformData, 'u_top_module1-clk')).toBe(waveformHeaderHeight + 6 * waveformLaneHeight);
    expect(countingLaneY).toBe(waveformHeaderHeight + 9 * waveformLaneHeight);
    expect(getWaveformSignalLaneY(mockWaveformData, 'dense-signal-01')).toBe(waveformHeaderHeight + 11 * waveformLaneHeight);
    expect(getWaveformSignalLaneY(mockWaveformData, 'dense-signal-40')).toBe(waveformHeaderHeight + 50 * waveformLaneHeight);
    expect(getWaveformCanvasHeightForData(mockWaveformData)).toBe(waveformHeaderHeight + rows.length * waveformLaneHeight + waveformBottomPadding);
  });

  it('returns only visible rows with overscan for Pixi scene culling', () => {
    const rows = getWaveformDisplayRows(mockWaveformData);
    const initialRows = getVisibleWaveformRows(rows, 0, 220);
    const scrolledRows = getVisibleWaveformRows(rows, 1470, 320);

    expect(initialRows.visibleRowCount).toBeGreaterThan(0);
    expect(initialRows.visibleRowCount).toBeLessThan(rows.length);
    expect(initialRows.culledRowCount).toBe(rows.length - initialRows.visibleRowCount);
    expect(initialRows.rows.some((row) => row.kind === 'signal' && row.signal.id === 'dense-signal-01')).toBe(true);
    expect(scrolledRows.rows.some((row) => row.kind === 'signal' && row.signal.id === 'dense-signal-40')).toBe(true);
  });

  it('coalesces subpixel dense segments only when the viewport is zoomed out', () => {
    const signal = mockWaveformData.signals.find((candidate) => candidate.id === 'dense-signal-01');

    expect(signal).toBeDefined();

    const fullViewportSegments = getWaveformRenderSegments(signal!, fitWaveformViewport(mockWaveformData), 360);
    const zoomedViewportSegments = getWaveformRenderSegments(signal!, { startTime: 0, endTime: 8 }, 900);

    expect(fullViewportSegments.sourceSegmentCount).toBeGreaterThan(100);
    expect(fullViewportSegments.renderedSegmentCount).toBeLessThan(fullViewportSegments.sourceSegmentCount);
    expect(fullViewportSegments.coalescedSegmentCount).toBeGreaterThan(0);
    expect(zoomedViewportSegments.coalescedSegmentCount).toBe(0);
  });

  it('counts bus hexagon intervals and rectangular special-state blocks in the visible viewport', () => {
    const shapeCounts = getWaveformShapeCounts(mockWaveformData, fitWaveformViewport(mockWaveformData));

    expect(shapeCounts.busHexagonCount).toBeGreaterThan(0);
    expect(shapeCounts.xStateBlockCount).toBeGreaterThan(0);
    expect(shapeCounts.zStateBlockCount).toBeGreaterThan(0);
  });

  it('counts fillable high pulse intervals without counting low digital intervals', () => {
    const pulseFillCount = getWaveformDigitalPulseFillCount(mockWaveformData, fitWaveformViewport(mockWaveformData));
    const digitalIntervalCount = mockWaveformData.signals
      .filter((signal) => signal.kind !== 'bus')
      .reduce((count, signal) => count + Math.max(0, signal.transitions.length - 1), 0);

    expect(pulseFillCount).toBeGreaterThan(0);
    expect(pulseFillCount).toBeLessThan(digitalIntervalCount);
  });

  it('creates stable ticks and signal row ids', () => {
    expect(getWaveformTicks({ startTime: 0, endTime: 200 }, 640)).toContain(100);
    expect(getWaveformSignalTestId('tb_top_module1.done_counting')).toBe('waveform-signal-row-tb_top_module1-done_counting');
  });
});
