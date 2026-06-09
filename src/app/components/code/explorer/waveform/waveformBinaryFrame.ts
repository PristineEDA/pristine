import type { WaveformDataSet } from './waveformTypes';

export const waveformBinaryFrameMagic = 0x46565750; // PWVF, little-endian.
export const waveformBinaryFrameVersion = 1;
export const waveformBinaryFrameVersionV2 = 2;
export const waveformBinaryFrameSignalTableStride = 4;
export const waveformBinaryFrameNoLabel = 0xffffffff;
export const waveformBinaryFrameFlagTruncated = 1;

const waveformBinaryFrameHeaderByteLength = 56;
const waveformBinaryFrameHeaderByteLengthV2 = 96;
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();
let nextWaveformFrameId = 1;

export enum WaveformBinaryValueKind {
  Low = 0,
  High = 1,
  Unknown = 2,
  HighImpedance = 3,
  Bus = 4,
}

export interface ParsedWaveformFrame {
  frameId: number;
  version: number;
  signalCount: number;
  segmentCount: number;
  flags: number;
  truncated: boolean;
  preparedRange: WaveformFrameRange | null;
  signalTable: Uint32Array;
  time0: Float64Array | null;
  time1: Float64Array | null;
  viewportRange: WaveformFrameRange | null;
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
  flags: number;
  labelIndexOffset: number;
  laneYOffset: number;
  preparedEndTime: number | null;
  preparedStartTime: number | null;
  segmentCount: number;
  headerByteLength: number;
  signalCount: number;
  signalTableOffset: number;
  time0Offset: number | null;
  time1Offset: number | null;
  valueKindOffset: number;
  version: number;
  viewportEndTime: number | null;
  viewportStartTime: number | null;
  x0Offset: number;
  x1Offset: number;
}

export interface WaveformFrameRange {
  endTime: number;
  startTime: number;
}

export interface WaveformBinaryFrameSegmentInput {
  label?: string | null;
  laneY: number;
  signalIndex: number;
  time0?: number;
  time1?: number;
  valueKind: WaveformBinaryValueKind;
  x0: number;
  x1: number;
}

export interface WaveformBinaryFrameBuildOptions {
  preparedRange?: WaveformFrameRange;
  signalIndices?: readonly number[];
  version?: 1 | 2;
  viewportRange?: WaveformFrameRange;
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
  if (header.version !== waveformBinaryFrameVersion && header.version !== waveformBinaryFrameVersionV2) {
    throw new Error(`Unsupported waveform frame version: ${header.version}`);
  }
  const minimumHeaderByteLength = header.version === waveformBinaryFrameVersionV2
    ? waveformBinaryFrameHeaderByteLengthV2
    : waveformBinaryFrameHeaderByteLength;
  if (header.headerByteLength < minimumHeaderByteLength || header.headerByteLength > buffer.byteLength) {
    throw new Error(`Unsupported waveform frame header length: ${header.headerByteLength}`);
  }

  assertArrayRegion(buffer, header.signalTableOffset, header.signalCount * waveformBinaryFrameSignalTableStride, Uint32Array.BYTES_PER_ELEMENT, 'signalTable');
  assertArrayRegion(buffer, header.x0Offset, header.segmentCount, Float32Array.BYTES_PER_ELEMENT, 'x0');
  assertArrayRegion(buffer, header.x1Offset, header.segmentCount, Float32Array.BYTES_PER_ELEMENT, 'x1');
  assertArrayRegion(buffer, header.laneYOffset, header.segmentCount, Float32Array.BYTES_PER_ELEMENT, 'laneY');
  assertArrayRegion(buffer, header.valueKindOffset, header.segmentCount, Uint8Array.BYTES_PER_ELEMENT, 'valueKind');
  assertArrayRegion(buffer, header.labelIndexOffset, header.segmentCount, Uint32Array.BYTES_PER_ELEMENT, 'labelIndex');
  assertByteRegion(buffer, header.labelBytesOffset, header.labelBytesLength, 'labelBytes');
  if (header.version === waveformBinaryFrameVersionV2) {
    if (header.time0Offset === null || header.time1Offset === null) {
      throw new Error('Waveform frame v2 must include time0 and time1 offsets.');
    }

    assertArrayRegion(buffer, header.time0Offset, header.segmentCount, Float64Array.BYTES_PER_ELEMENT, 'time0');
    assertArrayRegion(buffer, header.time1Offset, header.segmentCount, Float64Array.BYTES_PER_ELEMENT, 'time1');
  }

