import ELK, { type ELK as ElkInstance, type ElkEdgeSection, type ElkNode, type ElkPort } from 'elkjs/lib/elk.bundled.js';

import type {
  AsicModule,
  AsicNetEndpoint,
  AsicPort,
  AsicSchematicGraph,
  SchematicEdgeLayout,
  SchematicLayoutBounds,
  SchematicLayoutResult,
  SchematicNodeLayout,
  SchematicPoint,
  SchematicPortLayout,
} from './asicSchematicTypes';

const moduleNodeWidth = 190;
const moduleNodeBaseHeight = 88;
const ioNodeWidth = 96;
const ioNodeHeight = 34;
const portHeight = 18;
const fallbackColumnGap = 260;
const fallbackRowGap = 116;
const fallbackMargin = 56;

const elk = new ELK({
  defaultLayoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.spacing.nodeNode': '52',
    'elk.layered.spacing.nodeNodeBetweenLayers': '96',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.portConstraints': 'FIXED_SIDE',
  },
});

export interface LayoutAsicSchematicOptions {
  layoutEngine?: Pick<ElkInstance, 'layout'>;
}

export type SchematicNodePositionOverrides = Record<string, SchematicPoint | undefined>;

export async function layoutAsicSchematic(
  graph: AsicSchematicGraph,
  moduleId = graph.rootModuleId,
  options?: LayoutAsicSchematicOptions,
): Promise<SchematicLayoutResult> {
  const module = graph.modules[moduleId];

  if (!module) {
    throw new Error(`Unable to layout missing ASIC module '${moduleId}'.`);
  }

  try {
    const elkGraph = createElkGraph(graph, module);
    const layout = await (options?.layoutEngine ?? elk).layout(elkGraph);
    return toLayoutResult(graph, module, layout, false);
  } catch {
    return createFallbackLayout(graph, module);
  }
}

export function findModulePath(graph: AsicSchematicGraph, targetModuleId: string) {
  const root = graph.modules[graph.rootModuleId];

  if (!root) {
    return [];
  }

  const path = findModulePathFrom(graph, root, targetModuleId, new Set());
  return path ?? [root];
}

