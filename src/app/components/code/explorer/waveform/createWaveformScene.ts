import { Container, Graphics, Rectangle, Sprite, Text, type Renderer, type Texture } from 'pixi.js';

import {
  formatWaveformValue,
  type WaveformDisplayRow,
  getWaveformDigitalPulseFillCount,
  getWaveformDisplayRows,
  getWaveformFirstSignalLaneY,
  getWaveformRenderSegments,
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
import type { WaveformDataSet, WaveformLayerName, WaveformRenderSegment, WaveformRenderSegmentResult, WaveformRenderStats, WaveformShapeCounts, WaveformSignal, WaveformStateCounts, WaveformViewport } from './waveformTypes';
import { type ParsedWaveformFrame, WaveformBinaryValueKind } from './waveformBinaryFrame';
import {
  addWaveformGpuLine,
  addWaveformGpuPolygon,
  addWaveformGpuRect,
  commitWaveformGpuPrimitiveGroups,
  createWaveformGpuPrimitiveGroup,
  resetWaveformGpuPrimitiveGroup,
  type WaveformGpuPrimitiveGroup,
} from './waveformGpuPrimitives';

export const waveformLayerNames: readonly WaveformLayerName[] = ['background', 'content', 'status', 'operation'];
export const waveformUnknownStripeSpacing = 8;
export const waveformHighImpedanceStripeSpacing = 6;

export type WaveformSceneLayers = Record<WaveformLayerName, Container>;

export interface WaveformSignalTextureCacheEntry {
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
  estimatedBytes: number;
  renderedLabelCount: number;
  skippedHorizontalSegmentCount: number;
  suppressedLabelCount: number;
  texture: Texture;
}

export interface WaveformSignalTextureCache {
  get: (key: string) => WaveformSignalTextureCacheEntry | null | undefined;
  set: (key: string, entry: WaveformSignalTextureCacheEntry) => void;
}

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
  contentSignature: string | null;
  gpuContent: WaveformRowGpuContent | null;
  retainedContentGraphics: Graphics | null;
  retainedLabelContainer: Container | null;
  retainedTextPool: Text[];
  retainedTextUsed: number;
  rowId: string | null;
}

interface WaveformRowGpuContent {
  bus: WaveformGpuPrimitiveGroup;
  highImpedanceHatch: WaveformGpuPrimitiveGroup;
  highImpedance: WaveformGpuPrimitiveGroup;
  line: WaveformGpuPrimitiveGroup;
  midline: WaveformGpuPrimitiveGroup;
  pulse: WaveformGpuPrimitiveGroup;
  unknownHatch: WaveformGpuPrimitiveGroup;
  unknown: WaveformGpuPrimitiveGroup;
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
  gpuLayerCount: number;
  gpuVertexCount: number;
  labelPoolSize: number;
  cacheableSignalCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  cachedSignalCount: number;
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
  reuseContentSignature?: boolean;
}

interface WaveformSceneState {
  horizontalBuffer: WaveformHorizontalBufferState;
  cursorTime: number;
  data: WaveformDataSet;
  frame?: ParsedWaveformFrame | null;
  height: number;
  renderResolution: number;
  rows: WaveformDisplayRow[];
  selectedSignalId: string | null;
  signalTextureCache?: WaveformSignalTextureCache;
  textureRenderer?: Pick<Renderer, 'generateTexture'>;
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
  signalTextureCache?: WaveformSignalTextureCache;
  textureRenderer?: Pick<Renderer, 'generateTexture'>;
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
  const horizontalBuffer = createHorizontalBufferState(options.viewport, options.width, getRenderResolution(options));
  const renderStats = createRenderStats(visibleRows.visibleRowCount, visibleRows.culledRowCount, getRenderResolution(options));
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
      height: options.height,
      renderResolution: getRenderResolution(options),
      rows,
      selectedSignalId: options.selectedSignalId,
      signalTextureCache: options.signalTextureCache,
      textureRenderer: options.textureRenderer,
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
  layers.content.addChild(nodes.contentRows, nodes.contentRowPool);
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

    scene.state.viewport = viewport;
    scene.shapeCounts = getWaveformShapeCounts(scene.state.data, viewport);
    scene.digitalPulseFillCount = getWaveformDigitalPulseFillCount(scene.state.data, viewport);
    redrawWaveformSceneRulerIndicator(scene);
    redrawWaveformSceneGrid(scene);
    const updateStartedAt = performance.now();
    redrawWaveformSceneRows(scene, { redrawLanes: false, reuseContentSignature: true });
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
  scene.renderStats.rowContentSkipCount = scene.state.visibleRows.rows.filter((row) => row.kind === 'signal').length;
  accumulateVisibleRowContentMetrics(scene, scene.renderStats);
  return true;
}

