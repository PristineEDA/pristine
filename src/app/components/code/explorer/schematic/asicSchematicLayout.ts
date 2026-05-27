import ELK, { type ELK as ElkInstance, type ElkEdgeSection, type ElkNode, type ElkPort } from 'elkjs/lib/elk.bundled.js';

import type {
  AsicModule,
  AsicNet,
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

export interface SchematicRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ApplySchematicNodePositionsOptions {
  avoidOverlaps?: boolean;
  snapToGrid?: boolean;
  gridSize?: number;
  nodeGap?: number;
  selectedNodeIds?: readonly string[];
}

const defaultNodeGap = 24;
export const schematicGridSize = 40;
export const schematicEdgeObstacleGap = 14;
export const schematicRouteHorizontalStubLength = 24;
const overlapResolveIterationLimit = 80;

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
  options?: ApplySchematicNodePositionsOptions,
): SchematicLayoutResult {
  if (!Object.values(positions).some(Boolean)) {
    return layout;
  }

  const requestedPositions = options?.snapToGrid
    ? snapSchematicNodePositions(positions, options.gridSize)
    : positions;
  const resolvedPositions = options?.avoidOverlaps
    ? resolveSchematicNodeOverlaps(layout, requestedPositions, {
      snapToGrid: options.snapToGrid,
      gridSize: options.gridSize,
      nodeGap: options.nodeGap,
      selectedNodeIds: options.selectedNodeIds,
    })
    : requestedPositions;

  let changed = false;
  const nodes = layout.nodes.map((node) => {
    const position = resolvedPositions[node.id];

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
    points: routeSchematicEdgePoints(edge, nodeMap),
  }));

  return {
    ...layout,
    nodes,
    edges,
    bounds: calculateBounds(nodes, edges),
  };
}

export interface ResolveSchematicNodeOverlapsOptions {
  snapToGrid?: boolean;
  gridSize?: number;
  nodeGap?: number;
  selectedNodeIds?: readonly string[];
}

export function resolveSchematicNodeOverlaps(
  layout: SchematicLayoutResult,
  positions: SchematicNodePositionOverrides,
  options?: ResolveSchematicNodeOverlapsOptions,
): SchematicNodePositionOverrides {
  const moduleById = new Map(layout.nodes
    .filter((node) => node.kind === 'module')
    .map((node) => [node.id, node]));
  const selectedNodeIds = new Set(options?.selectedNodeIds?.length
    ? options.selectedNodeIds.filter((nodeId) => moduleById.has(nodeId))
    : Object.keys(positions).filter((nodeId) => moduleById.has(nodeId) && positions[nodeId]));

  if (selectedNodeIds.size === 0) {
    return positions;
  }

  const nodeGap = options?.nodeGap ?? defaultNodeGap;
  const resolvedPositions: SchematicNodePositionOverrides = { ...positions };

  selectedNodeIds.forEach((nodeId) => {
    const node = moduleById.get(nodeId);

    if (node && !resolvedPositions[nodeId]) {
      resolvedPositions[nodeId] = { x: node.x, y: node.y };
    }
  });

  const obstacleRects = layout.nodes
    .filter((node) => node.kind === 'module' && !selectedNodeIds.has(node.id))
    .map((node) => getSchematicNodeRectWithPosition(node, resolvedPositions[node.id]));

  if (obstacleRects.length === 0) {
    return resolvedPositions;
  }

  const groupNodes = [...selectedNodeIds]
    .map((nodeId) => moduleById.get(nodeId))
    .filter((node): node is SchematicNodeLayout => Boolean(node));
  const groupRects = groupNodes.map((node) => getSchematicNodeRectWithPosition(node, resolvedPositions[node.id]));
  const shift = getNonOverlappingGroupShift(groupRects, obstacleRects, nodeGap);

  if (shift.x === 0 && shift.y === 0) {
    return resolvedPositions;
  }

  selectedNodeIds.forEach((nodeId) => {
    const node = moduleById.get(nodeId);
    const position = resolvedPositions[nodeId] ?? (node ? { x: node.x, y: node.y } : { x: 0, y: 0 });

    const shiftedPosition = {
      x: roundLayoutCoordinate(position.x + shift.x),
      y: roundLayoutCoordinate(position.y + shift.y),
    };

    resolvedPositions[nodeId] = options?.snapToGrid
      ? snapSchematicPointToGrid(shiftedPosition, options.gridSize)
      : shiftedPosition;
  });

  return resolvedPositions;
}

