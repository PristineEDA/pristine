import type {
  LspSchematic,
  LspSchematicCell,
  LspSchematicEndpoint,
  LspSchematicModule,
  LspSchematicPort,
} from '../../../../../../types/systemverilog-lsp';
import type { AsicModule, AsicNet, AsicNetEndpoint, AsicPort, AsicSchematicGraph } from './asicSchematicTypes';

const emptyRootModuleId = '__empty_schematic__';
const externalPortNodePrefix = '$port:';

export function lspSchematicToGraph(schematic: LspSchematic): AsicSchematicGraph {
  const modules = new Map<string, AsicModule>();
  const rootModuleId = schematic.rootModuleId ?? schematic.modules[0]?.id ?? emptyRootModuleId;

  schematic.modules.forEach((module) => {
    modules.set(module.id, lspModuleToAsicModule(module, schematic));
  });

  schematic.modules.forEach((module) => {
    module.cells.forEach((cell) => {
      const moduleId = getCellModuleId(cell, schematic);
      if (!modules.has(moduleId)) {
        modules.set(moduleId, createSyntheticModule(cell, moduleId));
      }
    });
  });

  if (!modules.has(rootModuleId)) {
    modules.set(rootModuleId, {
      id: rootModuleId,
      name: 'No schematic',
      description: 'No schematic data is available for the selected top.',
      ports: [],
      instances: [],
      nets: [],
    });
  }

  return {
    rootModuleId,
    modules: Object.fromEntries(modules),
  };
}

function lspModuleToAsicModule(module: LspSchematicModule, schematic: LspSchematic): AsicModule {
  return {
    id: module.id,
    name: module.name,
    description: module.filePath ?? module.uri ?? 'SystemVerilog module schematic.',
    ports: module.ports.map(lspPortToAsicPort),
    instances: module.cells.map((cell) => ({
      id: cell.id,
      name: cell.name,
      moduleId: getCellModuleId(cell, schematic),
      role: cell.kind,
      cellKind: cell.kind,
    })),
    nets: module.nets.flatMap((net, index) => lspNetToAsicNets(net.name, net.drivers, net.loads, index, module, schematic)),
  };
}

function lspPortToAsicPort(port: LspSchematicPort): AsicPort {
  const displayWidthText = getDisplayWidthText(port.widthText);

  return {
    id: port.name,
    name: displayWidthText ? `${port.name}${displayWidthText}` : port.name,
    direction: port.direction,
    width: getWidthFromText(port.widthText),
  };
}

function getDisplayWidthText(widthText: string) {
  return widthText.match(/\[[^\]]+\]/g)?.join('') ?? '';
}

function lspNetToAsicNets(
  netName: string,
  drivers: readonly LspSchematicEndpoint[],
  loads: readonly LspSchematicEndpoint[],
  netIndex: number,
  module: LspSchematicModule,
  schematic: LspSchematic,
): AsicNet[] {
  const resolvedDrivers = drivers.map((endpoint) => lspEndpointToAsicEndpoint(endpoint)).filter((endpoint): endpoint is AsicNetEndpoint => Boolean(endpoint));
  const resolvedLoads = loads.map((endpoint) => lspEndpointToAsicEndpoint(endpoint)).filter((endpoint): endpoint is AsicNetEndpoint => Boolean(endpoint));

  if (resolvedLoads.length === 0) {
    return [];
  }

  const from = resolvedDrivers[0] ?? createSyntheticSourceEndpoint(netName, module);

  return [{
    id: `${module.id}:${netName}:${netIndex}`,
    name: netName,
    from,
    to: resolvedLoads.filter((endpoint) => !isSameEndpoint(endpoint, from)),
    kind: inferNetKind(netName, from, resolvedLoads, module, schematic),
  }].filter((net) => net.to.length > 0);
}

function lspEndpointToAsicEndpoint(endpoint: LspSchematicEndpoint): AsicNetEndpoint | null {
  if (endpoint.nodeId.startsWith(externalPortNodePrefix)) {
    return { portId: endpoint.nodeId.slice(externalPortNodePrefix.length) || endpoint.portName };
  }

  return {
    instanceId: endpoint.nodeId,
    portId: endpoint.portName,
  };
}

