import { describe, expect, it } from 'vitest';

import {
  createWaveformBinaryFrameFromDataset,
  parseWaveformBinaryFrame,
  WaveformBinaryValueKind,
  waveformBinaryFrameVersion,
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

  it('rejects bad magic and unsupported versions', () => {
    const badMagic = createFrameBuffer();
    new DataView(badMagic).setUint32(0, 0x12345678, true);

    expect(() => parseWaveformBinaryFrame(badMagic)).toThrow('Invalid waveform binary frame magic.');

    const unsupported = createFrameBuffer();
    new DataView(unsupported).setUint16(4, waveformBinaryFrameVersion + 1, true);

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
