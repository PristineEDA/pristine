import { BitmapFont, BitmapText, Container, Graphics } from 'pixi.js';

import type { AsicSchematicPalette } from './asicSchematicPalette';
import type { SchematicAlignmentGuide } from './asicSchematicGuides';
import type { SchematicEdgeLayout, SchematicLayoutResult, SchematicNodeLayout } from './asicSchematicTypes';

export type SchematicLayerName = 'background' | 'wire' | 'component' | 'interaction';

export interface SchematicWorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AsicSchematicScene {
  world: Container;
  layers: Record<SchematicLayerName, Container>;
  nodeContainers: Map<string, Container>;
  updateAlignmentGuides: (guides: readonly SchematicAlignmentGuide[]) => SchematicAlignmentGuideState;
  updateGrid: (camera: SchematicCameraState, viewport: SchematicViewport, options?: SchematicGridOptions) => SchematicGridState;
  updateSelection: (selectedNodeIds: readonly string[], positions?: Record<string, { x: number; y: number } | undefined>) => void;
  updateEdgeSelection: (selectedEdgeIds: readonly string[]) => void;
  updateMarquee: (rect: SchematicWorldRect | null) => void;
  updateWires: (edges: readonly SchematicEdgeLayout[]) => void;
  updateZoom: (zoom: number) => SchematicTextZoomState;
}

export interface SchematicTextZoomState {
  labelScale: number;
  textResolution: number;
  textFontStatus: 'bitmap-ready';
  textRenderer: 'bitmap';
}

export interface SchematicCameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface SchematicViewport {
  width: number;
  height: number;
}

export interface SchematicGridOptions {
  enabled: boolean;
  gridSize: number;
}

export interface SchematicGridState {
  effectiveStep: number;
  enabled: boolean;
  gridSize: number;
  lineCount: number;
}

export interface SchematicAlignmentGuideState {
  count: number;
  visible: boolean;
}

export interface AsicSchematicSceneOptions {
  gridOptions?: SchematicGridOptions;
  layout: SchematicLayoutResult;
  palette: AsicSchematicPalette;
  selectedNodeIds?: readonly string[];
  selectedEdgeIds?: readonly string[];
  onNodeContainerCreated?: (node: SchematicNodeLayout, container: Container) => void;
  onModuleOpen?: (moduleId: string) => void;
}

export function createAsicSchematicScene({
  gridOptions = { enabled: true, gridSize: 40 },
  layout,
  palette,
  selectedNodeIds = [],
  selectedEdgeIds = [],
  onNodeContainerCreated,
  onModuleOpen,
}: AsicSchematicSceneOptions): AsicSchematicScene {
  const world = new Container({ label: `schematic-world:${layout.module.id}`, sortableChildren: true, isRenderGroup: true });
  const backgroundLayer = new Container({ label: 'schematic-layer-background', zIndex: 0 });
  const wireLayer = new Container({ label: 'schematic-layer-wire', zIndex: 10 });
  const componentLayer = new Container({ label: 'schematic-layer-component', zIndex: 20, sortableChildren: true });
  const interactionLayer = new Container({ label: 'schematic-layer-interaction', zIndex: 30 });
  const gridOverlay = new Graphics({ label: 'schematic-grid' });
  const guideOverlay = new Graphics({ label: 'schematic-alignment-guides' });
  const selectionOverlay = new Graphics({ label: 'schematic-selection-overlay' });
  const marqueeOverlay = new Graphics({ label: 'schematic-marquee-overlay' });
  const nodeContainers = new Map<string, Container>();
  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));
  const textNodes: BitmapText[] = [];
  let currentEdges: readonly SchematicEdgeLayout[] = layout.edges;
  let currentSelectedEdgeIds: readonly string[] = selectedEdgeIds;
  drawGrid(gridOverlay, layout, palette, null, null, gridOptions);

  world.addChild(backgroundLayer, wireLayer, componentLayer, interactionLayer);
  backgroundLayer.addChild(gridOverlay);
  interactionLayer.addChild(guideOverlay, selectionOverlay, marqueeOverlay);
  layout.nodes.forEach((node) => {
    const container = drawNode({ node, palette, textNodes, onModuleOpen });
    nodeContainers.set(node.id, container);
    onNodeContainerCreated?.(node, container);
    componentLayer.addChild(container);
  });
  drawWireLayer(wireLayer, currentEdges, palette, currentSelectedEdgeIds);

  const updateSelection = (nextSelectedNodeIds: readonly string[], positions?: Record<string, { x: number; y: number } | undefined>) => {
    drawSelectionOverlay(selectionOverlay, nextSelectedNodeIds, nodeMap, palette, positions);
  };
  const updateMarquee = (rect: SchematicWorldRect | null) => {
    drawMarqueeOverlay(marqueeOverlay, rect, palette);
  };
  const updateAlignmentGuides = (guides: readonly SchematicAlignmentGuide[]) => {
    return drawAlignmentGuides(guideOverlay, guides, palette);
  };
  const updateGrid = (camera: SchematicCameraState, viewport: SchematicViewport, options = gridOptions) => {
    return drawGrid(gridOverlay, layout, palette, camera, viewport, options);
  };
  const updateEdgeSelection = (nextSelectedEdgeIds: readonly string[]) => {
    currentSelectedEdgeIds = nextSelectedEdgeIds;
    drawWireLayer(wireLayer, currentEdges, palette, currentSelectedEdgeIds);
  };
  const updateWires = (edges: readonly SchematicEdgeLayout[]) => {
    currentEdges = edges;
    drawWireLayer(wireLayer, currentEdges, palette, currentSelectedEdgeIds);
  };
  const updateZoom = () => updateTextZoom();

  updateSelection(selectedNodeIds);
  updateEdgeSelection(selectedEdgeIds);

  return {
    world,
    layers: {
      background: backgroundLayer,
      wire: wireLayer,
      component: componentLayer,
      interaction: interactionLayer,
    },
    nodeContainers,
    updateAlignmentGuides,
    updateGrid,
    updateSelection,
    updateEdgeSelection,
    updateMarquee,
    updateWires,
    updateZoom,
  };
}

