import { describe, expect, it, vi } from 'vitest';

import {
  applySchematicNodePositions,
  findModulePath,
  getSchematicEndpointStubLength,
  getSchematicNodeRect,
  layoutAsicSchematic,
  logicGateNodeWidth,
  resolveSchematicNodeOverlaps,
  schematicEdgeObstacleGap,
  schematicGridSize,
  schematicLogicGateRouteHorizontalStubLength,
  schematicRouteHorizontalStubLength,
  schematicPolylineIntersectsRect,
  schematicRectsIntersect,
  snapSchematicPointToGrid,
} from './asicSchematicLayout';
import { mockAsicSchematicGraph } from './asicSchematicMockData';
import type { AsicNetEndpoint, AsicSchematicGraph, SchematicLayoutResult } from './asicSchematicTypes';

const logicGateGraph: AsicSchematicGraph = {
  rootModuleId: 'top',
  modules: {
    top: {
      id: 'top',
      name: 'top',
      description: '',
      ports: [
        { id: 'a', name: 'a', direction: 'input' },
        { id: 'b', name: 'b', direction: 'input' },
        { id: 'y', name: 'y', direction: 'output' },
      ],
      instances: [
        { id: 'u_gate', name: 'u_gate', moduleId: 'logic:and', role: 'primitive', cellKind: 'and' },
        { id: 'u_block', name: 'u_block', moduleId: 'leaf', role: 'module', cellKind: 'module' },
      ],
      nets: [
        { id: 'net_a', name: 'a', from: { portId: 'a' }, to: [{ instanceId: 'u_gate', portId: 'a' }] },
        { id: 'net_b', name: 'b', from: { portId: 'b' }, to: [{ instanceId: 'u_gate', portId: 'b' }] },
        { id: 'net_gate', name: 'gate_y', from: { instanceId: 'u_gate', portId: 'y' }, to: [{ instanceId: 'u_block', portId: 'a' }] },
        { id: 'net_y', name: 'y', from: { instanceId: 'u_block', portId: 'y' }, to: [{ portId: 'y' }] },
      ],
    },
    'logic:and': {
      id: 'logic:and',
      name: 'logic:and',
      description: '',
      ports: [
        { id: 'a', name: 'A', direction: 'input' },
        { id: 'b', name: 'B', direction: 'input' },
        { id: 'y', name: 'Y', direction: 'output' },
      ],
      instances: [],
      nets: [],
    },
    leaf: {
      id: 'leaf',
      name: 'leaf',
      description: '',
      ports: [
        { id: 'a', name: 'a', direction: 'input' },
        { id: 'b', name: 'b', direction: 'input' },
        { id: 'y', name: 'y', direction: 'output' },
      ],
      instances: [],
      nets: [],
    },
  },
};

const inoutPortGraph: AsicSchematicGraph = {
  rootModuleId: 'top',
  modules: {
    top: {
      id: 'top',
      name: 'top',
      description: '',
      ports: [
        { id: 'clk', name: 'clk', direction: 'input' },
        { id: 'bus', name: 'bus', direction: 'inout', width: 8 },
        { id: 'done', name: 'done', direction: 'output' },
      ],
      instances: [
        { id: 'u_pad', name: 'u_pad', moduleId: 'pad', role: 'module', cellKind: 'module' },
      ],
      nets: [
        { id: 'net_clk', name: 'clk', from: { portId: 'clk' }, to: [{ instanceId: 'u_pad', portId: 'clk' }] },
        { id: 'net_bus', name: 'bus', from: { portId: 'bus' }, to: [{ instanceId: 'u_pad', portId: 'bus' }], kind: 'bus' },
        { id: 'net_done', name: 'done', from: { instanceId: 'u_pad', portId: 'done' }, to: [{ portId: 'done' }] },
      ],
    },
    pad: {
      id: 'pad',
      name: 'pad',
      description: '',
      ports: [
        { id: 'clk', name: 'clk', direction: 'input' },
        { id: 'bus', name: 'bus', direction: 'inout', width: 8 },
        { id: 'done', name: 'done', direction: 'output' },
      ],
      instances: [],
      nets: [],
    },
  },
};

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

  it('keeps module and top-level port type metadata out of visible subtitles', async () => {
    const layout = await layoutAsicSchematic(mockAsicSchematicGraph);
    const moduleNode = layout.nodes.find((node) => node.kind === 'module');
    const portNode = layout.nodes.find((node) => node.kind === 'port');

    expect(moduleNode).toBeDefined();
    expect(portNode).toBeDefined();
    expect(moduleNode?.subtitle).toBe('');
    expect(moduleNode?.tooltipType).toBeTruthy();
    expect(moduleNode?.label).toBe(moduleNode?.instanceId);
    expect(portNode?.subtitle).toBe('');
    expect(portNode?.tooltipType).toMatch(/^(input|output|inout)$/);
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

  it('lays out primitive gates at one-quarter of the regular module area', async () => {
    const layout = await layoutAsicSchematic(logicGateGraph);
    const gateNode = layout.nodes.find((node) => node.id === 'u_gate');
    const moduleNode = layout.nodes.find((node) => node.id === 'u_block');

    expect(gateNode).toBeDefined();
    expect(moduleNode).toBeDefined();
    if (!gateNode || !moduleNode) {
      return;
    }

    expect(gateNode.cellKind).toBe('and');
    expect(gateNode.width).toBe(logicGateNodeWidth);
    expect(gateNode.width).toBe(moduleNode.width / 2);
    expect(gateNode.height).toBe(moduleNode.height / 2);
    expect(gateNode.width * gateNode.height).toBe(moduleNode.width * moduleNode.height / 4);
  });
});