export function snapSchematicPointToGrid(point: SchematicPoint, gridSize = schematicGridSize): SchematicPoint {
  const safeGridSize = Number.isFinite(gridSize) && gridSize > 0 ? gridSize : schematicGridSize;

  return {
    x: roundLayoutCoordinate(Math.round(point.x / safeGridSize) * safeGridSize),
    y: roundLayoutCoordinate(Math.round(point.y / safeGridSize) * safeGridSize),
  };
}

export function snapSchematicNodePositions(
  positions: SchematicNodePositionOverrides,
  gridSize = schematicGridSize,
): SchematicNodePositionOverrides {
  return Object.fromEntries(Object.entries(positions).map(([nodeId, position]) => [
    nodeId,
    position ? snapSchematicPointToGrid(position, gridSize) : undefined,
  ]));
}

export function getSchematicNodeRect(node: SchematicNodeLayout): SchematicRect {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
}

export function schematicRectsIntersect(first: SchematicRect, second: SchematicRect, gap = 0) {
  return !(
    first.x + first.width + gap <= second.x
    || second.x + second.width + gap <= first.x
    || first.y + first.height + gap <= second.y
    || second.y + second.height + gap <= first.y
  );
}

export function schematicPolylineIntersectsRect(points: readonly SchematicPoint[], rect: SchematicRect, gap = 0) {
  const expandedRect = expandRect(rect, gap);

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];

    if (start && end && schematicSegmentIntersectsRect(start, end, expandedRect)) {
      return true;
    }
  }

  return false;
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
  const edges = toEdgeLayouts(graph, module, layout.edges ?? [], nodeMap);
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
      subtitle: '',
      tooltipType: port.direction,
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
    subtitle: '',
    tooltipType: childModule?.name ?? instance.moduleId,
    kind: 'module',
    cellKind: instance.cellKind,
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
  graph: AsicSchematicGraph,
  module: AsicModule,
  elkEdges: NonNullable<ElkNode['edges']>,
  nodeMap: Map<string, SchematicNodeLayout>,
): SchematicEdgeLayout[] {
  return module.nets.flatMap((net) => net.to.map((target, index) => {
    const elkEdge = elkEdges.find((edge) => edge.id === `${net.id}:${index}`);
    const points = elkEdge?.sections?.[0]
      ? getSectionPoints(elkEdge.sections[0])
      : getFallbackEdgePoints(net.from, target, nodeMap);

    return createSchematicEdgeLayout(graph, module, net, target, index, routeSchematicEdgePoints({
      id: `${net.id}:${index}`,
      label: net.name,
      kind: net.kind,
      signalWidth: getNetSignalWidth(graph, module, net.from, target),
      isBus: isBusNet(graph, module, net.kind, net.from, target),
      from: net.from,
      to: target,
      points,
    }, nodeMap));
  }));
}

function getSectionPoints(section: ElkEdgeSection): SchematicPoint[] {
  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
    .map((point) => ({ x: point.x, y: point.y }));
}

function createSchematicEdgeLayout(
  graph: AsicSchematicGraph,
  module: AsicModule,
  net: AsicNet,
  target: AsicNetEndpoint,
  targetIndex: number,
  points: SchematicPoint[],
): SchematicEdgeLayout {
  const signalWidth = getNetSignalWidth(graph, module, net.from, target);

  return {
    id: `${net.id}:${targetIndex}`,
    label: net.name,
    kind: net.kind,
    signalWidth,
    isBus: signalWidth > 1 || net.kind === 'bus',
    from: net.from,
    to: target,
    points,
  };
}

