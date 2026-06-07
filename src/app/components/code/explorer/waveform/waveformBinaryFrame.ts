import type { WaveformDataSet } from './waveformTypes';

export const waveformBinaryFrameMagic = 0x46565750; // PWVF, little-endian.
export const waveformBinaryFrameVersion = 1;
export const waveformBinaryFrameSignalTableStride = 4;
export const waveformBinaryFrameNoLabel = 0xffffffff;

const waveformBinaryFrameHeaderByteLength = 56;
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export enum WaveformBinaryValueKind {
  Low = 0,
  High = 1,
  Unknown = 2,
  HighImpedance = 3,
  Bus = 4,
}

export interface ParsedWaveformFrame {
  version: number;
  signalCount: number;
  segmentCount: number;
  signalTable: Uint32Array;
  x0: Float32Array;
  x1: Float32Array;
  laneY: Float32Array;
  valueKind: Uint8Array;
  labelIndex: Uint32Array;
  labelBytes: Uint8Array;
  getLabel: (segmentIndex: number) => string | null;
}

interface WaveformFrameHeader {
  labelBytesLength: number;
  labelBytesOffset: number;
  labelIndexOffset: number;
  laneYOffset: number;
  segmentCount: number;
  headerByteLength: number;
  signalCount: number;
  signalTableOffset: number;
  valueKindOffset: number;
  version: number;
  x0Offset: number;
  x1Offset: number;
}

export interface WaveformBinaryFrameSegmentInput {
  label?: string | null;
  laneY: number;
  signalIndex: number;
  valueKind: WaveformBinaryValueKind;
  x0: number;
  x1: number;
}

export function parseWaveformBinaryFrame(buffer: ArrayBuffer): ParsedWaveformFrame {
  if (buffer.byteLength < waveformBinaryFrameHeaderByteLength) {
    throw new Error('Waveform binary frame is shorter than the header.');
  }

  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  if (magic !== waveformBinaryFrameMagic) {
    throw new Error('Invalid waveform binary frame magic.');
  }

  const header = readHeader(view);
  if (header.version !== waveformBinaryFrameVersion) {
    throw new Error(`Unsupported waveform frame version: ${header.version}`);
  }
  if (header.headerByteLength < waveformBinaryFrameHeaderByteLength || header.headerByteLength > buffer.byteLength) {
    throw new Error(`Unsupported waveform frame header length: ${header.headerByteLength}`);
  }

  assertArrayRegion(buffer, header.signalTableOffset, header.signalCount * waveformBinaryFrameSignalTableStride, Uint32Array.BYTES_PER_ELEMENT, 'signalTable');
  assertArrayRegion(buffer, header.x0Offset, header.segmentCount, Float32Array.BYTES_PER_ELEMENT, 'x0');
  assertArrayRegion(buffer, header.x1Offset, header.segmentCount, Float32Array.BYTES_PER_ELEMENT, 'x1');
  assertArrayRegion(buffer, header.laneYOffset, header.segmentCount, Float32Array.BYTES_PER_ELEMENT, 'laneY');
  assertArrayRegion(buffer, header.valueKindOffset, header.segmentCount, Uint8Array.BYTES_PER_ELEMENT, 'valueKind');
  assertArrayRegion(buffer, header.labelIndexOffset, header.segmentCount, Uint32Array.BYTES_PER_ELEMENT, 'labelIndex');
  assertByteRegion(buffer, header.labelBytesOffset, header.labelBytesLength, 'labelBytes');

  const signalTable = new Uint32Array(buffer, header.signalTableOffset, header.signalCount * waveformBinaryFrameSignalTableStride);
  const x0 = new Float32Array(buffer, header.x0Offset, header.segmentCount);
  const x1 = new Float32Array(buffer, header.x1Offset, header.segmentCount);
  const laneY = new Float32Array(buffer, header.laneYOffset, header.segmentCount);
  const valueKind = new Uint8Array(buffer, header.valueKindOffset, header.segmentCount);
  const labelIndex = new Uint32Array(buffer, header.labelIndexOffset, header.segmentCount);
  const labelBytes = new Uint8Array(buffer, header.labelBytesOffset, header.labelBytesLength);
  const labelCache = new Map<number, string>();

  return {
    version: header.version,
    signalCount: header.signalCount,
    segmentCount: header.segmentCount,
    signalTable,
    x0,
    x1,
    laneY,
    valueKind,
    labelIndex,
    labelBytes,
    getLabel: (segmentIndex: number) => {
      if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= header.segmentCount) {
        return null;
      }

      const labelOffset = labelIndex[segmentIndex];
      if (labelOffset === undefined || labelOffset === waveformBinaryFrameNoLabel) {
        return null;
      }

      if (labelOffset >= labelBytes.byteLength) {
        return null;
      }

      const cached = labelCache.get(labelOffset);
      if (cached !== undefined) {
        return cached;
      }

      if (labelOffset + 4 > labelBytes.byteLength) {
        return null;
      }

      const labelView = new DataView(labelBytes.buffer, labelBytes.byteOffset, labelBytes.byteLength);
      const labelLength = labelView.getUint32(labelOffset, true);
      const labelStart = labelOffset + 4;
      const labelEnd = labelStart + labelLength;
      if (labelEnd > labelBytes.byteLength) {
        return null;
      }

      const label = textDecoder.decode(labelBytes.subarray(labelStart, labelEnd));
      labelCache.set(labelOffset, label);
      return label;
    },
  };
}

