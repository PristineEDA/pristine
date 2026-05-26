export type AsicPortDirection = 'input' | 'output' | 'inout';

export interface AsicPort {
  id: string;
  name: string;
  direction: AsicPortDirection;
  width?: number;
}

export interface AsicInstance {
  id: string;
  name: string;
  moduleId: string;
  role: string;
}

export interface AsicNetEndpoint {
  instanceId?: string;
  portId: string;
}

export interface AsicNet {
  id: string;
  name: string;
  from: AsicNetEndpoint;
  to: AsicNetEndpoint[];
  kind?: 'clock' | 'reset' | 'control' | 'data' | 'bus';
}

export interface AsicModule {
  id: string;
  name: string;
  description: string;
  ports: AsicPort[];
  instances: AsicInstance[];
  nets: AsicNet[];
}

export interface AsicSchematicGraph {
  rootModuleId: string;
  modules: Record<string, AsicModule>;
}

export interface SchematicPoint {
  x: number;
  y: number;
}

export interface SchematicPortLayout extends AsicPort {
  x: number;
  y: number;
  side: 'west' | 'east' | 'north' | 'south';
}

export interface SchematicNodeLayout {
  id: string;
  label: string;
  subtitle: string;
  kind: 'module' | 'port';
  instanceId?: string;
  moduleId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ports: SchematicPortLayout[];
  canDrillDown: boolean;
}

export interface SchematicEdgeLayout {
  id: string;
  label: string;
  kind: AsicNet['kind'];
  signalWidth: number;
  isBus: boolean;
  from: AsicNetEndpoint;
  to: AsicNetEndpoint;
  points: SchematicPoint[];
}

export interface SchematicLayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SchematicLayoutResult {
  module: AsicModule;
  nodes: SchematicNodeLayout[];
  edges: SchematicEdgeLayout[];
  bounds: SchematicLayoutBounds;
  usedFallback: boolean;
}