  const signalTable = new Uint32Array(buffer, header.signalTableOffset, header.signalCount * waveformBinaryFrameSignalTableStride);
  const x0 = new Float32Array(buffer, header.x0Offset, header.segmentCount);
  const x1 = new Float32Array(buffer, header.x1Offset, header.segmentCount);
  const laneY = new Float32Array(buffer, header.laneYOffset, header.segmentCount);
  const valueKind = new Uint8Array(buffer, header.valueKindOffset, header.segmentCount);
  const labelIndex = new Uint32Array(buffer, header.labelIndexOffset, header.segmentCount);
  const labelBytes = new Uint8Array(buffer, header.labelBytesOffset, header.labelBytesLength);
  const time0 = header.time0Offset === null ? null : new Float64Array(buffer, header.time0Offset, header.segmentCount);
  const time1 = header.time1Offset === null ? null : new Float64Array(buffer, header.time1Offset, header.segmentCount);
  const labelCache = new Map<number, string>();

  return {
    frameId: nextWaveformFrameId++,
    version: header.version,
    signalCount: header.signalCount,
    segmentCount: header.segmentCount,
    flags: header.flags,
    truncated: (header.flags & waveformBinaryFrameFlagTruncated) !== 0,
    preparedRange: header.preparedStartTime === null || header.preparedEndTime === null
      ? null
      : { startTime: header.preparedStartTime, endTime: header.preparedEndTime },
    signalTable,
    time0,
    time1,
    viewportRange: header.viewportStartTime === null || header.viewportEndTime === null
      ? null
      : { startTime: header.viewportStartTime, endTime: header.viewportEndTime },
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

export function parseWaveformBinaryFrameV2(buffer: ArrayBuffer): ParsedWaveformFrame {
  const frame = parseWaveformBinaryFrame(buffer);
  if (frame.version !== waveformBinaryFrameVersionV2 || !frame.time0 || !frame.time1 || !frame.preparedRange) {
    throw new Error('Expected waveform binary frame version 2.');
  }

  return frame;
}

export function createWaveformBinaryFrameFromDataset(
  data: WaveformDataSet,
  segments: readonly WaveformBinaryFrameSegmentInput[],
  options: WaveformBinaryFrameBuildOptions = {},
): ArrayBuffer {
  const version = options.version ?? waveformBinaryFrameVersion;
  const headerByteLength = version === waveformBinaryFrameVersionV2
    ? waveformBinaryFrameHeaderByteLengthV2
    : waveformBinaryFrameHeaderByteLength;
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

  const tableSignalIndices = options.signalIndices && options.signalIndices.length > 0
    ? [...options.signalIndices]
    : data.signals.map((_, signalIndex) => signalIndex);
  for (const signalIndex of tableSignalIndices) {
    if (!Number.isInteger(signalIndex) || signalIndex < 0 || signalIndex >= data.signals.length) {
      throw new Error(`Invalid waveform frame signal table index: ${signalIndex}.`);
    }
  }

  const signalCount = tableSignalIndices.length;
  const segmentCount = sortedSegments.length;
  const signalTableOffset = alignOffset(headerByteLength, 4);
  const x0Offset = alignOffset(signalTableOffset + signalCount * waveformBinaryFrameSignalTableStride * Uint32Array.BYTES_PER_ELEMENT, 4);
  const x1Offset = alignOffset(x0Offset + segmentCount * Float32Array.BYTES_PER_ELEMENT, 4);
  const laneYOffset = alignOffset(x1Offset + segmentCount * Float32Array.BYTES_PER_ELEMENT, 4);
  const valueKindOffset = laneYOffset + segmentCount * Float32Array.BYTES_PER_ELEMENT;
  const labelIndexOffset = alignOffset(valueKindOffset + segmentCount * Uint8Array.BYTES_PER_ELEMENT, 4);
  const time0Offset = version === waveformBinaryFrameVersionV2
    ? alignOffset(labelIndexOffset + segmentCount * Uint32Array.BYTES_PER_ELEMENT, 8)
    : null;
  const time1Offset = time0Offset === null
    ? null
    : alignOffset(time0Offset + segmentCount * Float64Array.BYTES_PER_ELEMENT, 8);
  const labelBytesOffset = time1Offset === null
    ? labelIndexOffset + segmentCount * Uint32Array.BYTES_PER_ELEMENT
    : alignOffset(time1Offset + segmentCount * Float64Array.BYTES_PER_ELEMENT, 4);
  const buffer = new ArrayBuffer(labelBytesOffset + labelBytesLength);
  const view = new DataView(buffer);

  view.setUint32(0, waveformBinaryFrameMagic, true);
  view.setUint16(4, version, true);
  view.setUint16(6, headerByteLength, true);
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
  if (version === waveformBinaryFrameVersionV2) {
    const preparedRange = options.preparedRange ?? { startTime: 0, endTime: data.duration };
    const viewportRange = options.viewportRange ?? preparedRange;

    view.setUint32(56, time0Offset ?? 0, true);
    view.setUint32(60, time1Offset ?? 0, true);
    view.setFloat64(64, preparedRange.startTime, true);
    view.setFloat64(72, preparedRange.endTime, true);
    view.setFloat64(80, viewportRange.startTime, true);
    view.setFloat64(88, viewportRange.endTime, true);
  }

  const signalTable = new Uint32Array(buffer, signalTableOffset, signalCount * waveformBinaryFrameSignalTableStride);
  for (let tableIndex = 0; tableIndex < tableSignalIndices.length; tableIndex += 1) {
    const signalIndex = tableSignalIndices[tableIndex]!;
    const base = tableIndex * waveformBinaryFrameSignalTableStride;
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
  const time0 = time0Offset === null ? null : new Float64Array(buffer, time0Offset, segmentCount);
  const time1 = time1Offset === null ? null : new Float64Array(buffer, time1Offset, segmentCount);

  for (let index = 0; index < sortedSegments.length; index += 1) {
    const segment = sortedSegments[index]!;
    x0[index] = segment.x0;
    x1[index] = segment.x1;
    laneY[index] = segment.laneY;
    valueKind[index] = segment.valueKind;
    labelIndex[index] = labelOffsets[index] ?? waveformBinaryFrameNoLabel;
    if (time0 && time1) {
      time0[index] = segment.time0 ?? segment.x0;
      time1[index] = segment.time1 ?? segment.x1;
    }
  }

  let labelCursor = 0;
  for (const chunk of labelChunks) {
    labelBytes.set(chunk, labelCursor);
    labelCursor += chunk.byteLength;
  }

  return buffer;
}

function readHeader(view: DataView): WaveformFrameHeader {
  const version = view.getUint16(4, true);
  const headerByteLength = view.getUint16(6, true);

  return {
    version,
    headerByteLength,
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
    flags: view.getUint32(48, true),
    time0Offset: version === waveformBinaryFrameVersionV2 && headerByteLength >= waveformBinaryFrameHeaderByteLengthV2 ? view.getUint32(56, true) : null,
    time1Offset: version === waveformBinaryFrameVersionV2 && headerByteLength >= waveformBinaryFrameHeaderByteLengthV2 ? view.getUint32(60, true) : null,
    preparedStartTime: version === waveformBinaryFrameVersionV2 && headerByteLength >= waveformBinaryFrameHeaderByteLengthV2 ? view.getFloat64(64, true) : null,
    preparedEndTime: version === waveformBinaryFrameVersionV2 && headerByteLength >= waveformBinaryFrameHeaderByteLengthV2 ? view.getFloat64(72, true) : null,
    viewportStartTime: version === waveformBinaryFrameVersionV2 && headerByteLength >= waveformBinaryFrameHeaderByteLengthV2 ? view.getFloat64(80, true) : null,
    viewportEndTime: version === waveformBinaryFrameVersionV2 && headerByteLength >= waveformBinaryFrameHeaderByteLengthV2 ? view.getFloat64(88, true) : null,
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