function getNetSignalWidth(
  graph: AsicSchematicGraph,
  module: AsicModule,
  from: AsicNetEndpoint,
  to: AsicNetEndpoint,
) {
  return Math.max(
    getEndpointPortWidth(graph, module, from),
    getEndpointPortWidth(graph, module, to),
  );
}

function isBusNet(
  graph: AsicSchematicGraph,
  module: AsicModule,
  kind: AsicNet['kind'],
  from: AsicNetEndpoint,
  to: AsicNetEndpoint,
) {
  return kind === 'bus' || getNetSignalWidth(graph, module, from, to) > 1;
}

function getEndpointPortWidth(graph: AsicSchematicGraph, module: AsicModule, endpoint: AsicNetEndpoint) {
  const port = getEndpointPort(graph, module, endpoint);

  return Math.max(1, port?.width ?? 1);
}

function getEndpointPort(graph: AsicSchematicGraph, module: AsicModule, endpoint: AsicNetEndpoint) {
  if (!endpoint.instanceId) {
    return module.ports.find((port) => port.id === endpoint.portId) ?? null;
  }

  const instance = module.instances.find((candidate) => candidate.id === endpoint.instanceId);
  const childModule = instance ? graph.modules[instance.moduleId] : undefined;

  return childModule?.ports.find((port) => port.id === endpoint.portId) ?? null;
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
      subtitle: '',
      tooltipType: childModule?.name ?? instance.moduleId,
      kind: 'module',
      cellKind: instance.cellKind,
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
  const edges = module.nets.flatMap((net) => net.to.map((target, index) => {
    const edge = createSchematicEdgeLayout(graph, module, net, target, index, getFallbackEdgePoints(net.from, target, nodeMap));

    return {
      ...edge,
      points: routeSchematicEdgePoints(edge, nodeMap),
    };
  }));

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
    subtitle: '',
    tooltipType: port.direction,
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

function getFallbackEdgePoints(from: AsicNetEndpoint, to: AsicNetEndpoint, nodeMap: Map<string, SchematicNodeLayout>): SchematicPoint[];
function getFallbackEdgePoints(start: SchematicPoint, end: SchematicPoint): SchematicPoint[];
function getFallbackEdgePoints(
  first: AsicNetEndpoint | SchematicPoint,
  second: AsicNetEndpoint | SchematicPoint,
  nodeMap?: Map<string, SchematicNodeLayout>,
): SchematicPoint[] {
  const start = nodeMap ? findEndpointPoint(first as AsicNetEndpoint, nodeMap) : first as SchematicPoint;
  const end = nodeMap ? findEndpointPoint(second as AsicNetEndpoint, nodeMap) : second as SchematicPoint;
  const midX = start.x + (end.x - start.x) / 2;

  return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
}

export function routeSchematicEdgePoints(
  edge: SchematicEdgeLayout,
  nodeMap: Map<string, SchematicNodeLayout>,
): SchematicPoint[] {
  const start = findEndpointRoutePoint(edge.from, nodeMap);
  const end = findEndpointRoutePoint(edge.to, nodeMap);
  const obstacleRects = getSchematicEdgeObstacleRects(edge, nodeMap);
  const searchedRoute = findOrthogonalRoute(start.stub, end.stub, obstacleRects);
  const protectedPointKeys = new Set([getRoutePointKey(start.stub), getRoutePointKey(end.stub)]);
  const candidates = [searchedRoute, ...createOrthogonalRouteCandidates(start.stub, end.stub, obstacleRects)]
    .filter((points): points is SchematicPoint[] => Boolean(points))
    .map((points) => normalizeRoutePoints(points))
    .map((points) => createStubbedRoute(start, end, points, protectedPointKeys))
    .filter((points, index, allCandidates) => allCandidates.findIndex((candidate) => areSameRoute(candidate, points)) === index);
  const validCandidates = candidates.filter((points) => !obstacleRects.some((rect) => schematicPolylineIntersectsRect(points, rect, schematicEdgeObstacleGap)));

  validCandidates.sort((first, second) => getRouteScore(first) - getRouteScore(second));

  return validCandidates[0] ?? createStubbedRoute(start, end, getFallbackEdgePoints(start.stub, end.stub), protectedPointKeys);
}

function getSchematicEdgeObstacleRects(edge: SchematicEdgeLayout, nodeMap: Map<string, SchematicNodeLayout>) {
  const connectedNodeIds = new Set([
    getEndpointNodeId(edge.from),
    getEndpointNodeId(edge.to),
  ]);

  return [...nodeMap.values()]
    .filter((node) => node.kind === 'module' && !connectedNodeIds.has(node.id))
    .map(getSchematicNodeRect);
}

function createOrthogonalRouteCandidates(
  start: SchematicPoint,
  end: SchematicPoint,
  obstacleRects: readonly SchematicRect[],
): SchematicPoint[][] {
  const midX = start.x + (end.x - start.x) / 2;
  const midY = start.y + (end.y - start.y) / 2;
  const { candidateXs, candidateYs } = getRouteCoordinates(start, end, obstacleRects);
  const candidates: SchematicPoint[][] = [];

  if (start.x === end.x || start.y === end.y) {
    candidates.push([start, end]);
  }

  candidateXs.forEach((x) => {
    candidates.push([start, { x, y: start.y }, { x, y: end.y }, end]);
  });
  candidateYs.forEach((y) => {
    candidates.push([start, { x: start.x, y }, { x: end.x, y }, end]);
  });

  candidates.push(
    [start, { x: midX, y: start.y }, { x: midX, y: midY }, { x: end.x, y: midY }, end],
    [start, { x: start.x, y: midY }, { x: midX, y: midY }, { x: midX, y: end.y }, end],
  );

  return candidates;
}

function findOrthogonalRoute(
  start: SchematicPoint,
  end: SchematicPoint,
  obstacleRects: readonly SchematicRect[],
): SchematicPoint[] | null {
  if (obstacleRects.length === 0) {
    return normalizeRoutePoints([start, { x: start.x + (end.x - start.x) / 2, y: start.y }, { x: start.x + (end.x - start.x) / 2, y: end.y }, end]);
  }

  const expandedObstacles = obstacleRects.map((rect) => expandRect(rect, schematicEdgeObstacleGap));
  const { candidateXs, candidateYs } = getRouteCoordinates(start, end, obstacleRects);
  const pointsByKey = new Map<string, SchematicPoint>();
  const startKey = getRoutePointKey(start);
  const endKey = getRoutePointKey(end);

  [...candidateXs, start.x, end.x].forEach((x) => {
    [...candidateYs, start.y, end.y].forEach((y) => {
      const point = { x: roundLayoutCoordinate(x), y: roundLayoutCoordinate(y) };

      if (!expandedObstacles.some((rect) => isPointInsideRect(point, rect))) {
        pointsByKey.set(getRoutePointKey(point), point);
      }
    });
  });
  pointsByKey.set(startKey, start);
  pointsByKey.set(endKey, end);

  const routePoints = [...pointsByKey.values()];
  const edgesByKey = new Map<string, Array<{ key: string; cost: number }>>();
  const addGraphEdge = (first: SchematicPoint, second: SchematicPoint) => {
    if (first.x !== second.x && first.y !== second.y) {
      return;
    }

    if (expandedObstacles.some((rect) => schematicSegmentIntersectsRect(first, second, rect))) {
      return;
    }

    const firstKey = getRoutePointKey(first);
    const secondKey = getRoutePointKey(second);
    const cost = Math.abs(first.x - second.x) + Math.abs(first.y - second.y);

    edgesByKey.set(firstKey, [...edgesByKey.get(firstKey) ?? [], { key: secondKey, cost }]);
    edgesByKey.set(secondKey, [...edgesByKey.get(secondKey) ?? [], { key: firstKey, cost }]);
  };

  uniqueCoordinates([...candidateYs, start.y, end.y]).forEach((y) => {
    const rowPoints = routePoints.filter((point) => point.y === y).sort((first, second) => first.x - second.x);

    for (let index = 1; index < rowPoints.length; index += 1) {
      addGraphEdge(rowPoints[index - 1]!, rowPoints[index]!);
    }
  });
  uniqueCoordinates([...candidateXs, start.x, end.x]).forEach((x) => {
    const columnPoints = routePoints.filter((point) => point.x === x).sort((first, second) => first.y - second.y);

    for (let index = 1; index < columnPoints.length; index += 1) {
      addGraphEdge(columnPoints[index - 1]!, columnPoints[index]!);
    }
  });

  const previousByKey = new Map<string, string>();
  const distanceByKey = new Map<string, number>([[startKey, 0]]);
  const pending = new Set(pointsByKey.keys());

  while (pending.size > 0) {
    const currentKey = [...pending].sort((first, second) => (distanceByKey.get(first) ?? Number.POSITIVE_INFINITY) - (distanceByKey.get(second) ?? Number.POSITIVE_INFINITY))[0];

    if (!currentKey || (distanceByKey.get(currentKey) ?? Number.POSITIVE_INFINITY) === Number.POSITIVE_INFINITY) {
      break;
    }

    pending.delete(currentKey);

    if (currentKey === endKey) {
      break;
    }

    const currentDistance = distanceByKey.get(currentKey) ?? Number.POSITIVE_INFINITY;
    edgesByKey.get(currentKey)?.forEach((edge) => {
      if (!pending.has(edge.key)) {
        return;
      }

      const nextDistance = currentDistance + edge.cost + 8;

      if (nextDistance < (distanceByKey.get(edge.key) ?? Number.POSITIVE_INFINITY)) {
        distanceByKey.set(edge.key, nextDistance);
        previousByKey.set(edge.key, currentKey);
      }
    });
  }

  if (!distanceByKey.has(endKey)) {
    return null;
  }

  const route: SchematicPoint[] = [];
  let currentKey: string | undefined = endKey;

  while (currentKey) {
    const point = pointsByKey.get(currentKey);

    if (point) {
      route.push(point);
    }
    currentKey = previousByKey.get(currentKey);
  }

  return route.reverse();
}

function getRouteCoordinates(
  start: SchematicPoint,
  end: SchematicPoint,
  obstacleRects: readonly SchematicRect[],
) {
  const midX = start.x + (end.x - start.x) / 2;
  const midY = start.y + (end.y - start.y) / 2;
  const clearance = schematicEdgeObstacleGap + 2;

  return {
    candidateXs: uniqueCoordinates([
      midX,
      start.x,
      end.x,
      ...obstacleRects.flatMap((rect) => [rect.x - clearance, rect.x + rect.width + clearance]),
    ]),
    candidateYs: uniqueCoordinates([
      midY,
      start.y,
      end.y,
      ...obstacleRects.flatMap((rect) => [rect.y - clearance, rect.y + rect.height + clearance]),
    ]),
  };
}

function getRoutePointKey(point: SchematicPoint) {
  return `${roundLayoutCoordinate(point.x)},${roundLayoutCoordinate(point.y)}`;
}

function uniqueCoordinates(values: readonly number[]) {
  return [...new Set(values.map(roundLayoutCoordinate))]
    .filter((value) => Number.isFinite(value))
    .sort((first, second) => Math.abs(first) - Math.abs(second));
}

function normalizeRoutePoints(points: readonly SchematicPoint[], protectedPointKeys = new Set<string>()) {
  const withoutDuplicates: SchematicPoint[] = [];

  points.forEach((point) => {
    const previous = withoutDuplicates[withoutDuplicates.length - 1];

    if (!previous || previous.x !== point.x || previous.y !== point.y) {
      withoutDuplicates.push({ x: roundLayoutCoordinate(point.x), y: roundLayoutCoordinate(point.y) });
    }
  });

  return withoutDuplicates.filter((point, index, allPoints) => {
    if (protectedPointKeys.has(getRoutePointKey(point))) {
      return true;
    }

    const previous = allPoints[index - 1];
    const next = allPoints[index + 1];

    if (!previous || !next) {
      return true;
    }

    return !(previous.x === point.x && point.x === next.x) && !(previous.y === point.y && point.y === next.y);
  });
}

function areSameRoute(first: readonly SchematicPoint[], second: readonly SchematicPoint[]) {
  return first.length === second.length && first.every((point, index) => {
    const otherPoint = second[index];

    return otherPoint?.x === point.x && otherPoint.y === point.y;
  });
}

function getRouteScore(points: readonly SchematicPoint[]) {
  let length = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const point = points[index]!;
    length += Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
  }

  return length + Math.max(0, points.length - 2) * 24;
}

