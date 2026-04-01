import { describe, expect, it, vi, beforeEach } from 'vitest';
import Konva from 'konva';
import type { VeConfig, VeSystemLayer } from './types';
import { defaultVeConfig } from './constants';
import { createBlockTemplate, createSoC1Template } from './designFactory';

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

describe('designFactory', () => {
  let layers: VeSystemLayer;
  let config: VeConfig;
  const pushState = vi.fn();

  beforeEach(() => {
    layers = makeSystemLayer();
    config = { ...defaultVeConfig };
    pushState.mockClear();
  });

  describe('createBlockTemplate', () => {
    it('adds a block group to the design layer', () => {
      createBlockTemplate(100, 200, config, layers, pushState);
      const blocks = layers.design!.find('.block');
      expect(blocks.length).toBe(1);
      expect(blocks[0]!.x()).toBe(100);
      expect(blocks[0]!.y()).toBe(200);
    });

    it('creates the block with opacity 0.3 (preview mode)', () => {
      createBlockTemplate(0, 0, config, layers, pushState);
      const block = layers.design!.find('.block')[0];
      expect(block!.opacity()).toBe(0.3);
    });

    it('adds a shadow to auxBot', () => {
      const before = layers.auxBot!.getChildren().length;
      createBlockTemplate(0, 0, config, layers, pushState);
      expect(layers.auxBot!.getChildren().length).toBeGreaterThan(before);
    });
  });

  describe('createSoC1Template', () => {
    it('adds a soc1 group to the design layer', () => {
      createSoC1Template(50, 60, config, layers, pushState);
      const socs = layers.design!.find('.soc1');
      expect(socs.length).toBe(1);
    });

    it('contains expected sub-blocks (IP blocks)', () => {
      createSoC1Template(50, 60, config, layers, pushState);
      const soc = layers.design!.find('.soc1')[0] as Konva.Group;
      // soc1 has: boundEdge + flag + CORE + RCU + BUS + 8 IP blocks = 13 children
      expect(soc.getChildren().length).toBe(13);
    });

    it('starts with opacity 0.3', () => {
      createSoC1Template(50, 60, config, layers, pushState);
      const soc = layers.design!.find('.soc1')[0];
      expect(soc!.opacity()).toBe(0.3);
    });
  });
});
