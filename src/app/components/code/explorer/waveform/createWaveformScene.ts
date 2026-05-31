import { Container, Graphics, Text } from 'pixi.js';

import {
  formatWaveformValue,
  getWaveformDigitalPulseFillCount,
  getWaveformDisplayRows,
  getWaveformFirstSignalLaneY,
  getWaveformSignalLaneY,
  getWaveformShapeCounts,
  getWaveformStateCounts,
  getWaveformTicks,
  getWaveformTransitionsInWindow,
  isHighImpedanceWaveformValue,
  isSpecialWaveformValue,
  isUnknownWaveformValue,
  normalizeWaveformValue,
  timeToX,
  waveformHeaderHeight,
  waveformLaneHeight,
  waveformLanePaddingY,
  waveformTimeAxisInset,
} from './waveformLayout';
import type { WaveformDataSet, WaveformLayerName, WaveformShapeCounts, WaveformSignal, WaveformStateCounts, WaveformViewport } from './waveformTypes';

export const waveformLayerNames: readonly WaveformLayerName[] = ['background', 'content', 'status', 'operation'];
export const waveformUnknownStripeSpacing = 8;
export const waveformHighImpedanceStripeSpacing = 6;

export type WaveformSceneLayers = Record<WaveformLayerName, Container>;

export interface WaveformScene {
  world: Container;
  layers: WaveformSceneLayers;
  shapeCounts: WaveformShapeCounts;
  digitalPulseFillCount: number;
  firstSignalLaneY: number | null;
  rowCount: number;
  selectedSignalLaneY: number | null;
  stateCounts: WaveformStateCounts;
}

interface WaveformSceneOptions {
  data: WaveformDataSet;
  viewport: WaveformViewport;
  cursorTime: number;
  height: number;
  selectedSignalId: string | null;
  verticalScrollTop?: number;
  width: number;
}

const palette = {
  background: 0x111111,
  header: 0x181818,
  laneOdd: 0x141414,
  laneEven: 0x101010,
  selectedLane: 0x203645,
  grid: 0x3a3a3a,
  gridStrong: 0x515151,
  text: 0xd6d6d6,
  textMuted: 0x8a8f98,
  cursor: 0xffd166,
  unknown: 0xff6b8a,
  highImpedance: 0xff9800,
};

export function createWaveformScene(options: WaveformSceneOptions): WaveformScene {
  const world = new Container();
  const layers = createLayers();
  const base = new Graphics();
  const rows = getWaveformDisplayRows(options.data);

  base.rect(0, 0, options.width, options.height).fill({ color: palette.background });
  base.rect(0, 0, options.width, waveformHeaderHeight).fill({ color: palette.header });

  layers.background.addChild(base);
  drawLanes(layers.background, rows, options);
  drawGrid(layers.background, layers.status, options);
  drawSignals(layers.content, rows, options);
  drawCursor(layers.status, layers.operation, options);

  world.addChild(layers.background, layers.content, layers.status, layers.operation);

  return {
    world,
    layers,
    shapeCounts: getWaveformShapeCounts(options.data, options.viewport),
    digitalPulseFillCount: getWaveformDigitalPulseFillCount(options.data, options.viewport),
    firstSignalLaneY: getWaveformFirstSignalLaneY(options.data),
    rowCount: rows.length,
    selectedSignalLaneY: getWaveformSignalLaneY(options.data, options.selectedSignalId),
    stateCounts: getWaveformStateCounts(options.data),
  };
}

function createLayers(): WaveformSceneLayers {
  return {
    background: new Container({ label: 'waveform-layer-background' }),
    content: new Container({ label: 'waveform-layer-content' }),
    status: new Container({ label: 'waveform-layer-status' }),
    operation: new Container({ label: 'waveform-layer-operation' }),
  };
}