describe('findModulePath', () => {
  it('returns the root-to-child breadcrumb path', () => {
    expect(findModulePath(mockAsicSchematicGraph, 'cpu_cluster').map((module) => module.id)).toEqual(['soc_top', 'cpu_cluster']);
  });
});

describe('applySchematicNodePositions', () => {
  it('snaps moved modules to the visible schematic grid', async () => {
    const layout = await layoutAsicSchematic(mockAsicSchematicGraph);
    const moduleNode = layout.nodes.find((node) => node.kind === 'module');

    expect(moduleNode).toBeDefined();
    if (!moduleNode) {
      return;
    }

    const moved = applySchematicNodePositions(layout, {
      [moduleNode.id]: { x: 123, y: 77 },
    }, {
      snapToGrid: true,
    });
    const movedNode = moved.nodes.find((node) => node.id === moduleNode.id);

    expect(movedNode?.x).toBe(120);
    expect(movedNode?.y).toBe(80);
    expect((movedNode?.x ?? 1) % schematicGridSize).toBe(0);
    expect((movedNode?.y ?? 1) % schematicGridSize).toBe(0);
  });

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

  it('respects custom grid size and unsnapped movement options', async () => {
    const layout = await layoutAsicSchematic(mockAsicSchematicGraph);
    const moduleNode = layout.nodes.find((node) => node.kind === 'module');

    expect(moduleNode).toBeDefined();
    if (!moduleNode) {
      return;
    }

    const customGridMoved = applySchematicNodePositions(layout, {
      [moduleNode.id]: { x: 37, y: 51 },
    }, {
      gridSize: 12,
      snapToGrid: true,
    });
    const customGridNode = customGridMoved.nodes.find((node) => node.id === moduleNode.id);

    expect(customGridNode?.x).toBe(36);
    expect(customGridNode?.y).toBe(48);

    const unsnappedMoved = applySchematicNodePositions(layout, {
      [moduleNode.id]: { x: 37, y: 51 },
    }, {
      snapToGrid: false,
    });
    const unsnappedNode = unsnappedMoved.nodes.find((node) => node.id === moduleNode.id);

    expect(unsnappedNode?.x).toBe(37);
    expect(unsnappedNode?.y).toBe(51);
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

  it('keeps snapped module moves clear of compact primitive gate obstacles', async () => {
    const layout = await layoutAsicSchematic(logicGateGraph);
    const selectedNode = layout.nodes.find((node) => node.id === 'u_block');
    const gateNode = layout.nodes.find((node) => node.id === 'u_gate');

    expect(selectedNode).toBeDefined();
    expect(gateNode).toBeDefined();
    if (!selectedNode || !gateNode) {
      return;
    }

    const moved = applySchematicNodePositions(layout, {
      [selectedNode.id]: { x: gateNode.x, y: gateNode.y },
    }, {
      avoidOverlaps: true,
      snapToGrid: true,
      selectedNodeIds: [selectedNode.id],
    });
    const movedSelectedNode = moved.nodes.find((node) => node.id === selectedNode.id)!;
    const movedGateNode = moved.nodes.find((node) => node.id === gateNode.id)!;

    expect(schematicRectsIntersect(getSchematicNodeRect(movedSelectedNode), getSchematicNodeRect(movedGateNode), 24)).toBe(false);
  });

  it('reroutes wires around non-endpoint module bodies after module movement', async () => {
    const layout = await layoutAsicSchematic(mockAsicSchematicGraph);
    const moduleNode = layout.nodes.find((node) => node.id === 'u_cpu');

    expect(moduleNode).toBeDefined();
    if (!moduleNode) {
      return;
    }

    const moved = applySchematicNodePositions(layout, {
      [moduleNode.id]: snapSchematicPointToGrid({ x: moduleNode.x + 220, y: moduleNode.y + 120 }),
    }, {
      avoidOverlaps: true,
      snapToGrid: true,
      selectedNodeIds: [moduleNode.id],
    });
    const moduleNodes = moved.nodes.filter((node) => node.kind === 'module');

    moved.edges.forEach((edge) => {
      const connectedNodeIds = new Set([edge.from.instanceId ?? `io:${edge.from.portId}`, edge.to.instanceId ?? `io:${edge.to.portId}`]);
      const obstacleNodes = moduleNodes.filter((node) => !connectedNodeIds.has(node.id));

      obstacleNodes.forEach((obstacleNode) => {
        expect(schematicPolylineIntersectsRect(edge.points, getSchematicNodeRect(obstacleNode), schematicEdgeObstacleGap)).toBe(false);
      });
    });
  });
});

describe('edge metadata', () => {
  it('classifies single signals and buses for rendering', async () => {
    const layout = await layoutAsicSchematic(mockAsicSchematicGraph);
    const busEdge = layout.edges.find((edge) => edge.kind === 'bus');
    const signalEdge = layout.edges.find((edge) => !edge.isBus);

    expect(busEdge).toBeDefined();
    expect(busEdge?.isBus).toBe(true);
    expect(busEdge?.signalWidth).toBeGreaterThan(1);
    expect(signalEdge).toBeDefined();
    expect(signalEdge?.isBus).toBe(false);
    expect(signalEdge?.signalWidth).toBe(1);
  });

  it('routes edges with fixed horizontal endpoint stubs', async () => {
    const layout = await layoutAsicSchematic(mockAsicSchematicGraph);
    const routedEdge = layout.edges.find((edge) => edge.points.length >= 4);

    expect(routedEdge).toBeDefined();
    if (!routedEdge) {
      return;
    }

    const start = getEndpointPoint(layout, routedEdge.from);
    const end = getEndpointPoint(layout, routedEdge.to);
    const startNode = getEndpointNode(layout, routedEdge.from);
    const endNode = getEndpointNode(layout, routedEdge.to);
    const firstStub = routedEdge.points[1]!;
    const lastStub = routedEdge.points[routedEdge.points.length - 2]!;

    expect(routedEdge.points[0]).toEqual(start);
    expect(routedEdge.points[routedEdge.points.length - 1]).toEqual(end);
    expect(firstStub.y).toBe(start.y);
    expect(Math.abs(firstStub.x - start.x)).toBe(getSchematicEndpointStubLength(startNode));
    expect(lastStub.y).toBe(end.y);
    expect(Math.abs(lastStub.x - end.x)).toBe(getSchematicEndpointStubLength(endNode));
  });

  it('uses shorter horizontal endpoint stubs for compact primitive gates', async () => {
    const layout = await layoutAsicSchematic(logicGateGraph);
    const gateEdge = layout.edges.find((edge) => edge.from.instanceId === 'u_gate' || edge.to.instanceId === 'u_gate');

    expect(gateEdge).toBeDefined();
    if (!gateEdge) {
      return;
    }

    const firstStub = gateEdge.points[1]!;
    const lastStub = gateEdge.points[gateEdge.points.length - 2]!;
    const start = getEndpointPoint(layout, gateEdge.from);
    const end = getEndpointPoint(layout, gateEdge.to);
    const startNode = getEndpointNode(layout, gateEdge.from);
    const endNode = getEndpointNode(layout, gateEdge.to);

    expect(Math.abs(firstStub.x - start.x)).toBe(getSchematicEndpointStubLength(startNode));
    expect(Math.abs(lastStub.x - end.x)).toBe(getSchematicEndpointStubLength(endNode));
    expect([Math.abs(firstStub.x - start.x), Math.abs(lastStub.x - end.x)]).toContain(schematicLogicGateRouteHorizontalStubLength);
    expect([Math.abs(firstStub.x - start.x), Math.abs(lastStub.x - end.x)]).toContain(schematicRouteHorizontalStubLength);
  });

  it('keeps wire endpoints attached to their port anchors', async () => {
    const layout = await layoutAsicSchematic(logicGateGraph);

    layout.edges.forEach((edge) => {
      expect(edge.points[0]).toEqual(getEndpointPoint(layout, edge.from));
      expect(edge.points[edge.points.length - 1]).toEqual(getEndpointPoint(layout, edge.to));
    });
  });

  it('places module inout ports on the right and keeps connected wires attached', async () => {
    const layout = await layoutAsicSchematic(inoutPortGraph);
    const moduleNode = layout.nodes.find((node) => node.id === 'u_pad');
    const inoutPort = moduleNode?.ports.find((port) => port.direction === 'inout');

    expect(moduleNode).toBeDefined();
    expect(inoutPort).toBeDefined();
    if (!moduleNode || !inoutPort) {
      return;
    }

    expect(inoutPort.side).toBe('east');
    expect(inoutPort.x).toBe(moduleNode.x + moduleNode.width);

    const inoutEdge = layout.edges.find((edge) => edge.to.instanceId === moduleNode.id && edge.to.portId === inoutPort.id);
    expect(inoutEdge).toBeDefined();
    if (!inoutEdge) {
      return;
    }

    expect(inoutEdge.points[0]).toEqual(getEndpointPoint(layout, inoutEdge.from));
    expect(inoutEdge.points[inoutEdge.points.length - 1]).toEqual(getEndpointPoint(layout, inoutEdge.to));
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
  const node = getEndpointNode(layout, endpoint);
  const port = node?.ports.find((candidate) => candidate.id === endpoint.portId);

  return port ? { x: port.x, y: port.y } : { x: node?.x ?? 0, y: node?.y ?? 0 };
}

function getEndpointNode(layout: SchematicLayoutResult, endpoint: AsicNetEndpoint) {
  return layout.nodes.find((candidate) => candidate.id === (endpoint.instanceId ?? `io:${endpoint.portId}`));
}
