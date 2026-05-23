import { Container, Graphics, Text } from 'pixi.js';

import type { AsicSchematicPalette } from './asicSchematicPalette';
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
  updateSelection: (selectedNodeIds: readonly string[], positions?: Record<string, { x: number; y: number } | undefined>) => void;
  updateEdgeSelection: (selectedEdgeIds: readonly string[]) => void;
  updateMarquee: (rect: SchematicWorldRect | null) => void;
  updateWires: (edges: readonly SchematicEdgeLayout[]) => void;
  updateZoom: (zoom: number) => SchematicTextZoomState;
}

export interface SchematicTextZoomState {
  labelScale: number;
  textResolution: number;
}

export interface AsicSchematicSceneOptions {
  layout: SchematicLayoutResult;
  palette: AsicSchematicPalette;
  selectedNodeIds?: readonly string[];
  selectedEdgeIds?: readonly string[];
  onNodeContainerCreated?: (node: SchematicNodeLayout, container: Container) => void;
  onModuleOpen?: (moduleId: string) => void;
}

export function createAsicSchematicScene({
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
  const selectionOverlay = new Graphics({ label: 'schematic-selection-overlay' });
  const marqueeOverlay = new Graphics({ label: 'schematic-marquee-overlay' });
  const nodeContainers = new Map<string, Container>();
  const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));
  const textNodes: Text[] = [];
  let currentEdges: readonly SchematicEdgeLayout[] = layout.edges;
  let currentSelectedEdgeIds: readonly string[] = selectedEdgeIds;

  world.addChild(backgroundLayer, wireLayer, componentLayer, interactionLayer);
  backgroundLayer.addChild(drawGrid(layout, palette));
  interactionLayer.addChild(selectionOverlay, marqueeOverlay);
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
  const updateEdgeSelection = (nextSelectedEdgeIds: readonly string[]) => {
    currentSelectedEdgeIds = nextSelectedEdgeIds;
    drawWireLayer(wireLayer, currentEdges, palette, currentSelectedEdgeIds);
  };
  const updateWires = (edges: readonly SchematicEdgeLayout[]) => {
    currentEdges = edges;
    drawWireLayer(wireLayer, currentEdges, palette, currentSelectedEdgeIds);
  };
  const updateZoom = (zoom: number) => updateTextZoom(textNodes, zoom);

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

function drawGrid(layout: SchematicLayoutResult, palette: AsicSchematicPalette) {
  const grid = new Graphics({ label: 'schematic-grid' });
  const step = 40;
  const startX = Math.floor(layout.bounds.x / step) * step;
  const startY = Math.floor(layout.bounds.y / step) * step;
  const endX = layout.bounds.x + layout.bounds.width;
  const endY = layout.bounds.y + layout.bounds.height;

  for (let x = startX; x <= endX; x += step) {
    grid.moveTo(x, startY).lineTo(x, endY).stroke({ color: palette.grid, alpha: 0.16, width: 1, pixelLine: true });
  }

  for (let y = startY; y <= endY; y += step) {
    grid.moveTo(startX, y).lineTo(endX, y).stroke({ color: palette.grid, alpha: 0.16, width: 1, pixelLine: true });
  }

  return grid;
}

function drawEdge(edge: SchematicEdgeLayout, palette: AsicSchematicPalette, selected: boolean) {
  const graphics = new Graphics({ label: `schematic-edge:${edge.id}` });
  const color = getEdgeColor(edge, palette);
  const style = getEdgeStrokeStyle(edge, selected);
  const [firstPoint, ...remainingPoints] = edge.points;

  if (!firstPoint) {
    return graphics;
  }

  if (selected) {
    graphics.moveTo(firstPoint.x, firstPoint.y);
    remainingPoints.forEach((point) => graphics.lineTo(point.x, point.y));
    graphics.stroke({ color: palette.selected, alpha: 0.92, width: style.width + 5, cap: 'round', join: 'round' });
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
  textNodes: Text[];
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

function drawPorts(container: Container, node: SchematicNodeLayout, palette: AsicSchematicPalette, textNodes: Text[] = []) {
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

function createText(textNodes: Text[], text: string, fill: number, fontSize: number, fontWeight: '400' | '600', x: number, y: number) {
  const textNode = new Text({
    text,
    style: {
      fill,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      fontSize,
      fontWeight,
    },
    x,
    y,
    resolution: 2,
  });

  textNodes.push(textNode);
  return textNode;
}

function updateTextZoom(textNodes: readonly Text[], zoom: number): SchematicTextZoomState {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const labelScale = safeZoom > 1 ? 1 / safeZoom : 1;
  const textResolution = Math.min(4, Math.max(2, Math.ceil(safeZoom * 2)));

  textNodes.forEach((textNode) => {
    textNode.scale.set(labelScale);
    (textNode as Text & { resolution: number }).resolution = textResolution;
  });

  return { labelScale, textResolution };
}

function getEdgeColor(edge: SchematicEdgeLayout, palette: AsicSchematicPalette) {
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
