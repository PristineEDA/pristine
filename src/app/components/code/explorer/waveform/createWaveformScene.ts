import { Container, Graphics, Text } from 'pixi.js';

import {
  formatWaveformValue,
  type WaveformDisplayRow,
  getWaveformDigitalPulseFillCount,
  getWaveformDisplayRows,
  getWaveformFirstSignalLaneY,
  getWaveformRulerScrollIndicatorMetrics,
  getWaveformSignalLaneY,
  getWaveformShapeCounts,
  getWaveformStateCounts,
  getWaveformTicks,
  getWaveformViewportSpan,
  getVisibleWaveformRows,
  type WaveformVisibleRows,
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
import type { WaveformDataSet, WaveformLayerName, WaveformRenderStats, WaveformShapeCounts, WaveformSignal, WaveformStateCounts, WaveformViewport } from './waveformTypes';
import { type ParsedWaveformFrame, WaveformBinaryValueKind } from './waveformBinaryFrame';
import { WaveformGpuBatchRenderer, type WaveformGpuBatchLayerKind } from './waveformGpuBatchRenderer';

export const waveformLayerNames: readonly WaveformLayerName[] = ['background', 'content', 'status', 'operation'];
export const waveformUnknownStripeSpacing = 8;
export const waveformHighImpedanceStripeSpacing = 6;

export type WaveformSceneLayers = Record<WaveformLayerName, Container>;

export interface WaveformScene {
  world: Container;
  layers: WaveformSceneLayers;
  nodes: WaveformSceneNodes;
  rowRegistry: WaveformSceneRowRegistry;
  state: WaveformSceneState;
  shapeCounts: WaveformShapeCounts;
  digitalPulseFillCount: number;
  firstSignalLaneY: number | null;
  renderStats: WaveformRenderStats;
  rowCount: number;
  selectedSignalLaneY: number | null;
  stateCounts: WaveformStateCounts;
}

interface WaveformSceneNodes {
  backgroundBase: Container;
  backgroundGrid: Container;
  backgroundLanes: Container;
  backgroundLanePool: Container;
  contentBatch: Container;
  contentRows: Container;
  contentRowPool: Container;
  statusCursor: Container;
  statusHeader: Container;
  statusHeaderBackground: Container;
  statusRulerIndicator: Container;
  operationCursor: Container;
}

interface WaveformSceneRowRegistry {
  activeRows: Map<string, WaveformSceneRowNode>;
  pool: WaveformSceneRowNode[];
}

interface WaveformSceneRowNode {
  laneContainer: Container;
  contentContainer: Container;
  contentMetrics: WaveformRowContentMetrics;
  rowId: string | null;
}

interface WaveformRowContentMetrics {
  renderedSignalCount: number;
  sourceSegmentCount: number;
  renderedSegmentCount: number;
  collapsedSegmentCount: number;
  drawnHorizontalSegmentCount: number;
  skippedHorizontalSegmentCount: number;
  drawnTransitionEdgeCount: number;
  busFullHexagonCount: number;
  busFoldOnlyCount: number;
  busSpecialStateHexagonCount: number;
  busSpecialStateLabelCount: number;
  busSpecialStateWidthAlignedLabelCount: number;
  busTruncatedLabelCount: number;
  busLabelDotReplacementCount: number;
  busVerticalFallbackCount: number;
  renderedLabelCount: number;
  gpuBufferUpdateCount: number;
  gpuBufferUpdateMs: number;
  gpuBufferCapacityVertexCount: number;
  gpuBufferReallocCount: number;
  gpuDrawLayerCount: number;
  gpuLayerCount: number;
  gpuVertexCount: number;
  glyphAtlasTextureCount: number;
  glyphBufferReallocCount: number;
  glyphBufferUpdateCount: number;
  glyphBufferUpdateMs: number;
  glyphVertexCount: number;
  labelLayoutCacheHitCount: number;
  labelLayoutCacheMissCount: number;
  labelTextureUpdateCount: number;
  labelPoolSize: number;
  suppressedLabelCount: number;
}

interface WaveformRowLifecycleStats {
  rowAttachCount: number;
  rowReuseCount: number;
  rowRecycleCount: number;
}

interface RedrawWaveformSceneRowsOptions {
  redrawContent?: boolean;
  redrawLanes?: boolean;
}

interface WaveformSceneState {
  horizontalBuffer: WaveformHorizontalBufferState;
  cursorTime: number;
  data: WaveformDataSet;
  frame?: ParsedWaveformFrame | null;
  gpuBatchRenderer: WaveformGpuBatchRenderer;
  height: number;
  renderResolution: number;
  rows: WaveformDisplayRow[];
  selectedSignalId: string | null;
  verticalScrollTop: number;
  viewport: WaveformViewport;
  visibleRows: WaveformVisibleRows;
  width: number;
}

interface WaveformHorizontalBufferState {
  bufferPixels: number;
  offsetX: number;
  viewport: WaveformViewport;
  width: number;
}

interface WaveformSceneOptions {
  data: WaveformDataSet;
  frame?: ParsedWaveformFrame | null;
  viewport: WaveformViewport;
  cursorTime: number;
  height: number;
  renderResolution?: number;
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
const waveformHorizontalBufferMinPixels = 256;
const waveformHorizontalBufferMaxPixels = 512;
const viewportSpanEpsilon = 0.000001;

export function createWaveformScene(options: WaveformSceneOptions): WaveformScene {
  const world = new Container();
  const layers = createLayers();
  const rows = getWaveformDisplayRows(options.data);
  const visibleRows = getVisibleWaveformRows(rows, options.verticalScrollTop ?? 0, options.height);
  const nodes = createSceneNodes();
  const rowRegistry = createRowRegistry();
  const horizontalBuffer = createHorizontalBufferState(options.viewport, options.width, getRenderResolution(options), getHorizontalBufferBounds(options));
  const renderStats = createRenderStats(visibleRows.visibleRowCount, visibleRows.culledRowCount, getRenderResolution(options));
  const gpuBatchRenderer = new WaveformGpuBatchRenderer();
  const scene: WaveformScene = {
    world,
    layers,
    nodes,
    rowRegistry,
    state: {
      horizontalBuffer,
      cursorTime: options.cursorTime,
      data: options.data,
      frame: options.frame ?? null,
      gpuBatchRenderer,
      height: options.height,
      renderResolution: getRenderResolution(options),
      rows,
      selectedSignalId: options.selectedSignalId,
      verticalScrollTop: options.verticalScrollTop ?? 0,
      viewport: options.viewport,
      visibleRows,
      width: options.width,
    },
    shapeCounts: getWaveformShapeCounts(options.data, options.viewport),
    digitalPulseFillCount: getWaveformDigitalPulseFillCount(options.data, options.viewport),
    firstSignalLaneY: getWaveformFirstSignalLaneY(options.data),
    renderStats,
    rowCount: rows.length,
    selectedSignalLaneY: getWaveformSignalLaneY(options.data, options.selectedSignalId),
    stateCounts: getWaveformStateCounts(options.data),
  };

  layers.background.addChild(nodes.backgroundBase, nodes.backgroundGrid, nodes.backgroundLanes, nodes.backgroundLanePool);
  nodes.contentBatch.addChild(gpuBatchRenderer.container);
  layers.content.addChild(nodes.contentBatch, nodes.contentRows, nodes.contentRowPool);
  layers.status.addChild(nodes.statusHeaderBackground, nodes.statusRulerIndicator, nodes.statusHeader, nodes.statusCursor);
  layers.operation.addChild(nodes.operationCursor);
  world.addChild(layers.background, layers.content, layers.status, layers.operation);

  redrawWaveformSceneBase(scene);
  redrawWaveformSceneRulerIndicator(scene);
  redrawWaveformSceneGrid(scene);
  redrawWaveformSceneRows(scene);
  redrawWaveformSceneCursor(scene);
  applyHorizontalBufferOffset(scene);

  return scene;
}

export function updateWaveformSceneCursor(scene: WaveformScene, cursorTime: number) {
  scene.state.cursorTime = cursorTime;
  redrawWaveformSceneCursor(scene);
}

export function updateWaveformSceneSelection(scene: WaveformScene, selectedSignalId: string | null) {
  scene.state.selectedSignalId = selectedSignalId;
  scene.selectedSignalLaneY = getWaveformSignalLaneY(scene.state.data, selectedSignalId);
  redrawWaveformSceneLanes(scene);
}

export function updateWaveformSceneVerticalScroll(scene: WaveformScene, verticalScrollTop: number) {
  scene.state.verticalScrollTop = verticalScrollTop;
  scene.state.visibleRows = getVisibleWaveformRows(scene.state.rows, verticalScrollTop, scene.state.height);
  redrawWaveformSceneRows(scene);
}

export function updateWaveformScenePan(scene: WaveformScene, viewport: WaveformViewport) {
  if (scene.state.frame) {
    if (!isFrameViewportPrepared(scene.state.frame, viewport)) {
      scene.renderStats = createRenderStats(
        scene.state.visibleRows.visibleRowCount,
        scene.state.visibleRows.culledRowCount,
        scene.state.renderResolution,
      );
      scene.renderStats.panBufferMissCount = 1;
      return false;
    }

    const previousOffsetX = getHorizontalBufferOffset(
      scene.state.horizontalBuffer.viewport,
      scene.state.viewport,
      getWaveformViewportSpan(scene.state.viewport),
      scene.state.width,
      scene.state.renderResolution,
    );
    const currentSpan = getWaveformViewportSpan(scene.state.viewport);
    const nextSpan = getWaveformViewportSpan(viewport);

    if (Math.abs(currentSpan - nextSpan) <= viewportSpanEpsilon && canShiftHorizontalBuffer(scene, viewport)) {
      scene.state.viewport = viewport;
      scene.shapeCounts = getWaveformShapeCounts(scene.state.data, viewport);
      scene.digitalPulseFillCount = getWaveformDigitalPulseFillCount(scene.state.data, viewport);
      redrawWaveformSceneRulerIndicator(scene);
      redrawWaveformSceneCursor(scene);
      applyHorizontalBufferOffset(scene);
      scene.renderStats = createRenderStats(
        scene.state.visibleRows.visibleRowCount,
        scene.state.visibleRows.culledRowCount,
        scene.state.renderResolution,
      );
      scene.renderStats.rowReuseCount = scene.state.visibleRows.rows.length;
      scene.renderStats.panBufferHitCount = 1;
      scene.renderStats.panPixelShiftCount = Math.abs(scene.state.horizontalBuffer.offsetX - previousOffsetX);
      accumulateFrameBatchStaticMetrics(scene, scene.renderStats);
      return true;
    }

    scene.state.viewport = viewport;
    scene.state.horizontalBuffer = createHorizontalBufferState(viewport, scene.state.width, scene.state.renderResolution, getHorizontalBufferBounds(getSceneOptions(scene)));
    scene.shapeCounts = getWaveformShapeCounts(scene.state.data, viewport);
    scene.digitalPulseFillCount = getWaveformDigitalPulseFillCount(scene.state.data, viewport);
    redrawWaveformSceneRulerIndicator(scene);
    redrawWaveformSceneGrid(scene);
    const updateStartedAt = performance.now();
    redrawWaveformSceneRows(scene, { redrawLanes: false });
    scene.renderStats.panBufferHitCount = 1;
    scene.renderStats.gpuBufferUpdateMs = Math.max(scene.renderStats.gpuBufferUpdateMs, performance.now() - updateStartedAt);
    scene.renderStats.meshBufferUpdateMs = scene.renderStats.gpuBufferUpdateMs;
    scene.renderStats.meshVertexCount = scene.renderStats.gpuVertexCount;
    redrawWaveformSceneCursor(scene);
    applyHorizontalBufferOffset(scene);
    return true;
  }

  const previousOffsetX = getHorizontalBufferOffset(
    scene.state.horizontalBuffer.viewport,
    scene.state.viewport,
    getWaveformViewportSpan(scene.state.viewport),
    scene.state.width,
    scene.state.renderResolution,
  );

  if (!canShiftHorizontalBuffer(scene, viewport)) {
    scene.renderStats = createRenderStats(
      scene.state.visibleRows.visibleRowCount,
      scene.state.visibleRows.culledRowCount,
      scene.state.renderResolution,
    );
    scene.renderStats.panBufferMissCount = 1;
    return false;
  }

  scene.state.viewport = viewport;
  scene.shapeCounts = getWaveformShapeCounts(scene.state.data, viewport);
  scene.digitalPulseFillCount = getWaveformDigitalPulseFillCount(scene.state.data, viewport);
  redrawWaveformSceneRulerIndicator(scene);
  applyHorizontalBufferOffset(scene);
  redrawWaveformSceneCursor(scene);
  scene.renderStats = createRenderStats(
    scene.state.visibleRows.visibleRowCount,
    scene.state.visibleRows.culledRowCount,
    scene.state.renderResolution,
  );
  scene.renderStats.rowReuseCount = scene.state.visibleRows.rows.length;
  scene.renderStats.panBufferHitCount = 1;
  scene.renderStats.panPixelShiftCount = Math.abs(scene.state.horizontalBuffer.offsetX - previousOffsetX);
  accumulateVisibleRowContentMetrics(scene, scene.renderStats);
  return true;
}

function accumulateFrameBatchStaticMetrics(scene: WaveformScene, target: WaveformRenderStats) {
  const gpuMetrics = scene.state.gpuBatchRenderer.getMetrics();

  target.renderedSignalCount = scene.state.visibleRows.rows.filter((row) => row.kind === 'signal').length;
  target.gpuDrawLayerCount = gpuMetrics.drawLayerCount;
  target.gpuLayerCount = gpuMetrics.drawLayerCount;
  target.gpuVertexCount = gpuMetrics.vertexCount;
  target.meshVertexCount = gpuMetrics.vertexCount;
  target.gpuBufferCapacityVertexCount = gpuMetrics.bufferCapacityVertexCount;
  target.glyphAtlasTextureCount = gpuMetrics.glyphAtlasTextureCount;
  target.glyphVertexCount = gpuMetrics.glyphVertexCount;
  target.labelPoolSize = gpuMetrics.labelPoolSize;
}

export function updateWaveformSceneViewport(scene: WaveformScene, viewport: WaveformViewport) {
  const previousViewport = scene.state.viewport;
  scene.state.viewport = viewport;
  scene.state.horizontalBuffer = createHorizontalBufferState(viewport, scene.state.width, scene.state.renderResolution, getHorizontalBufferBounds(getSceneOptions(scene)));
  scene.shapeCounts = getWaveformShapeCounts(scene.state.data, viewport);
  scene.digitalPulseFillCount = getWaveformDigitalPulseFillCount(scene.state.data, viewport);
  redrawWaveformSceneRulerIndicator(scene);
  redrawWaveformSceneGrid(scene);
  redrawWaveformSceneRows(scene, { redrawLanes: false });
  redrawWaveformSceneCursor(scene);
  applyHorizontalBufferOffset(scene);

  if (Math.abs(getWaveformViewportSpan(previousViewport) - getWaveformViewportSpan(viewport)) <= viewportSpanEpsilon) {
    scene.renderStats.panBufferMissCount = 1;
  }
}

function createRenderStats(visibleRowCount: number, culledRowCount: number, renderResolution: number): WaveformRenderStats {
  return {
    visibleRowCount,
    culledRowCount,
    rowAttachCount: 0,
    rowReuseCount: 0,
    rowRecycleCount: 0,
    panBufferHitCount: 0,
    panBufferMissCount: 0,
    panPixelShiftCount: 0,
    gpuBufferUpdateCount: 0,
    gpuBufferUpdateMs: 0,
    gpuBufferCapacityVertexCount: 0,
    gpuBufferReallocCount: 0,
    gpuDrawLayerCount: 0,
    gpuLayerCount: 0,
    gpuVertexCount: 0,
    glyphAtlasTextureCount: 0,
    glyphBufferReallocCount: 0,
    glyphBufferUpdateCount: 0,
    glyphBufferUpdateMs: 0,
    glyphVertexCount: 0,
    labelLayoutCacheHitCount: 0,
    labelLayoutCacheMissCount: 0,
    labelTextureUpdateCount: 0,
    meshBufferUpdateMs: 0,
    meshVertexCount: 0,
    labelPoolSize: 0,
    renderedSignalCount: 0,
    sourceSegmentCount: 0,
    renderedSegmentCount: 0,
    collapsedSegmentCount: 0,
    drawnHorizontalSegmentCount: 0,
    skippedHorizontalSegmentCount: 0,
    drawnTransitionEdgeCount: 0,
    busFullHexagonCount: 0,
    busFoldOnlyCount: 0,
    busSpecialStateHexagonCount: 0,
    busSpecialStateLabelCount: 0,
    busSpecialStateWidthAlignedLabelCount: 0,
    busTruncatedLabelCount: 0,
    busLabelDotReplacementCount: 0,
    busVerticalFallbackCount: 0,
    renderedLabelCount: 0,
    renderResolution,
    suppressedLabelCount: 0,
    fullSceneRebuildCount: 0,
    viewportContentUpdateCount: 0,
    verticalScrollUpdateCount: 0,
    cursorUpdateCount: 0,
    selectionUpdateCount: 0,
    displayViewportUpdateCount: 0,
    displayViewportOnlyUpdateCount: 0,
    droppedFrameCount: 0,
    frameIntervalP95Ms: 0,
    frameParseMs: 0,
    pipeRoundtripMs: 0,
    pixiRenderMs: 0,
    idleViewportCommitCount: 0,
    reactViewportCommitCount: 0,
    sceneUpdateMs: 0,
  };
}

interface DrawSignalResult {
  busFoldOnlyCount: number;
  busFullHexagonCount: number;
  busSpecialStateHexagonCount: number;
  busSpecialStateLabelCount: number;
  busSpecialStateWidthAlignedLabelCount: number;
  busTruncatedLabelCount: number;
  busLabelDotReplacementCount: number;
  busVerticalFallbackCount: number;
  collapsedSegmentCount: number;
  drawnHorizontalSegmentCount: number;
  drawnTransitionEdgeCount: number;
  renderedLabelCount: number;
  skippedHorizontalSegmentCount: number;
  suppressedLabelCount: number;
}

function isFrameViewportPrepared(frame: ParsedWaveformFrame, viewport: WaveformViewport) {
  if (!frame.preparedRange || !frame.time0 || !frame.time1) {
    return false;
  }

  const epsilon = 0.000001;
  return viewport.startTime >= frame.preparedRange.startTime - epsilon && viewport.endTime <= frame.preparedRange.endTime + epsilon;
}

interface SpecialStateLabelResult {
  busLabelDotReplacementCount?: number;
  busTruncatedLabelCount?: number;
  renderedLabelCount: number;
  suppressedLabelCount: number;
}

type WaveformTextFactory = (text: string, fill: number, fontSize: number, x: number, y: number, cacheKey?: string) => Container;

interface WaveformLabelDrawOptions {
  labelCacheKey?: string;
  textFactory?: WaveformTextFactory;
}

function createLayers(): WaveformSceneLayers {
  return {
    background: new Container({ label: 'waveform-layer-background' }),
    content: new Container({ label: 'waveform-layer-content' }),
    status: new Container({ label: 'waveform-layer-status' }),
    operation: new Container({ label: 'waveform-layer-operation' }),
  };
}

function createSceneNodes(): WaveformSceneNodes {
  return {
    backgroundBase: new Container({ label: 'waveform-background-base' }),
    backgroundGrid: new Container({ label: 'waveform-background-grid' }),
    backgroundLanes: new Container({ label: 'waveform-background-lanes' }),
    backgroundLanePool: new Container({ label: 'waveform-background-lane-pool', visible: false }),
    contentBatch: new Container({ label: 'waveform-content-batch' }),
    contentRows: new Container({ label: 'waveform-content-rows' }),
    contentRowPool: new Container({ label: 'waveform-content-row-pool', visible: false }),
    statusCursor: new Container({ label: 'waveform-status-cursor' }),
    statusHeader: new Container({ label: 'waveform-header-overlay' }),
    statusHeaderBackground: new Container({ label: 'waveform-header-background' }),
    statusRulerIndicator: new Container({ label: 'waveform-ruler-scroll-indicator' }),
    operationCursor: new Container({ label: 'waveform-operation-cursor' }),
  };
}

function createRowRegistry(): WaveformSceneRowRegistry {
  return {
    activeRows: new Map<string, WaveformSceneRowNode>(),
    pool: [],
  };
}

function createRowNode(): WaveformSceneRowNode {
  return {
    laneContainer: new Container({ label: 'waveform-row-lane' }),
    contentContainer: new Container({ label: 'waveform-row-content' }),
    contentMetrics: createEmptyRowContentMetrics(),
    rowId: null,
  };
}

function createEmptyRowContentMetrics(): WaveformRowContentMetrics {
  return {
    renderedSignalCount: 0,
    sourceSegmentCount: 0,
    renderedSegmentCount: 0,
    collapsedSegmentCount: 0,
    drawnHorizontalSegmentCount: 0,
    skippedHorizontalSegmentCount: 0,
    drawnTransitionEdgeCount: 0,
    busFullHexagonCount: 0,
    busFoldOnlyCount: 0,
    busSpecialStateHexagonCount: 0,
    busSpecialStateLabelCount: 0,
    busSpecialStateWidthAlignedLabelCount: 0,
    busTruncatedLabelCount: 0,
    busLabelDotReplacementCount: 0,
    busVerticalFallbackCount: 0,
    renderedLabelCount: 0,
    gpuBufferUpdateCount: 0,
    gpuBufferUpdateMs: 0,
    gpuBufferCapacityVertexCount: 0,
    gpuBufferReallocCount: 0,
    gpuDrawLayerCount: 0,
    gpuLayerCount: 0,
    gpuVertexCount: 0,
    glyphAtlasTextureCount: 0,
    glyphBufferReallocCount: 0,
    glyphBufferUpdateCount: 0,
    glyphBufferUpdateMs: 0,
    glyphVertexCount: 0,
    labelLayoutCacheHitCount: 0,
    labelLayoutCacheMissCount: 0,
    labelTextureUpdateCount: 0,
    labelPoolSize: 0,
    suppressedLabelCount: 0,
  };
}

function redrawWaveformSceneBase(scene: WaveformScene) {
  clearContainer(scene.nodes.backgroundBase);

  const base = new Graphics();
  base.rect(0, 0, scene.state.width, scene.state.height).fill({ color: palette.background });
  base.rect(0, 0, scene.state.width, waveformHeaderHeight).fill({ color: palette.header });
  scene.nodes.backgroundBase.addChild(base);
}

function redrawWaveformSceneRulerIndicator(scene: WaveformScene) {
  clearContainer(scene.nodes.statusRulerIndicator);

  const metrics = getWaveformRulerScrollIndicatorMetrics(scene.state.viewport, scene.state.data.duration, scene.state.width);
  const indicator = new Graphics();
  indicator
    .roundRect(metrics.left, 0, metrics.width, metrics.height, metrics.cornerRadius)
    .fill({ color: metrics.color, alpha: 1 });
  scene.nodes.statusRulerIndicator.addChild(indicator);
}

function redrawWaveformSceneHeaderBackground(scene: WaveformScene) {
  clearContainer(scene.nodes.statusHeaderBackground);

  const headerBackground = new Graphics();
  headerBackground
    .rect(0, 0, scene.state.width, waveformHeaderHeight)
    .fill({ color: palette.header, alpha: 1 })
    .moveTo(0, waveformHeaderHeight - 0.5)
    .lineTo(scene.state.width, waveformHeaderHeight - 0.5)
    .stroke({ color: palette.gridStrong, width: 1, alpha: 0.9 });
  scene.nodes.statusHeaderBackground.addChild(headerBackground);
}

function redrawWaveformSceneGrid(scene: WaveformScene) {
  redrawWaveformSceneHeaderBackground(scene);
  clearContainer(scene.nodes.backgroundGrid);
  clearContainer(scene.nodes.statusHeader);
  drawGrid(scene.nodes.backgroundGrid, scene.nodes.statusHeader, getHorizontalBufferSceneOptions(scene));
  applyHorizontalBufferOffset(scene);
}

function redrawWaveformSceneRows(scene: WaveformScene, options: RedrawWaveformSceneRowsOptions = {}) {
  const nextRenderStats = createRenderStats(
    scene.state.visibleRows.visibleRowCount,
    scene.state.visibleRows.culledRowCount,
    scene.state.renderResolution,
  );
  const rowLifecycle = syncVisibleRows(scene);

  nextRenderStats.rowAttachCount = rowLifecycle.rowAttachCount;
  nextRenderStats.rowReuseCount = rowLifecycle.rowReuseCount;
  nextRenderStats.rowRecycleCount = rowLifecycle.rowRecycleCount;

  if (options.redrawLanes ?? true) {
    redrawWaveformSceneLanes(scene);
  }

  if (options.redrawContent ?? true) {
    redrawWaveformSceneContent(scene, nextRenderStats);
  }

  accumulateVisibleRowContentMetrics(scene, nextRenderStats);
  scene.renderStats = nextRenderStats;
}

function redrawWaveformSceneLanes(scene: WaveformScene) {
  const sceneOptions = getSceneOptions(scene);

  scene.state.visibleRows.rows.forEach((row) => {
    const rowNode = scene.rowRegistry.activeRows.get(row.id);

    if (!rowNode) {
      return;
    }

    clearContainer(rowNode.laneContainer);
    drawLanes(rowNode.laneContainer, [row], sceneOptions);
  });
}

function redrawWaveformSceneContent(scene: WaveformScene, renderStats: WaveformRenderStats) {
  const sceneOptions = getHorizontalBufferSceneOptions(scene);

  if (sceneOptions.frame) {
    scene.nodes.contentRows.visible = false;
    scene.nodes.contentBatch.visible = true;
    redrawWaveformSceneFrameBatchContent(scene, sceneOptions, renderStats);
    return;
  }

  scene.nodes.contentRows.visible = true;
  scene.nodes.contentBatch.visible = false;
  scene.state.gpuBatchRenderer.clear();

  scene.state.visibleRows.rows.forEach((row) => {
    const rowNode = scene.rowRegistry.activeRows.get(row.id);

    if (!rowNode || row.kind !== 'signal') {
      return;
    }

    clearContainer(rowNode.contentContainer);
    rowNode.contentMetrics = createEmptyRowContentMetrics();
  });
}

function redrawWaveformSceneFrameBatchContent(scene: WaveformScene, options: WaveformSceneOptions, renderStats: WaveformRenderStats) {
  if (!options.frame) {
    return;
  }

  const batchRenderer = scene.state.gpuBatchRenderer;
  const metrics = createEmptyRowContentMetrics();

  batchRenderer.reset();

  for (const rowNode of scene.rowRegistry.activeRows.values()) {
    rowNode.contentMetrics = createEmptyRowContentMetrics();
  }

  scene.state.visibleRows.rows.forEach((row) => {
    if (row.kind !== 'signal') {
      return;
    }

    const tableEntry = getFrameSignalTableEntry(options.frame!, row.signalIndex);
    if (!tableEntry || tableEntry.segmentCount === 0) {
      return;
    }

    const laneY = getScrolledY(row.y, options);
    const signalResult = row.signal.kind === 'bus'
      ? drawFrameBusWaveformBatch(batchRenderer, row.signal, options, options.frame!, tableEntry.firstSegment, tableEntry.segmentCount, laneY)
      : drawFrameDigitalWaveformBatch(batchRenderer, row.signal, options, options.frame!, tableEntry.firstSegment, tableEntry.segmentCount, laneY);

    metrics.renderedSignalCount += 1;
    metrics.sourceSegmentCount += tableEntry.segmentCount;
    metrics.renderedSegmentCount += tableEntry.segmentCount;
    mergeBatchDrawResult(metrics, signalResult);
  });

  const gpuMetrics = batchRenderer.commit();

  metrics.gpuBufferUpdateCount += gpuMetrics.bufferUpdateCount;
  metrics.gpuBufferUpdateMs += gpuMetrics.bufferUpdateMs;
  metrics.gpuBufferCapacityVertexCount += gpuMetrics.bufferCapacityVertexCount;
  metrics.gpuBufferReallocCount += gpuMetrics.bufferReallocCount;
  metrics.gpuDrawLayerCount += gpuMetrics.drawLayerCount;
  metrics.gpuLayerCount += gpuMetrics.drawLayerCount;
  metrics.gpuVertexCount += gpuMetrics.vertexCount;
  metrics.glyphAtlasTextureCount += gpuMetrics.glyphAtlasTextureCount;
  metrics.glyphBufferReallocCount += gpuMetrics.glyphBufferReallocCount;
  metrics.glyphBufferUpdateCount += gpuMetrics.glyphBufferUpdateCount;
  metrics.glyphBufferUpdateMs += gpuMetrics.glyphBufferUpdateMs;
  metrics.glyphVertexCount += gpuMetrics.glyphVertexCount;
  metrics.labelLayoutCacheHitCount += gpuMetrics.labelLayoutCacheHitCount;
  metrics.labelLayoutCacheMissCount += gpuMetrics.labelLayoutCacheMissCount;
  metrics.labelPoolSize = gpuMetrics.labelPoolSize;
  metrics.labelTextureUpdateCount += gpuMetrics.labelTextureUpdateCount;

  accumulateRowContentMetrics(renderStats, metrics);
  accumulateRowContentUpdateMetrics(renderStats, metrics);
}

function accumulateVisibleRowContentMetrics(scene: WaveformScene, target: WaveformRenderStats) {
  scene.state.visibleRows.rows.forEach((row) => {
    if (row.kind !== 'signal') {
      return;
    }

    const rowNode = scene.rowRegistry.activeRows.get(row.id);

    if (!rowNode) {
      return;
    }

    accumulateRowContentMetrics(target, rowNode.contentMetrics);
  });
}

function accumulateRowContentMetrics(target: WaveformRenderStats, source: WaveformRowContentMetrics) {
  target.renderedSignalCount += source.renderedSignalCount;
  target.sourceSegmentCount += source.sourceSegmentCount;
  target.renderedSegmentCount += source.renderedSegmentCount;
  target.gpuDrawLayerCount += source.gpuDrawLayerCount;
  target.gpuLayerCount += source.gpuLayerCount;
  target.gpuVertexCount += source.gpuVertexCount;
  target.gpuBufferCapacityVertexCount += source.gpuBufferCapacityVertexCount;
  target.glyphAtlasTextureCount += source.glyphAtlasTextureCount;
  target.glyphBufferReallocCount += source.glyphBufferReallocCount;
  target.glyphBufferUpdateCount += source.glyphBufferUpdateCount;
  target.glyphBufferUpdateMs += source.glyphBufferUpdateMs;
  target.glyphVertexCount += source.glyphVertexCount;
  target.meshVertexCount = target.gpuVertexCount;
  target.labelLayoutCacheHitCount += source.labelLayoutCacheHitCount;
  target.labelLayoutCacheMissCount += source.labelLayoutCacheMissCount;
  target.collapsedSegmentCount += source.collapsedSegmentCount;
  target.drawnHorizontalSegmentCount += source.drawnHorizontalSegmentCount;
  target.skippedHorizontalSegmentCount += source.skippedHorizontalSegmentCount;
  target.drawnTransitionEdgeCount += source.drawnTransitionEdgeCount;
  target.busFullHexagonCount += source.busFullHexagonCount;
  target.busFoldOnlyCount += source.busFoldOnlyCount;
  target.busSpecialStateHexagonCount += source.busSpecialStateHexagonCount;
  target.busSpecialStateLabelCount += source.busSpecialStateLabelCount;
  target.busSpecialStateWidthAlignedLabelCount += source.busSpecialStateWidthAlignedLabelCount;
  target.busTruncatedLabelCount += source.busTruncatedLabelCount;
  target.busLabelDotReplacementCount += source.busLabelDotReplacementCount;
  target.busVerticalFallbackCount += source.busVerticalFallbackCount;
  target.renderedLabelCount += source.renderedLabelCount;
  target.labelPoolSize += source.labelPoolSize;
  target.labelLayoutCacheHitCount += source.labelLayoutCacheHitCount;
  target.labelLayoutCacheMissCount += source.labelLayoutCacheMissCount;
  target.labelTextureUpdateCount += source.labelTextureUpdateCount;
  target.suppressedLabelCount += source.suppressedLabelCount;
}

function accumulateRowContentUpdateMetrics(target: WaveformRenderStats, source: WaveformRowContentMetrics) {
  target.gpuBufferUpdateCount += source.gpuBufferUpdateCount;
  target.gpuBufferUpdateMs += source.gpuBufferUpdateMs;
  target.gpuBufferReallocCount += source.gpuBufferReallocCount;
  target.labelLayoutCacheHitCount += source.labelLayoutCacheHitCount;
  target.labelLayoutCacheMissCount += source.labelLayoutCacheMissCount;
  target.labelTextureUpdateCount += source.labelTextureUpdateCount;
  target.meshBufferUpdateMs = target.gpuBufferUpdateMs;
}

function mergeBatchDrawResult(target: WaveformRowContentMetrics, source: DrawSignalResult) {
  target.renderedLabelCount += source.renderedLabelCount;
  target.suppressedLabelCount += source.suppressedLabelCount;
  target.collapsedSegmentCount += source.collapsedSegmentCount;
  target.drawnHorizontalSegmentCount += source.drawnHorizontalSegmentCount;
  target.skippedHorizontalSegmentCount += source.skippedHorizontalSegmentCount;
  target.drawnTransitionEdgeCount += source.drawnTransitionEdgeCount;
  target.busFullHexagonCount += source.busFullHexagonCount;
  target.busFoldOnlyCount += source.busFoldOnlyCount;
  target.busSpecialStateHexagonCount += source.busSpecialStateHexagonCount;
  target.busSpecialStateLabelCount += source.busSpecialStateLabelCount;
  target.busSpecialStateWidthAlignedLabelCount += source.busSpecialStateWidthAlignedLabelCount;
  target.busTruncatedLabelCount += source.busTruncatedLabelCount;
  target.busLabelDotReplacementCount += source.busLabelDotReplacementCount;
  target.busVerticalFallbackCount += source.busVerticalFallbackCount;
}

function redrawWaveformSceneCursor(scene: WaveformScene) {
  clearContainer(scene.nodes.statusCursor);
  clearContainer(scene.nodes.operationCursor);
  drawCursor(scene.nodes.statusCursor, scene.nodes.operationCursor, getSceneOptions(scene));
}

function getSceneOptions(scene: WaveformScene): WaveformSceneOptions {
  return {
    cursorTime: scene.state.cursorTime,
    data: scene.state.data,
    frame: scene.state.frame,
    height: scene.state.height,
    renderResolution: scene.state.renderResolution,
    selectedSignalId: scene.state.selectedSignalId,
    verticalScrollTop: scene.state.verticalScrollTop,
    viewport: scene.state.viewport,
    width: scene.state.width,
  };
}

function getHorizontalBufferSceneOptions(scene: WaveformScene): WaveformSceneOptions {
  return {
    ...getSceneOptions(scene),
    viewport: scene.state.horizontalBuffer.viewport,
    width: scene.state.horizontalBuffer.width,
  };
}

function createHorizontalBufferState(
  viewport: WaveformViewport,
  width: number,
  renderResolution: number,
  bounds: WaveformViewport,
): WaveformHorizontalBufferState {
  const safeWidth = Math.max(1, width);
  const span = getWaveformViewportSpan(viewport);
  const usableWidth = getWaveformUsableWidth(safeWidth);
  const bufferPixels = Math.min(waveformHorizontalBufferMaxPixels, Math.max(waveformHorizontalBufferMinPixels, Math.round(safeWidth * 0.5)));
  const pxPerTime = usableWidth / Math.max(1, span);
  const leftBufferPixels = Math.min(bufferPixels, Math.max(0, (viewport.startTime - bounds.startTime) * pxPerTime));
  const rightBufferPixels = Math.min(bufferPixels, Math.max(0, (bounds.endTime - viewport.endTime) * pxPerTime));
  const leftBufferTime = leftBufferPixels / Math.max(1, pxPerTime);
  const rightBufferTime = rightBufferPixels / Math.max(1, pxPerTime);
  const bufferViewport = {
    startTime: viewport.startTime - leftBufferTime,
    endTime: viewport.endTime + rightBufferTime,
  };
  const bufferWidth = safeWidth + leftBufferPixels + rightBufferPixels;
  const offsetX = getHorizontalBufferOffset(bufferViewport, viewport, span, safeWidth, renderResolution);

  return {
    bufferPixels,
    offsetX,
    viewport: bufferViewport,
    width: bufferWidth,
  };
}

function getHorizontalBufferBounds(options: WaveformSceneOptions): WaveformViewport {
  if (options.frame?.preparedRange) {
    return {
      startTime: options.frame.preparedRange.startTime,
      endTime: options.frame.preparedRange.endTime,
    };
  }

  return {
    startTime: 0,
    endTime: Math.max(getWaveformViewportSpan(options.viewport), options.data.duration),
  };
}

function canShiftHorizontalBuffer(scene: WaveformScene, viewport: WaveformViewport) {
  const currentSpan = getWaveformViewportSpan(scene.state.viewport);
  const nextSpan = getWaveformViewportSpan(viewport);

  return Math.abs(currentSpan - nextSpan) <= viewportSpanEpsilon
    && viewport.startTime >= scene.state.horizontalBuffer.viewport.startTime
    && viewport.endTime <= scene.state.horizontalBuffer.viewport.endTime;
}

function applyHorizontalBufferOffset(scene: WaveformScene) {
  const offsetX = getHorizontalBufferOffset(
    scene.state.horizontalBuffer.viewport,
    scene.state.viewport,
    getWaveformViewportSpan(scene.state.viewport),
    scene.state.width,
    scene.state.renderResolution,
  );

  scene.state.horizontalBuffer.offsetX = offsetX;
  scene.nodes.backgroundGrid.x = offsetX;
  scene.nodes.contentBatch.x = offsetX;
  scene.nodes.contentRows.x = offsetX;
  scene.nodes.statusHeader.x = offsetX;
}

function getHorizontalBufferOffset(bufferViewport: WaveformViewport, viewport: WaveformViewport, span: number, width: number, renderResolution: number) {
  const pxPerTime = getWaveformUsableWidth(width) / Math.max(1, span);

  return snapToDevicePixel((bufferViewport.startTime - viewport.startTime) * pxPerTime, renderResolution);
}

function getWaveformUsableWidth(width: number) {
  return Math.max(1, width - waveformTimeAxisInset * 2);
}

function clearContainer(container: Container) {
  const removedChildren = container.removeChildren();

  for (const child of removedChildren) {
    child.destroy({ children: true });
  }
}

function syncVisibleRows(scene: WaveformScene): WaveformRowLifecycleStats {
  const nextVisibleIds = new Set(scene.state.visibleRows.rows.map((row) => row.id));
  const lifecycle: WaveformRowLifecycleStats = {
    rowAttachCount: 0,
    rowReuseCount: 0,
    rowRecycleCount: 0,
  };

  for (const [rowId, rowNode] of scene.rowRegistry.activeRows) {
    if (nextVisibleIds.has(rowId)) {
      continue;
    }

    recycleRowNode(scene, rowNode);
    scene.rowRegistry.activeRows.delete(rowId);
    lifecycle.rowRecycleCount += 1;
  }

  let laneIndex = 0;
  let contentIndex = 0;

  scene.state.visibleRows.rows.forEach((row) => {
    const existingNode = scene.rowRegistry.activeRows.get(row.id);
    const rowNode = existingNode ?? acquireRowNode(scene);

    if (existingNode) {
      lifecycle.rowReuseCount += 1;
    } else {
      lifecycle.rowAttachCount += 1;
      scene.rowRegistry.activeRows.set(row.id, rowNode);
    }

    bindRowNode(rowNode, row);
    attachContainer(rowNode.laneContainer, scene.nodes.backgroundLanes, laneIndex);
    laneIndex += 1;

    if (row.kind === 'signal') {
      attachContainer(rowNode.contentContainer, scene.nodes.contentRows, contentIndex);
      contentIndex += 1;
    } else {
      attachContainer(rowNode.contentContainer, scene.nodes.contentRowPool);
    }
  });

  return lifecycle;
}

function acquireRowNode(scene: WaveformScene) {
  return scene.rowRegistry.pool.pop() ?? createRowNode();
}

function recycleRowNode(scene: WaveformScene, rowNode: WaveformSceneRowNode) {
  attachContainer(rowNode.laneContainer, scene.nodes.backgroundLanePool);
  attachContainer(rowNode.contentContainer, scene.nodes.contentRowPool);
  rowNode.contentMetrics = createEmptyRowContentMetrics();
  rowNode.rowId = null;
  scene.rowRegistry.pool.push(rowNode);
}

function bindRowNode(rowNode: WaveformSceneRowNode, row: WaveformDisplayRow) {
  if (rowNode.rowId !== row.id) {
    rowNode.contentMetrics = createEmptyRowContentMetrics();
  }

  rowNode.rowId = row.id;
  rowNode.laneContainer.label = `waveform-row-lane-${row.id}`;
  rowNode.contentContainer.label = `waveform-row-content-${row.id}`;
}

function attachContainer(container: Container, parent: Container, index?: number) {
  if (container.parent !== parent) {
    parent.addChild(container);
  }

  if (typeof index !== 'number') {
    return;
  }

  const boundedIndex = Math.min(index, Math.max(0, parent.children.length - 1));

  if (parent.getChildIndex(container) !== boundedIndex) {
    parent.setChildIndex(container, boundedIndex);
  }
}

function drawLanes(target: Container, rows: ReturnType<typeof getWaveformDisplayRows>, options: WaveformSceneOptions) {
  const lanes = new Graphics();

  rows.forEach((row) => {
    const isGroup = row.kind === 'group';
    const y = getScrolledY(row.y, options);
    const isSelected = row.kind === 'signal' && row.signal.id === options.selectedSignalId;

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

  for (const tick of ticks) {
    const x = Math.round(timeToX(tick, options.viewport, options.width)) + 0.5;
    const labelText = `${tick}${options.data.timescaleUnit}`;

    grid
      .moveTo(x, waveformHeaderHeight)
      .lineTo(x, options.height)
      .stroke({ color: tick === 0 ? palette.gridStrong : palette.grid, width: 1, alpha: tick === 0 ? 0.72 : 0.42 });

    header
      .moveTo(x, 0)
      .lineTo(x, waveformHeaderHeight)
      .stroke({ color: tick === 0 ? palette.gridStrong : palette.grid, width: 1, alpha: tick === 0 ? 0.72 : 0.42 });

    const label = createText(labelText, palette.text, 10, x + 4, 6);
    labels.addChild(label);
  }

  headerOverlay.addChild(header, labels);
  target.addChild(grid);
  headerTarget.addChild(headerOverlay);
}

function drawFrameDigitalWaveformBatch(
  batchRenderer: WaveformGpuBatchRenderer,
  signal: WaveformSignal,
  options: WaveformSceneOptions,
  frame: ParsedWaveformFrame,
  firstSegment: number,
  segmentCount: number,
  laneY: number,
): DrawSignalResult {
  const labelCounts = createDrawSignalResult();
  const renderResolution = getRenderResolution(options);
  const signalColor = parseHexColor(signal.color);
  const topY = laneY + waveformLanePaddingY + 2;
  const bottomY = laneY + waveformLaneHeight - waveformLanePaddingY - 2;
  const midY = laneY + waveformLaneHeight / 2;
  const segmentStrokeWidth = getWaveformDigitalSegmentStrokeWidth(signal.kind);
  const specialStateBounds = getWaveformDigitalSpecialStateBounds(laneY);
  const end = Math.min(frame.segmentCount, firstSegment + segmentCount);
  const segmentBounds = createFrameSegmentPixelBounds();
  const nextSegment = createFrameSegmentValueBounds();

  for (let index = firstSegment; index < end; index += 1) {
    if (!readFrameSegmentPixelBounds(frame, index, options, segmentBounds)) {
      continue;
    }
    const hasNextSegment = readNextFrameSegmentPixelBounds(frame, index + 1, end, options, nextSegment);
    const valueKind = frame.valueKind[index] ?? WaveformBinaryValueKind.Unknown;
    const currentValue = normalizeWaveformValue(getFrameSegmentValue(frame, index, valueKind));
    const nextValue = hasNextSegment ? normalizeWaveformValue(nextSegment.value) : currentValue;
    const hasUnknown = valueKind === WaveformBinaryValueKind.Unknown;
    const hasHighImpedance = valueKind === WaveformBinaryValueKind.HighImpedance;
    const isVisible = isSegmentBoundsHorizontallyVisible(segmentBounds.x1, segmentBounds.x2, renderResolution);

    if (!isVisible) {
      labelCounts.skippedHorizontalSegmentCount += 1;
      labelCounts.collapsedSegmentCount += 1;
      continue;
    }

    labelCounts.drawnHorizontalSegmentCount += 1;

    if (hasUnknown || isUnknownWaveformValue(currentValue)) {
      drawBatchSpecialStateBlock(batchRenderer, segmentBounds.x1, specialStateBounds.y, segmentBounds.width, specialStateBounds.height, {
        color: palette.unknown,
        fillAlpha: 0.22,
        pattern: 'backslash',
        strokeAlpha: 0.86,
        strokeWidth: segmentStrokeWidth,
      });
      mergeDrawSignalResult(labelCounts, addSpecialStateCharacters([], 'x', palette.unknown, segmentBounds.x1, specialStateBounds.y, segmentBounds.width, specialStateBounds.height, shouldShowSpecialStateTextForWidth(segmentBounds.width), {
        labelCacheKey: getWaveformSegmentLabelCacheKey(signal.id, index, 'x'),
        textFactory: (text, fill, fontSize, x, y, cacheKey) => batchRenderer.acquireLabel(text, fill, fontSize, x, y, cacheKey),
      }));
      continue;
    }

    if (hasHighImpedance || isHighImpedanceWaveformValue(currentValue)) {
      drawBatchSpecialStateBlock(batchRenderer, segmentBounds.x1, specialStateBounds.y, segmentBounds.width, specialStateBounds.height, {
        color: palette.highImpedance,
        fillAlpha: 0.18,
        pattern: 'chevron',
        strokeAlpha: 0.88,
        strokeWidth: segmentStrokeWidth,
      });
      mergeDrawSignalResult(labelCounts, addSpecialStateCharacters([], 'z', palette.highImpedance, segmentBounds.x1, specialStateBounds.y, segmentBounds.width, specialStateBounds.height, shouldShowSpecialStateTextForWidth(segmentBounds.width), {
        labelCacheKey: getWaveformSegmentLabelCacheKey(signal.id, index, 'z'),
        textFactory: (text, fill, fontSize, x, y, cacheKey) => batchRenderer.acquireLabel(text, fill, fontSize, x, y, cacheKey),
      }));
      continue;
    }

    const isHigh = currentValue === '1';
    const y = isHigh ? topY : bottomY;

    if (isHigh) {
      batchRenderer.addRect('pulseFill', segmentBounds.x1, topY, segmentBounds.width, Math.max(1, bottomY - topY), signalColor, signal.kind === 'clock' ? 0.12 : 0.18);
    }

    batchRenderer.addLine('digitalStroke', segmentBounds.x1, y, segmentBounds.x2, y, segmentStrokeWidth, signalColor, 0.96);

    if (hasNextSegment && nextValue !== currentValue && !isSpecialWaveformValue(nextValue)) {
      const nextY = nextValue === '1' ? topY : bottomY;
      batchRenderer.addLine('digitalStroke', segmentBounds.x2, y, segmentBounds.x2, nextY, 1.7, signalColor, 0.9);
      labelCounts.drawnTransitionEdgeCount += 1;
    }
  }

  batchRenderer.addLine('midline', waveformTimeAxisInset, midY, options.width - waveformTimeAxisInset, midY, 1, 0xffffff, 0.04);

  return labelCounts;
}

function drawFrameBusWaveformBatch(
  batchRenderer: WaveformGpuBatchRenderer,
  signal: WaveformSignal,
  options: WaveformSceneOptions,
  frame: ParsedWaveformFrame,
  firstSegment: number,
  segmentCount: number,
  laneY: number,
): DrawSignalResult {
  const labelCounts = createDrawSignalResult();
  const renderResolution = getRenderResolution(options);
  const busColor = parseHexColor(signal.color);
  const y = laneY + waveformLanePaddingY;
  const height = waveformLaneHeight - waveformLanePaddingY * 2;
  const end = Math.min(frame.segmentCount, firstSegment + segmentCount);
  const segmentBounds = createFrameSegmentPixelBounds();

  for (let index = firstSegment; index < end; index += 1) {
    if (!readFrameSegmentPixelBounds(frame, index, options, segmentBounds)) {
      continue;
    }
    const valueKind = frame.valueKind[index] ?? WaveformBinaryValueKind.Unknown;
    const currentValue = normalizeWaveformValue(getFrameSegmentValue(frame, index, valueKind));
    const hasUnknown = valueKind === WaveformBinaryValueKind.Unknown;
    const hasHighImpedance = valueKind === WaveformBinaryValueKind.HighImpedance;
    const segmentShape = getBusSegmentShapeForBounds(segmentBounds.x1, segmentBounds.x2, segmentBounds.width, height, renderResolution);

    if (hasUnknown || isUnknownWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawBatchBusSpecialStateSegment(batchRenderer, signal, segmentBounds.x1, segmentBounds.width, segmentShape, y, height, {
        color: palette.unknown,
        fillAlpha: 0.22,
        labelCacheKey: getWaveformSegmentLabelCacheKey(signal.id, index, 'x'),
        labelColor: palette.unknown,
        state: 'x',
        strokeAlpha: 0.86,
        strokeWidth: 1,
      }));
    } else if (hasHighImpedance || isHighImpedanceWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawBatchBusSpecialStateSegment(batchRenderer, signal, segmentBounds.x1, segmentBounds.width, segmentShape, y, height, {
        color: palette.highImpedance,
        fillAlpha: 0.18,
        labelCacheKey: getWaveformSegmentLabelCacheKey(signal.id, index, 'z'),
        labelColor: palette.highImpedance,
        state: 'z',
        strokeAlpha: 0.88,
        strokeWidth: 1,
      }));
    } else if (segmentShape.kind === 'full') {
      drawBatchElongatedHexagon(batchRenderer, segmentBounds.x1, y, segmentBounds.width, height, busColor);
      labelCounts.busFullHexagonCount += 1;
      labelCounts.drawnHorizontalSegmentCount += 1;
    } else if (segmentShape.kind === 'fold') {
      drawBatchBusFoldOnly(batchRenderer, segmentShape.x, y, segmentShape.foldProjection, height, busColor);
      labelCounts.collapsedSegmentCount += 1;
      labelCounts.busFoldOnlyCount += 1;
      labelCounts.skippedHorizontalSegmentCount += 1;
    } else {
      batchRenderer.addLine('busOutline', segmentShape.x, y, segmentShape.x, y + height, busWaveformStyle.strokeWidth, busColor, busWaveformStyle.strokeAlpha);
      labelCounts.collapsedSegmentCount += 1;
      labelCounts.busVerticalFallbackCount += 1;
      labelCounts.skippedHorizontalSegmentCount += 1;
    }

    if (segmentShape.kind === 'full' && !hasUnknown && !hasHighImpedance && !isSpecialWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, addBusLabel([], formatWaveformValue(currentValue), palette.text, segmentBounds.x1, y, segmentBounds.width, height, {
        labelCacheKey: getWaveformSegmentLabelCacheKey(signal.id, index, 'value'),
        textFactory: (text, fill, fontSize, x, textY, cacheKey) => batchRenderer.acquireLabel(text, fill, fontSize, x, textY, cacheKey),
      }));
    }
  }

  return labelCounts;
}

interface FrameSegmentPixelBounds {
  x1: number;
  x2: number;
  width: number;
}

interface FrameSegmentValueBounds extends FrameSegmentPixelBounds {
  value: string;
}

function createFrameSegmentPixelBounds(): FrameSegmentPixelBounds {
  return {
    x1: 0,
    x2: 0,
    width: 0,
  };
}

function createFrameSegmentValueBounds(): FrameSegmentValueBounds {
  return {
    ...createFrameSegmentPixelBounds(),
    value: '',
  };
}

function readFrameSegmentPixelBounds(frame: ParsedWaveformFrame, segmentIndex: number, options: WaveformSceneOptions, target: FrameSegmentPixelBounds) {
  let x1 = frame.x0[segmentIndex] ?? 0;
  let x2 = frame.x1[segmentIndex] ?? x1;

  if (frame.time0 && frame.time1) {
    const startTime = frame.time0[segmentIndex] ?? 0;
    const endTime = frame.time1[segmentIndex] ?? startTime;

    if (endTime < options.viewport.startTime || startTime > options.viewport.endTime) {
      return false;
    }

    x1 = timeToX(startTime, options.viewport, options.width);
    x2 = timeToX(endTime, options.viewport, options.width);
  }

  target.x1 = x1;
  target.x2 = x2;
  target.width = Math.max(1, x2 - x1);
  return true;
}

function readNextFrameSegmentPixelBounds(frame: ParsedWaveformFrame, startIndex: number, endIndex: number, options: WaveformSceneOptions, target: FrameSegmentValueBounds) {
  for (let index = startIndex; index < endIndex; index += 1) {
    if (!readFrameSegmentPixelBounds(frame, index, options, target)) {
      continue;
    }

    const valueKind = frame.valueKind[index] ?? WaveformBinaryValueKind.Unknown;
    target.value = getFrameSegmentValue(frame, index, valueKind);
    return true;
  }

  return false;
}

function getFrameSegmentValue(frame: ParsedWaveformFrame, segmentIndex: number, valueKind: number) {
  if (valueKind === WaveformBinaryValueKind.Low) {
    return '0';
  }

  if (valueKind === WaveformBinaryValueKind.High) {
    return '1';
  }

  if (valueKind === WaveformBinaryValueKind.Unknown) {
    return 'x';
  }

  if (valueKind === WaveformBinaryValueKind.HighImpedance) {
    return 'z';
  }

  return normalizeWaveformValue(frame.getLabel(segmentIndex) ?? '0');
}

interface FrameSignalTableEntry {
  firstSegment: number;
  segmentCount: number;
}

function getFrameSignalTableEntry(frame: ParsedWaveformFrame, signalIndex: number): FrameSignalTableEntry | null {
  for (let tableEntryIndex = 0; tableEntryIndex < frame.signalCount; tableEntryIndex += 1) {
    const tableIndex = tableEntryIndex * 4;
    if (frame.signalTable[tableIndex] !== signalIndex) {
      continue;
    }

    const firstSegment = frame.signalTable[tableIndex + 1];
    const segmentCount = frame.signalTable[tableIndex + 2];

    if (firstSegment === undefined || segmentCount === undefined) {
      return null;
    }

    return {
      firstSegment,
      segmentCount,
    };
  }

  return null;
}

export function getWaveformDigitalSegmentStrokeWidth(signalKind: WaveformSignal['kind']) {
  return signalKind === 'clock' ? 1.7 : 2;
}

export function getWaveformDigitalSpecialStateBounds(laneY: number) {
  const y = laneY + waveformLanePaddingY + 2;
  const bottom = laneY + waveformLaneHeight - waveformLanePaddingY - 2;
  return {
    height: bottom - y,
    y,
  };
}

const busWaveformStyle = {
  fillAlpha: 0.16,
  strokeAlpha: 0.84,
  strokeWidth: 1.2,
} as const;

interface BusSpecialStateStyle {
  color: number;
  fillAlpha: number;
  labelCacheKey?: string;
  labelColor: number;
  state: 'x' | 'z';
  strokeAlpha: number;
  strokeWidth: number;
  textFactory?: WaveformTextFactory;
}

interface BusSpecialStateLabelResult extends SpecialStateLabelResult {
  widthAlignedLabelCount: number;
}

function addBusSpecialStateLabel(labels: Container[], signal: WaveformSignal, state: 'x' | 'z', labelColor: number, x: number, y: number, width: number, height: number, options: WaveformLabelDrawOptions = {}): BusSpecialStateLabelResult {
  const hexDigitWidth = getWaveformBusSpecialStateHexDigitWidth(signal.width);
  const labelText = getWaveformBusSpecialStateLabelText(signal.width, state);
  const result = addBusLabel(labels, labelText, labelColor, x, y, width, height, options);

  return {
    ...result,
    widthAlignedLabelCount: result.renderedLabelCount > 0 && labelText.length === hexDigitWidth ? 1 : 0,
  };
}

export function getWaveformBusSpecialStateHexDigitWidth(signalWidth: number | undefined) {
  const bitWidth = Number.isFinite(signalWidth) ? Math.floor(signalWidth ?? 1) : 1;
  return Math.max(1, Math.ceil(bitWidth / 4));
}

export function getWaveformBusSpecialStateLabelText(signalWidth: number | undefined, state: 'x' | 'z') {
  return state.repeat(getWaveformBusSpecialStateHexDigitWidth(signalWidth));
}

interface SpecialStateBlockStyle {
  color: number;
  fillAlpha: number;
  pattern: 'backslash' | 'chevron';
  strokeAlpha: number;
  strokeWidth: number;
}

interface WaveformPoint {
  x: number;
  y: number;
}

function getElongatedHexagonPoints(x: number, y: number, width: number, height: number): WaveformPoint[] {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const bevel = getElongatedHexagonBevel(safeWidth, safeHeight);
  const centerY = y + safeHeight / 2;

  return [
    { x: x + bevel, y },
    { x: x + safeWidth - bevel, y },
    { x: x + safeWidth, y: centerY },
    { x: x + safeWidth - bevel, y: y + safeHeight },
    { x: x + bevel, y: y + safeHeight },
    { x, y: centerY },
  ];
}

function getBusFoldOnlyPoints(x: number, y: number, foldProjection: number, height: number): WaveformPoint[] {
  const safeHeight = Math.max(1, height);
  const safeProjection = Math.max(0, foldProjection);
  const centerX = x + safeProjection;
  const centerY = y + safeHeight / 2;

  return [
    { x: centerX, y },
    { x: centerX + safeProjection, y: centerY },
    { x: centerX, y: y + safeHeight },
    { x: centerX - safeProjection, y: centerY },
  ];
}

function drawBatchElongatedHexagon(batchRenderer: WaveformGpuBatchRenderer, x: number, y: number, width: number, height: number, color: number) {
  const points = getElongatedHexagonPoints(x, y, width, height);
  batchRenderer.addPolygon('busFill', points, color, busWaveformStyle.fillAlpha);
  addBatchPolyline(batchRenderer, 'busOutline', points, busWaveformStyle.strokeWidth, true, color, busWaveformStyle.strokeAlpha);
}

function drawBatchBusFoldOnly(batchRenderer: WaveformGpuBatchRenderer, x: number, y: number, foldProjection: number, height: number, color: number) {
  const points = getBusFoldOnlyPoints(x, y, foldProjection, height);
  batchRenderer.addPolygon('busFill', [
    points[0] ?? { x, y },
    points[1] ?? { x, y },
    points[2] ?? { x, y },
    points[3] ?? { x, y },
  ], color, busWaveformStyle.fillAlpha);
  addBatchPolyline(batchRenderer, 'busOutline', points, busWaveformStyle.strokeWidth, true, color, busWaveformStyle.strokeAlpha);
}

function drawBatchBusSpecialStateSegment(
  batchRenderer: WaveformGpuBatchRenderer,
  signal: WaveformSignal,
  x: number,
  width: number,
  segmentShape: BusSegmentShape,
  y: number,
  height: number,
  style: BusSpecialStateStyle,
): DrawSignalResult {
  const result = createDrawSignalResult();

  if (segmentShape.kind === 'full') {
    const points = getElongatedHexagonPoints(x, y, width, height);
    batchRenderer.addPolygon('specialFill', points, style.color, style.fillAlpha);
    addBatchPolyline(batchRenderer, 'specialOutline', points, style.strokeWidth, true, style.color, style.strokeAlpha);
    result.busFullHexagonCount += 1;
    result.busSpecialStateHexagonCount += 1;
    result.drawnHorizontalSegmentCount += 1;

    const labelResult = addBusSpecialStateLabel([], signal, style.state, style.labelColor, x, y, width, height, {
      labelCacheKey: style.labelCacheKey,
      textFactory: (text, fill, fontSize, x, textY, cacheKey) => batchRenderer.acquireLabel(text, fill, fontSize, x, textY, cacheKey),
    });
    result.renderedLabelCount += labelResult.renderedLabelCount;
    result.suppressedLabelCount += labelResult.suppressedLabelCount;
    result.busSpecialStateLabelCount += labelResult.renderedLabelCount;
    result.busSpecialStateWidthAlignedLabelCount += labelResult.widthAlignedLabelCount;
    result.busTruncatedLabelCount += labelResult.busTruncatedLabelCount ?? 0;
    result.busLabelDotReplacementCount += labelResult.busLabelDotReplacementCount ?? 0;
    return result;
  }

  if (segmentShape.kind === 'fold') {
    const points = getBusFoldOnlyPoints(segmentShape.x, y, segmentShape.foldProjection, height);
    batchRenderer.addPolygon('specialFill', [
      points[0] ?? { x: segmentShape.x, y },
      points[1] ?? { x: segmentShape.x, y },
      points[2] ?? { x: segmentShape.x, y },
      points[3] ?? { x: segmentShape.x, y },
    ], style.color, style.fillAlpha);
    addBatchPolyline(batchRenderer, 'specialOutline', points, style.strokeWidth, true, style.color, style.strokeAlpha);
    result.collapsedSegmentCount += 1;
    result.busFoldOnlyCount += 1;
    result.skippedHorizontalSegmentCount += 1;
    return result;
  }

  batchRenderer.addLine('specialOutline', segmentShape.x, y, segmentShape.x, y + height, style.strokeWidth, style.color, style.strokeAlpha);
  result.collapsedSegmentCount += 1;
  result.busVerticalFallbackCount += 1;
  result.skippedHorizontalSegmentCount += 1;
  return result;
}

function drawBatchSpecialStateBlock(
  batchRenderer: WaveformGpuBatchRenderer,
  x: number,
  y: number,
  width: number,
  height: number,
  style: Pick<SpecialStateBlockStyle, 'color' | 'fillAlpha' | 'pattern' | 'strokeAlpha' | 'strokeWidth'>,
) {
  const radius = Math.min(2, Math.max(0, width / 2), Math.max(0, height / 2));
  const points = getRoundedRectPolygonPoints(x, y, width, height, radius);
  batchRenderer.addPolygon('specialFill', points, style.color, style.fillAlpha);
  addBatchPolyline(batchRenderer, 'specialOutline', points, style.strokeWidth, true, style.color, style.strokeAlpha);

  if (style.pattern === 'chevron') {
    addBatchChevronHatch(batchRenderer, x, y, width, height, style.color);
  } else {
    addBatchBackslashHatch(batchRenderer, x, y, width, height, style.color);
  }
}

function addBatchPolyline(
  batchRenderer: WaveformGpuBatchRenderer,
  layer: WaveformGpuBatchLayerKind,
  points: readonly WaveformPoint[],
  width: number,
  closed: boolean,
  color: number,
  alpha: number,
) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];

    if (!current || !next) {
      continue;
    }

    batchRenderer.addLine(layer, current.x, current.y, next.x, next.y, width, color, alpha);
  }

  if (closed && points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];

    if (first && last) {
      batchRenderer.addLine(layer, last.x, last.y, first.x, first.y, width, color, alpha);
    }
  }
}

