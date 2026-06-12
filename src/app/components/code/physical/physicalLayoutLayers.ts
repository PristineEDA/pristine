import type { LspLayoutShape } from '../../../../../types/systemverilog-lsp';

const layerPalette = [
  0x52a8ff,
  0xffc857,
  0x4dd599,
  0xf67280,
  0xb38cff,
  0x74d4ff,
  0xff9f43,
  0xa3e635,
  0xf472b6,
  0x7dd3fc,
] as const;

export interface PhysicalLayoutLayerColor {
  cssColor: string;
  pixiColor: number;
}

export type VisibleLayoutLayerSet = ReadonlySet<number>;

export function getPhysicalLayoutLayerColor(layerIndex: number): PhysicalLayoutLayerColor {
  const pixiColor = layerPalette[Math.abs(layerIndex) % layerPalette.length] ?? layerPalette[0];

  return {
    cssColor: `#${pixiColor.toString(16).padStart(6, '0')}`,
    pixiColor,
  };
}

export function createVisibleLayoutLayerSet(layerIndices: readonly number[]): Set<number> {
  return new Set(layerIndices);
}

export function isLayoutLayerVisible(visibleLayerIndices: VisibleLayoutLayerSet, layerIndex: number): boolean {
  return visibleLayerIndices.has(layerIndex);
}

export function filterVisibleLayoutShapes(
  shapes: readonly LspLayoutShape[],
  visibleLayerIndices: VisibleLayoutLayerSet,
): LspLayoutShape[] {
  return shapes.filter((shape) => isLayoutLayerVisible(visibleLayerIndices, shape.layerIndex));
}
