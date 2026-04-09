import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import Konva from 'konva';
import { defaultVeConfig } from './constants';
import { createRect, createShape, createText, deleteObj } from './shapeFactory';
import type { VeSystemLayer } from './types';
import { useHistory } from './useHistory';

function makeSystemLayer(): VeSystemLayer {
  const stage = new Konva.Stage({ container: document.createElement('div'), width: 800, height: 600 });
  const auxBot = new Konva.Layer();
  const shape = new Konva.Layer();
  const design = new Konva.Layer();
  const comment = new Konva.Layer();
  const auxTop = new Konva.Layer();
  stage.add(auxBot);
  stage.add(shape);
  stage.add(design);
  stage.add(comment);
  stage.add(auxTop);
  return { auxBot, shape, design, comment, auxTop };
}

describe('useHistory', () => {
  let layers: VeSystemLayer;

  beforeEach(() => {
    layers = makeSystemLayer();
  });

  it('restores comment-layer shapes on undo and redo', () => {
    const { result } = renderHook(() => useHistory({
      getSystemLayer: () => layers,
      createShapeFromData: (shapeData) => {
        createShape(shapeData, defaultVeConfig, layers, undefined, undefined);
      },
      deleteObj: (node) => deleteObj(node, layers),
    }));

    act(() => {
      result.current.pushState('init', -1, 'all');
      createText(100, 120, 'note', defaultVeConfig, layers, result.current.pushState);
      result.current.pushState('add', 1, 'Text');
      createRect(150, 160, 80, 80, defaultVeConfig, layers, result.current.pushState, 'gray', '#F3F1B1', false, undefined, true);
      result.current.pushState('add', 2, 'Rect');
    });

    expect(layers.comment!.find('.text')).toHaveLength(1);
    expect(layers.comment!.find('.rectangle')).toHaveLength(1);

    act(() => {
      result.current.undo();
    });

    expect(layers.comment!.find('.text')).toHaveLength(1);
    expect(layers.comment!.find('.rectangle')).toHaveLength(0);

    act(() => {
      result.current.redo();
    });

    expect(layers.comment!.find('.text')).toHaveLength(1);
    expect(layers.comment!.find('.rectangle')).toHaveLength(1);
  });
});