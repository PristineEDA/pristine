export type WaveformSignalKind = 'clock' | 'logic' | 'bus';

export interface WaveformTransition {
  time: number;
  value: string;
}

export interface WaveformSignal {
  id: string;
  groupId: string;
  name: string;
  path: string;
  kind: WaveformSignalKind;
  color: string;
  width?: number;
  transitions: readonly WaveformTransition[];
}

export interface WaveformSignalGroup {
  id: string;
  label: string;
}

export interface WaveformDataSet {
  id: string;
  title: string;
  timescaleUnit: string;
  duration: number;
  cursorTime: number;
  groups: readonly WaveformSignalGroup[];
  signals: readonly WaveformSignal[];
}

export interface WaveformViewport {
  startTime: number;
  endTime: number;
}

export type WaveformRendererStatus = 'initializing' | 'webgpu' | 'webgl' | 'error';