export function createWaveformBinaryFrameFromDataset(
  data: WaveformDataSet,
  segments: readonly WaveformBinaryFrameSegmentInput[],
): ArrayBuffer {
  const signalStarts = new Array<number>(data.signals.length).fill(0);
  const signalCounts = new Array<number>(data.signals.length).fill(0);
  const sortedSegments = [...segments].sort((left, right) => left.signalIndex - right.signalIndex || left.x0 - right.x0);

  for (let index = 0; index < sortedSegments.length; index += 1) {
    const segment = sortedSegments[index];
    if (!segment || segment.signalIndex < 0 || segment.signalIndex >= data.signals.length) {
      throw new Error(`Invalid waveform segment signal index at ${index}.`);
    }

    const signalIndex = segment.signalIndex;
    if (signalCounts[signalIndex] === 0) {
      signalStarts[signalIndex] = index;
    }
    signalCounts[signalIndex] = (signalCounts[signalIndex] ?? 0) + 1;
  }

  const labelOffsets: number[] = [];
  const labelChunks: Uint8Array[] = [];
  let labelBytesLength = 0;

  for (const segment of sortedSegments) {
    if (!segment.label) {
      labelOffsets.push(waveformBinaryFrameNoLabel);
      continue;
    }

    const encoded = textEncoder.encode(segment.label);
    labelOffsets.push(labelBytesLength);
    const lengthPrefix = new Uint8Array(4);
    new DataView(lengthPrefix.buffer).setUint32(0, encoded.byteLength, true);
    labelChunks.push(lengthPrefix, encoded);
    labelBytesLength += encoded.byteLength + 4;
  }

  const signalCount = data.signals.length;
  const segmentCount = sortedSegments.length;
  const signalTableOffset = alignOffset(waveformBinaryFrameHeaderByteLength, 4);
  const x0Offset = alignOffset(signalTableOffset + signalCount * waveformBinaryFrameSignalTableStride * Uint32Array.BYTES_PER_ELEMENT, 4);
  const x1Offset = alignOffset(x0Offset + segmentCount * Float32Array.BYTES_PER_ELEMENT, 4);
  const laneYOffset = alignOffset(x1Offset + segmentCount * Float32Array.BYTES_PER_ELEMENT, 4);
  const valueKindOffset = laneYOffset + segmentCount * Float32Array.BYTES_PER_ELEMENT;
  const labelIndexOffset = alignOffset(valueKindOffset + segmentCount * Uint8Array.BYTES_PER_ELEMENT, 4);
  const labelBytesOffset = labelIndexOffset + segmentCount * Uint32Array.BYTES_PER_ELEMENT;
  const buffer = new ArrayBuffer(labelBytesOffset + labelBytesLength);
  const view = new DataView(buffer);

  view.setUint32(0, waveformBinaryFrameMagic, true);
  view.setUint16(4, waveformBinaryFrameVersion, true);
  view.setUint16(6, waveformBinaryFrameHeaderByteLength, true);
  view.setUint32(8, signalCount, true);
  view.setUint32(12, segmentCount, true);
  view.setUint32(16, signalTableOffset, true);
  view.setUint32(20, x0Offset, true);
  view.setUint32(24, x1Offset, true);
  view.setUint32(28, laneYOffset, true);
  view.setUint32(32, valueKindOffset, true);
  view.setUint32(36, labelIndexOffset, true);
  view.setUint32(40, labelBytesOffset, true);
  view.setUint32(44, labelBytesLength, true);
  view.setUint32(48, 0, true);
  view.setUint32(52, segmentCount, true);

  const signalTable = new Uint32Array(buffer, signalTableOffset, signalCount * waveformBinaryFrameSignalTableStride);
  for (let signalIndex = 0; signalIndex < signalCount; signalIndex += 1) {
    const base = signalIndex * waveformBinaryFrameSignalTableStride;
    signalTable[base] = signalIndex;
    signalTable[base + 1] = signalStarts[signalIndex] ?? 0;
    signalTable[base + 2] = signalCounts[signalIndex] ?? 0;
    signalTable[base + 3] = signalIndex;
  }

  const x0 = new Float32Array(buffer, x0Offset, segmentCount);
  const x1 = new Float32Array(buffer, x1Offset, segmentCount);
  const laneY = new Float32Array(buffer, laneYOffset, segmentCount);
  const valueKind = new Uint8Array(buffer, valueKindOffset, segmentCount);
  const labelIndex = new Uint32Array(buffer, labelIndexOffset, segmentCount);
  const labelBytes = new Uint8Array(buffer, labelBytesOffset, labelBytesLength);

  for (let index = 0; index < sortedSegments.length; index += 1) {
    const segment = sortedSegments[index]!;
    x0[index] = segment.x0;
    x1[index] = segment.x1;
    laneY[index] = segment.laneY;
    valueKind[index] = segment.valueKind;
    labelIndex[index] = labelOffsets[index] ?? waveformBinaryFrameNoLabel;
  }

  let labelCursor = 0;
  for (const chunk of labelChunks) {
    labelBytes.set(chunk, labelCursor);
    labelCursor += chunk.byteLength;
  }

  return buffer;
}

