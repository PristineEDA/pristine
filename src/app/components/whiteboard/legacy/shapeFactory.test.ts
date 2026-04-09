import { describe, expect, it, vi, beforeEach } from 'vitest';
import Konva from 'konva';
import type { VeConfig, VeSystem, VeSystemLayer } from './types';
import { defaultVeConfig } from './constants';
import {
  createCircle, createTriangle, createRect, createText,
  createPolygon, createFreehandLine, createShape, deleteObj, copyObj, pasteObj,
  getPolygonName,
} from './shapeFactory';

function makeSystemLayer(): VeSystemLayer {
  const stage = new Konva.Stage({ container: document.createElement('div'), width: 800, height: 600 });
  const auxBot = new Konva.Layer();
  const shape = new Konva.Layer();
  const design = new Konva.Layer();
  const comment = new Konva.Layer();
  const auxTop = new Konva.Layer();
  stage.add(auxBot); stage.add(shape); stage.add(design); stage.add(comment); stage.add(auxTop);
  return { auxBot, shape, design, comment, auxTop };
}

function makeSystem(layers: VeSystemLayer): VeSystem {
  const xfer = new Konva.Transformer();
  layers.auxTop!.add(xfer);
  return {
    stage: layers.auxBot!.getStage()!,
    xfer, resizeObsvr: null, grid: null,
    clipboard: [], history: null, selectedRect: null, picUploadInputer: null,
  };
}