function drawLanes(target: Container, rows: ReturnType<typeof getWaveformDisplayRows>, options: WaveformSceneOptions) {
  const lanes = new Graphics();

  rows.forEach((row) => {
    const isGroup = row.kind === 'group';
    const y = getScrolledY(row.y, options);
    const isSelected = row.kind === 'signal' && row.signal.id === options.selectedSignalId;

    if (isLaneOutsideVisibleCanvas(y, options.height)) {
      return;
    }

    lanes
      .rect(0, y, options.width, waveformLaneHeight)
      .fill({ color: isSelected ? palette.selectedLane : isGroup ? palette.header : row.rowIndex % 2 === 0 ? palette.laneEven : palette.laneOdd, alpha: isSelected ? 0.72 : isGroup ? 0.78 : 1 });

    if (isGroup) {
      lanes
        .moveTo(0, y + waveformLaneHeight - 0.5)
        .lineTo(options.width, y + waveformLaneHeight - 0.5)
        .stroke({ color: palette.gridStrong, width: 1, alpha: 0.32 });
    }
  });

  target.addChild(lanes);
}

function drawGrid(target: Container, headerTarget: Container, options: WaveformSceneOptions) {
  const ticks = getWaveformTicks(options.viewport, options.width);
  const grid = new Graphics();
  const headerOverlay = new Container({ label: 'waveform-header-overlay' });
  const header = new Graphics();
  const labels = new Container({ label: 'waveform-header-labels' });

  grid
    .moveTo(0, waveformHeaderHeight)
    .lineTo(options.width, waveformHeaderHeight)
    .stroke({ color: palette.gridStrong, width: 1, alpha: 0.9 });

  header
    .rect(0, 0, options.width, waveformHeaderHeight)
    .fill({ color: palette.header, alpha: 1 })
    .moveTo(0, waveformHeaderHeight - 0.5)
    .lineTo(options.width, waveformHeaderHeight - 0.5)
    .stroke({ color: palette.gridStrong, width: 1, alpha: 0.9 });

  for (const tick of ticks) {
    const x = Math.round(timeToX(tick, options.viewport, options.width)) + 0.5;
    const labelText = `${tick}${options.data.timescaleUnit}`;
    const labelWidth = getEstimatedTextWidth(labelText, 10) + 8;

    grid
      .moveTo(x, waveformHeaderHeight)
      .lineTo(x, options.height)
      .stroke({ color: tick === 0 ? palette.gridStrong : palette.grid, width: 1, alpha: tick === 0 ? 0.72 : 0.42 });

    header
      .moveTo(x, 0)
      .lineTo(x, waveformHeaderHeight)
      .stroke({ color: tick === 0 ? palette.gridStrong : palette.grid, width: 1, alpha: tick === 0 ? 0.72 : 0.42 })
      .roundRect(x + 2, 5, labelWidth, 16, 2)
      .fill({ color: palette.header, alpha: 0.96 });

    const label = createText(labelText, palette.textMuted, 10, x + 4, 8);
    labels.addChild(label);
  }

  headerOverlay.addChild(header, labels);
  target.addChild(grid);
  headerTarget.addChild(headerOverlay);
}

function drawSignals(target: Container, rows: ReturnType<typeof getWaveformDisplayRows>, options: WaveformSceneOptions) {
  rows.forEach((row) => {
    if (row.kind !== 'signal') {
      return;
    }

    const signal = row.signal;
    const laneY = getScrolledY(row.y, options);
    const signalLayer = new Container();

    if (isLaneOutsideVisibleCanvas(laneY, options.height)) {
      return;
    }

    if (signal.kind === 'bus') {
      drawBusWaveform(signalLayer, signal, options, laneY);
    } else {
      drawDigitalWaveform(signalLayer, signal, options, laneY);
    }

    target.addChild(signalLayer);
  });
}