function addBatchBackslashHatch(batchRenderer: WaveformGpuBatchRenderer, x: number, y: number, width: number, height: number, color: number) {
  const left = x + 1;
  const right = x + width - 1;
  const bottom = y + height - 1;

  for (let start = x - height; start < x + width; start += waveformUnknownStripeSpacing) {
    const segmentStartX = Math.max(left, start);
    const segmentEndX = Math.min(right, start + height);

    if (segmentEndX <= segmentStartX) {
      continue;
    }

    batchRenderer.addLine(
      'hatch',
      segmentStartX,
      y + segmentStartX - start + 1,
      segmentEndX,
      Math.min(bottom, y + segmentEndX - start + 1),
      1,
      color,
      0.54,
    );
  }
}

function addBatchChevronHatch(batchRenderer: WaveformGpuBatchRenderer, x: number, y: number, width: number, height: number, color: number) {
  const top = y + 2;
  const bottom = y + height - 2;
  const centerY = y + height / 2;
  const left = x + 1;
  const right = x + width - 2;

  for (let start = x + 2; start < right; start += waveformHighImpedanceStripeSpacing) {
    const tipX = start + 5;

    if (tipX <= start + 1 || start >= right) {
      continue;
    }

    addBatchClippedLine(batchRenderer, start, top, tipX, centerY, { left, right, top, bottom }, color, 0.62);
    addBatchClippedLine(batchRenderer, tipX, centerY, start, bottom, { left, right, top, bottom }, color, 0.62);
  }
}

