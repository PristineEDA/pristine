import type { WaveformDataSet, WaveformDenseColumn, WaveformRenderDensityMode, WaveformRenderSegment, WaveformRenderSegmentResult, WaveformShapeCounts, WaveformSignal, WaveformSignalGroup, WaveformStateCounts, WaveformTransition, WaveformViewport } from './waveformTypes';

export const waveformCanvasMinWidth = 360;
export const waveformCanvasMinHeight = 220;
export const waveformHeaderHeight = 30;
export const waveformLaneHeight = 30;
export const waveformLanePaddingY = 5;
export const waveformTimeAxisInset = 10;
export const waveformBottomPadding = 14;
export const waveformMinWindow = 8;
export const waveformSegmentCoalescePixelThreshold = 5;
const waveformDenseAverageCssWidth = 6;
const waveformCompactAverageCssWidth = 10;
const waveformDenseMinimumSegmentCount = 96;
const waveformCompactMinimumSegmentCount = 48;
const waveformIndistinguishableDevicePixels = 1.15;

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

export interface WaveformVisibleRows {
  rows: WaveformDisplayRow[];
  visibleRowCount: number;
  culledRowCount: number;
}

export function getVisibleWaveformRows(rows: readonly WaveformDisplayRow[], verticalScrollTop: number, height: number, overscanRowCount = 8): WaveformVisibleRows {
  const top = waveformHeaderHeight - waveformLaneHeight * overscanRowCount;
  const bottom = height + waveformLaneHeight * overscanRowCount;
  const visibleRows = rows.filter((row) => {
    const y = row.y - verticalScrollTop;

    return y + waveformLaneHeight >= top && y <= bottom;
  });

  return {
    rows: visibleRows,
    visibleRowCount: visibleRows.length,
    culledRowCount: rows.length - visibleRows.length,
  };
}

