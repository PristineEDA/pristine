import { describe, expect, it } from 'vitest';

import type { LspLayoutCatalog, LspLayoutGeometry } from '../../../../../types/systemverilog-lsp';
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
  createPhysicalLayoutLayerTree,
  createPhysicalLayoutPinLabels,
  createPhysicalLayoutVisibility,
  filterVisiblePhysicalLayoutShapes,
  getPhysicalLayoutLayerCategoryColor,
  getPhysicalLayoutLayerColor,
  getPhysicalLayoutOutlineColor,
  getVisiblePhysicalLayoutShapeCounts,
  isPhysicalLayoutLayerCategoryVisible,
  isPhysicalLayoutOutlineVisible,
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

  it('provides stable layer and outline colors', () => {
    const metal1Color = getPhysicalLayoutLayerColor(0);
    const metal1PinColor = getPhysicalLayoutLayerCategoryColor(0, 'pin');
    const metal1ObstructionColor = getPhysicalLayoutLayerCategoryColor(0, 'obstruction');
    const outlineColor = getPhysicalLayoutOutlineColor();

    expect(metal1Color).toEqual(getPhysicalLayoutLayerColor(0));
    expect(metal1PinColor).toEqual(metal1Color);
    expect(metal1ObstructionColor).toEqual({ cssColor: '#f472b6', pixiColor: 0xf472b6 });
    expect(metal1Color.cssColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(Number.parseInt(metal1Color.cssColor.slice(1), 16)).toBe(metal1Color.pixiColor);
    expect(outlineColor.cssColor).toBe('#e5eef8');
    expect(Number.parseInt(outlineColor.cssColor.slice(1), 16)).toBe(outlineColor.pixiColor);
  });

  it('creates category visibility, filters shapes, and allows all categories to hide', () => {
    const macro = findLayoutMacro(catalog, 'sg13g2_inv_1');
    const selectedShapes = selectMacroShapes(catalog, layoutFixtureGeometry, 'sg13g2_inv_1');
    const visibility = createPhysicalLayoutVisibility(catalog, Boolean(macro), selectedShapes);

    expect(isPhysicalLayoutOutlineVisible(visibility)).toBe(true);
    expect(isPhysicalLayoutLayerCategoryVisible(visibility, 0, 'pin')).toBe(true);
    expect(isPhysicalLayoutLayerCategoryVisible(visibility, 0, 'label')).toBe(true);
    expect(isPhysicalLayoutLayerCategoryVisible(visibility, 0, 'obstruction')).toBe(false);
    expect(isPhysicalLayoutLayerCategoryVisible(visibility, 1, 'obstruction')).toBe(true);
    expect(filterVisiblePhysicalLayoutShapes(selectedShapes, visibility)).toHaveLength(3);
    expect(getVisiblePhysicalLayoutShapeCounts(selectedShapes, visibility)).toMatchObject({ obstruction: 1, pin: 2 });

    const hiddenVisibility = { outlineVisible: false, visibleItems: new Set<string>() };

    expect(isPhysicalLayoutOutlineVisible(hiddenVisibility)).toBe(false);
    expect(filterVisiblePhysicalLayoutShapes(selectedShapes, hiddenVisibility)).toEqual([]);
    expect(createPhysicalLayoutPinLabels(catalog, selectedShapes, hiddenVisibility)).toEqual([]);
  });

  it('builds layer tree availability and real pin labels', () => {
    const selectedShapes = selectMacroShapes(catalog, layoutFixtureGeometry, 'sg13g2_inv_1');
    const visibility = createPhysicalLayoutVisibility(catalog, true, selectedShapes);
    const tree = createPhysicalLayoutLayerTree(catalog, selectedShapes);

    expect(tree).toHaveLength(2);
    expect(tree[0]?.categories).toMatchObject({ label: true, obstruction: false, pin: true });
    expect(tree[0]?.available).toBe(true);
    expect(tree[1]?.categories).toMatchObject({ label: false, obstruction: true, pin: false });
    expect(tree[1]?.available).toBe(true);
    expect(createPhysicalLayoutPinLabels(catalog, selectedShapes, visibility)).toEqual([
      expect.objectContaining({ layerIndex: 0, name: 'A', ownerIndex: 0 }),
      expect.objectContaining({ layerIndex: 0, name: 'Y', ownerIndex: 1 }),
    ]);
  });

  it('omits pin labels when the catalog has no matching pin table entry', () => {
    const selectedShapes = selectMacroShapes(catalog, layoutFixtureGeometry, 'sg13g2_inv_1');
    const visibility = createPhysicalLayoutVisibility(catalog, true, selectedShapes);
    const catalogWithoutPinNames = {
      ...catalog,
      pins: catalog.pins.filter((pin) => !(pin.macroIndex === 0 && pin.pinIndex === 1)),
    };

    expect(createPhysicalLayoutPinLabels(catalogWithoutPinNames, selectedShapes, visibility)).toEqual([
      expect.objectContaining({ layerIndex: 0, name: 'A', ownerIndex: 0 }),
    ]);

    const catalogWithoutSelectedPinNames = {
      ...catalog,
      pins: catalog.pins.filter((pin) => pin.macroIndex !== 0),
    };

    expect(createPhysicalLayoutLayerTree(catalogWithoutSelectedPinNames, selectedShapes)[0]?.categories.label).toBe(false);
    expect(createPhysicalLayoutPinLabels(catalogWithoutSelectedPinNames, selectedShapes, visibility)).toEqual([]);
  });

  it('uses source-aware GDS layer categories and text labels', () => {
    const gdsCatalog: LspLayoutCatalog = {
      ...catalog,
      defPins: [],
      gdsCells: [{
        bounds: { x0: 0, y0: 0, x1: 2, y1: 2 },
        elementCount: 3,
        firstElementIndex: 0,
        firstReferenceIndex: 0,
        index: 0,
        name: 'TOP',
        referenceCount: 0,
        top: true,
      }],
      gdsElements: [
        { cellIndex: 0, datatype: 0, firstPointIndex: 0, index: 0, kind: 0, layer: 0, pointCount: 4, referenceIndex: null, text: '', texttype: 0 },
        { cellIndex: 0, datatype: 0, firstPointIndex: 4, index: 1, kind: 1, layer: 0, pointCount: 2, referenceIndex: null, text: '', texttype: 0 },
        { cellIndex: 0, datatype: 0, firstPointIndex: 6, index: 2, kind: 3, layer: 0, pointCount: 1, referenceIndex: null, text: 'VSS', texttype: 0 },
      ],
      gdsPoints: [],
      gdsReferences: [],
      macros: [],
      pins: [],
      shapeCount: 3,
      sourceKind: 'gds',
      topCellIndex: 0,
    };
    const gdsGeometry: LspLayoutGeometry = {
      polygonPointCount: 0,
      shapeCount: 3,
      shapes: [
        { flags: 0, index: 0, kind: 'polygon', layerIndex: 0, macroIndex: 0, ownerIndex: 0, ownerKind: 'gdsElement', polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], rect: { x0: 0, y0: 0, x1: 1, y1: 1 } },
        { flags: 0, index: 1, kind: 'path', layerIndex: 0, macroIndex: 0, ownerIndex: 1, ownerKind: 'gdsElement', polygon: [{ x: 0.2, y: 0.2 }, { x: 1.2, y: 0.2 }], rect: { x0: 0.2, y0: 0.2, x1: 1.2, y1: 0.2 } },
        { flags: 0, index: 2, kind: 'text', layerIndex: 0, macroIndex: 0, ownerIndex: 2, ownerKind: 'gdsElement', rect: { x0: 0.4, y0: 0.4, x1: 0.6, y1: 0.6 } },
      ],
      truncated: false,
      unitsPerMicron: 1000,
    };
    const selectedShapes = gdsGeometry.shapes;
    const visibility = createPhysicalLayoutVisibility(gdsCatalog, true, selectedShapes);
    const tree = createPhysicalLayoutLayerTree(gdsCatalog, selectedShapes);

    expect(tree[0]?.categories).toMatchObject({ boundary: true, path: true, text: true });
    expect(filterVisiblePhysicalLayoutShapes(selectedShapes, visibility)).toHaveLength(3);
    expect(getVisiblePhysicalLayoutShapeCounts(selectedShapes, visibility)).toMatchObject({
      boundary: 1,
      path: 1,
      text: 1,
    });
    expect(createPhysicalLayoutPinLabels(gdsCatalog, selectedShapes, visibility)).toEqual([
      expect.objectContaining({ layerIndex: 0, name: 'VSS', ownerIndex: 2 }),
    ]);
  });
});