function getEndpointNodeId(endpoint: AsicNetEndpoint) {
  return endpoint.instanceId ?? getIoNodeId(endpoint.portId);
}

interface SchematicEndpointRoutePoint {
  point: SchematicPoint;
  stub: SchematicPoint;
}

function createStubbedRoute(
  start: SchematicEndpointRoutePoint,
  end: SchematicEndpointRoutePoint,
  routeBetweenStubs: readonly SchematicPoint[],
  protectedPointKeys: Set<string>,
) {
  return normalizeRoutePoints([
    start.point,
    start.stub,
    ...routeBetweenStubs.slice(1, -1),
    end.stub,
    end.point,
  ], protectedPointKeys);
}

function findEndpointRoutePoint(endpoint: AsicNetEndpoint, nodeMap: Map<string, SchematicNodeLayout>): SchematicEndpointRoutePoint {
  const node = nodeMap.get(endpoint.instanceId ?? getIoNodeId(endpoint.portId));
  const port = node?.ports.find((candidate) => candidate.id === endpoint.portId);
  const point = port ? { x: port.x, y: port.y } : { x: node?.x ?? 0, y: node?.y ?? 0 };
  const direction = getEndpointHorizontalDirection(point, node, port);

  return {
    point,
    stub: {
      x: roundLayoutCoordinate(point.x + direction * schematicRouteHorizontalStubLength),
      y: point.y,
    },
  };
}