function drawDigitalWaveform(target: Container, signal: WaveformSignal, options: WaveformSceneOptions, laneY: number) {
  const transitions = getWaveformTransitionsInWindow(signal, options.viewport);
  const line = new Graphics();
  const stateLabels: Text[] = [];
  const lineColor = parseHexColor(signal.color);
  const laneTop = laneY + waveformLanePaddingY;
  const laneBottom = laneY + waveformLaneHeight - waveformLanePaddingY;
  const topY = laneY + waveformLanePaddingY + 2;
  const bottomY = laneY + waveformLaneHeight - waveformLanePaddingY - 2;
  const midY = laneY + waveformLaneHeight / 2;

  for (let index = 0; index < transitions.length - 1; index += 1) {
    const current = transitions[index];
    const next = transitions[index + 1];

    if (!current || !next) {
      continue;
    }

    const x1 = timeToX(current.time, options.viewport, options.width);
    const x2 = timeToX(next.time, options.viewport, options.width);
    const width = Math.max(1, x2 - x1);
    const currentValue = normalizeWaveformValue(current.value);
    const nextValue = normalizeWaveformValue(next.value);

    if (isUnknownWaveformValue(currentValue)) {
      drawUnknownStateBlock(line, stateLabels, x1, laneTop, width, laneBottom - laneTop);
      continue;
    }

    if (isHighImpedanceWaveformValue(currentValue)) {
      drawHighImpedanceStateBlock(line, stateLabels, x1, laneTop, width, laneBottom - laneTop);

      continue;
    }

    const isHigh = currentValue === '1';
    const y = isHigh ? topY : bottomY;

    if (isHigh) {
      drawDigitalPulseFill(line, x1, topY, width, bottomY - topY, lineColor, signal.kind);
    }

    line
      .moveTo(x1, y)
      .lineTo(x2, y)
      .stroke({ color: lineColor, width: signal.kind === 'clock' ? 1.7 : 2, alpha: 0.96 });

    if (nextValue !== currentValue && !isSpecialWaveformValue(nextValue)) {
      const nextY = nextValue === '1' ? topY : bottomY;
      line
        .moveTo(x2, y)
        .lineTo(x2, nextY)
        .stroke({ color: lineColor, width: 1.7, alpha: 0.9 });
    }
  }

  line
    .moveTo(waveformTimeAxisInset, midY)
    .lineTo(options.width - waveformTimeAxisInset, midY)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.04 });

  target.addChild(line, ...stateLabels);
}

function drawDigitalPulseFill(target: Graphics, x: number, y: number, width: number, height: number, color: number, signalKind: WaveformSignal['kind']) {
  target
    .rect(x, y, width, Math.max(1, height))
    .fill({ color, alpha: signalKind === 'clock' ? 0.12 : 0.18 });
}

function drawBusWaveform(target: Container, signal: WaveformSignal, options: WaveformSceneOptions, laneY: number) {
  const transitions = getWaveformTransitionsInWindow(signal, options.viewport);
  const bus = new Graphics();
  const valueLabels: Text[] = [];
  const busColor = parseHexColor(signal.color);
  const y = laneY + waveformLanePaddingY;
  const height = waveformLaneHeight - waveformLanePaddingY * 2;

  for (let index = 0; index < transitions.length - 1; index += 1) {
    const current = transitions[index];
    const next = transitions[index + 1];

    if (!current || !next) {
      continue;
    }

    const x1 = timeToX(current.time, options.viewport, options.width);
    const x2 = timeToX(next.time, options.viewport, options.width);
    const width = Math.max(1, x2 - x1);
    const currentValue = normalizeWaveformValue(current.value);

    if (isUnknownWaveformValue(currentValue)) {
      drawUnknownStateBlock(bus, valueLabels, x1, y, width, height);
    } else if (isHighImpedanceWaveformValue(currentValue)) {
      drawHighImpedanceStateBlock(bus, valueLabels, x1, y, width, height);
    } else {
      drawElongatedHexagon(bus, x1, y, width, height, {
        color: busColor,
        fillAlpha: 0.16,
        strokeAlpha: 0.84,
        strokeWidth: 1.2,
      });
    }

    if (!isSpecialWaveformValue(currentValue) && width >= 24) {
      valueLabels.push(createText(formatWaveformValue(currentValue), palette.text, 10, x1 + 7, y + 4));
    }
  }

  target.addChild(bus);
  target.addChild(...valueLabels);
}

function drawUnknownStateBlock(target: Graphics, labels: Text[], x: number, y: number, width: number, height: number) {
  drawSpecialStateBlock(target, x, y, width, height, {
    color: palette.unknown,
    fillAlpha: 0.22,
    pattern: 'backslash',
    state: 'x',
    strokeAlpha: 0.86,
  });
  addSpecialStateCharacters(labels, 'x', palette.unknown, x, y, width, height);
}

