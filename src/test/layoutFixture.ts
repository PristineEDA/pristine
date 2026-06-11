import type { LspLayoutGeometry, LspLayoutOpenResult } from '../../types/systemverilog-lsp';

export const layoutFixtureOpenResult = {
  sessionId: 'layout-test-session',
  id: 'layout-test-session',
  protocol: 'pristine-layout-columnar-v1',
  endpoint: {
    kind: 'namedPipe',
    path: '\\\\.\\pipe\\pristine-layout-test',
  },
  title: 'sg13g2_stdcell.lef',
  lefCount: 1,
  defPresent: false,
  unitsPerMicron: 1000,
  bbox: { x0: 0, y0: 0, x1: 2.4, y1: 3.78 },
  layerCount: 2,
  macroCount: 2,
  componentCount: 0,
  netCount: 0,
  diagnosticCount: 0,
  fileUris: ['file:///workspace/.pristine/layout/sg13g2_stdcell.lef'],
  messages: [],
  catalog: {
    unitsPerMicron: 1000,
    hasBounds: true,
    layers: [
      { index: 0, name: 'Metal1', kind: 1, pitch: 0.48, width: 0.16, spacing: 0.16 },
      { index: 1, name: 'Metal2', kind: 1, pitch: 0.56, width: 0.18, spacing: 0.18 },
    ],
    macros: [
      { index: 0, name: 'sg13g2_inv_1', className: 'CORE', originX: 0, originY: 0, sizeX: 1.2, sizeY: 3.78, pinCount: 3 },
      { index: 1, name: 'sg13g2_nand2_1', className: 'CORE', originX: 0, originY: 0, sizeX: 2.4, sizeY: 3.78, pinCount: 4 },
    ],
    vias: [],
    components: [],
    nets: [],
    diagnostics: [],
  },
} satisfies LspLayoutOpenResult;

export const layoutFixtureGeometry = {
  unitsPerMicron: 1000,
  truncated: false,
  shapeCount: 4,
  polygonPointCount: 0,
  shapes: [
    {
      index: 0,
      layerIndex: 0,
      kind: 'rect',
      ownerKind: 'pin',
      ownerIndex: 0,
      flags: 0,
      rect: { x0: 0.12, y0: 0.42, x1: 0.42, y1: 0.9 },
    },
    {
      index: 1,
      layerIndex: 0,
      kind: 'rect',
      ownerKind: 'pin',
      ownerIndex: 1,
      flags: 0,
      rect: { x0: 0.72, y0: 1.32, x1: 1.08, y1: 1.82 },
    },
    {
      index: 2,
      layerIndex: 1,
      kind: 'rect',
      ownerKind: 'obstruction',
      ownerIndex: 0,
      flags: 0,
      rect: { x0: 0.18, y0: 2.28, x1: 1.04, y1: 2.62 },
    },
    {
      index: 3,
      layerIndex: 1,
      kind: 'rect',
      ownerKind: 'obstruction',
      ownerIndex: 1,
      flags: 0,
      rect: { x0: 0.24, y0: 2.78, x1: 2.18, y1: 3.08 },
    },
  ],
} satisfies LspLayoutGeometry;
