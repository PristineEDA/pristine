import { describe, expect, it, vi } from 'vitest';

import {
  applySchematicNodePositions,
  findModulePath,
  getSchematicNodeRect,
  layoutAsicSchematic,
  resolveSchematicNodeOverlaps,
  schematicRectsIntersect,
} from './asicSchematicLayout';
import { mockAsicSchematicGraph } from './asicSchematicMockData';
import type { AsicNetEndpoint, SchematicLayoutResult } from './asicSchematicTypes';

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

describe('applySchematicNodePositions', () => {
  it('moves module ports and reroutes connected edges', async () => {
    const layout = await layoutAsicSchematic(mockAsicSchematicGraph);
    const originalNode = layout.nodes.find((node) => node.id === 'u_cpu');

    expect(originalNode).toBeDefined();
    if (!originalNode) {
      return;
    }

    const moved = applySchematicNodePositions(layout, {
      [originalNode.id]: {
        x: originalNode.x + 160,
        y: originalNode.y + 48,
      },
    });
    const movedNode = moved.nodes.find((node) => node.id === originalNode.id);

    expect(moved).not.toBe(layout);
    expect(movedNode?.x).toBe(originalNode.x + 160);
    expect(movedNode?.y).toBe(originalNode.y + 48);
    expect(movedNode?.ports[0]?.x).toBe(originalNode.ports[0]!.x + 160);
    expect(movedNode?.ports[0]?.y).toBe(originalNode.ports[0]!.y + 48);

    const connectedEdges = moved.edges.filter((edge) => edge.from.instanceId === originalNode.id || edge.to.instanceId === originalNode.id);
    expect(connectedEdges.length).toBeGreaterThan(0);

    connectedEdges.forEach((edge) => {
      const start = getEndpointPoint(moved, edge.from);
      const end = getEndpointPoint(moved, edge.to);
      expect(edge.points[0]).toEqual(start);
      expect(edge.points[edge.points.length - 1]).toEqual(end);
    });
  });

  it('ignores IO port position overrides', async () => {
    const layout = await layoutAsicSchematic(mockAsicSchematicGraph);
    const ioNode = layout.nodes.find((node) => node.kind === 'port');

    expect(ioNode).toBeDefined();
    if (!ioNode) {
      return;
    }

    expect(applySchematicNodePositions(layout, {
      [ioNode.id]: {
        x: ioNode.x + 400,
        y: ioNode.y + 400,
      },
    })).toBe(layout);
  });

  it('expands bounds after dragging a module outside the previous viewport', async () => {
    const layout = await layoutAsicSchematic(mockAsicSchematicGraph);
    const moduleNode = layout.nodes.find((node) => node.kind === 'module');

    expect(moduleNode).toBeDefined();
    if (!moduleNode) {
      return;
    }

    const moved = applySchematicNodePositions(layout, {
      [moduleNode.id]: {
        x: moduleNode.x + 1200,
        y: moduleNode.y,
      },
    });

    expect(moved.bounds.width).toBeGreaterThan(layout.bounds.width);
  });

  it('keeps a selected group together while avoiding unselected modules', async () => {
    const layout = await layoutAsicSchematic(mockAsicSchematicGraph);
    const selectedNodes = layout.nodes.filter((node) => node.kind === 'module').slice(0, 2);
    const obstacleNode = layout.nodes.find((node) => node.kind === 'module' && !selectedNodes.some((selectedNode) => selectedNode.id === node.id));

    expect(selectedNodes).toHaveLength(2);
    expect(obstacleNode).toBeDefined();
    if (selectedNodes.length < 2 || !obstacleNode) {
      return;
    }

    const relativeX = selectedNodes[1]!.x - selectedNodes[0]!.x;
    const relativeY = selectedNodes[1]!.y - selectedNodes[0]!.y;
    const resolvedPositions = resolveSchematicNodeOverlaps(layout, {
      [selectedNodes[0]!.id]: { x: obstacleNode.x, y: obstacleNode.y },
      [selectedNodes[1]!.id]: { x: obstacleNode.x + relativeX, y: obstacleNode.y + relativeY },
    }, {
      selectedNodeIds: selectedNodes.map((node) => node.id),
    });

    expect(resolvedPositions[selectedNodes[1]!.id]!.x - resolvedPositions[selectedNodes[0]!.id]!.x).toBe(relativeX);
    expect(resolvedPositions[selectedNodes[1]!.id]!.y - resolvedPositions[selectedNodes[0]!.id]!.y).toBe(relativeY);

    const moved = applySchematicNodePositions(layout, resolvedPositions, {
      selectedNodeIds: selectedNodes.map((node) => node.id),
    });
    const movedSelectedNodes = selectedNodes.map((node) => moved.nodes.find((candidate) => candidate.id === node.id)!);
    const movedObstacleNode = moved.nodes.find((node) => node.id === obstacleNode.id)!;

    movedSelectedNodes.forEach((node) => {
      expect(schematicRectsIntersect(getSchematicNodeRect(node), getSchematicNodeRect(movedObstacleNode), 24)).toBe(false);
    });
  });

  it('can resolve overlaps while applying positions and rerouting edges', async () => {
    const layout = await layoutAsicSchematic(mockAsicSchematicGraph);
    const selectedNode = layout.nodes.find((node) => node.id === 'u_cpu');
    const obstacleNode = layout.nodes.find((node) => node.kind === 'module' && node.id !== 'u_cpu');

    expect(selectedNode).toBeDefined();
    expect(obstacleNode).toBeDefined();
    if (!selectedNode || !obstacleNode) {
      return;
    }

    const moved = applySchematicNodePositions(layout, {
      [selectedNode.id]: { x: obstacleNode.x, y: obstacleNode.y },
    }, {
      avoidOverlaps: true,
      selectedNodeIds: [selectedNode.id],
    });
    const movedSelectedNode = moved.nodes.find((node) => node.id === selectedNode.id)!;
    const movedObstacleNode = moved.nodes.find((node) => node.id === obstacleNode.id)!;

    expect(schematicRectsIntersect(getSchematicNodeRect(movedSelectedNode), getSchematicNodeRect(movedObstacleNode), 24)).toBe(false);

    const connectedEdge = moved.edges.find((edge) => edge.from.instanceId === selectedNode.id || edge.to.instanceId === selectedNode.id);
    expect(connectedEdge).toBeDefined();
    if (!connectedEdge) {
      return;
    }

    expect(connectedEdge.points[0]).toEqual(getEndpointPoint(moved, connectedEdge.from));
    expect(connectedEdge.points[connectedEdge.points.length - 1]).toEqual(getEndpointPoint(moved, connectedEdge.to));
  });
});

describe('schematicRectsIntersect', () => {
  it('treats touching edges as non-overlapping without a gap', () => {
    expect(schematicRectsIntersect(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 100, y: 0, width: 100, height: 100 },
    )).toBe(false);
  });

  it('treats touching edges as overlapping when a gap is required', () => {
    expect(schematicRectsIntersect(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 100, y: 0, width: 100, height: 100 },
      24,
    )).toBe(true);
  });
});

function getEndpointPoint(layout: SchematicLayoutResult, endpoint: AsicNetEndpoint) {
  const node = layout.nodes.find((candidate) => candidate.id === (endpoint.instanceId ?? `io:${endpoint.portId}`));
  const port = node?.ports.find((candidate) => candidate.id === endpoint.portId);

  return port ? { x: port.x, y: port.y } : { x: node?.x ?? 0, y: node?.y ?? 0 };
}
