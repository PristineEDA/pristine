import type { LspLayoutCatalog, LspLayoutLayer, LspLayoutShape } from '../../../../../types/systemverilog-lsp';
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

export type PhysicalLayoutLayerCategory =
  | 'pin'
  | 'label'
  | 'obstruction'
  | 'net'
  | 'specialNet'
  | 'blockage'
  | 'boundary'
  | 'path'
  | 'text';

export interface PhysicalLayoutVisibility {
  layerOpacities: ReadonlyMap<number, number>;
  outlineVisible: boolean;
  visibleItems: ReadonlySet<string>;
}

export interface MutablePhysicalLayoutVisibility {
  layerOpacities: Map<number, number>;
  outlineVisible: boolean;
  visibleItems: Set<string>;
}

export type PhysicalLayoutLayerCategoryAvailability = Record<PhysicalLayoutLayerCategory, boolean>;

export interface PhysicalLayoutLayerTreeEntry {
  available: boolean;
  categories: PhysicalLayoutLayerCategoryAvailability;
  layer: LspLayoutLayer;
}

export interface PhysicalLayoutPinLabel {
  color: number;
  layerIndex: number;
  name: string;
  opacity: number;
  ownerIndex: number;
  x: number;
  y: number;
}

export const physicalLayoutLefDefLayerCategories = ['pin', 'label', 'obstruction', 'net', 'specialNet', 'blockage'] as const satisfies readonly PhysicalLayoutLayerCategory[];
export const physicalLayoutGdsLayerCategories = ['boundary', 'path', 'text'] as const satisfies readonly PhysicalLayoutLayerCategory[];
export const physicalLayoutLayerCategories = [
  ...physicalLayoutLefDefLayerCategories,
  ...physicalLayoutGdsLayerCategories,
] as const satisfies readonly PhysicalLayoutLayerCategory[];

export const physicalLayoutLayerOpacityMin = 0.2;
export const physicalLayoutLayerOpacityMax = 1;
export const physicalLayoutLayerOpacityStep = 0.05;

export function getPhysicalLayoutLayerCategories(catalog: LspLayoutCatalog | null | undefined): readonly PhysicalLayoutLayerCategory[] {
  return catalog?.sourceKind === 'gds' ? physicalLayoutGdsLayerCategories : physicalLayoutLefDefLayerCategories;
}

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
    return toLayerColor(0xf472b6);
  }
  if (category === 'blockage') {
    return toLayerColor(0xff8fab);
  }
  if (category === 'specialNet') {
    return toLayerColor(0x90cdf4);
  }

  return getPhysicalLayoutLayerColor(layerIndex);
}

export function getPhysicalLayoutOutlineColor(): PhysicalLayoutLayerColor {
  return toLayerColor(0xe5eef8);
}

export function createPhysicalLayoutVisibility(
  catalog: LspLayoutCatalog | null | undefined,
  hasOutline: boolean,
  shapes: readonly LspLayoutShape[],
): MutablePhysicalLayoutVisibility {
  const layerOpacities = new Map<number, number>();
  const visibleItems = new Set<string>();

  if (hasOutline) {
    visibleItems.add(createOutlineVisibilityKey());
  }

  for (const entry of createPhysicalLayoutLayerTree(catalog, shapes)) {
    layerOpacities.set(entry.layer.index, 1);
    for (const category of getPhysicalLayoutLayerCategories(catalog)) {
      if (entry.categories[category]) {
        visibleItems.add(createLayerCategoryVisibilityKey(entry.layer.index, category));
      }
    }
  }

  return {
    layerOpacities,
    outlineVisible: hasOutline,
    visibleItems,
  };
}