function drawWireLayer(
  layer: Container,
  edges: readonly SchematicEdgeLayout[],
  palette: AsicSchematicPalette,
  selectedEdgeIds: readonly string[],
) {
  const selectedEdges = new Set(selectedEdgeIds);

  layer.removeChildren().forEach((child) => child.destroy({ children: true }));
  edges.forEach((edge) => layer.addChild(drawEdge(edge, palette, selectedEdges.has(edge.id))));
}

function drawSelectionOverlay(
  graphics: Graphics,
  selectedNodeIds: readonly string[],
  nodeMap: Map<string, SchematicNodeLayout>,
  palette: AsicSchematicPalette,
  positions?: Record<string, { x: number; y: number } | undefined>,
) {
  graphics.clear();

  selectedNodeIds.forEach((nodeId) => {
    const node = nodeMap.get(nodeId);

    if (!node || node.kind !== 'module') {
      return;
    }

    const position = positions?.[nodeId];
    const x = position?.x ?? node.x;
    const y = position?.y ?? node.y;

    graphics
      .roundRect(x - 5, y - 5, node.width + 10, node.height + 10, 10)
      .stroke({ color: palette.selected, alpha: 0.96, width: 2.2 });
  });
}

function drawMarqueeOverlay(graphics: Graphics, rect: SchematicWorldRect | null, palette: AsicSchematicPalette) {
  graphics.clear();

  if (!rect || rect.width < 1 || rect.height < 1) {
    return;
  }

  graphics
    .rect(rect.x, rect.y, rect.width, rect.height)
    .fill({ color: palette.selected, alpha: 0.08 })
    .stroke({ color: palette.selected, alpha: 0.8, width: 1.4, pixelLine: true });
}

function drawGrid(
  graphics: Graphics,
  layout: SchematicLayoutResult,
  palette: AsicSchematicPalette,
  camera: SchematicCameraState | null,
  viewport: SchematicViewport | null,
  options: SchematicGridOptions,
): SchematicGridState {
  graphics.clear();

  const gridSize = normalizeGridSize(options.gridSize);
  if (!options.enabled) {
    return { effectiveStep: gridSize, enabled: false, gridSize, lineCount: 0 };
  }

  const zoom = camera?.zoom && camera.zoom > 0 ? camera.zoom : 1;
  const effectiveStep = getEffectiveGridStep(gridSize, zoom);
  const visibleRect = camera && viewport
    ? getVisibleWorldRect(camera, viewport)
    : layout.bounds;
  const padding = effectiveStep * 2;
  const startX = Math.floor((visibleRect.x - padding) / effectiveStep) * effectiveStep;
  const startY = Math.floor((visibleRect.y - padding) / effectiveStep) * effectiveStep;
  const endX = visibleRect.x + visibleRect.width + padding;
  const endY = visibleRect.y + visibleRect.height + padding;
  let lineCount = 0;

  for (let x = startX; x <= endX; x += effectiveStep) {
    graphics.moveTo(x, startY).lineTo(x, endY).stroke({ color: palette.grid, alpha: 0.16, width: 1, pixelLine: true });
    lineCount += 1;
  }

  for (let y = startY; y <= endY; y += effectiveStep) {
    graphics.moveTo(startX, y).lineTo(endX, y).stroke({ color: palette.grid, alpha: 0.16, width: 1, pixelLine: true });
    lineCount += 1;
  }

  return { effectiveStep, enabled: true, gridSize, lineCount };
}

