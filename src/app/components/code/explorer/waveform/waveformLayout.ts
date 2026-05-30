import type { WaveformDataSet, WaveformSignal, WaveformSignalGroup, WaveformStateCounts, WaveformTransition, WaveformViewport } from './waveformTypes';

export const waveformCanvasMinWidth = 360;
export const waveformCanvasMinHeight = 220;
export const waveformHeaderHeight = 30;
export const waveformLaneHeight = 30;
export const waveformLanePaddingY = 5;
export const waveformTimeAxisInset = 10;
export const waveformBottomPadding = 14;
export const waveformMinWindow = 8;

export type WaveformDisplayRow = WaveformGroupDisplayRow | WaveformSignalDisplayRow;

export interface WaveformGroupDisplayRow {
  kind: 'group';
  id: string;
  group: WaveformSignalGroup;
  rowIndex: number;
  y: number;
}

export interface WaveformSignalDisplayRow {
  kind: 'signal';
  id: string;
  groupId: string;
  signal: WaveformSignal;
  signalIndex: number;
  rowIndex: number;
  y: number;
}

export function getInitialWaveformViewport(data: WaveformDataSet): WaveformViewport {
  return fitWaveformViewport(data);
}

export function fitWaveformViewport(data: WaveformDataSet): WaveformViewport {
  return {
    startTime: 0,
    endTime: Math.max(waveformMinWindow, data.duration),
  };
}

export function getWaveformViewportSpan(viewport: WaveformViewport) {
  return Math.max(waveformMinWindow, viewport.endTime - viewport.startTime);
}

export function clampTime(time: number, duration: number) {
  return Math.min(Math.max(0, time), duration);
}

export function clampWaveformViewport(viewport: WaveformViewport, duration: number): WaveformViewport {
  const span = Math.min(Math.max(waveformMinWindow, getWaveformViewportSpan(viewport)), Math.max(waveformMinWindow, duration));
  const maxStart = Math.max(0, duration - span);
  const startTime = Math.min(Math.max(0, viewport.startTime), maxStart);

  return {
    startTime,
    endTime: startTime + span,
  };
}

export function zoomWaveformViewport(
  viewport: WaveformViewport,
  centerTime: number,
  zoomFactor: number,
  duration: number,
): WaveformViewport {
  const span = getWaveformViewportSpan(viewport);
  const safeZoomFactor = Math.min(Math.max(0.2, zoomFactor), 5);
  const nextSpan = Math.min(Math.max(waveformMinWindow, span / safeZoomFactor), Math.max(waveformMinWindow, duration));
  const centerRatio = span <= 0 ? 0.5 : (centerTime - viewport.startTime) / span;
  const nextStartTime = centerTime - nextSpan * Math.min(Math.max(0, centerRatio), 1);

  return clampWaveformViewport({ startTime: nextStartTime, endTime: nextStartTime + nextSpan }, duration);
}

export function panWaveformViewport(viewport: WaveformViewport, deltaTime: number, duration: number): WaveformViewport {
  return clampWaveformViewport({
    startTime: viewport.startTime + deltaTime,
    endTime: viewport.endTime + deltaTime,
  }, duration);
}

export function timeToX(time: number, viewport: WaveformViewport, width: number) {
  const usableWidth = getWaveformUsableWidth(width);
  const progress = (time - viewport.startTime) / getWaveformViewportSpan(viewport);

  return waveformTimeAxisInset + progress * usableWidth;
}

export function xToTime(x: number, viewport: WaveformViewport, width: number) {
  const usableWidth = getWaveformUsableWidth(width);
  const progress = (x - waveformTimeAxisInset) / usableWidth;

  return viewport.startTime + progress * getWaveformViewportSpan(viewport);
}

export function getSignalValueAtTime(signal: WaveformSignal, time: number) {
  let value = normalizeWaveformValue(signal.transitions[0]?.value ?? 'x');

  for (const transition of signal.transitions) {
    if (transition.time > time) {
      break;
    }

    value = normalizeWaveformValue(transition.value);
  }

  return value;
}

export function getWaveformTransitionsInWindow(signal: WaveformSignal, viewport: WaveformViewport): WaveformTransition[] {
  const transitions: WaveformTransition[] = [];
  const initialValue = getSignalValueAtTime(signal, viewport.startTime);

  transitions.push({ time: viewport.startTime, value: initialValue });

  for (const transition of signal.transitions) {
    if (transition.time <= viewport.startTime) {
      continue;
    }

    if (transition.time >= viewport.endTime) {
      break;
    }

    transitions.push(transition);
  }

  transitions.push({ time: viewport.endTime, value: getSignalValueAtTime(signal, viewport.endTime) });

  return transitions;
}