export function createEmptyPhysicalLayoutVisibility(): MutablePhysicalLayoutVisibility {
  return {
    layerOpacities: new Map(),
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

export function getPhysicalLayoutLayerOpacity(
  visibility: PhysicalLayoutVisibility,
  layerIndex: number,
): number {
  return normalizePhysicalLayoutLayerOpacity(visibility.layerOpacities.get(layerIndex));
}

export function normalizePhysicalLayoutLayerOpacity(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }

  const stepped = Math.round(value / physicalLayoutLayerOpacityStep) * physicalLayoutLayerOpacityStep;
  return Math.min(physicalLayoutLayerOpacityMax, Math.max(physicalLayoutLayerOpacityMin, Number(stepped.toFixed(2))));
}

export function formatPhysicalLayoutLayerOpacity(value: number): string {
  return `${Math.round(normalizePhysicalLayoutLayerOpacity(value) * 100)}%`;
}

export function formatPhysicalLayoutLayerOpacitySummary(visibility: PhysicalLayoutVisibility): string {
  return Array.from(visibility.layerOpacities.entries())
    .sort(([left], [right]) => left - right)
    .map(([layerIndex, opacity]) => `${layerIndex}:${normalizePhysicalLayoutLayerOpacity(opacity).toFixed(2)}`)
    .join('|');
}

export function hasNonDefaultPhysicalLayoutLayerOpacity(visibility: PhysicalLayoutVisibility): boolean {
  return Array.from(visibility.layerOpacities.values()).some((opacity) => normalizePhysicalLayoutLayerOpacity(opacity) < 1);
}

export function createPhysicalLayoutLayerTree(
  catalog: LspLayoutCatalog | null | undefined,
  shapes: readonly LspLayoutShape[],
): PhysicalLayoutLayerTreeEntry[] {
  if (catalog?.sourceKind === 'gds') {
    return createGdsPhysicalLayoutLayerTree(catalog, shapes);
  }

  const shapeCountsByLayer = new Map<number, PhysicalLayoutLayerCategoryAvailability>();
  const pinNameByKey = createPhysicalLayoutPinNameMap(catalog);

  for (const shape of shapes) {
    const categories = shapeCountsByLayer.get(shape.layerIndex) ?? createEmptyCategoryAvailability();
    const category = getPhysicalLayoutShapeCategory(shape, catalog?.sourceKind);

    if (category) {
      categories[category] = true;
    }

    if (shape.ownerKind === 'pin' && getPhysicalLayoutShapeLabel(catalog, pinNameByKey, shape)) {
      categories.label = true;
    }

    shapeCountsByLayer.set(shape.layerIndex, categories);
  }

  return (catalog?.layers ?? []).map((layer) => {
    const categories = shapeCountsByLayer.get(layer.index) ?? createEmptyCategoryAvailability();

    return {
      available: true,
      categories,
      layer,
    };
  });
}

function createGdsPhysicalLayoutLayerTree(
  catalog: LspLayoutCatalog,
  shapes: readonly LspLayoutShape[],
): PhysicalLayoutLayerTreeEntry[] {
  const shapeCountsByLayer = new Map<number, PhysicalLayoutLayerCategoryAvailability>();

  for (const shape of shapes) {
    const categories = shapeCountsByLayer.get(shape.layerIndex) ?? createEmptyCategoryAvailability();
    const category = getPhysicalLayoutShapeCategory(shape, catalog.sourceKind);
    if (category) {
      categories[category] = true;
    }
    shapeCountsByLayer.set(shape.layerIndex, categories);
  }

  return catalog.layers.map((layer) => {
    const categories = shapeCountsByLayer.get(layer.index) ?? createEmptyCategoryAvailability();

    categories.boundary = true;
    categories.path = true;
    categories.text = true;

    return {
      available: true,
      categories,
      layer,
    };
  });
}

export function filterVisiblePhysicalLayoutShapes(
  shapes: readonly LspLayoutShape[],
  visibility: PhysicalLayoutVisibility,
  sourceKind?: LspLayoutCatalog['sourceKind'],
): LspLayoutShape[] {
  return shapes.filter((shape) => {
    if (sourceKind === 'gds' && shape.kind === 'placement') {
      return true;
    }

    const category = getPhysicalLayoutShapeCategory(shape, sourceKind);
    return category ? isPhysicalLayoutLayerCategoryVisible(visibility, shape.layerIndex, category) : false;
  });
}

export function getVisiblePhysicalLayoutShapeCounts(
  shapes: readonly LspLayoutShape[],
  visibility: PhysicalLayoutVisibility,
  sourceKind?: LspLayoutCatalog['sourceKind'],
): Record<PhysicalLayoutLayerCategory, number> {
  const counts = createEmptyCategoryCount();

  for (const shape of shapes) {
    if (sourceKind === 'gds' && shape.kind === 'placement') {
      counts.boundary += 1;
      continue;
    }

    const category = getPhysicalLayoutShapeCategory(shape, sourceKind);
    if (category && isPhysicalLayoutLayerCategoryVisible(visibility, shape.layerIndex, category)) {
      counts[category] += 1;
    }
  }

  return counts;
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
    const labelVisibilityCategory = getShapeLabelVisibilityCategory(shape);
    if (!isPhysicalLayoutLayerCategoryVisible(visibility, shape.layerIndex, labelVisibilityCategory)) {
      continue;
    }

    const labelName = getPhysicalLayoutShapeLabel(catalog, pinNameByKey, shape);
    if (!labelName) {
      continue;
    }

    const bounds = shapeBounds(shape);
    const key = `${shape.ownerKind}:${shape.macroIndex ?? 'global'}:${shape.layerIndex}:${shape.ownerIndex}`;
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
      name: labelName,
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
    opacity: getPhysicalLayoutLayerOpacity(visibility, entry.layerIndex),
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

export function getVisiblePhysicalLayoutLayerCount(
  catalog: LspLayoutCatalog | null | undefined,
  visibility: PhysicalLayoutVisibility,
): number {
  const categories = getPhysicalLayoutLayerCategories(catalog);
  return (catalog?.layers ?? []).filter((layer) => (
    categories.some((category) => isPhysicalLayoutLayerCategoryVisible(visibility, layer.index, category))
  )).length;
}

export function getVisiblePhysicalLayoutCategoryCount(
  catalog: LspLayoutCatalog | null | undefined,
  visibility: PhysicalLayoutVisibility,
): number {
  const categories = getPhysicalLayoutLayerCategories(catalog);
  return (catalog?.layers ?? []).reduce((count, layer) => (
    count + categories.filter((category) => (
      isPhysicalLayoutLayerCategoryVisible(visibility, layer.index, category)
    )).length
  ), 0);
}

export function getPhysicalLayoutShapeCategory(
  shape: LspLayoutShape,
  sourceKind?: LspLayoutCatalog['sourceKind'],
): PhysicalLayoutLayerCategory | null {
  if (sourceKind === 'gds') {
    if (shape.kind === 'text') {
      return 'text';
    }
    if (shape.kind === 'path') {
      return 'path';
    }
    return 'boundary';
  }

  if (shape.ownerKind === 'pin') {
    return 'pin';
  }
  if (shape.ownerKind === 'obstruction') {
    return 'obstruction';
  }
  if (shape.ownerKind === 'net') {
    return 'net';
  }
  if (shape.ownerKind === 'specialNet') {
    return 'specialNet';
  }
  if (shape.ownerKind === 'blockage') {
    return 'blockage';
  }
  if (shape.ownerKind === 'gdsElement') {
    if (shape.kind === 'text') {
      return 'text';
    }
    if (shape.kind === 'path') {
      return 'path';
    }
    return 'boundary';
  }

  return null;
}

function getShapeLabelVisibilityCategory(shape: LspLayoutShape): PhysicalLayoutLayerCategory {
  if (shape.ownerKind === 'gdsElement' && shape.kind === 'text') {
    return 'text';
  }

  return 'label';
}

function getPhysicalLayoutShapeLabel(
  catalog: LspLayoutCatalog | null | undefined,
  pinNameByKey: ReadonlyMap<string, string>,
  shape: LspLayoutShape,
): string | null {
  if (shape.ownerKind === 'pin') {
    if (shape.macroIndex === null) {
      return catalog?.defPins[shape.ownerIndex]?.name || null;
    }

    return pinNameByKey.get(createPinNameKey(shape.macroIndex, shape.ownerIndex)) ?? null;
  }

  if (shape.ownerKind === 'gdsElement' && shape.kind === 'text') {
    return catalog?.gdsElements[shape.ownerIndex]?.text || null;
  }

  return null;
}

function createPinNameKey(macroIndex: number, pinIndex: number): string {
  return `${macroIndex}:${pinIndex}`;
}

function createEmptyCategoryAvailability(): PhysicalLayoutLayerCategoryAvailability {
  return physicalLayoutLayerCategories.reduce((categories, category) => {
    categories[category] = false;
    return categories;
  }, {} as PhysicalLayoutLayerCategoryAvailability);
}

function createEmptyCategoryCount(): Record<PhysicalLayoutLayerCategory, number> {
  return physicalLayoutLayerCategories.reduce((counts, category) => {
    counts[category] = 0;
    return counts;
  }, {} as Record<PhysicalLayoutLayerCategory, number>);
}

function toLayerColor(pixiColor: number): PhysicalLayoutLayerColor {
  return {
    cssColor: `#${pixiColor.toString(16).padStart(6, '0')}`,
    pixiColor,
  };
}