function getEndpointHorizontalDirection(
  point: SchematicPoint,
  node?: SchematicNodeLayout,
  port?: SchematicPortLayout,
) {
  if (port?.side === 'west') {
    return -1;
  }

  if (port?.side === 'east') {
    return 1;
  }

  if (node) {
    return point.x < node.x + node.width / 2 ? -1 : 1;
  }

  return 1;
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

function getSchematicNodeRectWithPosition(node: SchematicNodeLayout, position?: SchematicPoint): SchematicRect {
  return {
    x: position?.x ?? node.x,
    y: position?.y ?? node.y,
    width: node.width,
    height: node.height,
  };
}

function getBoundingRect(rects: readonly SchematicRect[]): SchematicRect {
  if (rects.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getNonOverlappingGroupShift(groupRects: readonly SchematicRect[], obstacleRects: readonly SchematicRect[], nodeGap: number): SchematicPoint {
  if (!hasAnyOverlap(groupRects, obstacleRects, nodeGap)) {
    return { x: 0, y: 0 };
  }

  const groupRect = getBoundingRect(groupRects);
  const candidates: SchematicPoint[] = [];

  obstacleRects.forEach((obstacleRect) => {
    candidates.push(
      { x: obstacleRect.x + obstacleRect.width + nodeGap - groupRect.x, y: 0 },
      { x: obstacleRect.x - nodeGap - (groupRect.x + groupRect.width), y: 0 },
      { x: 0, y: obstacleRect.y + obstacleRect.height + nodeGap - groupRect.y },
      { x: 0, y: obstacleRect.y - nodeGap - (groupRect.y + groupRect.height) },
    );
  });

  const searchStep = Math.max(72, nodeGap * 3);
  for (let radius = 1; radius <= overlapResolveIterationLimit; radius += 1) {
    candidates.push(
      { x: searchStep * radius, y: 0 },
      { x: -searchStep * radius, y: 0 },
      { x: 0, y: searchStep * radius },
      { x: 0, y: -searchStep * radius },
      { x: searchStep * radius, y: searchStep * radius },
      { x: -searchStep * radius, y: searchStep * radius },
      { x: searchStep * radius, y: -searchStep * radius },
      { x: -searchStep * radius, y: -searchStep * radius },
    );
  }

  const validCandidates = candidates
    .map((candidate) => ({ x: roundLayoutCoordinate(candidate.x), y: roundLayoutCoordinate(candidate.y) }))
    .filter((candidate, index, allCandidates) => allCandidates.findIndex((other) => other.x === candidate.x && other.y === candidate.y) === index)
    .filter((candidate) => !hasAnyOverlap(shiftRects(groupRects, candidate), obstacleRects, nodeGap));

  validCandidates.sort((first, second) => {
    const distanceDelta = Math.hypot(first.x, first.y) - Math.hypot(second.x, second.y);

    if (distanceDelta !== 0) {
      return distanceDelta;
    }

    return Math.abs(first.y) - Math.abs(second.y) || Math.abs(first.x) - Math.abs(second.x);
  });

  return validCandidates[0] ?? { x: 0, y: 0 };
}

function hasAnyOverlap(groupRects: readonly SchematicRect[], obstacleRects: readonly SchematicRect[], nodeGap: number) {
  return groupRects.some((groupRect) => obstacleRects.some((obstacleRect) => schematicRectsIntersect(groupRect, obstacleRect, nodeGap)));
}

function shiftRects(rects: readonly SchematicRect[], shift: SchematicPoint) {
  return rects.map((rect) => ({
    ...rect,
    x: rect.x + shift.x,
    y: rect.y + shift.y,
  }));
}

function expandRect(rect: SchematicRect, gap: number): SchematicRect {
  return {
    x: rect.x - gap,
    y: rect.y - gap,
    width: rect.width + gap * 2,
    height: rect.height + gap * 2,
  };
}

function schematicSegmentIntersectsRect(start: SchematicPoint, end: SchematicPoint, rect: SchematicRect) {
  if (isPointInsideRect(start, rect) || isPointInsideRect(end, rect)) {
    return true;
  }

  const rectPoints = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];

  return rectPoints.some((point, index) => {
    const nextPoint = rectPoints[(index + 1) % rectPoints.length]!;

    return segmentsIntersect(start, end, point, nextPoint);
  });
}

function isPointInsideRect(point: SchematicPoint, rect: SchematicRect) {
  return point.x > rect.x
    && point.x < rect.x + rect.width
    && point.y > rect.y
    && point.y < rect.y + rect.height;
}

function segmentsIntersect(firstStart: SchematicPoint, firstEnd: SchematicPoint, secondStart: SchematicPoint, secondEnd: SchematicPoint) {
  const firstDirection = getOrientation(firstStart, firstEnd, secondStart);
  const secondDirection = getOrientation(firstStart, firstEnd, secondEnd);
  const thirdDirection = getOrientation(secondStart, secondEnd, firstStart);
  const fourthDirection = getOrientation(secondStart, secondEnd, firstEnd);

  if (firstDirection !== secondDirection && thirdDirection !== fourthDirection) {
    return true;
  }

  return firstDirection === 0 && isPointOnSegment(firstStart, secondStart, firstEnd)
    || secondDirection === 0 && isPointOnSegment(firstStart, secondEnd, firstEnd)
    || thirdDirection === 0 && isPointOnSegment(secondStart, firstStart, secondEnd)
    || fourthDirection === 0 && isPointOnSegment(secondStart, firstEnd, secondEnd);
}

function getOrientation(first: SchematicPoint, second: SchematicPoint, third: SchematicPoint) {
  const value = (second.y - first.y) * (third.x - second.x) - (second.x - first.x) * (third.y - second.y);

  if (Math.abs(value) < 0.001) {
    return 0;
  }

  return value > 0 ? 1 : 2;
}

function isPointOnSegment(start: SchematicPoint, point: SchematicPoint, end: SchematicPoint) {
  return point.x <= Math.max(start.x, end.x)
    && point.x >= Math.min(start.x, end.x)
    && point.y <= Math.max(start.y, end.y)
    && point.y >= Math.min(start.y, end.y);
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