export function getWaveformTickStep(viewport: WaveformViewport, width: number) {
  const span = getWaveformViewportSpan(viewport);
  const targetTickCount = Math.max(4, Math.floor(width / 110));
  const roughStep = span / targetTickCount;
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];

  return candidates.find((step) => step >= roughStep) ?? 1000;
}

export function getWaveformTicks(viewport: WaveformViewport, width: number) {
  const step = getWaveformTickStep(viewport, width);
  const firstTick = Math.ceil(viewport.startTime / step) * step;
  const ticks: number[] = [];

  for (let tick = firstTick; tick <= viewport.endTime; tick += step) {
    ticks.push(Number(tick.toFixed(6)));
  }

  return ticks;
}

export function getWaveformLaneY(index: number) {
  return waveformHeaderHeight + index * waveformLaneHeight;
}

export function getWaveformDisplayRows(data: WaveformDataSet): WaveformDisplayRow[] {
  const rows: WaveformDisplayRow[] = [];
  let signalIndex = 0;

  for (const group of data.groups) {
    const groupRowIndex = rows.length;
    rows.push({
      kind: 'group',
      id: `group:${group.id}`,
      group,
      rowIndex: groupRowIndex,
      y: getWaveformLaneY(groupRowIndex),
    });

    for (const signal of data.signals) {
      if (signal.groupId !== group.id) {
        continue;
      }

      const signalRowIndex = rows.length;
      rows.push({
        kind: 'signal',
        id: `signal:${signal.id}`,
        groupId: group.id,
        signal,
        signalIndex,
        rowIndex: signalRowIndex,
        y: getWaveformLaneY(signalRowIndex),
      });
      signalIndex += 1;
    }
  }

  return rows;
}

export function getWaveformSignalRow(data: WaveformDataSet, signalId: string | null) {
  if (!signalId) {
    return null;
  }

  return getWaveformDisplayRows(data).find((row): row is WaveformSignalDisplayRow => row.kind === 'signal' && row.signal.id === signalId) ?? null;
}

export function getWaveformSignalLaneY(data: WaveformDataSet, signalId: string | null) {
  return getWaveformSignalRow(data, signalId)?.y ?? null;
}

export function getWaveformFirstSignalLaneY(data: WaveformDataSet) {
  return getWaveformDisplayRows(data).find((row): row is WaveformSignalDisplayRow => row.kind === 'signal')?.y ?? null;
}

export function getWaveformCanvasHeight(signalCount: number) {
  return waveformHeaderHeight + signalCount * waveformLaneHeight + waveformBottomPadding;
}

export function getWaveformCanvasHeightForData(data: WaveformDataSet) {
  return waveformHeaderHeight + getWaveformDisplayRows(data).length * waveformLaneHeight + waveformBottomPadding;
}

export function formatWaveformValue(value: string) {
  return value.length === 1 ? value.toUpperCase() : value;
}

export function normalizeWaveformValue(value: string) {
  return value.trim().toLowerCase();
}

export function isUnknownWaveformValue(value: string) {
  return normalizeWaveformValue(value) === 'x';
}

export function isHighImpedanceWaveformValue(value: string) {
  return normalizeWaveformValue(value) === 'z';
}

export function isSpecialWaveformValue(value: string) {
  return isUnknownWaveformValue(value) || isHighImpedanceWaveformValue(value);
}

export function getWaveformStateCounts(data: WaveformDataSet): WaveformStateCounts {
  let xStateCount = 0;
  let zStateCount = 0;

  for (const signal of data.signals) {
    for (const transition of signal.transitions) {
      if (isUnknownWaveformValue(transition.value)) {
        xStateCount += 1;
      } else if (isHighImpedanceWaveformValue(transition.value)) {
        zStateCount += 1;
      }
    }
  }

  return { xStateCount, zStateCount };
}

export function getWaveformDigitalPulseFillCount(data: WaveformDataSet, viewport: WaveformViewport) {
  let pulseFillCount = 0;

  for (const signal of data.signals) {
    if (signal.kind === 'bus') {
      continue;
    }

    const transitions = getWaveformTransitionsInWindow(signal, viewport);

    for (let index = 0; index < transitions.length - 1; index += 1) {
      const current = transitions[index];
      const next = transitions[index + 1];

      if (current && next && next.time > current.time && normalizeWaveformValue(current.value) === '1') {
        pulseFillCount += 1;
      }
    }
  }

  return pulseFillCount;
}

export function getWaveformSignalTestId(signalId: string) {
  return `waveform-signal-row-${signalId.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
}

function getWaveformUsableWidth(width: number) {
  return Math.max(1, width - waveformTimeAxisInset * 2);
}
