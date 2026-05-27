import { describe, expect, it } from 'vitest';

import type { LspSchematic } from '../../../../../../types/systemverilog-lsp';
import { lspSchematicToGraph } from './lspSchematicGraph';

describe('lspSchematicToGraph', () => {
  it('maps engine schematic modules, logic cells, ports, and nets into the canvas graph model', () => {
    const schematic: LspSchematic = {
      rootModuleId: 'top',
      messages: [],
      modules: [{
        id: 'top',
        name: 'top',
        uri: 'file:///workspace/rtl/top.sv',
        ports: [
          { name: 'a', direction: 'input', widthText: 'logic' },
          { name: 'y', direction: 'output', widthText: 'logic [3:0]' },
        ],
        cells: [{
          id: 'u_child',
          name: 'u_child',
          type: 'child',
          kind: 'module',
          connections: [
            { portName: 'a', portIndex: 0, signal: 'a' },
            { portName: 'y', portIndex: 1, signal: 'n1' },
          ],
        }, {
          id: '$mux0',
          name: '$mux0',
          type: 'mux',
          kind: 'mux',
          connections: [
            { portName: 'Y', portIndex: 0, signal: 'y' },
            { portName: 'S', portIndex: 1, signal: 'sel' },
            { portName: 'I0', portIndex: 2, signal: 'a' },
            { portName: 'I1', portIndex: 3, signal: 'n1' },
          ],
        }],
        nets: [{
          name: 'a',
          drivers: [{ nodeId: '$port:a', portName: 'a' }],
          loads: [{ nodeId: 'u_child', portName: 'a' }, { nodeId: '$mux0', portName: 'I0' }],
        }, {
          name: 'y',
          drivers: [{ nodeId: '$mux0', portName: 'Y' }],
          loads: [{ nodeId: '$port:y', portName: 'y' }],
        }],
      }, {
        id: 'child',
        name: 'child',
        ports: [
          { name: 'a', direction: 'input', widthText: 'logic' },
          { name: 'y', direction: 'output', widthText: 'logic [3:0]' },
        ],
        cells: [],
        nets: [],
      }],
    };

    const graph = lspSchematicToGraph(schematic);

    expect(graph.rootModuleId).toBe('top');
    expect(graph.modules.top?.ports).toEqual([
      { id: 'a', name: 'a', direction: 'input', width: undefined },
      { id: 'y', name: 'y[3:0]', direction: 'output', width: 4 },
    ]);
    expect(graph.modules.child?.ports).toEqual([
      { id: 'a', name: 'a', direction: 'input', width: undefined },
      { id: 'y', name: 'y[3:0]', direction: 'output', width: 4 },
    ]);
    expect(graph.modules.top?.instances).toEqual([
      { id: 'u_child', name: 'u_child', moduleId: 'child', role: 'module', cellKind: 'module' },
      { id: '$mux0', name: '$mux0', moduleId: 'logic:mux', role: 'mux', cellKind: 'mux' },
    ]);
    expect(graph.modules['logic:mux']?.ports.map((port) => [port.id, port.direction])).toEqual([
      ['Y', 'output'],
      ['S', 'input'],
      ['I0', 'input'],
      ['I1', 'input'],
    ]);
    expect(graph.modules.top?.nets).toEqual([
      {
        id: 'top:a:0',
        name: 'a',
        from: { portId: 'a' },
        to: [{ instanceId: 'u_child', portId: 'a' }, { instanceId: '$mux0', portId: 'I0' }],
        kind: 'data',
      },
      {
        id: 'top:y:1',
        name: 'y',
        from: { instanceId: '$mux0', portId: 'Y' },
        to: [{ portId: 'y' }],
        kind: 'bus',
      },
    ]);
  });
});