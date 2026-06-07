import { createWaveformBinaryFrameFromDataset, WaveformBinaryValueKind, type WaveformBinaryFrameSegmentInput } from './waveformBinaryFrame';
import { getWaveformDisplayRows, timeToX, type WaveformSignalDisplayRow } from './waveformLayout';
import type { WaveformDataSet, WaveformSignal, WaveformViewport } from './waveformTypes';

const denseColors = [
  '#a78bfa',
  '#60a5fa',
  '#38bdf8',
  '#34d399',
  '#84cc16',
  '#facc15',
  '#f97316',
  '#fb7185',
  '#2dd4bf',
] as const;

export const waveformFixtureData: WaveformDataSet = {
  id: 'counter_tb-binary-fixture',
  title: 'counter_tb',
  timescaleUnit: 'ns',
  duration: 200,
  cursorTime: 84,
  source: 'lsp-binary',
  groups: [
    { id: 'tb_top_module1', label: 'tb_top_module1' },
    { id: 'u_top_module1', label: 'u_top_module1' },
    { id: 'dense_test_signals', label: 'dense_test_signals' },
  ],
  signals: createFixtureSignals(),
};

export const waveformTransitionFixtureData: WaveformDataSet = {
  ...waveformFixtureData,
  id: 'counter_tb-transition-fixture',
  source: 'json',
  signals: waveformFixtureData.signals.map((signal) => ({
    ...signal,
    transitions: createSignalTransitions(signal),
  })),
};

export function createWaveformFixtureFrame(
  viewport: WaveformViewport,
  width: number,
  signalIds?: readonly string[],
): ArrayBuffer {
  const visibleSignalIds = signalIds && signalIds.length > 0 ? new Set(signalIds) : null;
  const rows = getWaveformDisplayRows(waveformFixtureData).filter(
    (row): row is WaveformSignalDisplayRow => row.kind === 'signal' && (!visibleSignalIds || visibleSignalIds.has(row.signal.id)),
  );
  const segments: WaveformBinaryFrameSegmentInput[] = [];

  for (const row of rows) {
    segments.push(...createSignalFrameSegments(row, viewport, width));
  }

  return createWaveformBinaryFrameFromDataset(waveformFixtureData, segments, {
    signalIndices: rows.map((row) => row.signalIndex),
  });
}

function createFixtureSignals(): WaveformSignal[] {
  const baseSignals: WaveformSignal[] = [
    createSignal('tb_top_module1-clk', 'tb_top_module1', 'clk', 'clock', '#ffd166'),
    createSignal('tb_top_module1-reset', 'tb_top_module1', 'reset_n', 'logic', '#9b7cff'),
    createSignal('tb_top_module1-shift-enable', 'tb_top_module1', 'shift_en', 'logic', '#7dd3fc'),
    createSignal('tb_top_module1-serial-data', 'tb_top_module1', 'serial_data', 'logic', '#fb7185'),
    createSignal('u_top_module1-clk', 'u_top_module1', 'clk', 'clock', '#4cc9f0'),
    createSignal('u_top_module1-enable', 'u_top_module1', 'enable', 'logic', '#38d68c'),
    createSignal('u_top_module1-shift_ena', 'u_top_module1', 'shift_ena', 'logic', '#f97316'),
    createSignal('u_top_module1-counting', 'u_top_module1', 'counting', 'bus', '#6ee7b7', 4),
  ];

  for (let index = 1; index <= 160; index += 1) {
    const padded = String(index).padStart(2, '0');
    const isBus = index % 5 === 0;
    baseSignals.push(createSignal(
      `dense-signal-${padded}`,
      'dense_test_signals',
      isBus ? `dense_bus_${padded}` : index % 3 === 0 ? `dense_clock_${padded}` : `dense_logic_${padded}`,
      isBus ? 'bus' : index % 3 === 0 ? 'clock' : 'logic',
      denseColors[index % denseColors.length]!,
      isBus ? (index % 2 === 0 ? 8 : 16) : undefined,
    ));
  }

  return baseSignals;
}

