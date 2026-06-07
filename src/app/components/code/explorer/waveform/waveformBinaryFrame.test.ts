import { describe, expect, it } from 'vitest';

import {
  createWaveformBinaryFrameFromDataset,
  parseWaveformBinaryFrame,
  parseWaveformBinaryFrameV2,
  waveformBinaryFrameFlagTruncated,
  WaveformBinaryValueKind,
  waveformBinaryFrameVersion,
  waveformBinaryFrameVersionV2,
} from './waveformBinaryFrame';
import type { WaveformDataSet } from './waveformTypes';

describe('waveformBinaryFrame', () => {
  it('parses valid columnar frames into typed array views without copying segment data', () => {
    const buffer = createFrameBuffer();
    expect(new DataView(buffer).getUint16(6, true)).toBe(56);

    const frame = parseWaveformBinaryFrame(buffer);

    expect(frame.version).toBe(waveformBinaryFrameVersion);
    expect(frame.signalCount).toBe(2);
    expect(frame.segmentCount).toBe(3);
    expect(frame.flags).toBe(0);
    expect(frame.truncated).toBe(false);
    expect(frame.signalTable.buffer).toBe(buffer);
    expect(frame.x0.buffer).toBe(buffer);
    expect(frame.x1.buffer).toBe(buffer);
    expect(frame.laneY.buffer).toBe(buffer);
    expect(frame.valueKind.buffer).toBe(buffer);
    expect(frame.labelIndex.buffer).toBe(buffer);
    expect(frame.labelBytes.buffer).toBe(buffer);
    expect(Array.from(frame.x0)).toEqual([0, 40, 80]);
    expect(Array.from(frame.valueKind)).toEqual([
      WaveformBinaryValueKind.Low,
      WaveformBinaryValueKind.Bus,
      WaveformBinaryValueKind.Unknown,
    ]);
    expect(frame.getLabel(1)).toBe('a5');
    expect(frame.getLabel(0)).toBeNull();
    expect(frame.getLabel(99)).toBeNull();
  });

  it('parses frame truncation flags', () => {
    const buffer = createFrameBuffer();
    new DataView(buffer).setUint32(48, waveformBinaryFrameFlagTruncated, true);

    const frame = parseWaveformBinaryFrame(buffer);

    expect(frame.flags).toBe(waveformBinaryFrameFlagTruncated);
    expect(frame.truncated).toBe(true);
  });

  it('can build a frame table for only the requested signals', () => {
    const buffer = createWaveformBinaryFrameFromDataset(createDataSet(), [
      {
        label: 'a5',
        laneY: 82,
        signalIndex: 1,
        valueKind: WaveformBinaryValueKind.Bus,
        x0: 40,
        x1: 80,
      },
    ], {
      signalIndices: [1],
    });

    const frame = parseWaveformBinaryFrame(buffer);

    expect(frame.signalCount).toBe(1);
    expect(Array.from(frame.signalTable)).toEqual([1, 0, 1, 1]);
  });

  it('parses v2 prepared-range frames with time columns as typed array views', () => {
    const buffer = createWaveformBinaryFrameFromDataset(createDataSet(), [
      {
        laneY: 52,
        signalIndex: 0,
        time0: 10,
        time1: 20,
        valueKind: WaveformBinaryValueKind.Low,
        x0: 0,
        x1: 40,
      },
      {
        label: 'a5',
        laneY: 82,
        signalIndex: 1,
        time0: 20,
        time1: 30,
        valueKind: WaveformBinaryValueKind.Bus,
        x0: 40,
        x1: 80,
      },
    ], {
      preparedRange: { startTime: 0, endTime: 100 },
      version: waveformBinaryFrameVersionV2,
      viewportRange: { startTime: 10, endTime: 40 },
    });
    expect(new DataView(buffer).getUint16(6, true)).toBe(96);

    const frame = parseWaveformBinaryFrameV2(buffer);

    expect(frame.version).toBe(waveformBinaryFrameVersionV2);
    expect(frame.preparedRange).toEqual({ startTime: 0, endTime: 100 });
    expect(frame.viewportRange).toEqual({ startTime: 10, endTime: 40 });
    expect(frame.time0?.buffer).toBe(buffer);
    expect(frame.time1?.buffer).toBe(buffer);
    expect(Array.from(frame.time0 ?? [])).toEqual([10, 20]);
    expect(Array.from(frame.time1 ?? [])).toEqual([20, 30]);
    expect(frame.getLabel(1)).toBe('a5');
  });

  it('rejects bad magic and unsupported versions', () => {
    const badMagic = createFrameBuffer();
    new DataView(badMagic).setUint32(0, 0x12345678, true);

    expect(() => parseWaveformBinaryFrame(badMagic)).toThrow('Invalid waveform binary frame magic.');

    const unsupported = createFrameBuffer();
    new DataView(unsupported).setUint16(4, 99, true);

    expect(() => parseWaveformBinaryFrame(unsupported)).toThrow('Unsupported waveform frame version');

    const unsupportedHeader = createFrameBuffer();
    new DataView(unsupportedHeader).setUint16(6, 48, true);

    expect(() => parseWaveformBinaryFrame(unsupportedHeader)).toThrow('Unsupported waveform frame header length');
  });

  it('rejects out-of-bounds and unaligned column offsets', () => {
    const outOfBounds = createFrameBuffer();
    const outOfBoundsView = new DataView(outOfBounds);
    outOfBoundsView.setUint32(20, Math.ceil((outOfBounds.byteLength + 8) / 4) * 4, true);

    expect(() => parseWaveformBinaryFrame(outOfBounds)).toThrow('x0 region is outside the waveform binary frame.');

    const unaligned = createFrameBuffer();
    new DataView(unaligned).setUint32(20, 49, true);

    expect(() => parseWaveformBinaryFrame(unaligned)).toThrow('x0 offset must be 4-byte aligned.');

    const unalignedTime = createWaveformBinaryFrameFromDataset(createDataSet(), [
      {
        laneY: 52,
        signalIndex: 0,
        valueKind: WaveformBinaryValueKind.Low,
        x0: 0,
        x1: 40,
      },
    ], { version: waveformBinaryFrameVersionV2 });
    new DataView(unalignedTime).setUint32(56, 98, true);

    expect(() => parseWaveformBinaryFrame(unalignedTime)).toThrow('time0 offset must be 8-byte aligned.');
  });
});

