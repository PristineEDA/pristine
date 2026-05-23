import { Container, Graphics, Text } from 'pixi.js';

import type { AsicSchematicPalette } from './asicSchematicPalette';
import type { SchematicEdgeLayout, SchematicLayoutResult, SchematicNodeLayout } from './asicSchematicTypes';

export interface AsicSchematicSceneOptions {
  layout: SchematicLayoutResult;
  palette: AsicSchematicPalette;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  onModuleOpen?: (moduleId: string) => void;
}

export function createAsicSchematicScene({
  layout,
  palette,
  selectedNodeId,
  onNodeSelect,
  onModuleOpen,
}: AsicSchematicSceneOptions) {
  const world = new Container({ label: `schematic-world:${layout.module.id}`, sortableChildren: true });
  const edgeLayer = new Container({ label: 'schematic-edges' });
  const nodeLayer = new Container({ label: 'schematic-nodes', sortableChildren: true });

  world.addChild(drawGrid(layout, palette), edgeLayer, nodeLayer);
  layout.edges.forEach((edge) => edgeLayer.addChild(drawEdge(edge, palette)));
  layout.nodes.forEach((node) => nodeLayer.addChild(drawNode({ node, palette, selected: node.id === selectedNodeId, onNodeSelect, onModuleOpen })));

  return world;
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

function drawEdge(edge: SchematicEdgeLayout, palette: AsicSchematicPalette) {
  const graphics = new Graphics({ label: `schematic-edge:${edge.id}` });
  const color = getEdgeColor(edge, palette);
  const [firstPoint, ...remainingPoints] = edge.points;

  if (!firstPoint) {
    return graphics;
  }

  graphics.moveTo(firstPoint.x, firstPoint.y);
  remainingPoints.forEach((point) => graphics.lineTo(point.x, point.y));
  graphics.stroke({ color, alpha: 0.78, width: edge.kind === 'clock' ? 2.4 : 1.6, cap: 'round', join: 'round' });

  const lastPoint = edge.points[edge.points.length - 1];
  if (lastPoint) {
    graphics.circle(lastPoint.x, lastPoint.y, 3).fill({ color, alpha: 0.88 });
  }

  return graphics;
}

function drawNode({
  node,
  palette,
  selected,
  onNodeSelect,
  onModuleOpen,
}: {
  node: SchematicNodeLayout;
  palette: AsicSchematicPalette;
  selected: boolean;
  onNodeSelect?: (nodeId: string | null) => void;
  onModuleOpen?: (moduleId: string) => void;
}) {
  const container = new Container({ label: `schematic-node:${node.id}`, x: node.x, y: node.y });
  const fill = node.kind === 'port' ? palette.panelMuted : palette.panel;
  const border = selected ? palette.selected : node.kind === 'port' ? palette.textMuted : palette.border;

  container.addChild(new Graphics({ label: `schematic-node-body:${node.id}` })
    .roundRect(0, 0, node.width, node.height, node.kind === 'port' ? 7 : 8)
    .fill({ color: fill, alpha: node.kind === 'port' ? 0.88 : 0.96 })
    .stroke({ color: border, alpha: selected ? 0.96 : 0.72, width: selected ? 2.4 : 1.2 }));
  container.addChild(createText(node.label, palette.text, node.kind === 'port' ? 11 : 12, '600', node.kind === 'port' ? 10 : 12, node.kind === 'port' ? 8 : 10));
  container.addChild(createText(node.subtitle, palette.textMuted, 10, '400', node.kind === 'port' ? 10 : 12, node.kind === 'port' ? 21 : 28));

  if (node.kind === 'module') {
    drawPorts(container, node, palette);

    if (node.canDrillDown) {
      const badge = createText('open', palette.accent, 9, '600', node.width - 12, node.height - 18);
      badge.anchor.set(1, 0);
      container.addChild(badge);
    }
  }

  container.eventMode = 'static';
  container.cursor = node.canDrillDown ? 'pointer' : 'default';
  container.on('pointertap', () => onNodeSelect?.(node.id));
  container.on('rightclick', () => onNodeSelect?.(null));
  container.on('dblclick', () => {
    if (node.canDrillDown && node.moduleId) {
      onModuleOpen?.(node.moduleId);
    }
  });

  return container;
}

function drawPorts(container: Container, node: SchematicNodeLayout, palette: AsicSchematicPalette) {
  node.ports.forEach((port) => {
    const localY = port.y - node.y;
    const sideMultiplier = port.side === 'west' ? 1 : -1;
    const anchorX = port.side === 'west' ? -1 : node.width + 1;
    const labelX = port.side === 'west' ? 10 : node.width - 10;
    const portColor = port.direction === 'input' ? palette.info : port.direction === 'output' ? palette.success : palette.warning;

    container.addChild(new Graphics().circle(anchorX, localY, 3.6).fill({ color: portColor, alpha: 0.9 }));
    container.addChild(new Graphics().moveTo(anchorX, localY).lineTo(anchorX + sideMultiplier * 8, localY).stroke({ color: portColor, alpha: 0.64, width: 1 }));

    const portText = createText(port.name, palette.textMuted, 9, '400', labelX, localY - 6);
    if (port.side === 'east') {
      portText.anchor.set(1, 0);
    }
    container.addChild(portText);
  });
}

function createText(text: string, fill: number, fontSize: number, fontWeight: '400' | '600', x: number, y: number) {
  return new Text({
    text,
    style: {
      fill,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      fontSize,
      fontWeight,
    },
    x,
    y,
  });
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
