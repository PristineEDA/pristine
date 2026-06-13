import type { LspLayoutCatalog, LspLayoutLayer, LspLayoutMacro, LspLayoutShape } from '../../../../../types/systemverilog-lsp';
import { shapeBounds } from './physicalLayoutGeometry';

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

export type PhysicalLayoutLayerCategory = 'pin' | 'label' | 'obstruction';

export interface PhysicalLayoutVisibility {
  outlineVisible: boolean;
  visibleItems: ReadonlySet<string>;
}

export interface MutablePhysicalLayoutVisibility {
  outlineVisible: boolean;
  visibleItems: Set<string>;
}

export interface PhysicalLayoutLayerCategoryAvailability {
  label: boolean;
  obstruction: boolean;
  pin: boolean;
}

export interface PhysicalLayoutLayerTreeEntry {
  available: boolean;
  categories: PhysicalLayoutLayerCategoryAvailability;
  layer: LspLayoutLayer;
}

export interface PhysicalLayoutPinLabel {
  color: number;
  layerIndex: number;
  name: string;
  ownerIndex: number;
  x: number;
  y: number;
}

export const physicalLayoutLayerCategories = ['pin', 'label', 'obstruction'] as const satisfies readonly PhysicalLayoutLayerCategory[];

export function getPhysicalLayoutLayerColor(layerIndex: number): PhysicalLayoutLayerColor {
  const pixiColor = layerPalette[Math.abs(layerIndex) % layerPalette.length] ?? layerPalette[0];

  return {
    cssColor: `#${pixiColor.toString(16).padStart(6, '0')}`,
    pixiColor,
  };
}

export function getPhysicalLayoutLayerCategoryColor(
  layerIndex: number,
  category: PhysicalLayoutLayerCategory,
): PhysicalLayoutLayerColor {
  if (category === 'obstruction') {
    const pixiColor = 0xf472b6;

    return {
      cssColor: `#${pixiColor.toString(16).padStart(6, '0')}`,
      pixiColor,
    };
  }

  return getPhysicalLayoutLayerColor(layerIndex);
}

export function getPhysicalLayoutOutlineColor(): PhysicalLayoutLayerColor {
  const pixiColor = 0xe5eef8;

  return {
    cssColor: `#${pixiColor.toString(16).padStart(6, '0')}`,
    pixiColor,
  };
}

export function createPhysicalLayoutVisibility(
  catalog: LspLayoutCatalog | null | undefined,
  macro: LspLayoutMacro | null | undefined,
  shapes: readonly LspLayoutShape[],
): MutablePhysicalLayoutVisibility {
  const visibleItems = new Set<string>();

  if (macro) {
    visibleItems.add(createOutlineVisibilityKey());
  }

  for (const entry of createPhysicalLayoutLayerTree(catalog, shapes)) {
    for (const category of physicalLayoutLayerCategories) {
      if (entry.categories[category]) {
        visibleItems.add(createLayerCategoryVisibilityKey(entry.layer.index, category));
      }
    }
  }

  return {
    outlineVisible: Boolean(macro),
    visibleItems,
  };
}

export function createEmptyPhysicalLayoutVisibility(): MutablePhysicalLayoutVisibility {
  return {
    outlineVisible: false,
    visibleItems: new Set(),
  };
}

export function createOutlineVisibilityKey(): string {
  return 'outline';
}

export function createLayerCategoryVisibilityKey(layerIndex: number, category: PhysicalLayoutLayerCategory): string {
  return `layer:${layerIndex}:${category}`;
}

export function isPhysicalLayoutOutlineVisible(visibility: PhysicalLayoutVisibility): boolean {
  return visibility.outlineVisible && visibility.visibleItems.has(createOutlineVisibilityKey());
}

export function isPhysicalLayoutLayerCategoryVisible(
  visibility: PhysicalLayoutVisibility,
  layerIndex: number,
  category: PhysicalLayoutLayerCategory,
): boolean {
  return visibility.visibleItems.has(createLayerCategoryVisibilityKey(layerIndex, category));
}

export function createPhysicalLayoutLayerTree(
  catalog: LspLayoutCatalog | null | undefined,
  shapes: readonly LspLayoutShape[],
): PhysicalLayoutLayerTreeEntry[] {
  const shapeCountsByLayer = new Map<number, PhysicalLayoutLayerCategoryAvailability>();
  const pinNameByKey = createPhysicalLayoutPinNameMap(catalog);

  for (const shape of shapes) {
    const categories = shapeCountsByLayer.get(shape.layerIndex) ?? { label: false, obstruction: false, pin: false };

    if (shape.ownerKind === 'pin') {
      categories.pin = true;
      categories.label = categories.label || getPhysicalLayoutPinName(pinNameByKey, shape) !== null;
    } else if (shape.ownerKind === 'obstruction') {
      categories.obstruction = true;
    }

    shapeCountsByLayer.set(shape.layerIndex, categories);
  }

  return (catalog?.layers ?? []).map((layer) => {
    const categories = shapeCountsByLayer.get(layer.index) ?? { label: false, obstruction: false, pin: false };

    return {
      available: categories.pin || categories.label || categories.obstruction,
      categories,
      layer,
    };
  });
}

