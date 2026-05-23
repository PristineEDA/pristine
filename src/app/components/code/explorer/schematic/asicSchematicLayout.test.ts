import { describe, expect, it, vi } from 'vitest';

import { findModulePath, layoutAsicSchematic } from './asicSchematicLayout';
import { mockAsicSchematicGraph } from './asicSchematicMockData';

describe('layoutAsicSchematic', () => {
  it('creates a positioned module graph from mock ASIC hierarchy', async () => {
    const layout = await layoutAsicSchematic(mockAsicSchematicGraph);

    expect(layout.module.id).toBe('soc_top');
    expect(layout.nodes.some((node) => node.id === 'u_cpu')).toBe(true);
    expect(layout.nodes.some((node) => node.id === 'io:clk')).toBe(true);
    expect(layout.edges.length).toBeGreaterThan(0);
    expect(layout.bounds.width).toBeGreaterThan(0);
    expect(layout.bounds.height).toBeGreaterThan(0);
    expect(layout.usedFallback).toBe(false);
  });

  it('falls back to deterministic columns when ELK layout fails', async () => {
    const layoutEngine = {
      layout: vi.fn().mockRejectedValue(new Error('layout unavailable')),
    };

    const layout = await layoutAsicSchematic(mockAsicSchematicGraph, 'soc_top', { layoutEngine });

    expect(layoutEngine.layout).toHaveBeenCalledTimes(1);
    expect(layout.usedFallback).toBe(true);
    expect(layout.nodes.map((node) => node.id)).toContain('u_fabric');
    expect(layout.edges.length).toBeGreaterThan(0);
  });
});

describe('findModulePath', () => {
  it('returns the root-to-child breadcrumb path', () => {
    expect(findModulePath(mockAsicSchematicGraph, 'cpu_cluster').map((module) => module.id)).toEqual(['soc_top', 'cpu_cluster']);
  });
});
