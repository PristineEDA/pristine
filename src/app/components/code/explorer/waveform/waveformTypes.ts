export type WaveformSignalKind = 'clock' | 'logic' | 'bus';
export type WaveformLayerName = 'background' | 'content' | 'status' | 'operation';
export type WaveformLogicState = '0' | '1' | 'x' | 'z';
export type WaveformDataSource = 'json' | 'lsp-binary';

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
  hasUnknown: boolean;
  hasHighImpedance: boolean;
}

export interface WaveformRenderSegmentResult {
  segments: WaveformRenderSegment[];
  sourceSegmentCount: number;
  renderedSegmentCount: number;
}

export interface WaveformRenderStats {
  visibleRowCount: number;
  culledRowCount: number;
  rowAttachCount: number;
  rowReuseCount: number;
  rowRecycleCount: number;
  panBufferHitCount: number;
  panBufferMissCount: number;
  panPixelShiftCount: number;
  gpuBufferUpdateCount: number;
  gpuBufferUpdateMs: number;
  gpuBufferCapacityVertexCount: number;
  gpuBufferReallocCount: number;
  gpuDrawLayerCount: number;
  gpuLayerCount: number;
  gpuVertexCount: number;
  labelLayoutCacheHitCount: number;
  labelLayoutCacheMissCount: number;
  labelTextureUpdateCount: number;
  meshBufferUpdateMs: number;
  meshVertexCount: number;
  labelPoolSize: number;
  renderedSignalCount: number;
  sourceSegmentCount: number;
  renderedSegmentCount: number;
  collapsedSegmentCount: number;
  drawnHorizontalSegmentCount: number;
  skippedHorizontalSegmentCount: number;
  drawnTransitionEdgeCount: number;
  busFullHexagonCount: number;
  busFoldOnlyCount: number;
  busVerticalFallbackCount: number;
  busSpecialStateHexagonCount: number;
  busSpecialStateLabelCount: number;
  busSpecialStateWidthAlignedLabelCount: number;
  busTruncatedLabelCount: number;
  busLabelDotReplacementCount: number;
  renderedLabelCount: number;
  renderResolution: number;
  suppressedLabelCount: number;
  fullSceneRebuildCount: number;
  viewportContentUpdateCount: number;
  verticalScrollUpdateCount: number;
  cursorUpdateCount: number;
  selectionUpdateCount: number;
  displayViewportUpdateCount: number;
  displayViewportOnlyUpdateCount: number;
  droppedFrameCount: number;
  frameIntervalP95Ms: number;
  frameParseMs: number;
  pipeRoundtripMs: number;
  pixiRenderMs: number;
  idleViewportCommitCount: number;
  reactViewportCommitCount: number;
  sceneUpdateMs: number;
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
  panBufferHitCount: number;
  panBufferMissCount: number;
  panPixelShiftCount: number;
  gpuBufferUpdateCount: number;
  gpuBufferUpdateMs: number;
  gpuBufferCapacityVertexCount: number;
  gpuBufferReallocCount: number;
  gpuDrawLayerCount: number;
  gpuLayerCount: number;
  gpuVertexCount: number;
  labelLayoutCacheHitCount: number;
  labelLayoutCacheMissCount: number;
  labelTextureUpdateCount: number;
  meshBufferUpdateMs: number;
  meshVertexCount: number;
  labelPoolSize: number;
  displayViewportUpdateCount: number;
  displayViewportOnlyUpdateCount: number;
  droppedFrameCount: number;
  frameIntervalP95Ms: number;
  frameParseMs: number;
  pipeRoundtripMs: number;
  pixiRenderMs: number;
  idleViewportCommitCount: number;
  reactViewportCommitCount: number;
  sceneUpdateMs: number;
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
  transitions?: readonly WaveformTransition[];
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
  source?: WaveformDataSource;
  groups: readonly WaveformSignalGroup[];
  signals: readonly WaveformSignal[];
}

export interface WaveformViewport {
  startTime: number;
  endTime: number;
}

export type WaveformRendererStatus = 'initializing' | 'webgpu' | 'webgl' | 'error';
