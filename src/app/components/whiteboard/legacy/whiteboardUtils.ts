import type { VeConfig } from './types';

export type ShapeToolOption =
  | 'shape-circle'
  | 'shape-triangle'
  | 'shape-rectangle'
  | 'shape-pentagon'
  | 'shape-hexagon'
  | 'shape-octagon';

export interface ShapeToolDefinition {
  kind: 'circle' | 'triangle' | 'rectangle' | 'polygon';
  name: string;
  radius?: number;
  width?: number;
  height?: number;
  sides?: number;
}

export interface PenStyleDefinition {
  color: string;
  dash: number[];
  strokeWidth: number;
}

export interface GridRenderMetrics {
  spacing: number;
  startX: number;
  endX: number;
  startY: number;
  endY: number;
}

const PEN_COLOR_MAP: Record<string, string> = {
  'pen-black': '#000000',
  'pen-white': '#ffffff',
  'pen-gray': '#6b7280',
  'pen-red': '#ef4444',
  'pen-orange': '#f97316',
  'pen-yellow': '#eab308',
  'pen-green': '#22c55e',
  'pen-cyan': '#06b6d4',
  'pen-blue': '#3b82f6',
  'pen-purple': '#a855f7',
};

const PEN_SIZE_MAP: Record<string, number> = {
  'pen-small': 2,
  'pen-medium': 4,
  'pen-large': 6,
  'earser-small': 10,
  'earser-medium': 16,
  'earser-large': 24,
  'earser-extra large': 32,
};

export const WHITEBOARD_SELECTABLE_SELECTOR = '.circle, .triangle, .rectangle, .pentagon, .hexagon, .octagon, .text, .image';

export function clampScale(scale: number, minZoom: number, maxZoom: number): number {
  return Math.min(Math.max(scale, minZoom), maxZoom);
}

export function resolveShapeTool(tool: string, config: VeConfig): ShapeToolDefinition {
  switch (tool as ShapeToolOption) {
    case 'shape-triangle':
      return { kind: 'triangle', name: 'triangle', radius: config.gridSize * 3 };
    case 'shape-rectangle':
      return { kind: 'rectangle', name: 'rectangle', width: config.gridSize * 6, height: config.gridSize * 4 };
    case 'shape-pentagon':
      return { kind: 'polygon', name: 'pentagon', radius: config.gridSize * 3, sides: 5 };
    case 'shape-hexagon':
      return { kind: 'polygon', name: 'hexagon', radius: config.gridSize * 3, sides: 6 };
    case 'shape-octagon':
      return { kind: 'polygon', name: 'octagon', radius: config.gridSize * 3, sides: 8 };
    case 'shape-circle':
    default:
      return { kind: 'circle', name: 'circle', radius: config.gridSize * 2 };
  }
}

export function resolvePenStyle(
  sizeKey: string,
  colorKey: string,
  dashKey: string,
): PenStyleDefinition {
  return {
    color: PEN_COLOR_MAP[colorKey] ?? PEN_COLOR_MAP['pen-black']!,
    dash: dashKey === 'pen-dash' ? [10, 8] : [],
    strokeWidth: PEN_SIZE_MAP[sizeKey] ?? PEN_SIZE_MAP['pen-small']!,
  };
}

export function resolveEraserWidth(sizeKey: string): number {
  return PEN_SIZE_MAP[sizeKey] ?? PEN_SIZE_MAP['earser-small']!;
}

export function getGridRenderMetrics(
  stageWidth: number,
  stageHeight: number,
  stageX: number,
  stageY: number,
  scale: number,
  gridSize: number,
): GridRenderMetrics {
  let spacing = gridSize;

  if (scale <= 0.3) {
    spacing *= 3;
  } else if (scale <= 0.5) {
    spacing *= 2;
  }

  const margin = spacing * 2;
  const worldLeft = -stageX / scale;
  const worldTop = -stageY / scale;
  const worldRight = worldLeft + stageWidth / scale;
  const worldBottom = worldTop + stageHeight / scale;

  return {
    spacing,
    startX: Math.floor((worldLeft - margin) / spacing) * spacing,
    endX: Math.ceil((worldRight + margin) / spacing) * spacing,
    startY: Math.floor((worldTop - margin) / spacing) * spacing,
    endY: Math.ceil((worldBottom + margin) / spacing) * spacing,
  };
}