export function filterVisiblePhysicalLayoutShapes(
  shapes: readonly LspLayoutShape[],
  visibility: PhysicalLayoutVisibility,
): LspLayoutShape[] {
  return shapes.filter((shape) => {
    if (shape.ownerKind === 'pin') {
      return isPhysicalLayoutLayerCategoryVisible(visibility, shape.layerIndex, 'pin');
    }

    if (shape.ownerKind === 'obstruction') {
      return isPhysicalLayoutLayerCategoryVisible(visibility, shape.layerIndex, 'obstruction');
    }

    return false;
  });
}

export function getVisiblePhysicalLayoutShapeCounts(
  shapes: readonly LspLayoutShape[],
  visibility: PhysicalLayoutVisibility,
): { obstruction: number; pin: number } {
  let pin = 0;
  let obstruction = 0;

  for (const shape of shapes) {
    if (shape.ownerKind === 'pin' && isPhysicalLayoutLayerCategoryVisible(visibility, shape.layerIndex, 'pin')) {
      pin += 1;
    } else if (
      shape.ownerKind === 'obstruction'
      && isPhysicalLayoutLayerCategoryVisible(visibility, shape.layerIndex, 'obstruction')
    ) {
      obstruction += 1;
    }
  }

  return { obstruction, pin };
}

export function createPhysicalLayoutPinLabels(
  catalog: LspLayoutCatalog | null | undefined,
  shapes: readonly LspLayoutShape[],
  visibility: PhysicalLayoutVisibility,
): PhysicalLayoutPinLabel[] {
  const pinNameByKey = createPhysicalLayoutPinNameMap(catalog);
  const labelBoundsByKey = new Map<string, {
    color: number;
    layerIndex: number;
    name: string;
    ownerIndex: number;
    x0: number;
    x1: number;
    y0: number;
    y1: number;
  }>();

  for (const shape of shapes) {
    if (
      shape.ownerKind !== 'pin'
      || !isPhysicalLayoutLayerCategoryVisible(visibility, shape.layerIndex, 'label')
    ) {
      continue;
    }

    const pinName = getPhysicalLayoutPinName(pinNameByKey, shape);
    if (!pinName) {
      continue;
    }

    const bounds = shapeBounds(shape);
    const key = `${shape.macroIndex ?? 'global'}:${shape.layerIndex}:${shape.ownerIndex}`;
    const existing = labelBoundsByKey.get(key);

    if (existing) {
      existing.x0 = Math.min(existing.x0, bounds.x0);
      existing.y0 = Math.min(existing.y0, bounds.y0);
      existing.x1 = Math.max(existing.x1, bounds.x1);
      existing.y1 = Math.max(existing.y1, bounds.y1);
      continue;
    }

    labelBoundsByKey.set(key, {
      color: getPhysicalLayoutLayerColor(shape.layerIndex).pixiColor,
      layerIndex: shape.layerIndex,
      name: pinName,
      ownerIndex: shape.ownerIndex,
      x0: bounds.x0,
      y0: bounds.y0,
      x1: bounds.x1,
      y1: bounds.y1,
    });
  }

  return Array.from(labelBoundsByKey.values()).map((entry) => ({
    color: entry.color,
    layerIndex: entry.layerIndex,
    name: entry.name,
    ownerIndex: entry.ownerIndex,
    x: (entry.x0 + entry.x1) / 2,
    y: (entry.y0 + entry.y1) / 2,
  }));
}

export function createPhysicalLayoutPinNameMap(catalog: LspLayoutCatalog | null | undefined): ReadonlyMap<string, string> {
  const pinNameByKey = new Map<string, string>();

  for (const pin of catalog?.pins ?? []) {
    if (pin.name.length === 0) {
      continue;
    }

    pinNameByKey.set(createPinNameKey(pin.macroIndex, pin.pinIndex), pin.name);
  }

  return pinNameByKey;
}

function getPhysicalLayoutPinName(pinNameByKey: ReadonlyMap<string, string>, shape: LspLayoutShape): string | null {
  if (shape.macroIndex === null) {
    return null;
  }

  return pinNameByKey.get(createPinNameKey(shape.macroIndex, shape.ownerIndex)) ?? null;
}

function createPinNameKey(macroIndex: number, pinIndex: number): string {
  return `${macroIndex}:${pinIndex}`;
}

export function getVisiblePhysicalLayoutLayerCount(
  catalog: LspLayoutCatalog | null | undefined,
  visibility: PhysicalLayoutVisibility,
): number {
  return (catalog?.layers ?? []).filter((layer) => (
    physicalLayoutLayerCategories.some((category) => isPhysicalLayoutLayerCategoryVisible(visibility, layer.index, category))
  )).length;
}

export function getVisiblePhysicalLayoutCategoryCount(
  catalog: LspLayoutCatalog | null | undefined,
  visibility: PhysicalLayoutVisibility,
): number {
  return (catalog?.layers ?? []).reduce((count, layer) => (
    count + physicalLayoutLayerCategories.filter((category) => (
      isPhysicalLayoutLayerCategoryVisible(visibility, layer.index, category)
    )).length
  ), 0);
}
