import { describe, expect, it } from 'vitest';
import { defaultVeConfig } from './constants';
import {
  clampScale,
  getGridRenderMetrics,
  resolveEraserWidth,
  resolvePenStyle,
  resolveShapeTool,
} from './whiteboardUtils';

describe('whiteboardUtils', () => {
  it('clamps scale within the configured range', () => {
    expect(clampScale(0.01, 0.1, 8)).toBe(0.1);
    expect(clampScale(12, 0.1, 8)).toBe(8);
    expect(clampScale(1.5, 0.1, 8)).toBe(1.5);
  });

  it('resolves rectangle and polygon shape tools from the selected subtool', () => {
    expect(resolveShapeTool('shape-rectangle', defaultVeConfig)).toMatchObject({
      kind: 'rectangle',
      name: 'rectangle',
      width: defaultVeConfig.gridSize * 6,
      height: defaultVeConfig.gridSize * 4,
    });

    expect(resolveShapeTool('shape-octagon', defaultVeConfig)).toMatchObject({
      kind: 'polygon',
      name: 'octagon',
      sides: 8,
    });
  });

  it('maps pen and eraser options to usable stroke settings', () => {
    expect(resolvePenStyle('pen-medium', 'pen-blue', 'pen-dash')).toEqual({
      color: '#3b82f6',
      dash: [10, 8],
      strokeWidth: 4,
    });

    expect(resolveEraserWidth('earser-large')).toBe(24);
  });

  it('returns viewport grid metrics with wider spacing at low zoom', () => {
    const zoomedOut = getGridRenderMetrics(800, 600, -120, -60, 0.25, 20);
    const normal = getGridRenderMetrics(800, 600, -120, -60, 1, 20);

    expect(zoomedOut.spacing).toBe(60);
    expect(normal.spacing).toBe(20);
    expect(zoomedOut.startX).toBeLessThanOrEqual(zoomedOut.endX);
    expect(zoomedOut.startY).toBeLessThanOrEqual(zoomedOut.endY);
  });
});