function drawEdge(edge: SchematicEdgeLayout, palette: AsicSchematicPalette, selected: boolean) {
  const graphics = new Graphics({ label: `schematic-edge:${edge.id}` });
  const color = getSchematicEdgeColor(edge, palette);
  const style = getEdgeStrokeStyle(edge, selected);
  const [firstPoint, ...remainingPoints] = edge.points;

  if (!firstPoint) {
    return graphics;
  }

  if (selected) {
    graphics.moveTo(firstPoint.x, firstPoint.y);
    remainingPoints.forEach((point) => graphics.lineTo(point.x, point.y));
    graphics.stroke({ color, alpha: 0.42, width: style.width + 5, cap: 'round', join: 'round' });
  }

  graphics.moveTo(firstPoint.x, firstPoint.y);
  remainingPoints.forEach((point) => graphics.lineTo(point.x, point.y));
  graphics.stroke({ color, alpha: style.alpha, width: style.width, cap: 'round', join: 'round' });

  const lastPoint = edge.points[edge.points.length - 1];
  if (lastPoint) {
    if (edge.isBus) {
      const size = selected ? 7 : 5.5;
      graphics.rect(lastPoint.x - size / 2, lastPoint.y - size / 2, size, size).fill({ color, alpha: 0.9 });
    } else {
      graphics.circle(lastPoint.x, lastPoint.y, selected ? 4.6 : 3).fill({ color, alpha: 0.88 });
    }
  }

  return graphics;
}

export function getSchematicEdgeColor(edge: SchematicEdgeLayout, palette: AsicSchematicPalette) {
  switch (edge.kind) {
    case 'clock':
      return palette.clock;
    case 'reset':
      return palette.reset;
    case 'control':
      return palette.warning;
    case 'bus':
      return palette.accent;
    default:
      return palette.wire;
  }
}

function getEdgeStrokeStyle(edge: SchematicEdgeLayout, selected: boolean) {
  if (edge.isBus) {
    return { alpha: selected ? 0.98 : 0.86, width: selected ? 3.7 : 2.9 };
  }

  if (edge.kind === 'clock') {
    return { alpha: selected ? 0.98 : 0.82, width: selected ? 2.6 : 2.1 };
  }

  return { alpha: selected ? 0.96 : 0.72, width: selected ? 2.1 : 1.35 };
}

function drawNode({
  node,
  palette,
  textNodes,
  onModuleOpen,
}: {
  node: SchematicNodeLayout;
  palette: AsicSchematicPalette;
  textNodes: BitmapText[];
  onModuleOpen?: (moduleId: string) => void;
}) {
  const container = new Container({ label: `schematic-node:${node.id}`, x: node.x, y: node.y });
  const fill = node.kind === 'port' ? palette.panelMuted : palette.panel;
  const border = node.kind === 'port' ? palette.textMuted : palette.border;

  container.addChild(new Graphics({ label: `schematic-node-body:${node.id}` })
    .roundRect(0, 0, node.width, node.height, node.kind === 'port' ? 7 : 8)
    .fill({ color: fill, alpha: node.kind === 'port' ? 0.88 : 0.96 })
    .stroke({ color: border, alpha: 0.72, width: 1.2 }));
  container.addChild(createText(textNodes, node.label, palette.text, node.kind === 'port' ? 11 : 12, '600', node.kind === 'port' ? 10 : 12, node.kind === 'port' ? 8 : 10));
  container.addChild(createText(textNodes, node.subtitle, palette.textMuted, 10, '400', node.kind === 'port' ? 10 : 12, node.kind === 'port' ? 21 : 28));

  if (node.kind === 'module') {
    drawPorts(container, node, palette, textNodes);

    if (node.canDrillDown) {
      const badge = createText(textNodes, 'open', palette.accent, 9, '600', node.width - 12, node.height - 18);
      badge.anchor.set(1, 0);
      container.addChild(badge);
    }
  }

  container.eventMode = 'static';
  container.cursor = node.kind === 'module' ? 'grab' : 'default';
  container.on('dblclick', () => {
    if (node.canDrillDown && node.moduleId) {
      onModuleOpen?.(node.moduleId);
    }
  });

  return container;
}