describe('shapeFactory', () => {
  let layers: VeSystemLayer;
  let config: VeConfig;
  const pushState = vi.fn();

  beforeEach(() => {
    layers = makeSystemLayer();
    config = { ...defaultVeConfig };
    pushState.mockClear();
  });

  describe('createCircle', () => {
    it('adds a circle to the shape layer and a shadow to auxBot', () => {
      createCircle(100, 200, config, layers, pushState);
      const circles = layers.shape!.find('.circle');
      expect(circles.length).toBe(1);
      expect(circles[0]!.x()).toBe(100);
      expect(circles[0]!.y()).toBe(200);
      // shadow should be in auxBot
      expect(layers.auxBot!.getChildren().length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('createTriangle', () => {
    it('adds a triangle to the shape layer', () => {
      createTriangle(50, 60, config, layers, pushState);
      const tris = layers.shape!.find('.triangle');
      expect(tris.length).toBe(1);
      expect(tris[0]!.x()).toBe(50);
    });
  });

  describe('createPolygon', () => {
    it('adds a polygon with the provided name to the shape layer', () => {
      createPolygon(75, 90, 8, 24, 'octagon', config, layers, pushState);
      const polygons = layers.shape!.find('.octagon');
      expect(polygons.length).toBe(1);
      expect((polygons[0] as Konva.RegularPolygon).sides()).toBe(8);
    });
  });

  describe('createRect', () => {
    it('adds a rectangle to the shape layer by default', () => {
      createRect(10, 20, 30, 40, config, layers, pushState);
      const rects = layers.shape!.find('.rectangle');
      expect(rects.length).toBe(1);
      expect(rects[0]!.width()).toBe(30);
    });

    it('adds to comment layer when commentLayer=true', () => {
      createRect(10, 20, 30, 40, config, layers, pushState, 'gray', '#F3F1B1', false, undefined, true);
      expect(layers.comment!.find('.rectangle').length).toBe(1);
      expect(layers.shape!.find('.rectangle').length).toBe(0);
    });
  });

  describe('createText', () => {
    it('adds text to the comment layer', () => {
      createText(100, 200, 'hello', config, layers, pushState);
      const texts = layers.comment!.find('.text');
      expect(texts.length).toBe(1);
      expect((texts[0] as Konva.Text).text()).toBe('hello');
    });
  });

  describe('createFreehandLine', () => {
    it('adds a freehand line to the comment layer', () => {
      createFreehandLine([0, 0, 10, 10], { stroke: '#000', strokeWidth: 4, name: 'pen-stroke' }, layers);
      const lines = layers.comment!.find('Line');
      expect(lines.length).toBe(1);
      expect((lines[0] as Konva.Line).points()).toEqual([0, 0, 10, 10]);
    });
  });

  describe('createShape (restore dispatch)', () => {
    it('restores a Circle from snapshot data', () => {
      createShape({ type: 'Circle', attrs: { x: 10, y: 20 } }, config, layers, pushState);
      expect(layers.shape!.find('.circle').length).toBe(1);
    });

    it('restores a RegularPolygon as triangle', () => {
      createShape({ type: 'RegularPolygon', attrs: { x: 30, y: 40 } }, config, layers, pushState);
      expect(layers.shape!.find('.triangle').length).toBe(1);
    });

    it('restores a RegularPolygon as octagon when sides are provided', () => {
      createShape({ type: 'RegularPolygon', attrs: { x: 30, y: 40, sides: 8, radius: 24, name: 'octagon' } }, config, layers, pushState);
      expect(layers.shape!.find('.octagon').length).toBe(1);
    });

    it('restores a Rect from snapshot data', () => {
      createShape({ type: 'Rect', attrs: { x: 10, y: 20, width: 50, height: 60 } }, config, layers, pushState);
      expect(layers.shape!.find('.rectangle').length).toBe(1);
    });

    it('restores a Line into the comment layer', () => {
      createShape({ type: 'Line', attrs: { points: [1, 2, 3, 4], stroke: '#111', strokeWidth: 3 } }, config, layers, pushState);
      expect(layers.comment!.find('Line').length).toBe(1);
    });

    it('ignores unknown types', () => {
      createShape({ type: 'Unknown', attrs: { x: 0, y: 0 } }, config, layers, pushState);
      expect(layers.shape!.getChildren().length).toBe(0);
    });
  });

  describe('deleteObj', () => {
    it('destroys the node and its shadow', () => {
      createCircle(10, 20, config, layers, pushState);
      const circle = layers.shape!.find('.circle')[0];
      const auxBotChildrenBefore = layers.auxBot!.getChildren().length;
      deleteObj(circle!, layers);
      expect(layers.shape!.find('.circle').length).toBe(0);
      expect(layers.auxBot!.getChildren().length).toBeLessThan(auxBotChildrenBefore);
    });
  });

  describe('copyObj / pasteObj', () => {
    it('clones selected objects', () => {
      createCircle(100, 200, config, layers, pushState);
      const sys = makeSystem(layers);
      const circle = layers.shape!.find('.circle')[0];
      sys.xfer!.nodes([circle!]);

      copyObj(sys, layers, config);
      expect(sys.clipboard.length).toBe(1);
      expect(sys.xfer!.nodes().length).toBe(0);

      pasteObj(sys, layers, config);
      expect(layers.shape!.find('.circle').length).toBe(2);
    });
  });

  describe('getPolygonName', () => {
    it('returns class name for Circle', () => {
      const c = new Konva.Circle({ x: 0, y: 0, radius: 10 });
      expect(getPolygonName(c)).toBe('Circle');
    });

    it('returns Triangle for 3-sided RegularPolygon', () => {
      const t = new Konva.RegularPolygon({ x: 0, y: 0, sides: 3, radius: 10 });
      expect(getPolygonName(t)).toBe('Triangle');
    });

    it('returns Pentagon for 5-sided RegularPolygon', () => {
      const p = new Konva.RegularPolygon({ x: 0, y: 0, sides: 5, radius: 10 });
      expect(getPolygonName(p)).toBe('Pentagon');
    });

    it('returns Hexagon for 6-sided RegularPolygon', () => {
      const h = new Konva.RegularPolygon({ x: 0, y: 0, sides: 6, radius: 10 });
      expect(getPolygonName(h)).toBe('Hexagon');
    });
  });
});