export function applySchematicNodePositions(
  layout: SchematicLayoutResult,
  positions: SchematicNodePositionOverrides,
): SchematicLayoutResult {
  if (!Object.values(positions).some(Boolean)) {
    return layout;
  }

  let changed = false;
  const nodes = layout.nodes.map((node) => {
    const position = positions[node.id];

    if (!position || node.kind !== 'module') {
      return node;
    }

    const nextX = roundLayoutCoordinate(position.x);
    const nextY = roundLayoutCoordinate(position.y);

    if (nextX === node.x && nextY === node.y) {
      return node;
    }

    changed = true;
    const deltaX = nextX - node.x;
    const deltaY = nextY - node.y;

    return {
      ...node,
      x: nextX,
      y: nextY,
      ports: node.ports.map((port) => ({
        ...port,
        x: roundLayoutCoordinate(port.x + deltaX),
        y: roundLayoutCoordinate(port.y + deltaY),
      })),
    };
  });

  if (!changed) {
    return layout;
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edges = layout.edges.map((edge) => ({
    ...edge,
    points: getFallbackEdgePoints(edge.from, edge.to, nodeMap),
  }));

  return {
    ...layout,
    nodes,
    edges,
    bounds: calculateBounds(nodes, edges),
  };
}

function findModulePathFrom(
  graph: AsicSchematicGraph,
  module: AsicModule,
  targetModuleId: string,
  visited: Set<string>,
): AsicModule[] | null {
  if (module.id === targetModuleId) {
    return [module];
  }

  if (visited.has(module.id)) {
    return null;
  }

  visited.add(module.id);

  for (const instance of module.instances) {
    const childModule = graph.modules[instance.moduleId];

    if (!childModule) {
      continue;
    }

    const childPath = findModulePathFrom(graph, childModule, targetModuleId, visited);

    if (childPath) {
      return [module, ...childPath];
    }
  }

  return null;
}

function createElkGraph(graph: AsicSchematicGraph, module: AsicModule): ElkNode {
  return {
    id: `module:${module.id}`,
    layoutOptions: {
      'elk.padding': '[top=40,left=48,bottom=40,right=48]',
    },
    children: [
      ...module.ports.map((port) => createIoElkNode(port)),
      ...module.instances.map((instance) => {
        const childModule = graph.modules[instance.moduleId];
        const ports = childModule?.ports ?? [];
        return {
          id: instance.id,
          width: moduleNodeWidth,
          height: getModuleNodeHeight(ports),
          ports: ports.map((port) => createInstanceElkPort(instance.id, port)),
          labels: [{ text: instance.name }],
        } satisfies ElkNode;
      }),
    ],
    edges: module.nets.flatMap((net) => net.to.map((target, index) => ({
      id: `${net.id}:${index}`,
      sources: [getEndpointElkPortId(net.from)],
      targets: [getEndpointElkPortId(target)],
      labels: [{ text: net.name }],
    }))),
  };
}

function createIoElkNode(port: AsicPort): ElkNode {
  return {
    id: getIoNodeId(port.id),
    width: ioNodeWidth,
    height: ioNodeHeight,
    ports: [{
      id: getIoPortId(port.id),
      width: 8,
      height: 8,
      layoutOptions: {
        'elk.port.side': port.direction === 'output' ? 'WEST' : 'EAST',
      },
    }],
    labels: [{ text: port.name }],
  };
}

function createInstanceElkPort(instanceId: string, port: AsicPort): ElkPort {
  return {
    id: getInstancePortId(instanceId, port.id),
    width: 8,
    height: 8,
    layoutOptions: {
      'elk.port.side': getElkPortSide(port),
    },
  };
}

function toLayoutResult(
  graph: AsicSchematicGraph,
  module: AsicModule,
  layout: ElkNode,
  usedFallback: boolean,
): SchematicLayoutResult {
  const elkChildren = layout.children ?? [];
  const nodes = elkChildren.map((child) => toNodeLayout(graph, module, child));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edges = toEdgeLayouts(module, layout.edges ?? [], nodeMap);
  const bounds = calculateBounds(nodes, edges);

  return { module, nodes, edges, bounds, usedFallback };
}

function toNodeLayout(graph: AsicSchematicGraph, module: AsicModule, elkNode: ElkNode): SchematicNodeLayout {
  const x = elkNode.x ?? 0;
  const y = elkNode.y ?? 0;
  const width = elkNode.width ?? moduleNodeWidth;
  const height = elkNode.height ?? moduleNodeBaseHeight;

  if (elkNode.id.startsWith('io:')) {
    const portId = elkNode.id.slice(3);
    const port = module.ports.find((candidate) => candidate.id === portId)!;
    const elkPort = elkNode.ports?.[0];
    const side = getLayoutSide(port.direction === 'output' ? 'west' : 'east');

    return {
      id: elkNode.id,
      label: port.name,
      subtitle: port.direction.toUpperCase(),
      kind: 'port',
      x,
      y,
      width,
      height,
      ports: [{
        ...port,
        side,
        x: x + (elkPort?.x ?? (side === 'west' ? 0 : width)),
        y: y + (elkPort?.y ?? height / 2),
      }],
      canDrillDown: false,
    };
  }

  const instance = module.instances.find((candidate) => candidate.id === elkNode.id)!;
  const childModule = graph.modules[instance.moduleId];
  const childPorts = childModule?.ports ?? [];
  const ports = childPorts.map((port) => {
    const elkPort = elkNode.ports?.find((candidate) => candidate.id === getInstancePortId(instance.id, port.id));
    const side = getPortLayoutSide(port);

    return {
      ...port,
      side,
      x: x + (elkPort?.x ?? (side === 'west' ? 0 : width)),
      y: y + (elkPort?.y ?? getFallbackPortY(childPorts, port)),
    } satisfies SchematicPortLayout;
  });

  return {
    id: instance.id,
    label: instance.name,
    subtitle: childModule?.name ?? instance.moduleId,
    kind: 'module',
    instanceId: instance.id,
    moduleId: instance.moduleId,
    x,
    y,
    width,
    height,
    ports,
    canDrillDown: Boolean(childModule && childModule.instances.length > 0),
  };
}

function toEdgeLayouts(
  module: AsicModule,
  elkEdges: NonNullable<ElkNode['edges']>,
  nodeMap: Map<string, SchematicNodeLayout>,
): SchematicEdgeLayout[] {
  return module.nets.flatMap((net) => net.to.map((target, index) => {
    const elkEdge = elkEdges.find((edge) => edge.id === `${net.id}:${index}`);
    const points = elkEdge?.sections?.[0]
      ? getSectionPoints(elkEdge.sections[0])
      : getFallbackEdgePoints(net.from, target, nodeMap);

    return {
      id: `${net.id}:${index}`,
      label: net.name,
      kind: net.kind,
      from: net.from,
      to: target,
      points,
    };
  }));
}

function getSectionPoints(section: ElkEdgeSection): SchematicPoint[] {
  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
    .map((point) => ({ x: point.x, y: point.y }));
}

function createFallbackLayout(graph: AsicSchematicGraph, module: AsicModule): SchematicLayoutResult {
  const inputPorts = module.ports.filter((port) => port.direction !== 'output');
  const outputPorts = module.ports.filter((port) => port.direction === 'output');
  const nodes: SchematicNodeLayout[] = [];

  inputPorts.forEach((port, index) => {
    nodes.push(createFallbackPortNode(port, fallbackMargin, fallbackMargin + index * fallbackRowGap));
  });

  module.instances.forEach((instance, index) => {
    const childModule = graph.modules[instance.moduleId];
    const ports = childModule?.ports ?? [];
    const x = fallbackMargin + fallbackColumnGap;
    const y = fallbackMargin + index * fallbackRowGap;
    const width = moduleNodeWidth;
    const height = getModuleNodeHeight(ports);

    nodes.push({
      id: instance.id,
      label: instance.name,
      subtitle: childModule?.name ?? instance.moduleId,
      kind: 'module',
      instanceId: instance.id,
      moduleId: instance.moduleId,
      x,
      y,
      width,
      height,
      ports: ports.map((port) => ({
        ...port,
        side: getPortLayoutSide(port),
        x: x + (port.direction === 'input' ? 0 : width),
        y: y + getFallbackPortY(ports, port),
      })),
      canDrillDown: Boolean(childModule && childModule.instances.length > 0),
    });
  });

  outputPorts.forEach((port, index) => {
    nodes.push(createFallbackPortNode(port, fallbackMargin + fallbackColumnGap * 2, fallbackMargin + index * fallbackRowGap));
  });

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edges = module.nets.flatMap((net) => net.to.map((target, index) => ({
    id: `${net.id}:${index}`,
    label: net.name,
    kind: net.kind,
    from: net.from,
    to: target,
    points: getFallbackEdgePoints(net.from, target, nodeMap),
  })));

  return {
    module,
    nodes,
    edges,
    bounds: calculateBounds(nodes, edges),
    usedFallback: true,
  };
}

function createFallbackPortNode(port: AsicPort, x: number, y: number): SchematicNodeLayout {
  const side = getLayoutSide(port.direction === 'output' ? 'west' : 'east');

  return {
    id: getIoNodeId(port.id),
    label: port.name,
    subtitle: port.direction.toUpperCase(),
    kind: 'port',
    x,
    y,
    width: ioNodeWidth,
    height: ioNodeHeight,
    ports: [{
      ...port,
      side,
      x: x + (side === 'west' ? 0 : ioNodeWidth),
      y: y + ioNodeHeight / 2,
    }],
    canDrillDown: false,
  };
}

function getFallbackEdgePoints(
  from: AsicNetEndpoint,
  to: AsicNetEndpoint,
  nodeMap: Map<string, SchematicNodeLayout>,
): SchematicPoint[] {
  const start = findEndpointPoint(from, nodeMap);
  const end = findEndpointPoint(to, nodeMap);
  const midX = start.x + (end.x - start.x) / 2;

  return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
}

function findEndpointPoint(endpoint: AsicNetEndpoint, nodeMap: Map<string, SchematicNodeLayout>): SchematicPoint {
  const node = nodeMap.get(endpoint.instanceId ?? getIoNodeId(endpoint.portId));
  const port = node?.ports.find((candidate) => candidate.id === endpoint.portId);

  return port ? { x: port.x, y: port.y } : { x: node?.x ?? 0, y: node?.y ?? 0 };
}

function calculateBounds(
  nodes: readonly SchematicNodeLayout[],
  edges: readonly SchematicEdgeLayout[],
): SchematicLayoutBounds {
  const nodePoints = nodes.flatMap((node) => [
    { x: node.x, y: node.y },
    { x: node.x + node.width, y: node.y + node.height },
  ]);
  const edgePoints = edges.flatMap((edge) => edge.points);
  const points = [...nodePoints, ...edgePoints];

  if (points.length === 0) {
    return { x: 0, y: 0, width: 640, height: 360 };
  }

  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));

  return {
    x: minX - 48,
    y: minY - 48,
    width: maxX - minX + 96,
    height: maxY - minY + 96,
  };
}