function drawHighImpedanceStateBlock(target: Graphics, labels: Text[], x: number, y: number, width: number, height: number) {
  drawSpecialStateBlock(target, x, y, width, height, {
    color: palette.highImpedance,
    fillAlpha: 0.18,
    pattern: 'chevron',
    state: 'z',
    strokeAlpha: 0.88,
  });
  addSpecialStateCharacters(labels, 'z', palette.highImpedance, x, y, width, height);
}

interface SpecialStateBlockStyle {
  color: number;
  fillAlpha: number;
  pattern: 'backslash' | 'chevron';
  state: 'x' | 'z';
  strokeAlpha: number;
}

function drawSpecialStateBlock(target: Graphics, x: number, y: number, width: number, height: number, style: SpecialStateBlockStyle) {
  target
    .roundRect(x, y, width, height, 2)
    .fill({ color: style.color, alpha: style.fillAlpha })
    .stroke({ color: style.color, width: 1, alpha: style.strokeAlpha });

  if (style.pattern === 'chevron') {
    drawChevronHatch(target, x, y, width, height, style.color);
  } else {
    drawBackslashHatch(target, x, y, width, height, style.color);
  }
}

interface ElongatedHexagonStyle {
  color: number;
  fillAlpha: number;
  strokeAlpha: number;
  strokeWidth: number;
}

function drawElongatedHexagon(target: Graphics, x: number, y: number, width: number, height: number, style: ElongatedHexagonStyle) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const bevel = getElongatedHexagonBevel(safeWidth, safeHeight);
  const centerY = y + safeHeight / 2;

  target
    .poly([
      x + bevel,
      y,
      x + safeWidth - bevel,
      y,
      x + safeWidth,
      centerY,
      x + safeWidth - bevel,
      y + safeHeight,
      x + bevel,
      y + safeHeight,
      x,
      centerY,
    ], true)
    .fill({ color: style.color, alpha: style.fillAlpha })
    .stroke({ color: style.color, width: style.strokeWidth, alpha: style.strokeAlpha, join: 'miter' });
}

function getElongatedHexagonBevel(width: number, height: number) {
  return getWaveformBusHexagonBevel(width, height);
}

export function getWaveformBusHexagonBevel(width: number, height: number) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const baseBevel = Math.min(safeHeight * 0.22, 4);
  const narrowSegmentLimit = Math.max(0, safeWidth / 2 - 1);

  return Math.max(0, Math.min(baseBevel, narrowSegmentLimit));
}

function addSpecialStateCharacters(labels: Text[], state: 'x' | 'z', color: number, x: number, y: number, width: number, height: number) {
  if (width < 8 || height < 10) {
    return;
  }

  const fontSize = Math.max(8, Math.min(11, height * 0.58));
  const textX = x + width / 2 - fontSize * 0.28;
  const textY = y + Math.max(1, (height - fontSize) / 2 - 1);

  labels.push(createText(state, color, fontSize, textX, textY));
}

function drawBackslashHatch(target: Graphics, x: number, y: number, width: number, height: number, color: number) {
  const spacing = waveformUnknownStripeSpacing;
  const left = x + 1;
  const right = x + width - 1;
  const bottom = y + height - 1;

  for (let start = x - height; start < x + width; start += spacing) {
    const segmentStartX = Math.max(left, start);
    const segmentEndX = Math.min(right, start + height);

    if (segmentEndX <= segmentStartX) {
      continue;
    }

    target
      .moveTo(segmentStartX, y + segmentStartX - start + 1)
      .lineTo(segmentEndX, Math.min(bottom, y + segmentEndX - start + 1))
      .stroke({ color, width: 1, alpha: 0.54 });
  }
}