function createFrameBuffer() {
  return createWaveformBinaryFrameFromDataset(createDataSet(), [
    {
      laneY: 52,
      signalIndex: 0,
      valueKind: WaveformBinaryValueKind.Low,
      x0: 0,
      x1: 40,
    },
    {
      label: 'a5',
      laneY: 82,
      signalIndex: 1,
      valueKind: WaveformBinaryValueKind.Bus,
      x0: 40,
      x1: 80,
    },
    {
      laneY: 82,
      signalIndex: 1,
      valueKind: WaveformBinaryValueKind.Unknown,
      x0: 80,
      x1: 100,
    },
  ]);
}

function createDataSet(): WaveformDataSet {
  return {
    id: 'binary-frame-test',
    title: 'binary-frame-test',
    timescaleUnit: 'ns',
    duration: 100,
    cursorTime: 0,
    groups: [{ id: 'g0', label: 'g0' }],
    signals: [
      {
        color: '#38d68c',
        groupId: 'g0',
        id: 'clk',
        kind: 'logic',
        name: 'clk',
        path: 'g0.clk',
      },
      {
        color: '#6ee7b7',
        groupId: 'g0',
        id: 'bus',
        kind: 'bus',
        name: 'bus',
        path: 'g0.bus',
        width: 8,
      },
    ],
  };
}