function readHeader(view: DataView): WaveformFrameHeader {
  return {
    version: view.getUint16(4, true),
    headerByteLength: view.getUint16(6, true),
    signalCount: view.getUint32(8, true),
    segmentCount: view.getUint32(12, true),
    signalTableOffset: view.getUint32(16, true),
    x0Offset: view.getUint32(20, true),
    x1Offset: view.getUint32(24, true),
    laneYOffset: view.getUint32(28, true),
    valueKindOffset: view.getUint32(32, true),
    labelIndexOffset: view.getUint32(36, true),
    labelBytesOffset: view.getUint32(40, true),
    labelBytesLength: view.getUint32(44, true),
  };
}

function assertArrayRegion(buffer: ArrayBuffer, offset: number, length: number, bytesPerElement: number, name: string) {
  if (offset % bytesPerElement !== 0) {
    throw new Error(`${name} offset must be ${bytesPerElement}-byte aligned.`);
  }

  assertByteRegion(buffer, offset, length * bytesPerElement, name);
}

function assertByteRegion(buffer: ArrayBuffer, offset: number, byteLength: number, name: string) {
  if (!Number.isInteger(offset) || !Number.isInteger(byteLength) || offset < 0 || byteLength < 0 || offset + byteLength > buffer.byteLength) {
    throw new Error(`${name} region is outside the waveform binary frame.`);
  }
}

function alignOffset(offset: number, alignment: number) {
  return Math.ceil(offset / alignment) * alignment;
}