function addBatchClippedLine(batchRenderer: WaveformGpuBatchRenderer, x1: number, y1: number, x2: number, y2: number, bounds: WaveformClipBounds, color: number, alpha: number) {
  const clipped = clipWaveformLineToBounds(x1, y1, x2, y2, bounds);

  if (!clipped) {
    return;
  }

  batchRenderer.addLine('hatch', clipped.x1, clipped.y1, clipped.x2, clipped.y2, 1, color, alpha);
}

function getRoundedRectPolygonPoints(x: number, y: number, width: number, height: number, radius: number): WaveformPoint[] {
  const right = x + width;
  const bottom = y + height;

  if (radius <= 0) {
    return [
      { x, y },
      { x: right, y },
      { x: right, y: bottom },
      { x, y: bottom },
    ];
  }

  return [
    { x: x + radius, y },
    { x: right - radius, y },
    { x: right, y: y + radius },
    { x: right, y: bottom - radius },
    { x: right - radius, y: bottom },
    { x: x + radius, y: bottom },
    { x, y: bottom - radius },
    { x, y: y + radius },
  ];
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

export interface WaveformBusLabelBounds {
  left: number;
  right: number;
  width: number;
}

export interface WaveformFittedBusLabelText {
  fits: boolean;
  replacementCount: number;
  text: string;
  truncated: boolean;
}

export function getWaveformBusLabelBounds(x: number, width: number, height: number): WaveformBusLabelBounds {
  const safeWidth = Math.max(1, width);
  const bevel = getWaveformBusHexagonBevel(safeWidth, height);
  const left = x + bevel;
  const right = x + safeWidth - bevel;

  return {
    left,
    right,
    width: Math.max(0, right - left),
  };
}

export function getWaveformFittedBusLabelText(text: string, maxWidth: number, fontSize: number): WaveformFittedBusLabelText {
  if (text.length === 0 || maxWidth <= 0 || fontSize <= 0) {
    return {
      fits: false,
      replacementCount: 0,
      text: '',
      truncated: text.length > 0,
    };
  }

  if (getEstimatedTextWidth(text, fontSize) <= maxWidth) {
    return {
      fits: true,
      replacementCount: 0,
      text,
      truncated: false,
    };
  }

  const dotWidth = getEstimatedTextWidth('.', fontSize);

  if (dotWidth > maxWidth) {
    return {
      fits: false,
      replacementCount: text.length,
      text: '',
      truncated: true,
    };
  }

  const chars = [...text];

  for (let index = chars.length - 1; index >= 0; index -= 1) {
    chars[index] = '.';
    const candidate = chars.join('');

    if (getEstimatedTextWidth(candidate, fontSize) <= maxWidth) {
      return {
        fits: true,
        replacementCount: text.length - index,
        text: candidate,
        truncated: true,
      };
    }
  }

  return {
    fits: true,
    replacementCount: text.length,
    text: '.',
    truncated: true,
  };
}

function addBusLabel(labels: Container[], labelText: string, labelColor: number, x: number, y: number, width: number, height: number, options: WaveformLabelDrawOptions = {}): SpecialStateLabelResult {
  if (height < 10) {
    return { renderedLabelCount: 0, suppressedLabelCount: 1 };
  }

  const fontSize = 10;
  const bounds = getWaveformBusLabelBounds(x, width, height);
  const fittedLabel = getWaveformFittedBusLabelText(labelText, bounds.width, fontSize);

  if (!fittedLabel.fits) {
    return {
      busLabelDotReplacementCount: fittedLabel.replacementCount,
      busTruncatedLabelCount: fittedLabel.truncated ? 1 : 0,
      renderedLabelCount: 0,
      suppressedLabelCount: 1,
    };
  }

  labels.push((options.textFactory ?? createText)(fittedLabel.text, labelColor, fontSize, bounds.left, y + 4, options.labelCacheKey));
  return {
    busLabelDotReplacementCount: fittedLabel.replacementCount,
    busTruncatedLabelCount: fittedLabel.truncated ? 1 : 0,
    renderedLabelCount: 1,
    suppressedLabelCount: 0,
  };
}

function addSpecialStateCharacters(labels: Container[], state: 'x' | 'z', color: number, x: number, y: number, width: number, height: number, showText: boolean, options: WaveformLabelDrawOptions = {}): SpecialStateLabelResult {
  if (!showText) {
    return { renderedLabelCount: 0, suppressedLabelCount: 1 };
  }

  if (width < 8 || height < 10) {
    return { renderedLabelCount: 0, suppressedLabelCount: 0 };
  }

  const fontSize = Math.max(8, Math.min(11, height * 0.58));
  const textX = x + width / 2 - fontSize * 0.28;
  const textY = y + Math.max(1, (height - fontSize) / 2 - 1);

  labels.push((options.textFactory ?? createText)(state, color, fontSize, textX, textY, options.labelCacheKey));
  return { renderedLabelCount: 1, suppressedLabelCount: 0 };
}

function getWaveformSegmentLabelCacheKey(signalId: string, segmentIndex: number, labelKind: string) {
  return `${signalId}:${segmentIndex}:${labelKind}`;
}

export interface WaveformClipBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
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

function createDrawSignalResult(): DrawSignalResult {
  return {
    busFoldOnlyCount: 0,
    busFullHexagonCount: 0,
    busSpecialStateHexagonCount: 0,
    busSpecialStateLabelCount: 0,
    busSpecialStateWidthAlignedLabelCount: 0,
    busTruncatedLabelCount: 0,
    busLabelDotReplacementCount: 0,
    busVerticalFallbackCount: 0,
    collapsedSegmentCount: 0,
    drawnHorizontalSegmentCount: 0,
    drawnTransitionEdgeCount: 0,
    renderedLabelCount: 0,
    skippedHorizontalSegmentCount: 0,
    suppressedLabelCount: 0,
  };
}

function mergeDrawSignalResult(target: DrawSignalResult, source: SpecialStateLabelResult & Partial<DrawSignalResult>) {
  target.busFoldOnlyCount += source.busFoldOnlyCount ?? 0;
  target.busFullHexagonCount += source.busFullHexagonCount ?? 0;
  target.busSpecialStateHexagonCount += source.busSpecialStateHexagonCount ?? 0;
  target.busSpecialStateLabelCount += source.busSpecialStateLabelCount ?? 0;
  target.busSpecialStateWidthAlignedLabelCount += source.busSpecialStateWidthAlignedLabelCount ?? 0;
  target.busTruncatedLabelCount += source.busTruncatedLabelCount ?? 0;
  target.busLabelDotReplacementCount += source.busLabelDotReplacementCount ?? 0;
  target.busVerticalFallbackCount += source.busVerticalFallbackCount ?? 0;
  target.collapsedSegmentCount += source.collapsedSegmentCount ?? 0;
  target.drawnHorizontalSegmentCount += source.drawnHorizontalSegmentCount ?? 0;
  target.drawnTransitionEdgeCount += source.drawnTransitionEdgeCount ?? 0;
  target.renderedLabelCount += source.renderedLabelCount;
  target.skippedHorizontalSegmentCount += source.skippedHorizontalSegmentCount ?? 0;
  target.suppressedLabelCount += source.suppressedLabelCount;
}

function shouldShowSpecialStateTextForWidth(width: number) {
  return width >= 8;
}

function isSegmentBoundsHorizontallyVisible(x1: number, x2: number, renderResolution: number) {
  return Math.floor(x1 * renderResolution) !== Math.floor(x2 * renderResolution);
}

type BusSegmentShape =
  | { kind: 'full' }
  | { foldProjection: number; kind: 'fold'; x: number }
  | { kind: 'vertical'; x: number };

function getBusSegmentShapeForBounds(x1: number, x2: number, width: number, height: number, renderResolution: number): BusSegmentShape {
  const normalBevel = getElongatedHexagonBevel(32, height);
  const centralStart = x1 + normalBevel;
  const centralEnd = x2 - normalBevel;
  const x1Column = Math.floor(x1 * renderResolution);
  const x2Column = Math.floor(x2 * renderResolution);
  const leftInnerColumn = Math.floor(centralStart * renderResolution);
  const rightInnerColumn = Math.floor(centralEnd * renderResolution);

  if (centralEnd > centralStart && leftInnerColumn < rightInnerColumn) {
    return { kind: 'full' };
  }

  if (x1Column !== x2Column) {
    return {
      foldProjection: Math.max(1 / renderResolution, Math.min(normalBevel, Math.max(0, width / 2))),
      kind: 'fold',
      x: x1,
    };
  }

  return {
    kind: 'vertical',
    x: snapToDevicePixel(x1, renderResolution),
  };
}

function getRenderResolution(options: WaveformSceneOptions) {
  return Math.max(1, options.renderResolution ?? 1);
}

function snapToDevicePixel(value: number, renderResolution: number) {
  return Math.round(value * renderResolution) / renderResolution;
}

function getEstimatedTextWidth(text: string, fontSize: number) {
  return [...text].reduce((width, character) => width + getEstimatedTextCharacterWidth(character, fontSize), 0);
}

function getEstimatedTextCharacterWidth(character: string, fontSize: number) {
  return fontSize * (character === '.' ? 0.32 : 0.58);
}

function drawCursor(statusLayer: Container, operationLayer: Container, options: WaveformSceneOptions) {
  const x = Math.round(timeToX(options.cursorTime, options.viewport, options.width)) + 0.5;
  const labelText = `${options.cursorTime.toFixed(1)}${options.data.timescaleUnit}`;

  if (options.cursorTime < options.viewport.startTime || options.cursorTime > options.viewport.endTime) {
    return;
  }

  const cursorLine = new Graphics({ label: `waveform-cursor-line-x-${x.toFixed(2)}` });
  const cursorBadge = new Graphics({ label: 'waveform-cursor-badge' });

  cursorLine
    .moveTo(x, 0)
    .lineTo(x, options.height)
    .stroke({ color: palette.cursor, width: 1.5, alpha: 0.95 });

  cursorBadge
    .roundRect(x - 27, 2, 54, 18, 4)
    .fill({ color: 0x2a2410, alpha: 0.96 })
    .stroke({ color: palette.cursor, width: 1, alpha: 0.9 });

  const label = createText(labelText, palette.cursor, 10, x - 22, 6);

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