function drawChevronHatch(target: Graphics, x: number, y: number, width: number, height: number, color: number) {
  const spacing = waveformHighImpedanceStripeSpacing;
  const top = y + 2;
  const bottom = y + height - 2;
  const centerY = y + height / 2;
  const left = x + 1;
  const right = x + width - 2;

  for (let start = x + 2; start < right; start += spacing) {
    const tipX = start + 5;

    if (tipX <= start + 1 || start >= right) {
      continue;
    }

    drawClippedLine(target, start, top, tipX, centerY, { left, right, top, bottom }, color, 0.62);
    drawClippedLine(target, tipX, centerY, start, bottom, { left, right, top, bottom }, color, 0.62);
  }
}

export interface WaveformClipBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

function drawClippedLine(target: Graphics, x1: number, y1: number, x2: number, y2: number, bounds: WaveformClipBounds, color: number, alpha: number) {
  const clipped = clipWaveformLineToBounds(x1, y1, x2, y2, bounds);

  if (!clipped) {
    return;
  }

  target
    .moveTo(clipped.x1, clipped.y1)
    .lineTo(clipped.x2, clipped.y2)
    .stroke({ color, width: 1, alpha });
}

export function clipWaveformLineToBounds(x1: number, y1: number, x2: number, y2: number, bounds: WaveformClipBounds) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let entry = 0;
  let exit = 1;

  function clip(edgeDelta: number, edgeOffset: number) {
    if (edgeDelta === 0) {
      return edgeOffset >= 0;
    }

    const ratio = edgeOffset / edgeDelta;

    if (edgeDelta < 0) {
      if (ratio > exit) {
        return false;
      }

      entry = Math.max(entry, ratio);
      return true;
    }

    if (ratio < entry) {
      return false;
    }

    exit = Math.min(exit, ratio);
    return true;
  }

  if (
    !clip(-dx, x1 - bounds.left) ||
    !clip(dx, bounds.right - x1) ||
    !clip(-dy, y1 - bounds.top) ||
    !clip(dy, bounds.bottom - y1)
  ) {
    return null;
  }

  return {
    x1: x1 + entry * dx,
    y1: y1 + entry * dy,
    x2: x1 + exit * dx,
    y2: y1 + exit * dy,
  };
}

function getScrolledY(y: number, options: WaveformSceneOptions) {
  return y - (options.verticalScrollTop ?? 0);
}

function isLaneOutsideVisibleCanvas(y: number, height: number) {
  return y + waveformLaneHeight < waveformHeaderHeight - waveformLaneHeight || y > height + waveformLaneHeight;
}

function getEstimatedTextWidth(text: string, fontSize: number) {
  return text.length * fontSize * 0.58;
}

function drawCursor(statusLayer: Container, operationLayer: Container, options: WaveformSceneOptions) {
  const cursorLine = new Graphics();
  const cursorBadge = new Graphics();
  const x = Math.round(timeToX(options.cursorTime, options.viewport, options.width)) + 0.5;
  const clampedX = Math.min(Math.max(waveformTimeAxisInset, x), options.width - waveformTimeAxisInset);
  const labelText = `${options.cursorTime.toFixed(1)}${options.data.timescaleUnit}`;

  cursorLine
    .moveTo(clampedX, 0)
    .lineTo(clampedX, options.height)
    .stroke({ color: palette.cursor, width: 1.5, alpha: 0.95 });

  cursorBadge
    .roundRect(clampedX - 27, 3, 54, 18, 4)
    .fill({ color: 0x2a2410, alpha: 0.96 })
    .stroke({ color: palette.cursor, width: 1, alpha: 0.9 });

  cursorBadge
    .poly([clampedX - 5, waveformHeaderHeight - 1, clampedX + 5, waveformHeaderHeight - 1, clampedX, waveformHeaderHeight + 6], true)
    .fill({ color: palette.cursor, alpha: 0.82 });

  const label = createText(labelText, palette.cursor, 10, clampedX - 22, 7);

  statusLayer.addChild(cursorLine);
  operationLayer.addChild(cursorBadge, label);
}

function createText(text: string, fill: number, fontSize: number, x: number, y: number) {
  return new Text({
    text,
    style: {
      fill,
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      fontSize,
      fontWeight: '500',
    },
    x,
    y,
  });
}

function parseHexColor(color: string) {
  return Number.parseInt(color.replace('#', ''), 16);
}