function createSyntheticSourceEndpoint(netName: string, module: LspSchematicModule): AsicNetEndpoint {
  const port = module.ports.find((candidate) => candidate.name === netName && candidate.direction !== 'input');
  return { portId: port?.name ?? module.ports[0]?.name ?? netName };
}

function getCellModuleId(cell: LspSchematicCell, schematic: LspSchematic) {
  if (cell.kind === 'module' && schematic.modules.some((module) => module.id === cell.type)) {
    return cell.type;
  }

  return cell.kind === 'module' ? cell.type : `logic:${cell.kind}`;
}

function createSyntheticModule(cell: LspSchematicCell, moduleId: string): AsicModule {
  const ports = uniqueCellPorts(cell).map((connection) => ({
    id: connection.portName,
    name: connection.portName,
    direction: inferCellPortDirection(cell, connection.portName, connection.portIndex),
  } satisfies AsicPort));

  return {
    id: moduleId,
    name: cell.kind === 'module' ? cell.type : cell.kind,
    description: cell.kind === 'module' ? `Unresolved module ${cell.type}.` : `${cell.kind} logic block.`,
    ports,
    instances: [],
    nets: [],
  };
}

function uniqueCellPorts(cell: LspSchematicCell) {
  return [...new Map(cell.connections.map((connection) => [connection.portName, connection])).values()]
    .sort((left, right) => left.portIndex - right.portIndex);
}

function inferCellPortDirection(cell: LspSchematicCell, portName: string, portIndex: number): AsicPort['direction'] {
  const normalizedPortName = portName.toLowerCase();

  if (cell.kind !== 'module' && (normalizedPortName === 'y' || normalizedPortName === 'o' || normalizedPortName === 'out' || portIndex === 0)) {
    return 'output';
  }

  return 'input';
}

function getWidthFromText(widthText: string) {
  const match = widthText.match(/\[\s*(\d+)\s*:\s*(\d+)\s*\]/);

  if (!match) {
    return undefined;
  }

  const left = Number(match[1]);
  const right = Number(match[2]);

  return Number.isFinite(left) && Number.isFinite(right) ? Math.abs(left - right) + 1 : undefined;
}

function inferNetKind(
  name: string,
  from: AsicNetEndpoint,
  loads: readonly AsicNetEndpoint[],
  module: LspSchematicModule,
  schematic: LspSchematic,
): AsicNet['kind'] {
  const normalizedName = name.toLowerCase();
  if (normalizedName.includes('clk') || normalizedName.includes('clock')) {
    return 'clock';
  }

  if (normalizedName.includes('rst') || normalizedName.includes('reset')) {
    return 'reset';
  }

  if (normalizedName.includes('sel') || normalizedName.includes('ctrl') || normalizedName.includes('en')) {
    return 'control';
  }

  const width = Math.max(getEndpointWidth(from, module, schematic), ...loads.map((endpoint) => getEndpointWidth(endpoint, module, schematic)));
  return width > 1 ? 'bus' : 'data';
}

function getEndpointWidth(endpoint: AsicNetEndpoint, module: LspSchematicModule, schematic: LspSchematic) {
  if (!endpoint.instanceId) {
    const port = module.ports.find((candidate) => candidate.name === endpoint.portId);
    return port ? getWidthFromText(port.widthText) ?? 1 : 1;
  }

  const cell = module.cells.find((candidate) => candidate.id === endpoint.instanceId);
  const targetModule = cell ? schematic.modules.find((candidate) => candidate.id === getCellModuleId(cell, schematic)) : undefined;
  const targetPort = targetModule?.ports.find((candidate) => candidate.name === endpoint.portId);

  return targetPort ? getWidthFromText(targetPort.widthText) ?? 1 : 1;
}

function isSameEndpoint(left: AsicNetEndpoint, right: AsicNetEndpoint) {
  return left.instanceId === right.instanceId && left.portId === right.portId;
}