function drawPorts(container: Container, node: SchematicNodeLayout, palette: AsicSchematicPalette, textNodes: BitmapText[] = []) {
  node.ports.forEach((port) => {
    const localY = port.y - node.y;
    const sideMultiplier = port.side === 'west' ? 1 : -1;
    const anchorX = port.side === 'west' ? -1 : node.width + 1;
    const labelX = port.side === 'west' ? 10 : node.width - 10;
    const portColor = port.direction === 'input' ? palette.info : port.direction === 'output' ? palette.success : palette.warning;

    container.addChild(new Graphics().circle(anchorX, localY, 3.6).fill({ color: portColor, alpha: 0.9 }));
    container.addChild(new Graphics().moveTo(anchorX, localY).lineTo(anchorX + sideMultiplier * 8, localY).stroke({ color: portColor, alpha: 0.64, width: 1 }));

    const portText = createText(textNodes, port.name, palette.textMuted, 9, '400', labelX, localY - 6);
    if (port.side === 'east') {
      portText.anchor.set(1, 0);
    }
    container.addChild(portText);
  });
}

function createText(textNodes: BitmapText[], text: string, fill: number, fontSize: number, fontWeight: '400' | '600', x: number, y: number) {
  ensureSchematicBitmapFonts();

  const textNode = new BitmapText({
    text,
    style: {
      fill,
      fontFamily: fontWeight === '600' ? schematicBitmapFontSemibold : schematicBitmapFontRegular,
      fontSize,
    },
    x,
    y,
  });

  textNodes.push(textNode);
  return textNode;
}

function updateTextZoom(): SchematicTextZoomState {
  return {
    labelScale: 1,
    textFontStatus: 'bitmap-ready',
    textRenderer: 'bitmap',
    textResolution: schematicBitmapFontResolution,
  };
}

function drawAlignmentGuides(
  graphics: Graphics,
  guides: readonly SchematicAlignmentGuide[],
  palette: AsicSchematicPalette,
): SchematicAlignmentGuideState {
  graphics.clear();

  guides.forEach((guide) => {
    const color = guide.kind === 'center' ? palette.accent : palette.warning;
    const alpha = guide.kind === 'center' ? 0.82 : 0.58;

    if (guide.orientation === 'vertical') {
      graphics.moveTo(guide.position, guide.start).lineTo(guide.position, guide.end).stroke({ color, alpha, width: 1, pixelLine: true });
    } else {
      graphics.moveTo(guide.start, guide.position).lineTo(guide.end, guide.position).stroke({ color, alpha, width: 1, pixelLine: true });
    }
  });

  return { count: guides.length, visible: guides.length > 0 };
}

function normalizeGridSize(gridSize: number) {
  return Number.isFinite(gridSize) && gridSize > 0 ? Math.max(1, Math.round(gridSize)) : 40;
}

function getEffectiveGridStep(gridSize: number, zoom: number) {
  let step = gridSize;
  while (step * zoom < 8) {
    step *= 2;
  }

  return step;
}

function getVisibleWorldRect(camera: SchematicCameraState, viewport: SchematicViewport) {
  const safeZoom = camera.zoom > 0 ? camera.zoom : 1;

  return {
    x: (0 - camera.x) / safeZoom,
    y: (0 - camera.y) / safeZoom,
    width: viewport.width / safeZoom,
    height: viewport.height / safeZoom,
  };
}

const schematicBitmapFontRegular = 'PristineSchematicBitmapRegular';
const schematicBitmapFontSemibold = 'PristineSchematicBitmapSemibold';
const schematicBitmapFontResolution = 3;
let schematicBitmapFontsInstalled = false;

function ensureSchematicBitmapFonts() {
  if (schematicBitmapFontsInstalled) {
    return;
  }

  const commonOptions = {
    chars: [[' ', '~']],
    dynamicFill: true,
    padding: 6,
    resolution: schematicBitmapFontResolution,
  };

  BitmapFont.install({
    ...commonOptions,
    name: schematicBitmapFontRegular,
    style: {
      fill: 0xffffff,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      fontSize: 16,
      fontWeight: '400',
    },
  });
  BitmapFont.install({
    ...commonOptions,
    name: schematicBitmapFontSemibold,
    style: {
      fill: 0xffffff,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  schematicBitmapFontsInstalled = true;
}
