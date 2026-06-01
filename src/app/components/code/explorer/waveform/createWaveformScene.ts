import { Container, Graphics, Rectangle, Sprite, Text, type Renderer, type Texture } from 'pixi.js';

import {
  formatWaveformValue,
  type WaveformDisplayRow,
  getWaveformDigitalPulseFillCount,
  getWaveformDisplayRows,
  getWaveformFirstSignalLaneY,
  getWaveformRenderSegments,
  getWaveformSignalLaneY,
  getWaveformShapeCounts,
  getWaveformStateCounts,
  getWaveformTicks,
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

export const waveformLayerNames: readonly WaveformLayerName[] = ['background', 'content', 'status', 'operation'];
export const waveformUnknownStripeSpacing = 8;
export const waveformHighImpedanceStripeSpacing = 6;

export type WaveformSceneLayers = Record<WaveformLayerName, Container>;

export interface WaveformSignalTextureCacheEntry {
  estimatedBytes: number;
  texture: Texture;
  renderedLabelCount: number;
  suppressedLabelCount: number;
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
  rowId: string | null;
}

interface WaveformRowContentMetrics {
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
  cursorTime: number;
  data: WaveformDataSet;
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

interface WaveformSceneOptions {
  data: WaveformDataSet;
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

export function createWaveformScene(options: WaveformSceneOptions): WaveformScene {
  const world = new Container();
  const layers = createLayers();
  const rows = getWaveformDisplayRows(options.data);
  const visibleRows = getVisibleWaveformRows(rows, options.verticalScrollTop ?? 0, options.height);
  const nodes = createSceneNodes();
  const rowRegistry = createRowRegistry();
  const renderStats = createRenderStats(visibleRows.visibleRowCount, visibleRows.culledRowCount, getRenderResolution(options));
  const scene: WaveformScene = {
    world,
    layers,
    nodes,
    rowRegistry,
    state: {
      cursorTime: options.cursorTime,
      data: options.data,
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
  layers.status.addChild(nodes.statusHeader, nodes.statusCursor);
  layers.operation.addChild(nodes.operationCursor);
  world.addChild(layers.background, layers.content, layers.status, layers.operation);

  redrawWaveformSceneBase(scene);
  redrawWaveformSceneGrid(scene);
  redrawWaveformSceneRows(scene);
  redrawWaveformSceneCursor(scene);

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

export function updateWaveformSceneViewport(scene: WaveformScene, viewport: WaveformViewport) {
  scene.state.viewport = viewport;
  scene.shapeCounts = getWaveformShapeCounts(scene.state.data, viewport);
  scene.digitalPulseFillCount = getWaveformDigitalPulseFillCount(scene.state.data, viewport);
  redrawWaveformSceneGrid(scene);
  redrawWaveformSceneRows(scene, { redrawLanes: false, reuseContentSignature: true });
  redrawWaveformSceneCursor(scene);
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
    renderedSignalCount: 0,
    sourceSegmentCount: 0,
    renderedSegmentCount: 0,
    coalescedSegmentCount: 0,
    renderedLabelCount: 0,
    cacheableSignalCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    cachedSignalCount: 0,
    compactSignalCount: 0,
    denseColumnCount: 0,
    denseRunCount: 0,
    denseSignalCount: 0,
    detailSignalCount: 0,
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
  renderedLabelCount: number;
  suppressedLabelCount: number;
}

interface SpecialStateLabelResult {
  renderedLabelCount: number;
  suppressedLabelCount: number;
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
    rowId: null,
  };
}

function createEmptyRowContentMetrics(): WaveformRowContentMetrics {
  return {
    renderedSignalCount: 0,
    sourceSegmentCount: 0,
    renderedSegmentCount: 0,
    coalescedSegmentCount: 0,
    renderedLabelCount: 0,
    cacheableSignalCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    cachedSignalCount: 0,
    compactSignalCount: 0,
    denseColumnCount: 0,
    denseRunCount: 0,
    denseSignalCount: 0,
    detailSignalCount: 0,
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

function redrawWaveformSceneGrid(scene: WaveformScene) {
  clearContainer(scene.nodes.backgroundGrid);
  clearContainer(scene.nodes.statusHeader);
  drawGrid(scene.nodes.backgroundGrid, scene.nodes.statusHeader, getSceneOptions(scene));
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
  const sceneOptions = getSceneOptions(scene);

  scene.state.visibleRows.rows.forEach((row) => {
    const rowNode = scene.rowRegistry.activeRows.get(row.id);

    if (!rowNode || row.kind !== 'signal') {
      return;
    }

    const segmentResult = getWaveformRenderSegments(row.signal, sceneOptions.viewport, sceneOptions.width, undefined, getRenderResolution(sceneOptions));
    const contentSignature = getSignalRenderSignature(row.signal, sceneOptions, segmentResult);

    if (reuseContentSignature && rowNode.contentSignature === contentSignature) {
      renderStats.rowContentSkipCount += 1;
      return;
    }

    clearContainer(rowNode.contentContainer);
    rowNode.contentMetrics = drawSignalRow(rowNode.contentContainer, row, sceneOptions, segmentResult);
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
  target.coalescedSegmentCount += source.coalescedSegmentCount;
  target.renderedLabelCount += source.renderedLabelCount;
  target.cacheableSignalCount += source.cacheableSignalCount;
  target.cacheHitCount += source.cacheHitCount;
  target.cacheMissCount += source.cacheMissCount;
  target.cachedSignalCount += source.cachedSignalCount;
  target.compactSignalCount += source.compactSignalCount;
  target.denseColumnCount += source.denseColumnCount;
  target.denseRunCount += source.denseRunCount;
  target.denseSignalCount += source.denseSignalCount;
  target.detailSignalCount += source.detailSignalCount;
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
  contentMetrics.coalescedSegmentCount += segmentResult.coalescedSegmentCount;
  contentMetrics.denseColumnCount += segmentResult.denseColumnCount;
  contentMetrics.denseRunCount += segmentResult.denseRunCount;

  if (segmentResult.densityMode === 'dense') {
    contentMetrics.denseSignalCount += 1;
  } else if (segmentResult.densityMode === 'compact') {
    contentMetrics.compactSignalCount += 1;
  } else {
    contentMetrics.detailSignalCount += 1;
  }

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
        estimatedBytes: estimateSignalTextureBytes(options.width, waveformLaneHeight, renderResolution),
        texture,
        renderedLabelCount: drawResult.renderedLabelCount,
        suppressedLabelCount: drawResult.suppressedLabelCount,
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

function getSignalRenderSignature(signal: WaveformSignal, options: WaveformSceneOptions, segmentResult: WaveformRenderSegmentResult) {
  return [
    signal.id,
    signal.kind,
    segmentResult.densityMode,
    options.width,
    getRenderResolution(options).toFixed(2),
    segmentResult.segments.map((segment) => [
      segment.x1.toFixed(4),
      segment.x2.toFixed(4),
      segment.value,
      segment.sourceSegmentCount,
      segment.mixed ? '1' : '0',
      segment.hasUnknown ? '1' : '0',
      segment.hasHighImpedance ? '1' : '0',
    ].join(',')).join('|'),
  ].join(':');
}

function drawDigitalWaveform(target: Container, signal: WaveformSignal, options: WaveformSceneOptions, segmentResult: WaveformRenderSegmentResult, laneY: number): DrawSignalResult {
  if (segmentResult.densityMode === 'dense') {
    return drawDenseDigitalWaveform(target, signal, options, segmentResult, laneY);
  }

  const line = new Graphics();
  const stateLabels: Text[] = [];
  const labelCounts = createDrawSignalResult();
  const lineColor = parseHexColor(signal.color);
  const laneTop = laneY + waveformLanePaddingY;
  const laneBottom = laneY + waveformLaneHeight - waveformLanePaddingY;
  const topY = laneY + waveformLanePaddingY + 2;
  const bottomY = laneY + waveformLaneHeight - waveformLanePaddingY - 2;
  const midY = laneY + waveformLaneHeight / 2;

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

    if (segment.hasUnknown || isUnknownWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawUnknownStateBlock(line, stateLabels, x1, laneTop, width, laneBottom - laneTop, {
        showText: shouldShowSpecialStateText(segment, segmentResult),
      }));
      continue;
    }

    if (segment.hasHighImpedance || isHighImpedanceWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawHighImpedanceStateBlock(line, stateLabels, x1, laneTop, width, laneBottom - laneTop, {
        showText: shouldShowSpecialStateText(segment, segmentResult),
      }));

      continue;
    }

    if (segment.mixed) {
      drawDigitalActivityBlock(line, x1, topY, width, bottomY - topY, lineColor, signal.kind);
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

    if (nextSegment && !nextSegment.mixed && nextValue !== currentValue && !isSpecialWaveformValue(nextValue)) {
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
  return labelCounts;
}

function drawDenseDigitalWaveform(target: Container, signal: WaveformSignal, options: WaveformSceneOptions, segmentResult: WaveformRenderSegmentResult, laneY: number): DrawSignalResult {
  const line = new Graphics();
  const stateLabels: Text[] = [];
  const labelCounts = createDrawSignalResult();
  const lineColor = parseHexColor(signal.color);
  const renderResolution = getRenderResolution(options);
  const laneTop = snapToDevicePixel(laneY + waveformLanePaddingY, renderResolution);
  const laneBottom = snapToDevicePixel(laneY + waveformLaneHeight - waveformLanePaddingY, renderResolution);
  const topY = snapToDevicePixel(laneY + waveformLanePaddingY + 2, renderResolution);
  const bottomY = snapToDevicePixel(laneY + waveformLaneHeight - waveformLanePaddingY - 2, renderResolution);
  const activityY = snapToDevicePixel(topY, renderResolution);
  const activityHeight = Math.max(1 / renderResolution, bottomY - topY);
  const railHeight = Math.max(1 / renderResolution, 2 / renderResolution);

  for (const segment of segmentResult.segments) {
    const x1 = snapToDevicePixel(segment.x1, renderResolution);
    const x2 = snapToDevicePixel(segment.x2, renderResolution);
    const width = Math.max(1 / renderResolution, x2 - x1);
    const currentValue = normalizeWaveformValue(segment.value);

    if (segment.hasUnknown || isUnknownWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawUnknownStateBlock(line, stateLabels, x1, laneTop, width, laneBottom - laneTop, {
        dense: true,
        showText: false,
      }));
      continue;
    }

    if (segment.hasHighImpedance || isHighImpedanceWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawHighImpedanceStateBlock(line, stateLabels, x1, laneTop, width, laneBottom - laneTop, {
        dense: true,
        showText: false,
      }));
      continue;
    }

    if (segment.mixed || currentValue === 'mixed') {
      line
        .rect(x1, activityY, width, activityHeight)
        .fill({ color: lineColor, alpha: signal.kind === 'clock' ? 0.12 : 0.16 })
        .rect(x1, snapToDevicePixel(laneY + waveformLaneHeight / 2 - 0.5 / renderResolution, renderResolution), width, Math.max(1 / renderResolution, 1 / renderResolution))
        .fill({ color: lineColor, alpha: 0.78 });
      continue;
    }

    const isHigh = currentValue === '1';
    const y = isHigh ? topY : bottomY - railHeight;

    line
      .rect(x1, y, width, railHeight)
      .fill({ color: lineColor, alpha: isHigh ? 0.92 : 0.74 });
  }

  target.addChild(line, ...stateLabels);
  return labelCounts;
}

function drawDigitalPulseFill(target: Graphics, x: number, y: number, width: number, height: number, color: number, signalKind: WaveformSignal['kind']) {
  target
    .rect(x, y, width, Math.max(1, height))
    .fill({ color, alpha: signalKind === 'clock' ? 0.12 : 0.18 });
}

function drawDigitalActivityBlock(target: Graphics, x: number, y: number, width: number, height: number, color: number, signalKind: WaveformSignal['kind']) {
  const midY = y + height / 2;

  target
    .rect(x, y, width, Math.max(1, height))
    .fill({ color, alpha: signalKind === 'clock' ? 0.08 : 0.12 })
    .moveTo(x, midY)
    .lineTo(x + width, midY)
    .stroke({ color, width: signalKind === 'clock' ? 1.3 : 1.6, alpha: 0.84 });
}

function drawBusWaveform(target: Container, signal: WaveformSignal, options: WaveformSceneOptions, segmentResult: WaveformRenderSegmentResult, laneY: number): DrawSignalResult {
  if (segmentResult.densityMode === 'dense') {
    return drawDenseBusWaveform(target, signal, options, segmentResult, laneY);
  }

  const bus = new Graphics();
  const valueLabels: Text[] = [];
  const labelCounts = createDrawSignalResult();
  const busColor = parseHexColor(signal.color);
  const y = laneY + waveformLanePaddingY;
  const height = waveformLaneHeight - waveformLanePaddingY * 2;

  for (const segment of segmentResult.segments) {
    if (!segment) {
      continue;
    }

    const x1 = segment.x1;
    const width = segment.width;
    const currentValue = normalizeWaveformValue(segment.value);

    if (segment.hasUnknown || isUnknownWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawUnknownStateBlock(bus, valueLabels, x1, y, width, height, {
        showText: shouldShowSpecialStateText(segment, segmentResult),
      }));
    } else if (segment.hasHighImpedance || isHighImpedanceWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawHighImpedanceStateBlock(bus, valueLabels, x1, y, width, height, {
        showText: shouldShowSpecialStateText(segment, segmentResult),
      }));
    } else {
      drawElongatedHexagon(bus, x1, y, width, height, {
        color: busColor,
        fillAlpha: segment.mixed ? 0.1 : 0.16,
        strokeAlpha: segment.mixed ? 0.58 : 0.84,
        strokeWidth: 1.2,
      });
    }

    if (!segment.mixed && !isSpecialWaveformValue(currentValue) && width >= 24) {
      valueLabels.push(createText(formatWaveformValue(currentValue), palette.text, 10, x1 + 7, y + 4));
      labelCounts.renderedLabelCount += 1;
    }
  }

  target.addChild(bus);

  if (valueLabels.length > 0) {
    target.addChild(...valueLabels);
  }

  return labelCounts;
}

function drawDenseBusWaveform(target: Container, signal: WaveformSignal, options: WaveformSceneOptions, segmentResult: WaveformRenderSegmentResult, laneY: number): DrawSignalResult {
  const bus = new Graphics();
  const valueLabels: Text[] = [];
  const labelCounts = createDrawSignalResult();
  const busColor = parseHexColor(signal.color);
  const renderResolution = getRenderResolution(options);
  const y = snapToDevicePixel(laneY + waveformLanePaddingY, renderResolution);
  const height = snapToDevicePixel(waveformLaneHeight - waveformLanePaddingY * 2, renderResolution);

  for (const segment of segmentResult.segments) {
    const x1 = snapToDevicePixel(segment.x1, renderResolution);
    const x2 = snapToDevicePixel(segment.x2, renderResolution);
    const width = Math.max(1 / renderResolution, x2 - x1);
    const currentValue = normalizeWaveformValue(segment.value);

    if (segment.hasUnknown || isUnknownWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawUnknownStateBlock(bus, valueLabels, x1, y, width, height, {
        dense: true,
        showText: false,
      }));
    } else if (segment.hasHighImpedance || isHighImpedanceWaveformValue(currentValue)) {
      mergeDrawSignalResult(labelCounts, drawHighImpedanceStateBlock(bus, valueLabels, x1, y, width, height, {
        dense: true,
        showText: false,
      }));
    } else {
      bus
        .rect(x1, y, width, height)
        .fill({ color: busColor, alpha: segment.mixed || currentValue === 'mixed' ? 0.12 : 0.18 })
        .rect(x1, snapToDevicePixel(y + height / 2 - 0.5 / renderResolution, renderResolution), width, Math.max(1 / renderResolution, 1 / renderResolution))
        .fill({ color: busColor, alpha: segment.mixed || currentValue === 'mixed' ? 0.72 : 0.5 });
    }
  }

  target.addChild(bus, ...valueLabels);
  return labelCounts;
}

interface SpecialStateDrawOptions {
  dense?: boolean;
  showText: boolean;
}

function drawUnknownStateBlock(target: Graphics, labels: Text[], x: number, y: number, width: number, height: number, options: SpecialStateDrawOptions): SpecialStateLabelResult {
  drawSpecialStateBlock(target, x, y, width, height, {
    color: palette.unknown,
    dense: options.dense ?? false,
    fillAlpha: 0.22,
    pattern: 'backslash',
    state: 'x',
    strokeAlpha: 0.86,
  });
  return addSpecialStateCharacters(labels, 'x', palette.unknown, x, y, width, height, options.showText);
}

function drawHighImpedanceStateBlock(target: Graphics, labels: Text[], x: number, y: number, width: number, height: number, options: SpecialStateDrawOptions): SpecialStateLabelResult {
  drawSpecialStateBlock(target, x, y, width, height, {
    color: palette.highImpedance,
    dense: options.dense ?? false,
    fillAlpha: 0.18,
    pattern: 'chevron',
    state: 'z',
    strokeAlpha: 0.88,
  });
  return addSpecialStateCharacters(labels, 'z', palette.highImpedance, x, y, width, height, options.showText);
}

interface SpecialStateBlockStyle {
  color: number;
  dense: boolean;
  fillAlpha: number;
  pattern: 'backslash' | 'chevron';
  state: 'x' | 'z';
  strokeAlpha: number;
}

function drawSpecialStateBlock(target: Graphics, x: number, y: number, width: number, height: number, style: SpecialStateBlockStyle) {
  if (style.dense) {
    target
      .rect(x, y, width, height)
      .fill({ color: style.color, alpha: style.fillAlpha + 0.04 });
  } else {
    target
      .roundRect(x, y, width, height, 2)
      .fill({ color: style.color, alpha: style.fillAlpha })
      .stroke({ color: style.color, width: 1, alpha: style.strokeAlpha });
  }

  if (style.dense && width < 2) {
    return;
  }

  if (style.pattern === 'chevron') {
    drawChevronHatch(target, x, y, width, height, style.color, style.dense);
  } else {
    drawBackslashHatch(target, x, y, width, height, style.color, style.dense);
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

function addSpecialStateCharacters(labels: Text[], state: 'x' | 'z', color: number, x: number, y: number, width: number, height: number, showText: boolean): SpecialStateLabelResult {
  if (!showText) {
    return { renderedLabelCount: 0, suppressedLabelCount: 1 };
  }

  if (width < 8 || height < 10) {
    return { renderedLabelCount: 0, suppressedLabelCount: 0 };
  }

  const fontSize = Math.max(8, Math.min(11, height * 0.58));
  const textX = x + width / 2 - fontSize * 0.28;
  const textY = y + Math.max(1, (height - fontSize) / 2 - 1);

  labels.push(createText(state, color, fontSize, textX, textY));
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
    renderedLabelCount: 0,
    suppressedLabelCount: 0,
  };
}

function mergeDrawSignalResult(target: DrawSignalResult, source: SpecialStateLabelResult) {
  target.renderedLabelCount += source.renderedLabelCount;
  target.suppressedLabelCount += source.suppressedLabelCount;
}

function shouldShowSpecialStateText(segment: WaveformRenderSegment, segmentResult: WaveformRenderSegmentResult) {
  if (segmentResult.densityMode === 'dense') {
    return false;
  }

  if (segmentResult.densityMode === 'compact') {
    return segment.width >= 24 && segment.sourceSegmentCount <= 2;
  }

  return segment.width >= 8;
}

function shouldCacheSignalTexture(segmentResult: WaveformRenderSegmentResult, options: WaveformSceneOptions) {
  if (segmentResult.densityMode === 'dense') {
    return false;
  }

  const renderResolution = getRenderResolution(options);
  const estimatedBytes = estimateSignalTextureBytes(options.width, waveformLaneHeight, renderResolution);

  if (estimatedBytes > 2 * 1024 * 1024) {
    return false;
  }

  return segmentResult.sourceSegmentCount >= 72 || segmentResult.renderedSegmentCount >= 48 || segmentResult.coalescedSegmentCount >= 24;
}

function getSignalTextureCacheKey(signal: WaveformSignal, options: WaveformSceneOptions, segmentResult: WaveformRenderSegmentResult) {
  const lastTransition = signal.transitions[signal.transitions.length - 1];

  return [
    options.data.id,
    signal.id,
    signal.kind,
    signal.color,
    segmentResult.densityMode,
    getRenderResolution(options).toFixed(2),
    options.width,
    options.viewport.startTime.toFixed(3),
    options.viewport.endTime.toFixed(3),
    signal.transitions.length,
    lastTransition?.time.toFixed(3) ?? '0.000',
    lastTransition?.value ?? '',
    segmentResult.sourceSegmentCount,
    segmentResult.renderedSegmentCount,
    segmentResult.coalescedSegmentCount,
  ].join(':');
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