export function updateWaveformSceneViewport(scene: WaveformScene, viewport: WaveformViewport) {
  const previousViewport = scene.state.viewport;
  scene.state.viewport = viewport;
  scene.state.horizontalBuffer = createHorizontalBufferState(viewport, scene.state.width, scene.state.renderResolution);
  scene.shapeCounts = getWaveformShapeCounts(scene.state.data, viewport);
  scene.digitalPulseFillCount = getWaveformDigitalPulseFillCount(scene.state.data, viewport);
  redrawWaveformSceneRulerIndicator(scene);
  redrawWaveformSceneGrid(scene);
  redrawWaveformSceneRows(scene, { redrawLanes: false, reuseContentSignature: true });
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
    rowContentRedrawCount: 0,
    rowContentSkipCount: 0,
    panBufferHitCount: 0,
    panBufferMissCount: 0,
    panPixelShiftCount: 0,
    gpuBufferUpdateCount: 0,
    gpuBufferUpdateMs: 0,
    gpuLayerCount: 0,
    gpuVertexCount: 0,
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
    cacheableSignalCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    cachedSignalCount: 0,
    renderResolution,
    suppressedLabelCount: 0,
    textureCacheBytes: 0,
    textureCacheSize: 0,
    fullSceneRebuildCount: 0,
    viewportContentUpdateCount: 0,
    verticalScrollUpdateCount: 0,
    cursorUpdateCount: 0,
    selectionUpdateCount: 0,
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

type WaveformTextFactory = (text: string, fill: number, fontSize: number, x: number, y: number) => Text;

interface WaveformLabelDrawOptions {
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
    contentSignature: null,
    gpuContent: null,
    retainedContentGraphics: null,
    retainedLabelContainer: null,
    retainedTextPool: [],
    retainedTextUsed: 0,
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
    gpuLayerCount: 0,
    gpuVertexCount: 0,
    labelPoolSize: 0,
    cacheableSignalCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    cachedSignalCount: 0,
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
    redrawWaveformSceneContent(scene, options.reuseContentSignature ?? false, nextRenderStats);
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

function redrawWaveformSceneContent(scene: WaveformScene, reuseContentSignature: boolean, renderStats: WaveformRenderStats) {
  const sceneOptions = getHorizontalBufferSceneOptions(scene);

  scene.state.visibleRows.rows.forEach((row) => {
    const rowNode = scene.rowRegistry.activeRows.get(row.id);

    if (!rowNode || row.kind !== 'signal') {
      return;
    }

    const segmentResult = sceneOptions.frame
      ? null
      : getWaveformRenderSegments(row.signal, sceneOptions.viewport, sceneOptions.width, undefined, getRenderResolution(sceneOptions));
    const contentSignature = sceneOptions.frame
      ? getFrameSignalRenderSignature(sceneOptions.frame, row.signal, row.signalIndex, sceneOptions, true)
      : getSignalRenderSignature(row.signal, sceneOptions, segmentResult!);

    if (sceneOptions.frame && reuseContentSignature && rowNode.contentSignature === contentSignature) {
      rowNode.contentMetrics = drawFrameSignalRow(rowNode, row, sceneOptions, sceneOptions.frame);
      renderStats.rowContentSkipCount += 1;
      return;
    }

    if (reuseContentSignature && rowNode.contentSignature === contentSignature) {
      renderStats.rowContentSkipCount += 1;
      return;
    }

    if (sceneOptions.frame) {
      rowNode.contentMetrics = drawFrameSignalRow(rowNode, row, sceneOptions, sceneOptions.frame);
    } else {
      releaseRetainedRowContent(rowNode);
      clearContainer(rowNode.contentContainer);
      discardRetainedRowContent(rowNode);
      rowNode.contentMetrics = drawSignalRow(rowNode.contentContainer, row, sceneOptions, segmentResult!);
    }
    rowNode.contentSignature = contentSignature;
    renderStats.rowContentRedrawCount += 1;
  });
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
  target.gpuBufferUpdateCount += source.gpuBufferUpdateCount;
  target.gpuBufferUpdateMs += source.gpuBufferUpdateMs;
  target.gpuLayerCount += source.gpuLayerCount;
  target.gpuVertexCount += source.gpuVertexCount;
  target.meshBufferUpdateMs = target.gpuBufferUpdateMs;
  target.meshVertexCount = target.gpuVertexCount;
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
  target.cacheableSignalCount += source.cacheableSignalCount;
  target.cacheHitCount += source.cacheHitCount;
  target.cacheMissCount += source.cacheMissCount;
  target.cachedSignalCount += source.cachedSignalCount;
  target.suppressedLabelCount += source.suppressedLabelCount;
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
    signalTextureCache: scene.state.signalTextureCache,
    textureRenderer: scene.state.textureRenderer,
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

function createHorizontalBufferState(viewport: WaveformViewport, width: number, renderResolution: number): WaveformHorizontalBufferState {
  const safeWidth = Math.max(1, width);
  const span = getWaveformViewportSpan(viewport);
  const usableWidth = getWaveformUsableWidth(safeWidth);
  const bufferPixels = Math.min(waveformHorizontalBufferMaxPixels, Math.max(waveformHorizontalBufferMinPixels, Math.round(safeWidth * 0.5)));
  const bufferTime = bufferPixels * span / usableWidth;
  const bufferViewport = {
    startTime: viewport.startTime - bufferTime,
    endTime: viewport.endTime + bufferTime,
  };
  const bufferWidth = safeWidth + bufferPixels * 2;
  const offsetX = getHorizontalBufferOffset(bufferViewport, viewport, span, safeWidth, renderResolution);

  return {
    bufferPixels,
    offsetX,
    viewport: bufferViewport,
    width: bufferWidth,
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
  if (scene.state.frame) {
    scene.state.horizontalBuffer.offsetX = 0;
    scene.nodes.backgroundGrid.x = 0;
    scene.nodes.contentRows.x = 0;
    scene.nodes.statusHeader.x = 0;
    return;
  }

  const offsetX = getHorizontalBufferOffset(
    scene.state.horizontalBuffer.viewport,
    scene.state.viewport,
    getWaveformViewportSpan(scene.state.viewport),
    scene.state.width,
    scene.state.renderResolution,
  );

  scene.state.horizontalBuffer.offsetX = offsetX;
  scene.nodes.backgroundGrid.x = offsetX;
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
  rowNode.contentSignature = null;
  rowNode.rowId = null;
  scene.rowRegistry.pool.push(rowNode);
}

function bindRowNode(rowNode: WaveformSceneRowNode, row: WaveformDisplayRow) {
  if (rowNode.rowId !== row.id) {
    rowNode.contentMetrics = createEmptyRowContentMetrics();
    rowNode.contentSignature = null;
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

function drawSignalRow(target: Container, row: WaveformDisplayRow, options: WaveformSceneOptions, segmentResult: WaveformRenderSegmentResult): WaveformRowContentMetrics {
  if (row.kind !== 'signal') {
    return createEmptyRowContentMetrics();
  }

  const signal = row.signal;
  const laneY = getScrolledY(row.y, options);
  const contentMetrics = createEmptyRowContentMetrics();

  contentMetrics.renderedSignalCount += 1;
  contentMetrics.sourceSegmentCount += segmentResult.sourceSegmentCount;
  contentMetrics.renderedSegmentCount += segmentResult.renderedSegmentCount;

  const cacheKey = shouldCacheSignalTexture(segmentResult, options) ? getSignalTextureCacheKey(signal, options, segmentResult) : null;

  if (cacheKey) {
    contentMetrics.cacheableSignalCount += 1;
    const cached = options.signalTextureCache?.get(cacheKey);

    if (cached && !cached.texture.destroyed) {
      const sprite = new Sprite(cached.texture);
      sprite.y = laneY;
      target.addChild(sprite);
      contentMetrics.cacheHitCount += 1;
      contentMetrics.renderedLabelCount += cached.renderedLabelCount;
      contentMetrics.suppressedLabelCount += cached.suppressedLabelCount;
      contentMetrics.collapsedSegmentCount += cached.collapsedSegmentCount;
      contentMetrics.drawnHorizontalSegmentCount += cached.drawnHorizontalSegmentCount;
      contentMetrics.skippedHorizontalSegmentCount += cached.skippedHorizontalSegmentCount;
      contentMetrics.drawnTransitionEdgeCount += cached.drawnTransitionEdgeCount;
      contentMetrics.busFullHexagonCount += cached.busFullHexagonCount;
      contentMetrics.busFoldOnlyCount += cached.busFoldOnlyCount;
      contentMetrics.busSpecialStateHexagonCount += cached.busSpecialStateHexagonCount;
      contentMetrics.busSpecialStateLabelCount += cached.busSpecialStateLabelCount;
      contentMetrics.busSpecialStateWidthAlignedLabelCount += cached.busSpecialStateWidthAlignedLabelCount;
      contentMetrics.busTruncatedLabelCount += cached.busTruncatedLabelCount;
      contentMetrics.busLabelDotReplacementCount += cached.busLabelDotReplacementCount;
      contentMetrics.busVerticalFallbackCount += cached.busVerticalFallbackCount;
      return contentMetrics;
    }
  }

  const signalLayer = new Container({ label: `waveform-signal-layer-${signal.id}` });
  let drawResult: DrawSignalResult;

  if (signal.kind === 'bus') {
    drawResult = drawBusWaveform(signalLayer, signal, options, segmentResult, 0);
  } else {
    drawResult = drawDigitalWaveform(signalLayer, signal, options, segmentResult, 0);
  }

  contentMetrics.renderedLabelCount += drawResult.renderedLabelCount;
  contentMetrics.suppressedLabelCount += drawResult.suppressedLabelCount;
  contentMetrics.collapsedSegmentCount += drawResult.collapsedSegmentCount;
  contentMetrics.drawnHorizontalSegmentCount += drawResult.drawnHorizontalSegmentCount;
  contentMetrics.skippedHorizontalSegmentCount += drawResult.skippedHorizontalSegmentCount;
  contentMetrics.drawnTransitionEdgeCount += drawResult.drawnTransitionEdgeCount;
  contentMetrics.busFullHexagonCount += drawResult.busFullHexagonCount;
  contentMetrics.busFoldOnlyCount += drawResult.busFoldOnlyCount;
  contentMetrics.busSpecialStateHexagonCount += drawResult.busSpecialStateHexagonCount;
  contentMetrics.busSpecialStateLabelCount += drawResult.busSpecialStateLabelCount;
  contentMetrics.busSpecialStateWidthAlignedLabelCount += drawResult.busSpecialStateWidthAlignedLabelCount;
  contentMetrics.busTruncatedLabelCount += drawResult.busTruncatedLabelCount;
  contentMetrics.busLabelDotReplacementCount += drawResult.busLabelDotReplacementCount;
  contentMetrics.busVerticalFallbackCount += drawResult.busVerticalFallbackCount;

  if (cacheKey && options.signalTextureCache && options.textureRenderer) {
    contentMetrics.cacheMissCount += 1;

    try {
      const renderResolution = getRenderResolution(options);
      const texture = options.textureRenderer.generateTexture({
        target: signalLayer,
        frame: new Rectangle(0, 0, options.width, waveformLaneHeight),
        resolution: renderResolution,
        antialias: false,
      });
      options.signalTextureCache.set(cacheKey, {
        busFoldOnlyCount: drawResult.busFoldOnlyCount,
        busFullHexagonCount: drawResult.busFullHexagonCount,
        busSpecialStateHexagonCount: drawResult.busSpecialStateHexagonCount,
        busSpecialStateLabelCount: drawResult.busSpecialStateLabelCount,
        busSpecialStateWidthAlignedLabelCount: drawResult.busSpecialStateWidthAlignedLabelCount,
        busTruncatedLabelCount: drawResult.busTruncatedLabelCount,
        busLabelDotReplacementCount: drawResult.busLabelDotReplacementCount,
        busVerticalFallbackCount: drawResult.busVerticalFallbackCount,
        collapsedSegmentCount: drawResult.collapsedSegmentCount,
        drawnHorizontalSegmentCount: drawResult.drawnHorizontalSegmentCount,
        drawnTransitionEdgeCount: drawResult.drawnTransitionEdgeCount,
        estimatedBytes: estimateSignalTextureBytes(options.width, waveformLaneHeight, renderResolution),
        renderedLabelCount: drawResult.renderedLabelCount,
        skippedHorizontalSegmentCount: drawResult.skippedHorizontalSegmentCount,
        suppressedLabelCount: drawResult.suppressedLabelCount,
        texture,
      });
      const sprite = new Sprite(texture);
      sprite.y = laneY;
      target.addChild(sprite);
      signalLayer.destroy({ children: true });
      contentMetrics.cachedSignalCount += 1;
      return contentMetrics;
    } catch {
      // Fall through to direct Graphics rendering if texture generation is unavailable.
    }
  }

  signalLayer.y = laneY;
  target.addChild(signalLayer);
  return contentMetrics;
}

function drawFrameSignalRow(rowNode: WaveformSceneRowNode, row: WaveformDisplayRow, options: WaveformSceneOptions, frame: ParsedWaveformFrame): WaveformRowContentMetrics {
  const contentMetrics = createEmptyRowContentMetrics();

  if (row.kind !== 'signal') {
    return contentMetrics;
  }

  const signal = row.signal;
  const tableEntry = getFrameSignalTableEntry(frame, row.signalIndex);
  if (!tableEntry || tableEntry.segmentCount === 0) {
    releaseRetainedFrameRowContent(rowNode);
    return contentMetrics;
  }

  const signalLayer = prepareRetainedFrameRowContent(rowNode, `waveform-signal-${signal.id}`, parseHexColor(signal.color));
  const drawResult = signal.kind === 'bus'
    ? drawFrameBusWaveform(signalLayer, signal, options, frame, tableEntry.firstSegment, tableEntry.segmentCount, 0)
    : drawFrameDigitalWaveform(signalLayer, signal, options, frame, tableEntry.firstSegment, tableEntry.segmentCount, 0);
  const gpuMetrics = finishRetainedFrameRowContent(signalLayer);

  contentMetrics.renderedSignalCount += 1;
  contentMetrics.sourceSegmentCount += tableEntry.segmentCount;
  contentMetrics.renderedSegmentCount += tableEntry.segmentCount;
  contentMetrics.gpuBufferUpdateCount += gpuMetrics.bufferUpdateCount;
  contentMetrics.gpuBufferUpdateMs += gpuMetrics.bufferUpdateMs;
  contentMetrics.gpuLayerCount += gpuMetrics.layerCount;
  contentMetrics.gpuVertexCount += gpuMetrics.vertexCount;
  contentMetrics.labelPoolSize = rowNode.retainedTextPool.length;
  contentMetrics.renderedLabelCount += drawResult.renderedLabelCount;
  contentMetrics.suppressedLabelCount += drawResult.suppressedLabelCount;
  contentMetrics.collapsedSegmentCount += drawResult.collapsedSegmentCount;
  contentMetrics.drawnHorizontalSegmentCount += drawResult.drawnHorizontalSegmentCount;
  contentMetrics.skippedHorizontalSegmentCount += drawResult.skippedHorizontalSegmentCount;
  contentMetrics.drawnTransitionEdgeCount += drawResult.drawnTransitionEdgeCount;
  contentMetrics.busFullHexagonCount += drawResult.busFullHexagonCount;
  contentMetrics.busFoldOnlyCount += drawResult.busFoldOnlyCount;
  contentMetrics.busSpecialStateHexagonCount += drawResult.busSpecialStateHexagonCount;
  contentMetrics.busSpecialStateLabelCount += drawResult.busSpecialStateLabelCount;
  contentMetrics.busSpecialStateWidthAlignedLabelCount += drawResult.busSpecialStateWidthAlignedLabelCount;
  contentMetrics.busTruncatedLabelCount += drawResult.busTruncatedLabelCount;
  contentMetrics.busLabelDotReplacementCount += drawResult.busLabelDotReplacementCount;
  contentMetrics.busVerticalFallbackCount += drawResult.busVerticalFallbackCount;

  rowNode.contentContainer.y = row.y - (options.verticalScrollTop ?? 0);
  return contentMetrics;
}

interface RetainedRowContent {
  graphics: Graphics;
  labels: Text[];
  labelContainer: Container;
  rowNode: WaveformSceneRowNode;
  usedLabels: Text[];
}

interface RetainedFrameRowContent {
  gpuContent: WaveformRowGpuContent;
  labelContainer: Container;
  rowNode: WaveformSceneRowNode;
  usedLabels: Text[];
}

function prepareRetainedFrameRowContent(rowNode: WaveformSceneRowNode, label: string, signalColor: number): RetainedFrameRowContent {
  if (rowNode.retainedContentGraphics) {
    rowNode.retainedContentGraphics.clear();
    rowNode.retainedContentGraphics.visible = false;
  }

  if (!rowNode.gpuContent) {
    rowNode.gpuContent = createWaveformRowGpuContent(label, signalColor);
    rowNode.contentContainer.addChild(
      rowNode.gpuContent.pulse.fill.container,
      rowNode.gpuContent.bus.fill.container,
      rowNode.gpuContent.bus.stroke.container,
      rowNode.gpuContent.unknown.fill.container,
      rowNode.gpuContent.unknown.stroke.container,
      rowNode.gpuContent.unknownHatch.stroke.container,
      rowNode.gpuContent.highImpedance.fill.container,
      rowNode.gpuContent.highImpedance.stroke.container,
      rowNode.gpuContent.highImpedanceHatch.stroke.container,
      rowNode.gpuContent.line.fill.container,
      rowNode.gpuContent.midline.fill.container,
    );
  }

  updateWaveformRowGpuContentColor(rowNode.gpuContent, signalColor);
  resetWaveformRowGpuContent(rowNode.gpuContent);

  if (!rowNode.retainedLabelContainer) {
    rowNode.retainedLabelContainer = new Container({ label: `${label}-labels` });
    rowNode.contentContainer.addChild(rowNode.retainedLabelContainer);
  }

  rowNode.retainedLabelContainer.label = `${label}-labels`;
  rowNode.retainedTextUsed = 0;

  return {
    gpuContent: rowNode.gpuContent,
    labelContainer: rowNode.retainedLabelContainer,
    rowNode,
    usedLabels: [],
  };
}

function finishRetainedFrameRowContent(content: RetainedFrameRowContent) {
  finishRetainedFrameLabels(content);
  return commitWaveformGpuPrimitiveGroups(getWaveformRowGpuGroups(content.gpuContent));
}

function finishRetainedFrameLabels(content: RetainedFrameRowContent) {
  content.rowNode.retainedTextUsed = content.usedLabels.length;
  for (let index = 0; index < content.rowNode.retainedTextPool.length; index += 1) {
    const label = content.rowNode.retainedTextPool[index];
    if (!label) {
      continue;
    }

    if (index >= content.usedLabels.length) {
      label.visible = false;
    }
  }
}

function releaseRetainedFrameRowContent(rowNode: WaveformSceneRowNode) {
  if (rowNode.gpuContent) {
    resetWaveformRowGpuContent(rowNode.gpuContent);
    commitWaveformGpuPrimitiveGroups(getWaveformRowGpuGroups(rowNode.gpuContent));
  }

  for (const label of rowNode.retainedTextPool) {
    label.visible = false;
  }
  rowNode.retainedTextUsed = 0;
}

function createWaveformRowGpuContent(label: string, signalColor: number): WaveformRowGpuContent {
  return {
    bus: createWaveformGpuPrimitiveGroup(`${label}-bus`, signalColor, busWaveformStyle.fillAlpha, busWaveformStyle.strokeAlpha),
    highImpedance: createWaveformGpuPrimitiveGroup(`${label}-z`, palette.highImpedance, 0.18, 0.88),
    highImpedanceHatch: createWaveformGpuPrimitiveGroup(`${label}-z-hatch`, palette.highImpedance, 0, 0.62),
    line: createWaveformGpuPrimitiveGroup(`${label}-line`, signalColor, 0.96, 0.96),
    midline: createWaveformGpuPrimitiveGroup(`${label}-midline`, 0xffffff, 0.04, 0.04),
    pulse: createWaveformGpuPrimitiveGroup(`${label}-pulse`, signalColor, 0.18, 0.18),
    unknown: createWaveformGpuPrimitiveGroup(`${label}-x`, palette.unknown, 0.22, 0.86),
    unknownHatch: createWaveformGpuPrimitiveGroup(`${label}-x-hatch`, palette.unknown, 0, 0.54),
  };
}

function updateWaveformRowGpuContentColor(content: WaveformRowGpuContent, signalColor: number) {
  setWaveformGpuPrimitiveGroupTint(content.bus, signalColor);
  setWaveformGpuPrimitiveGroupTint(content.line, signalColor);
  setWaveformGpuPrimitiveGroupTint(content.pulse, signalColor);
}

function setWaveformGpuPrimitiveGroupTint(group: WaveformGpuPrimitiveGroup, tint: number) {
  group.fill.mesh.tint = tint;
  group.stroke.mesh.tint = tint;
}

function resetWaveformRowGpuContent(content: WaveformRowGpuContent) {
  for (const group of getWaveformRowGpuGroups(content)) {
    resetWaveformGpuPrimitiveGroup(group);
  }
}

function getWaveformRowGpuGroups(content: WaveformRowGpuContent) {
  return [
    content.bus,
    content.highImpedance,
    content.highImpedanceHatch,
    content.line,
    content.midline,
    content.pulse,
    content.unknown,
    content.unknownHatch,
  ];
}

function releaseRetainedRowContent(rowNode: WaveformSceneRowNode) {
  rowNode.retainedContentGraphics?.clear();
  for (const label of rowNode.retainedTextPool) {
    label.visible = false;
  }
  rowNode.retainedTextUsed = 0;
}

function discardRetainedRowContent(rowNode: WaveformSceneRowNode) {
  rowNode.gpuContent = null;
  rowNode.retainedContentGraphics = null;
  rowNode.retainedLabelContainer = null;
  rowNode.retainedTextPool = [];
  rowNode.retainedTextUsed = 0;
}

function acquireRetainedText(content: RetainedRowContent | RetainedFrameRowContent, text: string, fill: number, fontSize: number, x: number, y: number) {
  const index = content.rowNode.retainedTextUsed;
  let label = content.rowNode.retainedTextPool[index];
  if (!label) {
    label = createText('', fill, fontSize, 0, 0);
    content.rowNode.retainedTextPool.push(label);
    content.labelContainer.addChild(label);
  }

  content.rowNode.retainedTextUsed += 1;
  updateText(label, text, fill, fontSize, x, y);
  label.visible = true;
  return label;
}

function drawFrameDigitalWaveform(
  content: RetainedFrameRowContent,
  signal: WaveformSignal,
  options: WaveformSceneOptions,
  frame: ParsedWaveformFrame,
  firstSegment: number,
  segmentCount: number,
  laneY: number,
): DrawSignalResult {
  const labelCounts = createDrawSignalResult();
  const renderResolution = getRenderResolution(options);
  const topY = laneY + waveformLanePaddingY + 2;
  const bottomY = laneY + waveformLaneHeight - waveformLanePaddingY - 2;
  const midY = laneY + waveformLaneHeight / 2;
  const segmentStrokeWidth = getWaveformDigitalSegmentStrokeWidth(signal.kind);
  const specialStateBounds = getWaveformDigitalSpecialStateBounds(laneY);
  const end = Math.min(frame.segmentCount, firstSegment + segmentCount);

  for (let index = firstSegment; index < end; index += 1) {
    const segment = getFrameRenderSegment(frame, index, options);
    if (!segment) {
      continue;
    }
    const nextSegment = getNextFrameRenderSegment(frame, index + 1, end, options);
    const currentValue = normalizeWaveformValue(segment.value);
    const nextValue = nextSegment ? normalizeWaveformValue(nextSegment.value) : currentValue;
    const isVisible = isSegmentHorizontallyVisible(segment, renderResolution);

    if (!isVisible) {
      labelCounts.skippedHorizontalSegmentCount += 1;
      labelCounts.collapsedSegmentCount += 1;
      continue;
    }

    labelCounts.drawnHorizontalSegmentCount += 1;

    if (segment.hasUnknown || isUnknownWaveformValue(currentValue)) {
      drawGpuSpecialStateBlock(content.gpuContent.unknown, segment.x1, specialStateBounds.y, segment.width, specialStateBounds.height, {
        hatchGroup: content.gpuContent.unknownHatch,
        pattern: 'backslash',
        strokeWidth: segmentStrokeWidth,
      });
      mergeDrawSignalResult(labelCounts, addSpecialStateCharacters(content.usedLabels, 'x', palette.unknown, segment.x1, specialStateBounds.y, segment.width, specialStateBounds.height, shouldShowSpecialStateText(segment), {
        textFactory: (text, fill, fontSize, x, y) => acquireRetainedText(content, text, fill, fontSize, x, y),
      }));
      continue;
    }

    if (segment.hasHighImpedance || isHighImpedanceWaveformValue(currentValue)) {
      drawGpuSpecialStateBlock(content.gpuContent.highImpedance, segment.x1, specialStateBounds.y, segment.width, specialStateBounds.height, {
        hatchGroup: content.gpuContent.highImpedanceHatch,
        pattern: 'chevron',
        strokeWidth: segmentStrokeWidth,
      });
      mergeDrawSignalResult(labelCounts, addSpecialStateCharacters(content.usedLabels, 'z', palette.highImpedance, segment.x1, specialStateBounds.y, segment.width, specialStateBounds.height, shouldShowSpecialStateText(segment), {
        textFactory: (text, fill, fontSize, x, y) => acquireRetainedText(content, text, fill, fontSize, x, y),
      }));
      continue;
    }

    const isHigh = currentValue === '1';
    const y = isHigh ? topY : bottomY;

    if (isHigh) {
      addWaveformGpuRect(content.gpuContent.pulse.fill, segment.x1, topY, segment.width, Math.max(1, bottomY - topY));
    }

    addWaveformGpuLine(content.gpuContent.line.fill, segment.x1, y, segment.x2, y, segmentStrokeWidth);

    if (nextSegment && nextValue !== currentValue && !isSpecialWaveformValue(nextValue)) {
      const nextY = nextValue === '1' ? topY : bottomY;
      addWaveformGpuLine(content.gpuContent.line.fill, segment.x2, y, segment.x2, nextY, 1.7);
      labelCounts.drawnTransitionEdgeCount += 1;
    }
  }

  addWaveformGpuLine(content.gpuContent.midline.fill, waveformTimeAxisInset, midY, options.width - waveformTimeAxisInset, midY, 1);

  return labelCounts;
}

function drawFrameBusWaveform(
  content: RetainedFrameRowContent,
  signal: WaveformSignal,
  options: WaveformSceneOptions,
  frame: ParsedWaveformFrame,
  firstSegment: number,
  segmentCount: number,
  laneY: number,
): DrawSignalResult {
  const labelCounts = createDrawSignalResult();
  const renderResolution = getRenderResolution(options);
  const y = laneY + waveformLanePaddingY;
  const height = waveformLaneHeight - waveformLanePaddingY * 2;
  const end = Math.min(frame.segmentCount, firstSegment + segmentCount);

  for (let index = firstSegment; index < end; index += 1) {
    const segment = getFrameRenderSegment(frame, index, options);
    if (!segment) {
      continue;
    }
    const currentValue = normalizeWaveformValue(segment.value);
    const segmentShape = getBusSegmentShape(segment, height, renderResolution);

    if (segment.hasUnknown || isUnknownWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawGpuBusSpecialStateSegment(content, signal, segment, segmentShape, y, height, {
        group: content.gpuContent.unknown,
        color: palette.unknown,
        fillAlpha: 0.22,
        labelColor: palette.unknown,
        state: 'x',
        strokeAlpha: 0.86,
        strokeWidth: 1,
      }));
    } else if (segment.hasHighImpedance || isHighImpedanceWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawGpuBusSpecialStateSegment(content, signal, segment, segmentShape, y, height, {
        group: content.gpuContent.highImpedance,
        color: palette.highImpedance,
        fillAlpha: 0.18,
        labelColor: palette.highImpedance,
        state: 'z',
        strokeAlpha: 0.88,
        strokeWidth: 1,
      }));
    } else {
      if (segmentShape.kind === 'full') {
        drawGpuElongatedHexagon(content.gpuContent.bus, segment.x1, y, segment.width, height);
        labelCounts.busFullHexagonCount += 1;
        labelCounts.drawnHorizontalSegmentCount += 1;
      } else if (segmentShape.kind === 'fold') {
        drawGpuBusFoldOnly(content.gpuContent.bus, segmentShape.x, y, segmentShape.foldProjection, height);
        labelCounts.collapsedSegmentCount += 1;
        labelCounts.busFoldOnlyCount += 1;
        labelCounts.skippedHorizontalSegmentCount += 1;
      } else {
        drawGpuBusVerticalFallback(content.gpuContent.bus, segmentShape.x, y, height, busWaveformStyle.strokeWidth);
        labelCounts.collapsedSegmentCount += 1;
        labelCounts.busVerticalFallbackCount += 1;
        labelCounts.skippedHorizontalSegmentCount += 1;
      }
    }

    if (segmentShape.kind === 'full' && !segment.hasUnknown && !segment.hasHighImpedance && !isSpecialWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, addBusLabel(content.usedLabels, formatWaveformValue(currentValue), palette.text, segment.x1, y, segment.width, height, {
        textFactory: (text, fill, fontSize, x, y) => acquireRetainedText(content, text, fill, fontSize, x, y),
      }));
    }
  }

  return labelCounts;
}

function getFrameRenderSegment(frame: ParsedWaveformFrame, segmentIndex: number, options: WaveformSceneOptions): WaveformRenderSegment | null {
  let x1 = frame.x0[segmentIndex] ?? 0;
  let x2 = frame.x1[segmentIndex] ?? x1;
  let startTime = 0;
  let endTime = 0;

  if (frame.time0 && frame.time1) {
    startTime = frame.time0[segmentIndex] ?? 0;
    endTime = frame.time1[segmentIndex] ?? startTime;
    if (endTime < options.viewport.startTime || startTime > options.viewport.endTime) {
      return null;
    }

    x1 = timeToX(startTime, options.viewport, options.width);
    x2 = timeToX(endTime, options.viewport, options.width);
  }
  const valueKind = frame.valueKind[segmentIndex] ?? WaveformBinaryValueKind.Unknown;
  const value = getFrameSegmentValue(frame, segmentIndex, valueKind);

  return {
    startTime,
    endTime,
    x1,
    x2,
    width: Math.max(1, x2 - x1),
    value,
    sourceSegmentCount: 1,
    hasUnknown: valueKind === WaveformBinaryValueKind.Unknown,
    hasHighImpedance: valueKind === WaveformBinaryValueKind.HighImpedance,
  };
}

function getNextFrameRenderSegment(frame: ParsedWaveformFrame, startIndex: number, endIndex: number, options: WaveformSceneOptions) {
  for (let index = startIndex; index < endIndex; index += 1) {
    const segment = getFrameRenderSegment(frame, index, options);

    if (segment) {
      return segment;
    }
  }

  return null;
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

function getFrameSignalRenderSignature(frame: ParsedWaveformFrame, signal: WaveformSignal, signalIndex: number, options: WaveformSceneOptions, lightweight = false) {
  const tableEntry = getFrameSignalTableEntry(frame, signalIndex);
  if (!tableEntry) {
    return [options.data.id, signal.id, 'frame', frame.version, 'empty'].join(':');
  }

  if (lightweight && frame.time0 && frame.time1) {
    return [
      options.data.id,
      signal.id,
      'frame',
      frame.frameId,
      frame.version,
      signal.kind,
      signal.color,
      signal.width ?? '',
      getRenderResolution(options).toFixed(2),
      options.width,
      tableEntry.firstSegment,
      tableEntry.segmentCount,
    ].join(':');
  }

  const parts = [
    options.data.id,
    signal.id,
    'frame',
    frame.version,
    signal.kind,
    signal.color,
    signal.width ?? '',
    getRenderResolution(options).toFixed(2),
    options.width,
    options.viewport.startTime.toFixed(3),
    options.viewport.endTime.toFixed(3),
    tableEntry.firstSegment,
    tableEntry.segmentCount,
  ];

  const end = Math.min(frame.segmentCount, tableEntry.firstSegment + tableEntry.segmentCount);
  for (let index = tableEntry.firstSegment; index < end; index += 1) {
    parts.push([
      frame.x0[index]?.toFixed(4) ?? '',
      frame.x1[index]?.toFixed(4) ?? '',
      frame.valueKind[index] ?? '',
      frame.labelIndex[index] ?? '',
    ].join(','));
  }

  return parts.join(':');
}

function getSignalRenderSignature(signal: WaveformSignal, options: WaveformSceneOptions, segmentResult: WaveformRenderSegmentResult) {
  return [
    signal.id,
    signal.kind,
    options.width,
    getRenderResolution(options).toFixed(2),
    segmentResult.segments.map((segment) => [
      segment.x1.toFixed(4),
      segment.x2.toFixed(4),
      segment.value,
      segment.sourceSegmentCount,
      segment.hasUnknown ? '1' : '0',
      segment.hasHighImpedance ? '1' : '0',
    ].join(',')).join('|'),
  ].join(':');
}

function drawDigitalWaveform(target: Container, signal: WaveformSignal, options: WaveformSceneOptions, segmentResult: WaveformRenderSegmentResult, laneY: number): DrawSignalResult {
  const line = new Graphics();
  const stateLabels: Text[] = [];
  const labelCounts = createDrawSignalResult();
  const lineColor = parseHexColor(signal.color);
  const renderResolution = getRenderResolution(options);
  const topY = laneY + waveformLanePaddingY + 2;
  const bottomY = laneY + waveformLaneHeight - waveformLanePaddingY - 2;
  const midY = laneY + waveformLaneHeight / 2;
  const segmentStrokeWidth = getWaveformDigitalSegmentStrokeWidth(signal.kind);
  const specialStateBounds = getWaveformDigitalSpecialStateBounds(laneY);

  for (let index = 0; index < segmentResult.segments.length; index += 1) {
    const segment = segmentResult.segments[index];
    const nextSegment = segmentResult.segments[index + 1];

    if (!segment) {
      continue;
    }

    const x1 = segment.x1;
    const x2 = segment.x2;
    const width = segment.width;
    const currentValue = normalizeWaveformValue(segment.value);
    const nextValue = nextSegment ? normalizeWaveformValue(nextSegment.value) : currentValue;
    const isVisible = isSegmentHorizontallyVisible(segment, renderResolution);

    if (!isVisible) {
      labelCounts.skippedHorizontalSegmentCount += 1;
      labelCounts.collapsedSegmentCount += 1;
      continue;
    }

    labelCounts.drawnHorizontalSegmentCount += 1;

    if (segment.hasUnknown || isUnknownWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawUnknownStateBlock(line, stateLabels, x1, specialStateBounds.y, width, specialStateBounds.height, {
        showText: shouldShowSpecialStateText(segment),
        strokeWidth: segmentStrokeWidth,
      }));
      continue;
    }

    if (segment.hasHighImpedance || isHighImpedanceWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawHighImpedanceStateBlock(line, stateLabels, x1, specialStateBounds.y, width, specialStateBounds.height, {
        showText: shouldShowSpecialStateText(segment),
        strokeWidth: segmentStrokeWidth,
      }));

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
      .stroke({ color: lineColor, width: segmentStrokeWidth, alpha: 0.96 });

    if (nextSegment && nextValue !== currentValue && !isSpecialWaveformValue(nextValue)) {
      const nextY = nextValue === '1' ? topY : bottomY;
      line
        .moveTo(x2, y)
        .lineTo(x2, nextY)
        .stroke({ color: lineColor, width: 1.7, alpha: 0.9 });
      labelCounts.drawnTransitionEdgeCount += 1;
    }
  }

  line
    .moveTo(waveformTimeAxisInset, midY)
    .lineTo(options.width - waveformTimeAxisInset, midY)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.04 });

  target.addChild(line, ...stateLabels);
  return labelCounts;
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

function drawDigitalPulseFill(target: Graphics, x: number, y: number, width: number, height: number, color: number, signalKind: WaveformSignal['kind']) {
  target
    .rect(x, y, width, Math.max(1, height))
    .fill({ color, alpha: signalKind === 'clock' ? 0.12 : 0.18 });
}

function drawBusWaveform(target: Container, signal: WaveformSignal, options: WaveformSceneOptions, segmentResult: WaveformRenderSegmentResult, laneY: number): DrawSignalResult {
  const bus = new Graphics();
  const valueLabels: Text[] = [];
  const labelCounts = createDrawSignalResult();
  const busColor = parseHexColor(signal.color);
  const renderResolution = getRenderResolution(options);
  const y = laneY + waveformLanePaddingY;
  const height = waveformLaneHeight - waveformLanePaddingY * 2;

  for (const segment of segmentResult.segments) {
    if (!segment) {
      continue;
    }

    const x1 = segment.x1;
    const width = segment.width;
    const currentValue = normalizeWaveformValue(segment.value);
    const segmentShape = getBusSegmentShape(segment, height, renderResolution);

    if (segment.hasUnknown || isUnknownWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawBusSpecialStateSegment(bus, valueLabels, signal, segment, segmentShape, y, height, {
        color: palette.unknown,
        fillAlpha: 0.22,
        labelColor: palette.unknown,
        state: 'x',
        strokeAlpha: 0.86,
        strokeWidth: 1,
      }));
    } else if (segment.hasHighImpedance || isHighImpedanceWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawBusSpecialStateSegment(bus, valueLabels, signal, segment, segmentShape, y, height, {
        color: palette.highImpedance,
        fillAlpha: 0.18,
        labelColor: palette.highImpedance,
        state: 'z',
        strokeAlpha: 0.88,
        strokeWidth: 1,
      }));
    } else {
      if (segmentShape.kind === 'full') {
        drawElongatedHexagon(bus, x1, y, width, height, {
          ...busWaveformStyle,
          color: busColor,
        });
        labelCounts.busFullHexagonCount += 1;
        labelCounts.drawnHorizontalSegmentCount += 1;
      } else if (segmentShape.kind === 'fold') {
        drawBusFoldOnly(bus, segmentShape.x, y, segmentShape.foldProjection, height, {
          ...busWaveformStyle,
          color: busColor,
        });
        labelCounts.collapsedSegmentCount += 1;
        labelCounts.busFoldOnlyCount += 1;
        labelCounts.skippedHorizontalSegmentCount += 1;
      } else {
        drawBusVerticalFallback(bus, segmentShape.x, y, height, {
          color: busColor,
          strokeAlpha: busWaveformStyle.strokeAlpha,
          strokeWidth: busWaveformStyle.strokeWidth,
        });
        labelCounts.collapsedSegmentCount += 1;
        labelCounts.busVerticalFallbackCount += 1;
        labelCounts.skippedHorizontalSegmentCount += 1;
      }
    }

    if (segmentShape.kind === 'full' && !segment.hasUnknown && !segment.hasHighImpedance && !isSpecialWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, addBusLabel(valueLabels, formatWaveformValue(currentValue), palette.text, x1, y, width, height));
    }
  }

  target.addChild(bus);

  if (valueLabels.length > 0) {
    target.addChild(...valueLabels);
  }

  return labelCounts;
}