export function getWaveformRenderSegments(
  signal: WaveformSignal,
  viewport: WaveformViewport,
  width: number,
  minPixelWidth = waveformSegmentCoalescePixelThreshold,
  renderResolution = 1,
): WaveformRenderSegmentResult {
  const transitions = getWaveformTransitionsInWindow(signal, viewport);
  const sourceSegments: WaveformRenderSegment[] = [];

  for (let index = 0; index < transitions.length - 1; index += 1) {
    const current = transitions[index];
    const next = transitions[index + 1];

    if (!current || !next || next.time <= current.time) {
      continue;
    }

    sourceSegments.push(createRenderSegment(current, next, viewport, width));
  }

  const densityMode = getWaveformRenderDensityMode(sourceSegments);

  if (densityMode === 'dense') {
    const denseResult = getWaveformDenseColumnRuns(signal, sourceSegments, renderResolution);

    return createRenderSegmentResult(denseResult.runs, sourceSegments.length, densityMode, denseResult.columnCount, denseResult.runs.length);
  }

  if (minPixelWidth <= 0 || sourceSegments.length <= 1) {
    return createRenderSegmentResult(sourceSegments, sourceSegments.length, densityMode);
  }

  const segments: WaveformRenderSegment[] = [];
  let pending: WaveformRenderSegment | null = null;

  for (const sourceSegment of sourceSegments) {
    if (!pending) {
      pending = sourceSegment;
      continue;
    }

    if (densityMode !== 'detail' && shouldCoalesceRenderSegment(pending, sourceSegment, minPixelWidth, renderResolution)) {
      pending = mergeRenderSegments(pending, sourceSegment);
      continue;
    }

    segments.push(pending);
    pending = sourceSegment;
  }

  if (pending) {
    segments.push(pending);
  }

  return createRenderSegmentResult(segments, sourceSegments.length, densityMode);
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

export function getWaveformShapeCounts(data: WaveformDataSet, viewport: WaveformViewport): WaveformShapeCounts {
  let busHexagonCount = 0;
  let xStateBlockCount = 0;
  let zStateBlockCount = 0;

  for (const signal of data.signals) {
    const transitions = getWaveformTransitionsInWindow(signal, viewport);

    for (let index = 0; index < transitions.length - 1; index += 1) {
      const current = transitions[index];
      const next = transitions[index + 1];

      if (!current || !next || next.time <= current.time) {
        continue;
      }

      const currentValue = normalizeWaveformValue(current.value);

      if (isUnknownWaveformValue(currentValue)) {
        xStateBlockCount += 1;
      } else if (isHighImpedanceWaveformValue(currentValue)) {
        zStateBlockCount += 1;
      }

      if (signal.kind === 'bus' && !isSpecialWaveformValue(currentValue)) {
        busHexagonCount += 1;
      }
    }
  }

  return { busHexagonCount, xStateBlockCount, zStateBlockCount };
}

export function getWaveformHorizontalScrollMetrics(viewport: WaveformViewport, duration: number, viewportWidth: number) {
  const safeWidth = Math.max(1, viewportWidth);
  const span = getWaveformViewportSpan(viewport);
  const safeDuration = Math.max(waveformMinWindow, duration);
  const contentWidth = Math.max(safeWidth, safeWidth * safeDuration / Math.min(span, safeDuration));
  const maxScrollLeft = Math.max(0, contentWidth - safeWidth);
  const maxStartTime = Math.max(0, safeDuration - span);
  const scrollLeft = maxStartTime <= 0 || maxScrollLeft <= 0
    ? 0
    : (Math.min(Math.max(0, viewport.startTime), maxStartTime) / maxStartTime) * maxScrollLeft;

  return { contentWidth, maxScrollLeft, maxStartTime, scrollLeft };
}

export function getWaveformViewportForHorizontalScroll(viewport: WaveformViewport, duration: number, viewportWidth: number, scrollLeft: number) {
  const metrics = getWaveformHorizontalScrollMetrics(viewport, duration, viewportWidth);
  const span = getWaveformViewportSpan(viewport);
  const startTime = metrics.maxScrollLeft <= 0 || metrics.maxStartTime <= 0
    ? 0
    : (Math.min(Math.max(0, scrollLeft), metrics.maxScrollLeft) / metrics.maxScrollLeft) * metrics.maxStartTime;

  return clampWaveformViewport({ startTime, endTime: startTime + span }, duration);
}

export function getWaveformSignalTestId(signalId: string) {
  return `waveform-signal-row-${signalId.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
}

function getWaveformUsableWidth(width: number) {
  return Math.max(1, width - waveformTimeAxisInset * 2);
}

function createRenderSegment(current: WaveformTransition, next: WaveformTransition, viewport: WaveformViewport, width: number): WaveformRenderSegment {
  const value = normalizeWaveformValue(current.value);
  const x1 = timeToX(current.time, viewport, width);
  const x2 = timeToX(next.time, viewport, width);

  return {
    startTime: current.time,
    endTime: next.time,
    x1,
    x2,
    width: Math.max(1, x2 - x1),
    value,
    sourceSegmentCount: 1,
    mixed: false,
    hasUnknown: isUnknownWaveformValue(value),
    hasHighImpedance: isHighImpedanceWaveformValue(value),
  };
}

function createRenderSegmentResult(
  segments: WaveformRenderSegment[],
  sourceSegmentCount: number,
  densityMode: WaveformRenderDensityMode,
  denseColumnCount = 0,
  denseRunCount = 0,
): WaveformRenderSegmentResult {
  return {
    densityMode,
    segments,
    sourceSegmentCount,
    renderedSegmentCount: segments.length,
    coalescedSegmentCount: Math.max(0, sourceSegmentCount - segments.length),
    denseColumnCount,
    denseRunCount,
  };
}

function getWaveformRenderDensityMode(sourceSegments: readonly WaveformRenderSegment[]): WaveformRenderDensityMode {
  if (sourceSegments.length < waveformCompactMinimumSegmentCount) {
    return 'detail';
  }

  const averageCssWidth = sourceSegments.reduce((total, segment) => total + segment.width, 0) / sourceSegments.length;
  const narrowSegmentCount = sourceSegments.filter((segment) => segment.width <= waveformDenseAverageCssWidth).length;
  const narrowRatio = narrowSegmentCount / sourceSegments.length;

  if (sourceSegments.length >= waveformDenseMinimumSegmentCount && (averageCssWidth <= waveformDenseAverageCssWidth || narrowRatio >= 0.62)) {
    return 'dense';
  }

  if (averageCssWidth <= waveformCompactAverageCssWidth || narrowRatio >= 0.36) {
    return 'compact';
  }

  return 'detail';
}

interface DenseColumnAccumulator {
  column: number;
  sourceSegmentCount: number;
  values: Set<string>;
  hasUnknown: boolean;
  hasHighImpedance: boolean;
  hasHigh: boolean;
  hasLow: boolean;
}

function getWaveformDenseColumnRuns(signal: WaveformSignal, sourceSegments: readonly WaveformRenderSegment[], renderResolution: number) {
  const safeResolution = Math.max(1, renderResolution);
  const columns = new Map<number, DenseColumnAccumulator>();

  for (const segment of sourceSegments) {
    const startColumn = Math.floor(segment.x1 * safeResolution);
    const endColumn = Math.max(startColumn + 1, Math.ceil(segment.x2 * safeResolution));

    for (let column = startColumn; column < endColumn; column += 1) {
      const accumulator = columns.get(column) ?? createDenseColumnAccumulator(column);
      accumulator.sourceSegmentCount += segment.sourceSegmentCount;
      accumulator.values.add(segment.value);
      accumulator.hasUnknown ||= segment.hasUnknown;
      accumulator.hasHighImpedance ||= segment.hasHighImpedance;
      accumulator.hasHigh ||= segment.value === '1';
      accumulator.hasLow ||= segment.value === '0';
      columns.set(column, accumulator);
    }
  }

  const denseColumns = Array.from(columns.values())
    .sort((left, right) => left.column - right.column)
    .map((column) => createDenseColumn(signal, column, safeResolution));
  const runs: WaveformRenderSegment[] = [];
  let pending: WaveformDenseColumn | null = null;

  for (const column of denseColumns) {
    if (!pending) {
      pending = column;
      continue;
    }

    if (canMergeDenseColumns(pending, column)) {
      pending = mergeDenseColumns(pending, column);
      continue;
    }

    runs.push(denseColumnToRenderSegment(pending));
    pending = column;
  }

  if (pending) {
    runs.push(denseColumnToRenderSegment(pending));
  }

  return {
    columnCount: denseColumns.length,
    runs,
  };
}

function createDenseColumnAccumulator(column: number): DenseColumnAccumulator {
  return {
    column,
    sourceSegmentCount: 0,
    values: new Set<string>(),
    hasUnknown: false,
    hasHighImpedance: false,
    hasHigh: false,
    hasLow: false,
  };
}

function createDenseColumn(signal: WaveformSignal, accumulator: DenseColumnAccumulator, renderResolution: number): WaveformDenseColumn {
  const values = Array.from(accumulator.values);
  const hasMultipleValues = values.length > 1;
  const value = getDenseColumnValue(signal, accumulator, hasMultipleValues);

  return {
    column: accumulator.column,
    x1: accumulator.column / renderResolution,
    x2: (accumulator.column + 1) / renderResolution,
    width: 1 / renderResolution,
    value,
    sourceSegmentCount: accumulator.sourceSegmentCount,
    mixed: hasMultipleValues || (signal.kind !== 'bus' && accumulator.hasHigh && accumulator.hasLow),
    hasUnknown: accumulator.hasUnknown,
    hasHighImpedance: accumulator.hasHighImpedance,
    hasHigh: accumulator.hasHigh,
    hasLow: accumulator.hasLow,
  };
}

function getDenseColumnValue(signal: WaveformSignal, column: DenseColumnAccumulator, hasMultipleValues: boolean) {
  if (column.hasUnknown) {
    return 'x';
  }

  if (column.hasHighImpedance) {
    return 'z';
  }

  if (signal.kind !== 'bus') {
    if (column.hasHigh && column.hasLow) {
      return 'mixed';
    }

    return column.hasHigh ? '1' : '0';
  }

  return hasMultipleValues ? 'mixed' : Array.from(column.values)[0] ?? 'x';
}

function canMergeDenseColumns(previous: WaveformDenseColumn, next: WaveformDenseColumn) {
  return previous.column + 1 === next.column && getDenseColumnVisualKey(previous) === getDenseColumnVisualKey(next);
}

function mergeDenseColumns(previous: WaveformDenseColumn, next: WaveformDenseColumn): WaveformDenseColumn {
  return {
    ...previous,
    x2: next.x2,
    width: Math.max(previous.width, next.x2 - previous.x1),
    sourceSegmentCount: previous.sourceSegmentCount + next.sourceSegmentCount,
    mixed: previous.mixed || next.mixed,
    hasUnknown: previous.hasUnknown || next.hasUnknown,
    hasHighImpedance: previous.hasHighImpedance || next.hasHighImpedance,
    hasHigh: previous.hasHigh || next.hasHigh,
    hasLow: previous.hasLow || next.hasLow,
  };
}

function getDenseColumnVisualKey(column: WaveformDenseColumn) {
  if (column.hasUnknown) {
    return 'x';
  }

  if (column.hasHighImpedance) {
    return 'z';
  }

  if (column.mixed) {
    return 'mixed';
  }

  return column.value;
}

function denseColumnToRenderSegment(column: WaveformDenseColumn): WaveformRenderSegment {
  return {
    startTime: 0,
    endTime: 0,
    x1: column.x1,
    x2: column.x2,
    width: column.width,
    value: column.value,
    sourceSegmentCount: column.sourceSegmentCount,
    mixed: column.mixed,
    hasUnknown: column.hasUnknown,
    hasHighImpedance: column.hasHighImpedance,
  };
}

function shouldCoalesceRenderSegment(previous: WaveformRenderSegment, next: WaveformRenderSegment, minPixelWidth: number, renderResolution: number) {
  const previousDeviceWidth = previous.width * renderResolution;
  const nextDeviceWidth = next.width * renderResolution;
  const boundaryIsHidden = Math.floor(previous.x2 * renderResolution) === Math.floor(next.x1 * renderResolution);
  const sameVisualState = getRenderSegmentVisualKey(previous) === getRenderSegmentVisualKey(next);

  if (sameVisualState && (boundaryIsHidden || previous.width < minPixelWidth || next.width < minPixelWidth)) {
    return true;
  }

  return boundaryIsHidden && previousDeviceWidth <= waveformIndistinguishableDevicePixels && nextDeviceWidth <= waveformIndistinguishableDevicePixels;
}

function getRenderSegmentVisualKey(segment: WaveformRenderSegment) {
  if (segment.hasUnknown) {
    return 'x';
  }

  if (segment.hasHighImpedance) {
    return 'z';
  }

  if (segment.mixed) {
    return 'mixed';
  }

  return segment.value;
}

function mergeRenderSegments(previous: WaveformRenderSegment, next: WaveformRenderSegment): WaveformRenderSegment {
  const hasUnknown = previous.hasUnknown || next.hasUnknown;
  const hasHighImpedance = previous.hasHighImpedance || next.hasHighImpedance;
  const mixed = previous.mixed || next.mixed || previous.value !== next.value;

  return {
    startTime: previous.startTime,
    endTime: next.endTime,
    x1: previous.x1,
    x2: next.x2,
    width: Math.max(1, next.x2 - previous.x1),
    value: hasUnknown ? 'x' : hasHighImpedance ? 'z' : previous.value,
    sourceSegmentCount: previous.sourceSegmentCount + next.sourceSegmentCount,
    mixed,
    hasUnknown,
    hasHighImpedance,
  };
}
