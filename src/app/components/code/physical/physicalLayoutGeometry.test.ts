import { describe, expect, it } from 'vitest';

import { layoutFixtureGeometry, layoutFixtureOpenResult } from '../../../../test/layoutFixture';
import {
  applyLayoutWheel,
  findLayoutMacro,
  getFitLayoutCamera,
  getFirstLayoutMacroName,
  getMacroBounds,
  getShapesBounds,
  selectMacroShapes,
} from './physicalLayoutGeometry';
import {
  filterVisibleLayoutShapes,
  getPhysicalLayoutLayerColor,
  isLayoutLayerVisible,
} from './physicalLayoutLayers';

describe('physicalLayoutGeometry', () => {
  const catalog = layoutFixtureOpenResult.catalog;

  it('selects the first available macro name', () => {
    expect(getFirstLayoutMacroName(catalog)).toBe('sg13g2_inv_1');
    expect(getFirstLayoutMacroName(null)).toBeNull();
  });

  it('finds macro bounds from catalog data', () => {
    const macro = findLayoutMacro(catalog, 'sg13g2_nand2_1');

    expect(macro?.name).toBe('sg13g2_nand2_1');
    expect(macro ? getMacroBounds(macro) : null).toEqual({ x0: 0, y0: 0, x1: 2.4, y1: 3.78 });
  });

  it('filters selected macro geometry using macro ownership', () => {
    const inverterShapes = selectMacroShapes(catalog, layoutFixtureGeometry, 'sg13g2_inv_1');
    const nandShapes = selectMacroShapes(catalog, layoutFixtureGeometry, 'sg13g2_nand2_1');

    expect(inverterShapes).toHaveLength(3);
    expect(inverterShapes.every((shape) => shape.macroIndex === 0)).toBe(true);
    expect(nandShapes).toHaveLength(1);
    expect(nandShapes.every((shape) => shape.macroIndex === 1)).toBe(true);
  });

  it('does not include overlapping shapes from other macros', () => {
    const inverterShapes = selectMacroShapes(catalog, layoutFixtureGeometry, 'sg13g2_inv_1');

    expect(inverterShapes.some((shape) => shape.ownerKind === 'obstruction' && shape.ownerIndex === 1)).toBe(false);
  });

  it('computes fit camera from layout bounds and viewport size', () => {
    const camera = getFitLayoutCamera({ x0: 0, y0: 0, x1: 2, y1: 4 }, { width: 400, height: 300 });

    expect(camera.zoom).toBeGreaterThan(2);
    expect(camera.panX).toBeGreaterThan(0);
    expect(camera.panY).toBeGreaterThan(0);
  });

  it('computes shape bounds with a fallback', () => {
    expect(getShapesBounds([], { x0: 0, y0: 0, x1: 1, y1: 1 })).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
    expect(getShapesBounds(layoutFixtureGeometry.shapes, null)).toEqual({ x0: 0.12, y0: 0.42, x1: 2.18, y1: 3.08 });
  });

  it('applies wheel pan and zoom shortcuts', () => {
    const camera = { panX: 10, panY: 20, zoom: 30 };

    expect(applyLayoutWheel(camera, {
      clientX: 100,
      clientY: 100,
      deltaX: 0,
      deltaY: 50,
    }, { x: 0, y: 0 }).panY).toBe(-30);

    expect(applyLayoutWheel(camera, {
      clientX: 100,
      clientY: 100,
      deltaX: 0,
      deltaY: 50,
      shiftKey: true,
    }, { x: 0, y: 0 }).panX).toBe(-40);

    expect(applyLayoutWheel(camera, {
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      deltaX: 0,
      deltaY: -120,
    }, { x: 0, y: 0 }).zoom).toBeGreaterThan(camera.zoom);
  });

  it('provides stable layer colors and filters visible layer shapes', () => {
    const metal1Color = getPhysicalLayoutLayerColor(0);

    expect(metal1Color).toEqual(getPhysicalLayoutLayerColor(0));
    expect(metal1Color.cssColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(Number.parseInt(metal1Color.cssColor.slice(1), 16)).toBe(metal1Color.pixiColor);
    expect(isLayoutLayerVisible(new Set([0]), 0)).toBe(true);
    expect(isLayoutLayerVisible(new Set([0]), 1)).toBe(false);
    expect(filterVisibleLayoutShapes(layoutFixtureGeometry.shapes, new Set([0]))).toHaveLength(2);
    expect(filterVisibleLayoutShapes(layoutFixtureGeometry.shapes, new Set())).toEqual([]);
  });
});