const busWaveformStyle = {
  fillAlpha: 0.16,
  strokeAlpha: 0.84,
  strokeWidth: 1.2,
} as const;

interface BusSpecialStateStyle {
  color: number;
  fillAlpha: number;
  labelColor: number;
  state: 'x' | 'z';
  strokeAlpha: number;
  strokeWidth: number;
  textFactory?: WaveformTextFactory;
}

function drawBusSpecialStateSegment(
  target: Graphics,
  labels: Text[],
  signal: WaveformSignal,
  segment: WaveformRenderSegment,
  segmentShape: BusSegmentShape,
  y: number,
  height: number,
  style: BusSpecialStateStyle,
): DrawSignalResult {
  const result = createDrawSignalResult();

  if (segmentShape.kind === 'full') {
    drawElongatedHexagon(target, segment.x1, y, segment.width, height, {
      color: style.color,
      fillAlpha: style.fillAlpha,
      strokeAlpha: style.strokeAlpha,
      strokeWidth: style.strokeWidth,
    });
    result.busFullHexagonCount += 1;
    result.busSpecialStateHexagonCount += 1;
    result.drawnHorizontalSegmentCount += 1;

    const labelResult = addBusSpecialStateLabel(labels, signal, style.state, style.labelColor, segment.x1, y, segment.width, height, {
      textFactory: style.textFactory,
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
    drawBusFoldOnly(target, segmentShape.x, y, segmentShape.foldProjection, height, {
      color: style.color,
      fillAlpha: style.fillAlpha,
      strokeAlpha: style.strokeAlpha,
      strokeWidth: style.strokeWidth,
    });
    result.collapsedSegmentCount += 1;
    result.busFoldOnlyCount += 1;
    result.skippedHorizontalSegmentCount += 1;
    return result;
  }

  drawBusVerticalFallback(target, segmentShape.x, y, height, {
    color: style.color,
    strokeAlpha: style.strokeAlpha,
    strokeWidth: style.strokeWidth,
  });
  result.collapsedSegmentCount += 1;
  result.busVerticalFallbackCount += 1;
  result.skippedHorizontalSegmentCount += 1;
  return result;
}

interface GpuBusSpecialStateStyle extends BusSpecialStateStyle {
  group: WaveformGpuPrimitiveGroup;
}

function drawGpuBusSpecialStateSegment(
  content: RetainedFrameRowContent,
  signal: WaveformSignal,
  segment: WaveformRenderSegment,
  segmentShape: BusSegmentShape,
  y: number,
  height: number,
  style: GpuBusSpecialStateStyle,
): DrawSignalResult {
  const result = createDrawSignalResult();

  if (segmentShape.kind === 'full') {
    drawGpuElongatedHexagon(style.group, segment.x1, y, segment.width, height);
    result.busFullHexagonCount += 1;
    result.busSpecialStateHexagonCount += 1;
    result.drawnHorizontalSegmentCount += 1;

    const labelResult = addBusSpecialStateLabel(content.usedLabels, signal, style.state, style.labelColor, segment.x1, y, segment.width, height, {
      textFactory: (text, fill, fontSize, x, y) => acquireRetainedText(content, text, fill, fontSize, x, y),
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
    drawGpuBusFoldOnly(style.group, segmentShape.x, y, segmentShape.foldProjection, height);
    result.collapsedSegmentCount += 1;
    result.busFoldOnlyCount += 1;
    result.skippedHorizontalSegmentCount += 1;
    return result;
  }

  drawGpuBusVerticalFallback(style.group, segmentShape.x, y, height, style.strokeWidth);
  result.collapsedSegmentCount += 1;
  result.busVerticalFallbackCount += 1;
  result.skippedHorizontalSegmentCount += 1;
  return result;
}

interface BusSpecialStateLabelResult extends SpecialStateLabelResult {
  widthAlignedLabelCount: number;
}

function addBusSpecialStateLabel(labels: Text[], signal: WaveformSignal, state: 'x' | 'z', labelColor: number, x: number, y: number, width: number, height: number, options: WaveformLabelDrawOptions = {}): BusSpecialStateLabelResult {
  const hexDigitWidth = getWaveformBusSpecialStateHexDigitWidth(signal.width);
  const labelText = state.repeat(hexDigitWidth);
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

interface SpecialStateDrawOptions {
  showText: boolean;
  strokeWidth: number;
  textFactory?: WaveformTextFactory;
}

function drawUnknownStateBlock(target: Graphics, labels: Text[], x: number, y: number, width: number, height: number, options: SpecialStateDrawOptions): SpecialStateLabelResult {
  drawSpecialStateBlock(target, x, y, width, height, {
    color: palette.unknown,
    fillAlpha: 0.22,
    pattern: 'backslash',
    state: 'x',
    strokeAlpha: 0.86,
    strokeWidth: options.strokeWidth,
  });
  return addSpecialStateCharacters(labels, 'x', palette.unknown, x, y, width, height, options.showText, {
    textFactory: options.textFactory,
  });
}

function drawHighImpedanceStateBlock(target: Graphics, labels: Text[], x: number, y: number, width: number, height: number, options: SpecialStateDrawOptions): SpecialStateLabelResult {
  drawSpecialStateBlock(target, x, y, width, height, {
    color: palette.highImpedance,
    fillAlpha: 0.18,
    pattern: 'chevron',
    state: 'z',
    strokeAlpha: 0.88,
    strokeWidth: options.strokeWidth,
  });
  return addSpecialStateCharacters(labels, 'z', palette.highImpedance, x, y, width, height, options.showText, {
    textFactory: options.textFactory,
  });
}

interface SpecialStateBlockStyle {
  color: number;
  fillAlpha: number;
  pattern: 'backslash' | 'chevron';
  state: 'x' | 'z';
  strokeAlpha: number;
  strokeWidth: number;
}

function drawSpecialStateBlock(target: Graphics, x: number, y: number, width: number, height: number, style: SpecialStateBlockStyle) {
  target
    .roundRect(x, y, width, height, 2)
    .fill({ color: style.color, alpha: style.fillAlpha })
    .stroke({ color: style.color, width: style.strokeWidth, alpha: style.strokeAlpha });

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

interface WaveformPoint {
  x: number;
  y: number;
}

function drawElongatedHexagon(target: Graphics, x: number, y: number, width: number, height: number, style: ElongatedHexagonStyle) {
  const points = getElongatedHexagonPoints(x, y, width, height);

  target
    .poly(flattenWaveformPoints(points), true)
    .fill({ color: style.color, alpha: style.fillAlpha })
    .stroke({ color: style.color, width: style.strokeWidth, alpha: style.strokeAlpha, join: 'miter' });
}

function drawBusFoldOnly(target: Graphics, x: number, y: number, foldProjection: number, height: number, style: ElongatedHexagonStyle) {
  const points = getBusFoldOnlyPoints(x, y, foldProjection, height);
  const drawPoints: WaveformPoint[] = [
    points[0] ?? { x, y },
    points[1] ?? { x, y },
    points[2] ?? { x, y },
    points[2] ?? { x, y },
    points[3] ?? { x, y },
    points[0] ?? { x, y },
  ];

  target
    .poly(flattenWaveformPoints(drawPoints), true)
    .fill({ color: style.color, alpha: style.fillAlpha })
    .stroke({ color: style.color, width: style.strokeWidth, alpha: style.strokeAlpha, join: 'miter' });
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

function flattenWaveformPoints(points: readonly WaveformPoint[]) {
  return points.flatMap((point) => [point.x, point.y]);
}

function drawBusVerticalFallback(target: Graphics, x: number, y: number, height: number, style: { color: number; strokeAlpha: number; strokeWidth: number }) {
  target
    .moveTo(x, y)
    .lineTo(x, y + height)
    .stroke({ color: style.color, width: style.strokeWidth, alpha: style.strokeAlpha });
}

function drawGpuElongatedHexagon(group: WaveformGpuPrimitiveGroup, x: number, y: number, width: number, height: number) {
  const points = getElongatedHexagonPoints(x, y, width, height);
  addWaveformGpuPolygon(group.fill, points);
  addGpuPolyline(group.stroke, points, busWaveformStyle.strokeWidth, true);
}

function drawGpuBusFoldOnly(group: WaveformGpuPrimitiveGroup, x: number, y: number, foldProjection: number, height: number) {
  const points = getBusFoldOnlyPoints(x, y, foldProjection, height);
  addWaveformGpuPolygon(group.fill, [
    points[0] ?? { x, y },
    points[1] ?? { x, y },
    points[2] ?? { x, y },
    points[3] ?? { x, y },
  ]);
  addGpuPolyline(group.stroke, points, busWaveformStyle.strokeWidth, true);
}

function drawGpuBusVerticalFallback(group: WaveformGpuPrimitiveGroup, x: number, y: number, height: number, strokeWidth: number) {
  addWaveformGpuLine(group.stroke, x, y, x, y + height, strokeWidth);
}

function drawGpuSpecialStateBlock(
  group: WaveformGpuPrimitiveGroup,
  x: number,
  y: number,
  width: number,
  height: number,
  style: Pick<SpecialStateBlockStyle, 'pattern' | 'strokeWidth'> & { hatchGroup: WaveformGpuPrimitiveGroup },
) {
  const radius = Math.min(2, Math.max(0, width / 2), Math.max(0, height / 2));
  const points = getRoundedRectPolygonPoints(x, y, width, height, radius);
  addWaveformGpuPolygon(group.fill, points);
  addGpuPolyline(group.stroke, points, style.strokeWidth, true);

  if (style.pattern === 'chevron') {
    addGpuChevronHatch(style.hatchGroup, x, y, width, height);
  } else {
    addGpuBackslashHatch(style.hatchGroup, x, y, width, height);
  }
}

function addGpuPolyline(layer: WaveformGpuPrimitiveGroup['stroke'], points: readonly WaveformPoint[], width: number, closed: boolean) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];

    if (!current || !next) {
      continue;
    }

    addWaveformGpuLine(layer, current.x, current.y, next.x, next.y, width);
  }

  if (closed && points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];

    if (first && last) {
      addWaveformGpuLine(layer, last.x, last.y, first.x, first.y, width);
    }
  }
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

function addGpuBackslashHatch(group: WaveformGpuPrimitiveGroup, x: number, y: number, width: number, height: number) {
  const left = x + 1;
  const right = x + width - 1;
  const bottom = y + height - 1;

  for (let start = x - height; start < x + width; start += waveformUnknownStripeSpacing) {
    const segmentStartX = Math.max(left, start);
    const segmentEndX = Math.min(right, start + height);

    if (segmentEndX <= segmentStartX) {
      continue;
    }

    addWaveformGpuLine(
      group.stroke,
      segmentStartX,
      y + segmentStartX - start + 1,
      segmentEndX,
      Math.min(bottom, y + segmentEndX - start + 1),
      1,
    );
  }
}

function addGpuChevronHatch(group: WaveformGpuPrimitiveGroup, x: number, y: number, width: number, height: number) {
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

    addGpuClippedLine(group.stroke, start, top, tipX, centerY, { left, right, top, bottom });
    addGpuClippedLine(group.stroke, tipX, centerY, start, bottom, { left, right, top, bottom });
  }
}

function addGpuClippedLine(layer: WaveformGpuPrimitiveGroup['stroke'], x1: number, y1: number, x2: number, y2: number, bounds: WaveformClipBounds) {
  const clipped = clipWaveformLineToBounds(x1, y1, x2, y2, bounds);

  if (!clipped) {
    return;
  }

  addWaveformGpuLine(layer, clipped.x1, clipped.y1, clipped.x2, clipped.y2, 1);
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

function addBusLabel(labels: Text[], labelText: string, labelColor: number, x: number, y: number, width: number, height: number, options: WaveformLabelDrawOptions = {}): SpecialStateLabelResult {
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

  labels.push((options.textFactory ?? createText)(fittedLabel.text, labelColor, fontSize, bounds.left, y + 4));
  return {
    busLabelDotReplacementCount: fittedLabel.replacementCount,
    busTruncatedLabelCount: fittedLabel.truncated ? 1 : 0,
    renderedLabelCount: 1,
    suppressedLabelCount: 0,
  };
}

function addSpecialStateCharacters(labels: Text[], state: 'x' | 'z', color: number, x: number, y: number, width: number, height: number, showText: boolean, options: WaveformLabelDrawOptions = {}): SpecialStateLabelResult {
  if (!showText) {
    return { renderedLabelCount: 0, suppressedLabelCount: 1 };
  }

  if (width < 8 || height < 10) {
    return { renderedLabelCount: 0, suppressedLabelCount: 0 };
  }

  const fontSize = Math.max(8, Math.min(11, height * 0.58));
  const textX = x + width / 2 - fontSize * 0.28;
  const textY = y + Math.max(1, (height - fontSize) / 2 - 1);

  labels.push((options.textFactory ?? createText)(state, color, fontSize, textX, textY));
  return { renderedLabelCount: 1, suppressedLabelCount: 0 };
}

function drawBackslashHatch(target: Graphics, x: number, y: number, width: number, height: number, color: number, dense = false) {
  const spacing = dense ? Math.max(waveformUnknownStripeSpacing, 10) : waveformUnknownStripeSpacing;
  const left = x + 1;
  const right = x + width - 1;
  const bottom = y + height - 1;
  let hatchCount = 0;

  for (let start = x - height; start < x + width; start += spacing) {
    if (dense && hatchCount >= Math.max(1, Math.ceil(width / 18))) {
      break;
    }

    const segmentStartX = Math.max(left, start);
    const segmentEndX = Math.min(right, start + height);

    if (segmentEndX <= segmentStartX) {
      continue;
    }

    target
      .moveTo(segmentStartX, y + segmentStartX - start + 1)
      .lineTo(segmentEndX, Math.min(bottom, y + segmentEndX - start + 1))
      .stroke({ color, width: 1, alpha: 0.54 });
    hatchCount += 1;
  }
}

function drawChevronHatch(target: Graphics, x: number, y: number, width: number, height: number, color: number, dense = false) {
  const spacing = dense ? Math.max(waveformHighImpedanceStripeSpacing, 10) : waveformHighImpedanceStripeSpacing;
  const top = y + 2;
  const bottom = y + height - 2;
  const centerY = y + height / 2;
  const left = x + 1;
  const right = x + width - 2;
  let hatchCount = 0;

  for (let start = x + 2; start < right; start += spacing) {
    if (dense && hatchCount >= Math.max(1, Math.ceil(width / 18))) {
      break;
    }

    const tipX = start + 5;

    if (tipX <= start + 1 || start >= right) {
      continue;
    }

    drawClippedLine(target, start, top, tipX, centerY, { left, right, top, bottom }, color, 0.62);
    drawClippedLine(target, tipX, centerY, start, bottom, { left, right, top, bottom }, color, 0.62);
    hatchCount += 1;
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

function shouldShowSpecialStateText(segment: WaveformRenderSegment) {
  return segment.width >= 8;
}

function shouldCacheSignalTexture(segmentResult: WaveformRenderSegmentResult, options: WaveformSceneOptions) {
  const renderResolution = getRenderResolution(options);
  const estimatedBytes = estimateSignalTextureBytes(options.width, waveformLaneHeight, renderResolution);

  if (estimatedBytes > 2 * 1024 * 1024) {
    return false;
  }

  return segmentResult.sourceSegmentCount >= 72 || segmentResult.renderedSegmentCount >= 48;
}

function getSignalTextureCacheKey(signal: WaveformSignal, options: WaveformSceneOptions, segmentResult: WaveformRenderSegmentResult) {
  const transitions = signal.transitions ?? [];
  const lastTransition = transitions[transitions.length - 1];
  const busLabelSignature = signal.kind === 'bus' ? getBusLabelTextureCacheSignature(signal, segmentResult, getRenderResolution(options)) : '';

  return [
    options.data.id,
    signal.id,
    signal.kind,
    signal.color,
    signal.width ?? '',
    getRenderResolution(options).toFixed(2),
    options.width,
    options.viewport.startTime.toFixed(3),
    options.viewport.endTime.toFixed(3),
    transitions.length,
    lastTransition?.time.toFixed(3) ?? '0.000',
    lastTransition?.value ?? '',
    segmentResult.sourceSegmentCount,
    segmentResult.renderedSegmentCount,
    busLabelSignature,
    segmentResult.segments.map((segment) => [
      segment.x1.toFixed(4),
      segment.x2.toFixed(4),
      segment.value,
      segment.hasUnknown ? '1' : '0',
      segment.hasHighImpedance ? '1' : '0',
    ].join(',')).join('|'),
  ].join(':');
}

function getBusLabelTextureCacheSignature(signal: WaveformSignal, segmentResult: WaveformRenderSegmentResult, renderResolution: number) {
  const labelFitVersion = 'bus-label-fit-v1';
  const height = waveformLaneHeight - waveformLanePaddingY * 2;

  return [
    labelFitVersion,
    segmentResult.segments.map((segment) => {
      const value = normalizeWaveformValue(segment.value);
      const shape = getBusSegmentShape(segment, height, renderResolution);

      if (shape.kind !== 'full') {
        return 'none';
      }

      let labelText: string;

      if (segment.hasUnknown || isUnknownWaveformValue(value)) {
        labelText = 'x'.repeat(getWaveformBusSpecialStateHexDigitWidth(signal.width));
      } else if (segment.hasHighImpedance || isHighImpedanceWaveformValue(value)) {
        labelText = 'z'.repeat(getWaveformBusSpecialStateHexDigitWidth(signal.width));
      } else if (!isSpecialWaveformValue(value)) {
        labelText = formatWaveformValue(value);
      } else {
        return 'none';
      }

      const bounds = getWaveformBusLabelBounds(segment.x1, segment.width, height);
      const fitted = getWaveformFittedBusLabelText(labelText, bounds.width, 10);

      return [
        segment.x1.toFixed(4),
        segment.x2.toFixed(4),
        fitted.fits ? fitted.text : '',
      ].join(',');
    }).join('|'),
  ].join('=');
}

function isSegmentHorizontallyVisible(segment: WaveformRenderSegment, renderResolution: number) {
  return Math.floor(segment.x1 * renderResolution) !== Math.floor(segment.x2 * renderResolution);
}

type BusSegmentShape =
  | { kind: 'full' }
  | { foldProjection: number; kind: 'fold'; x: number }
  | { kind: 'vertical'; x: number };

function getBusSegmentShape(segment: WaveformRenderSegment, height: number, renderResolution: number): BusSegmentShape {
  const normalBevel = getElongatedHexagonBevel(32, height);
  const centralStart = segment.x1 + normalBevel;
  const centralEnd = segment.x2 - normalBevel;
  const x1Column = Math.floor(segment.x1 * renderResolution);
  const x2Column = Math.floor(segment.x2 * renderResolution);
  const leftInnerColumn = Math.floor(centralStart * renderResolution);
  const rightInnerColumn = Math.floor(centralEnd * renderResolution);

  if (centralEnd > centralStart && leftInnerColumn < rightInnerColumn) {
    return { kind: 'full' };
  }

  if (x1Column !== x2Column) {
    return {
      foldProjection: Math.max(1 / renderResolution, Math.min(normalBevel, Math.max(0, segment.width / 2))),
      kind: 'fold',
      x: segment.x1,
    };
  }

  return {
    kind: 'vertical',
    x: snapToDevicePixel(segment.x1, renderResolution),
  };
}

function getRenderResolution(options: WaveformSceneOptions) {
  return Math.max(1, options.renderResolution ?? 1);
}

function estimateSignalTextureBytes(width: number, height: number, renderResolution: number) {
  return Math.ceil(width * renderResolution) * Math.ceil(height * renderResolution) * 4;
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

function updateText(label: Text, text: string, fill: number, fontSize: number, x: number, y: number) {
  label.text = text;
  label.x = x;
  label.y = y;
  label.style = {
    fill,
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    fontSize,
    fontWeight: '500',
  };
}

function parseHexColor(color: string) {
  return Number.parseInt(color.replace('#', ''), 16);
}
