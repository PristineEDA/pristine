import { Container, Graphics, Text } from 'pixi.js';

import {
  formatWaveformValue,
  getWaveformLaneY,
  getWaveformTicks,
  getWaveformTransitionsInWindow,
  timeToX,
  waveformHeaderHeight,
  waveformLaneHeight,
  waveformLanePaddingY,
  waveformTimeAxisInset,
} from './waveformLayout';
import type { WaveformDataSet, WaveformSignal, WaveformViewport } from './waveformTypes';

export interface WaveformScene {
  world: Container;
}

interface WaveformSceneOptions {
  data: WaveformDataSet;
  viewport: WaveformViewport;
  cursorTime: number;
  height: number;
  selectedSignalId: string | null;
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
};

export function createWaveformScene(options: WaveformSceneOptions): WaveformScene {
  const world = new Container();
  const background = new Graphics();
  const grid = new Graphics();
  const waves = new Container();
  const labels = new Container();
  const cursor = new Container();

  background.rect(0, 0, options.width, options.height).fill({ color: palette.background });
  background.rect(0, 0, options.width, waveformHeaderHeight).fill({ color: palette.header });

  drawLanes(background, options);
  drawGrid(grid, labels, options);
  drawSignals(waves, options);
  drawCursor(cursor, options);

  world.addChild(background, grid, waves, cursor, labels);

  return { world };
}

function drawLanes(target: Graphics, options: WaveformSceneOptions) {
  options.data.signals.forEach((signal, index) => {
    const y = getWaveformLaneY(index);
    const isSelected = signal.id === options.selectedSignalId;

    target
      .rect(0, y, options.width, waveformLaneHeight)
      .fill({ color: isSelected ? palette.selectedLane : index % 2 === 0 ? palette.laneEven : palette.laneOdd, alpha: isSelected ? 0.72 : 1 });
  });
}

function drawGrid(grid: Graphics, labels: Container, options: WaveformSceneOptions) {
  const ticks = getWaveformTicks(options.viewport, options.width);

  grid
    .moveTo(0, waveformHeaderHeight)
    .lineTo(options.width, waveformHeaderHeight)
    .stroke({ color: palette.gridStrong, width: 1, alpha: 0.9 });

  for (const tick of ticks) {
    const x = Math.round(timeToX(tick, options.viewport, options.width)) + 0.5;

    grid
      .moveTo(x, 0)
      .lineTo(x, options.height)
      .stroke({ color: tick === 0 ? palette.gridStrong : palette.grid, width: 1, alpha: tick === 0 ? 0.72 : 0.42 });

    const label = createText(`${tick}${options.data.timescaleUnit}`, palette.textMuted, 10, x + 4, 8);
    labels.addChild(label);
  }
}

function drawSignals(target: Container, options: WaveformSceneOptions) {
  options.data.signals.forEach((signal, index) => {
    const laneY = getWaveformLaneY(index);
    const signalLayer = new Container();
    const line = new Graphics();

    if (signal.kind === 'bus') {
      drawBusWaveform(signalLayer, signal, options, laneY);
    } else {
      drawDigitalWaveform(line, signal, options, laneY);
      signalLayer.addChild(line);
    }

    target.addChild(signalLayer);
  });
}

function drawDigitalWaveform(target: Graphics, signal: WaveformSignal, options: WaveformSceneOptions, laneY: number) {
  const transitions = getWaveformTransitionsInWindow(signal, options.viewport);
  const lineColor = parseHexColor(signal.color);
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

    if (current.value.toLowerCase() === 'x' || current.value.toLowerCase() === 'z') {
      target
        .rect(x1, laneY + waveformLanePaddingY, Math.max(1, x2 - x1), waveformLaneHeight - waveformLanePaddingY * 2)
        .fill({ color: palette.unknown, alpha: 0.2 })
        .stroke({ color: palette.unknown, width: 1, alpha: 0.85 });

      continue;
    }

    const y = current.value === '1' ? topY : bottomY;

    target
      .moveTo(x1, y)
      .lineTo(x2, y)
      .stroke({ color: lineColor, width: signal.kind === 'clock' ? 1.7 : 2, alpha: 0.96 });

    if (next.value !== current.value && next.value.toLowerCase() !== 'x' && next.value.toLowerCase() !== 'z') {
      const nextY = next.value === '1' ? topY : bottomY;
      target
        .moveTo(x2, y)
        .lineTo(x2, nextY)
        .stroke({ color: lineColor, width: 1.7, alpha: 0.9 });
    }
  }

  target
    .moveTo(waveformTimeAxisInset, midY)
    .lineTo(options.width - waveformTimeAxisInset, midY)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.04 });
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
    const isUnknown = current.value.toLowerCase() === 'x' || current.value.toLowerCase() === 'z';

    bus
      .roundRect(x1, y, width, height, 3)
      .fill({ color: isUnknown ? palette.unknown : busColor, alpha: isUnknown ? 0.18 : 0.13 })
      .stroke({ color: isUnknown ? palette.unknown : busColor, width: 1.2, alpha: 0.82 });

    if (width >= 24) {
      valueLabels.push(createText(formatWaveformValue(current.value), isUnknown ? palette.unknown : palette.text, 10, x1 + 7, y + 4));
    }
  }

  target.addChild(bus);
  target.addChild(...valueLabels);
}

function drawCursor(target: Container, options: WaveformSceneOptions) {
  const cursorLine = new Graphics();
  const x = Math.round(timeToX(options.cursorTime, options.viewport, options.width)) + 0.5;
  const clampedX = Math.min(Math.max(waveformTimeAxisInset, x), options.width - waveformTimeAxisInset);
  const labelText = `${options.cursorTime.toFixed(1)}${options.data.timescaleUnit}`;

  cursorLine
    .moveTo(clampedX, 0)
    .lineTo(clampedX, options.height)
    .stroke({ color: palette.cursor, width: 1.5, alpha: 0.95 });

  cursorLine
    .roundRect(clampedX - 27, 3, 54, 18, 4)
    .fill({ color: 0x2a2410, alpha: 0.96 })
    .stroke({ color: palette.cursor, width: 1, alpha: 0.9 });

  const label = createText(labelText, palette.cursor, 10, clampedX - 22, 7);

  target.addChild(cursorLine, label);
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
