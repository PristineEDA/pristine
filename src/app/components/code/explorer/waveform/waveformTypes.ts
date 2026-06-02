export type WaveformSignalKind = 'clock' | 'logic' | 'bus';
export type WaveformLayerName = 'background' | 'content' | 'status' | 'operation';
export type WaveformLogicState = '0' | '1' | 'x' | 'z';
export type WaveformRenderDensityMode = 'detail' | 'compact' | 'dense';

export interface WaveformStateCounts {
  xStateCount: number;
  zStateCount: number;
}

export interface WaveformShapeCounts {
  busHexagonCount: number;
  xStateBlockCount: number;
  zStateBlockCount: number;
}

export interface WaveformRenderSegment {
  startTime: number;
  endTime: number;
  x1: number;
  x2: number;
  width: number;
  value: string;
  sourceSegmentCount: number;
  mixed: boolean;
  hasUnknown: boolean;
  hasHighImpedance: boolean;
}

export interface WaveformDenseColumn {
  column: number;
  x1: number;
  x2: number;
  width: number;
  value: string;
  sourceSegmentCount: number;
  mixed: boolean;
  hasUnknown: boolean;
  hasHighImpedance: boolean;
  hasHigh: boolean;
  hasLow: boolean;
}

export interface WaveformRenderSegmentResult {
  densityMode: WaveformRenderDensityMode;
  segments: WaveformRenderSegment[];
  sourceSegmentCount: number;
  renderedSegmentCount: number;
  coalescedSegmentCount: number;
  denseColumnCount: number;
  denseRunCount: number;
}

export interface WaveformRenderStats {
  visibleRowCount: number;
  culledRowCount: number;
  rowAttachCount: number;
  rowReuseCount: number;
  rowRecycleCount: number;
  rowContentRedrawCount: number;
  rowContentSkipCount: number;
  panBufferHitCount: number;
  panBufferMissCount: number;
  panPixelShiftCount: number;
  renderedSignalCount: number;
  sourceSegmentCount: number;
  renderedSegmentCount: number;
  coalescedSegmentCount: number;
  renderedLabelCount: number;
  cacheableSignalCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  cachedSignalCount: number;
  compactSignalCount: number;
  denseColumnCount: number;
  denseRunCount: number;
  denseSignalCount: number;
  detailSignalCount: number;
  renderResolution: number;
  suppressedLabelCount: number;
  textureCacheBytes: number;
  textureCacheSize: number;
  fullSceneRebuildCount: number;
  viewportContentUpdateCount: number;
  verticalScrollUpdateCount: number;
  cursorUpdateCount: number;
  selectionUpdateCount: number;
}

export interface WaveformRenderMetrics {
  lastRenderDurationMs: number | null;
  averageRenderDurationMs: number | null;
  lastFps: number | null;
  averageFps: number | null;
  visiblePrimitiveCount: number;
}

export interface WaveformSceneUpdateMetrics {
  fullSceneRebuildCount: number;
  viewportContentUpdateCount: number;
  verticalScrollUpdateCount: number;
  selectionUpdateCount: number;
  cursorUpdateCount: number;
  rowAttachCount: number;
  rowReuseCount: number;
  rowRecycleCount: number;
  rowContentRedrawCount: number;
  rowContentSkipCount: number;
  panBufferHitCount: number;
  panBufferMissCount: number;
  panPixelShiftCount: number;
}

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
