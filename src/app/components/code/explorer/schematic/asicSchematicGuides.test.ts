import { describe, expect, it } from 'vitest';

import { getSchematicAlignmentGuides } from './asicSchematicGuides';
import type { SchematicLayoutResult, SchematicNodeLayout } from './asicSchematicTypes';

const createModuleNode = (id: string, x: number, y: number, width = 100, height = 60): SchematicNodeLayout => ({
  id,
  label: id,
  subtitle: id,
  tooltipType: id,
  kind: 'module',
  instanceId: id,
  moduleId: `${id}_module`,
  x,
  y,
  width,
  height,
  ports: [],
  canDrillDown: false,
});

function createLayout(nodes: SchematicNodeLayout[]): SchematicLayoutResult {
  return {
    module: {
      id: 'top',
      name: 'top',
      description: '',
      ports: [],
      instances: [],
      nets: [],
    },
    nodes,
    edges: [],
    bounds: { x: 0, y: 0, width: 600, height: 400 },
    usedFallback: false,
  };
}

describe('getSchematicAlignmentGuides', () => {
  it('returns edge and center guides for dragged modules near stationary modules', () => {
    const layout = createLayout([
      createModuleNode('dragged', 10, 10),
      createModuleNode('stationary', 220, 160),
    ]);
    const guides = getSchematicAlignmentGuides(layout, ['dragged'], {
      dragged: { x: 222, y: 160 },
    }, 4);

    expect(guides).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'edge', orientation: 'horizontal', position: 160 }),
      expect.objectContaining({ kind: 'edge', orientation: 'vertical', position: 220 }),
      expect.objectContaining({ kind: 'center', orientation: 'horizontal', position: 190 }),
      expect.objectContaining({ kind: 'center', orientation: 'vertical', position: 270 }),
    ]));
    expect(guides.every((guide) => guide.start <= guide.end)).toBe(true);
  });

  it('ignores non-dragged modules and positions outside the tolerance', () => {
    const layout = createLayout([
      createModuleNode('dragged', 10, 10),
      createModuleNode('stationary', 220, 160),
    ]);

    expect(getSchematicAlignmentGuides(layout, ['dragged'], {
      dragged: { x: 180, y: 111 },
    }, 4)).toEqual([]);
    expect(getSchematicAlignmentGuides(layout, [], {
      dragged: { x: 220, y: 160 },
    }, 4)).toEqual([]);
  });
});