function roundLayoutCoordinate(value: number) {
  return Math.round(value * 10) / 10;
}

function getModuleNodeHeight(ports: readonly AsicPort[]) {
  const leftCount = ports.filter((port) => port.direction === 'input').length;
  const rightCount = ports.filter((port) => port.direction !== 'input').length;
  return Math.max(moduleNodeBaseHeight, 48 + Math.max(leftCount, rightCount) * portHeight);
}

function getFallbackPortY(ports: readonly AsicPort[], port: AsicPort) {
  const sameSidePorts = ports.filter((candidate) => getPortLayoutSide(candidate) === getPortLayoutSide(port));
  const index = sameSidePorts.findIndex((candidate) => candidate.id === port.id);
  return 42 + Math.max(index, 0) * portHeight;
}

function getEndpointElkPortId(endpoint: AsicNetEndpoint) {
  return endpoint.instanceId ? getInstancePortId(endpoint.instanceId, endpoint.portId) : getIoPortId(endpoint.portId);
}

function getIoNodeId(portId: string) {
  return `io:${portId}`;
}

function getIoPortId(portId: string) {
  return `io:${portId}:pin`;
}

function getInstancePortId(instanceId: string, portId: string) {
  return `${instanceId}:${portId}`;
}

function getElkPortSide(port: AsicPort) {
  return port.direction === 'input' ? 'WEST' : port.direction === 'output' ? 'EAST' : 'SOUTH';
}

function getPortLayoutSide(port: AsicPort) {
  return getLayoutSide(port.direction === 'input' ? 'west' : port.direction === 'output' ? 'east' : 'south');
}

function getLayoutSide(side: SchematicPortLayout['side']) {
  return side;
}