function createSignal(id: string, groupId: string, name: string, kind: WaveformSignal['kind'], color: string, width?: number): WaveformSignal {
  return {
    id,
    groupId,
    name,
    path: `${groupId}.${name}`,
    kind,
    color,
    width,
  };
}

function createSignalTransitions(signal: WaveformSignal) {
  if (signal.id === 'u_top_module1-counting') {
    return [
      { time: 0, value: 'x' },
      { time: 20, value: '0' },
      { time: 50, value: '1' },
      { time: 80, value: '2' },
      { time: 120, value: '3' },
      { time: 150, value: '4' },
      { time: 190, value: 'z' },
    ];
  }

  if (signal.id === 'u_top_module1-shift_ena') {
    return [
      { time: 0, value: 'z' },
      { time: 18, value: '0' },
      { time: 62, value: '1' },
      { time: 112, value: '0' },
      { time: 170, value: '1' },
    ];
  }

  const step = signal.kind === 'bus' ? 1 : signal.kind === 'clock' ? 0.8 : 1.1;
  const transitionCount = signal.groupId === 'dense_test_signals' ? 220 : 48;
  const transitions = [];

  for (let index = 0; index < transitionCount; index += 1) {
    transitions.push({
      time: Math.min(waveformFixtureData.duration, Number((index * step).toFixed(3))),
      value: getTransitionValue(signal, index),
    });
  }

  return transitions;
}

function getTransitionValue(signal: WaveformSignal, index: number) {
  if (signal.kind === 'bus') {
    if (index % 29 === 0) {
      return 'x';
    }

    if (index % 37 === 0) {
      return 'z';
    }

    const width = signal.width ?? 4;
    const mask = Math.max(1, 2 ** Math.min(width, 12) - 1);
    return ((index * 7) & mask).toString(16);
  }

  if (index % 41 === 0) {
    return 'x';
  }

  if (index % 53 === 0) {
    return 'z';
  }

  return index % 2 === 0 ? '0' : '1';
}

function createSignalFrameSegments(row: WaveformSignalDisplayRow, viewport: WaveformViewport, width: number): WaveformBinaryFrameSegmentInput[] {
  const signal = row.signal;
  const segments: WaveformBinaryFrameSegmentInput[] = [];
  const step = signal.kind === 'bus' ? 12 : signal.kind === 'clock' ? 4 : 10;
  let time = Math.floor(viewport.startTime / step) * step;
  let segmentIndex = 0;

  while (time < viewport.endTime) {
    const nextTime = Math.min(viewport.endTime, time + step);

    if (nextTime > viewport.startTime) {
      segments.push({
        label: getSegmentLabel(signal, segmentIndex),
        laneY: row.y,
        signalIndex: row.signalIndex,
        valueKind: getSegmentValueKind(signal, segmentIndex),
        x0: timeToX(Math.max(time, viewport.startTime), viewport, width),
        x1: timeToX(nextTime, viewport, width),
      });
    }

    time = nextTime;
    segmentIndex += 1;
  }

  return segments;
}

function getSegmentValueKind(signal: WaveformSignal, index: number) {
  if (signal.kind === 'bus') {
    if (signal.id === 'u_top_module1-counting') {
      return WaveformBinaryValueKind.Bus;
    }

    if (index % 11 === 0) {
      return WaveformBinaryValueKind.Unknown;
    }
    if (index % 13 === 0) {
      return WaveformBinaryValueKind.HighImpedance;
    }
    return WaveformBinaryValueKind.Bus;
  }

  if (index % 17 === 0) {
    return WaveformBinaryValueKind.Unknown;
  }
  if (index % 19 === 0) {
    return WaveformBinaryValueKind.HighImpedance;
  }

  return index % 2 === 0 ? WaveformBinaryValueKind.High : WaveformBinaryValueKind.Low;
}

function getSegmentLabel(signal: WaveformSignal, index: number) {
  if (signal.kind !== 'bus') {
    return null;
  }

  if (signal.id === 'u_top_module1-counting') {
    return String(Math.max(0, index - 4));
  }

  const width = signal.width ?? 4;
  const mask = Math.max(1, 2 ** Math.min(width, 12) - 1);
  return ((index * 7) & mask).toString(16);
}
