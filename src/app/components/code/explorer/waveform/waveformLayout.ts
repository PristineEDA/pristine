import type { WaveformDataSet, WaveformSignal, WaveformTransition, WaveformViewport } from './waveformTypes';

export const waveformCanvasMinWidth = 360;
export const waveformCanvasMinHeight = 220;
export const waveformHeaderHeight = 30;
export const waveformLaneHeight = 30;
export const waveformLanePaddingY = 5;
export const waveformTimeAxisInset = 10;
export const waveformBottomPadding = 14;
export const waveformMinWindow = 8;

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
  let value = signal.transitions[0]?.value ?? 'x';

  for (const transition of signal.transitions) {
    if (transition.time > time) {
      break;
    }

    value = transition.value;
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

export function getWaveformCanvasHeight(signalCount: number) {
  return waveformHeaderHeight + signalCount * waveformLaneHeight + waveformBottomPadding;
}

export function formatWaveformValue(value: string) {
  return value.length === 1 ? value.toUpperCase() : value;
}

export function getWaveformSignalTestId(signalId: string) {
  return `waveform-signal-row-${signalId.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
}

function getWaveformUsableWidth(width: number) {
  return Math.max(1, width - waveformTimeAxisInset * 2);
}
