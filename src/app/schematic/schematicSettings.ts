export const DEFAULT_SCHEMATIC_GRID_ENABLED = true;
export const DEFAULT_SCHEMATIC_GRID_SIZE = 40;
export const DEFAULT_SCHEMATIC_SNAP_TO_GRID = true;
export const DEFAULT_SCHEMATIC_ALIGNMENT_GUIDES_ENABLED = true;

export const MIN_SCHEMATIC_GRID_SIZE = 1;
export const MAX_SCHEMATIC_GRID_SIZE = 60;

export const SCHEMATIC_GRID_ENABLED_CONFIG_KEY = 'schematic.grid.enabled';
export const SCHEMATIC_GRID_SIZE_CONFIG_KEY = 'schematic.grid.size';
export const SCHEMATIC_SNAP_TO_GRID_CONFIG_KEY = 'schematic.snapToGrid';
export const SCHEMATIC_ALIGNMENT_GUIDES_ENABLED_CONFIG_KEY = 'schematic.alignmentGuides.enabled';

export function parseSchematicGridEnabled(value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_SCHEMATIC_GRID_ENABLED;
}

export function parseSchematicGridSize(value: unknown): number {
  const numericValue = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_SCHEMATIC_GRID_SIZE;
  }

  return Math.min(MAX_SCHEMATIC_GRID_SIZE, Math.max(MIN_SCHEMATIC_GRID_SIZE, Math.round(numericValue)));
}

export function parseSchematicSnapToGrid(value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_SCHEMATIC_SNAP_TO_GRID;
}

export function parseSchematicAlignmentGuidesEnabled(value: unknown): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_SCHEMATIC_ALIGNMENT_GUIDES_ENABLED;
}
