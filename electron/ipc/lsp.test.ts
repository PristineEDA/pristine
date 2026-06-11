import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockHandle = vi.fn();
const mockExistsSync = vi.fn((_filePath?: string) => true);
const mockMkdirSync = vi.fn();
const mockCopyFileSync = vi.fn();
const mockSpawn = vi.fn();
const mockCreateMessageConnection = vi.fn();
const mockCloseAllWaveformPipeSessions = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
const mockCloseWaveformPipeSession = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
const mockNormalizeWaveformOpenSessionMetadata = vi.fn<(...args: unknown[]) => unknown>((value: unknown) => value);
const mockOpenWaveformPipeSession = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
  cursorTime: 0,
  duration: 200,
  groups: [{ id: 'tb', label: 'tb' }],
  id: '1',
  messages: [],
  sessionId: '1',
  signals: [{
    color: '#12abef',
    groupId: 'tb',
    id: 'tb-count',
    kind: 'bus',
    name: 'count',
    path: 'tb.count',
    width: 16,
  }],
  timescaleUnit: 'ns',
  title: 'counter_tb',
}));
const mockRequestWaveformPipeFrame = vi.fn<(...args: unknown[]) => Promise<ArrayBuffer>>(async () => new ArrayBuffer(8));
const mockCloseAllLayoutPipeSessions = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
const mockCloseLayoutPipeSession = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
const mockNormalizeLayoutOpenSessionMetadata = vi.fn<(...args: unknown[]) => unknown>((value: unknown) => value);
const mockOpenLayoutPipeSession = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
  bbox: { x0: 0, y0: 0, x1: 1.2, y1: 3.78 },
  catalog: {
    components: [],
    diagnostics: [],
    hasBounds: true,
    layers: [{ index: 0, name: 'Metal1', kind: 1, pitch: 0.48, width: 0.16, spacing: 0.16 }],
    macros: [{ index: 0, name: 'sg13g2_inv_1', className: 'CORE', originX: 0, originY: 0, sizeX: 1.2, sizeY: 3.78, pinCount: 3 }],
    nets: [],
    unitsPerMicron: 1000,
    vias: [],
  },
  componentCount: 0,
  defPresent: false,
  diagnosticCount: 0,
  fileUris: ['file:///C:/workspace/Pristine/.pristine/layout/sg13g2_stdcell.lef'],
  id: 'layout-1',
  layerCount: 1,
  lefCount: 1,
  macroCount: 1,
  messages: [],
  netCount: 0,
  protocol: 'pristine-layout-columnar-v1',
  sessionId: 'layout-1',
  title: 'sg13g2_stdcell.lef',
  unitsPerMicron: 1000,
}));
const mockRequestLayoutPipeGeometry = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
  polygonPointCount: 0,
  shapeCount: 1,
  shapes: [{
    flags: 0,
    index: 0,
    kind: 'rect',
    layerIndex: 0,
    ownerIndex: 0,
    ownerKind: 'pin',
    rect: { x0: 0, y0: 0, x1: 1, y1: 1 },
  }],
  truncated: false,
  unitsPerMicron: 1000,
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (...args: unknown[]) => mockHandle(...args),
  },
  app: {
    isPackaged: false,
    getAppPath: () => 'C:/workspace/Pristine/dist-electron',
  },
  BrowserWindow: class {},
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: (filePath: string) => mockExistsSync(filePath),
    mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
    copyFileSync: (...args: unknown[]) => mockCopyFileSync(...args),
  },
  existsSync: (filePath: string) => mockExistsSync(filePath),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  copyFileSync: (...args: unknown[]) => mockCopyFileSync(...args),
}));

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock('vscode-jsonrpc/node.js', () => ({
  createMessageConnection: (...args: unknown[]) => mockCreateMessageConnection(...args),
  StreamMessageReader: class {
    constructor(_stream: unknown) {}
  },
  StreamMessageWriter: class {
    constructor(_stream: unknown) {}
  },
}));

vi.mock('./waveformPipeClient.js', () => ({
  closeAllWaveformPipeSessions: (...args: unknown[]) => mockCloseAllWaveformPipeSessions.apply(null, args),
  closeWaveformPipeSession: (...args: unknown[]) => mockCloseWaveformPipeSession.apply(null, args),
  normalizeWaveformOpenSessionMetadata: (...args: unknown[]) => mockNormalizeWaveformOpenSessionMetadata.apply(null, args),
  openWaveformPipeSession: (...args: unknown[]) => mockOpenWaveformPipeSession.apply(null, args),
  requestWaveformPipeFrame: (...args: unknown[]) => mockRequestWaveformPipeFrame.apply(null, args),
}));

vi.mock('./layoutPipeClient.js', () => ({
  closeAllLayoutPipeSessions: (...args: unknown[]) => mockCloseAllLayoutPipeSessions.apply(null, args),
  closeLayoutPipeSession: (...args: unknown[]) => mockCloseLayoutPipeSession.apply(null, args),
  normalizeLayoutOpenSessionMetadata: (...args: unknown[]) => mockNormalizeLayoutOpenSessionMetadata.apply(null, args),
  openLayoutPipeSession: (...args: unknown[]) => mockOpenLayoutPipeSession.apply(null, args),
  requestLayoutPipeGeometry: (...args: unknown[]) => mockRequestLayoutPipeGeometry.apply(null, args),
}));

import { disposeLspSession, registerLspHandlers, setLspProjectRoot } from './lsp.js';

type FakeConnection = {
  sendRequest: ReturnType<typeof vi.fn>;
  sendNotification: ReturnType<typeof vi.fn>;
  onNotification: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
  listen: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  _notificationHandlers: Map<string, (payload: any) => void>;
};

type FakeProcess = {
  stdout: Record<string, never>;
  stdin: Record<string, never>;
  stderr: { on: ReturnType<typeof vi.fn> };
  on: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
  killed: boolean;
  _handlers: Record<string, (...args: unknown[]) => void>;
};

function getHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
  const entry = mockHandle.mock.calls.find((call) => call[0] === channel);
  if (!entry) {
    throw new Error(`No handler registered for ${channel}`);
  }

  return entry[1];
}

function createFakeProcess(): FakeProcess {
  const handlers: Record<string, (...args: unknown[]) => void> = {};

  return {
    stdout: {},
    stdin: {},
    stderr: {
      on: vi.fn(),
    },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
    }),
    kill: vi.fn(function (this: FakeProcess) {
      this.killed = true;
    }),
    killed: false,
    _handlers: handlers,
  };
}

function createFakeConnection(): FakeConnection {
  const notificationHandlers = new Map<string, (payload: any) => void>();

  return {
    sendRequest: vi.fn(async (method: string) => {
      if (method === 'initialize') {
        return {};
      }

      if (method === 'textDocument/definition') {
        return [{
          uri: 'file:///C:/workspace/Pristine/rtl/core/alu.sv',
          range: {
            start: { line: 8, character: 2 },
            end: { line: 8, character: 12 },
          },
        }];
      }

      if (method === 'textDocument/typeDefinition') {
        return [{
          uri: 'file:///C:/workspace/Pristine/rtl/core/types.sv',
          range: {
            start: { line: 2, character: 4 },
            end: { line: 2, character: 11 },
          },
        }];
      }

      if (method === 'completionItem/resolve') {
        return {
          label: 'data_ready',
          kind: 6,
          detail: 'logic resolved',
          documentation: { kind: 'markdown', value: 'Resolved docs' },
        };
      }

      if (method === 'textDocument/documentSymbol') {
        return [{
          name: 'cpu_top',
          kind: 2,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 4, character: 9 },
          },
          selectionRange: {
            start: { line: 0, character: 7 },
            end: { line: 0, character: 14 },
          },
        }];
      }

      if (method === 'textDocument/semanticTokens/full') {
        return { data: [0, 7, 7, 1, 0] };
      }

      if (method === 'textDocument/signatureHelp') {
        return {
          signatures: [{ label: 'child(input logic clk)', parameters: [{ label: 'clk' }] }],
          activeSignature: 0,
          activeParameter: 0,
        };
      }

      if (method === 'textDocument/rename') {
        return {
          changes: {
            'file:///C:/workspace/Pristine/rtl/core/cpu_top.sv': [{
              range: {
                start: { line: 1, character: 2 },
                end: { line: 1, character: 7 },
              },
              newText: 'valid',
            }],
          },
        };
      }

      if (method === 'systemverilog/outline') {
        return {
          uri: 'file:///C:/workspace/Pristine/rtl/core/cpu_top.sv',
          version: 3,
          generation: 7,
          partial: false,
          truncated: false,
          roots: [{
            id: 'outline:0',
            parentId: null,
            name: 'cpu_top',
            kind: 'module',
            symbolKind: 2,
            range: {
              start: { line: 0, character: 0 },
              end: { line: 6, character: 9 },
            },
            selectionRange: {
              start: { line: 0, character: 7 },
              end: { line: 0, character: 14 },
            },
            depth: 0,
            children: [{
              id: 'outline:0.0',
              parentId: 'outline:0',
              name: 'ready',
              kind: 'port',
              detail: 'input logic',
              declaration: 'input logic ready',
              type: 'logic',
              direction: 'input',
              value: '1',
              moduleName: 'cpu_top',
              symbolKind: 13,
              range: {
                start: { line: 2, character: 2 },
                end: { line: 2, character: 13 },
              },
              selectionRange: {
                start: { line: 2, character: 8 },
                end: { line: 2, character: 13 },
              },
              depth: 1,
            }],
          }],
          items: [{
            id: 'outline:0',
            parentId: null,
            name: 'cpu_top',
            kind: 'module',
            symbolKind: 2,
            range: {
              start: { line: 0, character: 0 },
              end: { line: 6, character: 9 },
            },
            selectionRange: {
              start: { line: 0, character: 7 },
              end: { line: 0, character: 14 },
            },
            depth: 0,
          }],
          messages: ['ok'],
        };
      }

      if (method === 'systemverilog/moduleHierarchy') {
        return {
          roots: [{
            moduleName: 'cpu_top',
            kind: 'module',
            uri: 'file:///C:/workspace/Pristine/rtl/core/cpu_top.sv',
            range: {
              start: { line: 0, character: 0 },
              end: { line: 6, character: 9 },
            },
            selectionRange: {
              start: { line: 0, character: 7 },
              end: { line: 0, character: 14 },
            },
            unresolved: false,
            cycle: false,
            children: [{
              moduleName: 'alu',
              kind: 'module',
              instanceName: 'u_alu',
              uri: 'file:///C:/workspace/Pristine/rtl/core/alu.sv',
              instanceSelectionRange: {
                start: { line: 2, character: 6 },
                end: { line: 2, character: 11 },
              },
              unresolved: false,
              cycle: false,
              children: [],
            }, {
              moduleName: 'bus_if',
              kind: 'interface',
              instanceName: 'bus',
              uri: 'file:///C:/workspace/Pristine/rtl/core/bus_if.sv',
              unresolved: false,
              cycle: false,
              children: [],
            }, {
              moduleName: 'missing_block',
              instanceName: 'u_missing',
              uri: null,
              unresolved: true,
              cycle: false,
              children: [],
            }],
          }],
          messages: ['ok'],
        };
      }

      if (method === 'systemverilog/schematic') {
        return {
          rootModuleId: 'cpu_top',
          modules: [{
            id: 'cpu_top',
            name: 'cpu_top',
            uri: 'file:///C:/workspace/Pristine/rtl/core/cpu_top.sv',
            range: {
              start: { line: 0, character: 0 },
              end: { line: 8, character: 9 },
            },
            selectionRange: {
              start: { line: 0, character: 7 },
              end: { line: 0, character: 14 },
            },
            ports: [{
              name: 'clk',
              direction: 'input',
              widthText: '',
            }, {
              name: 'y',
              direction: 'output',
              widthText: '[7:0]',
            }],
            cells: [{
              id: 'u_and',
              name: 'u_and',
              type: 'and',
              kind: 'and',
              connections: [{ portName: 'Y', portIndex: 0, signal: 'y' }],
            }],
            nets: [{
              name: 'y',
              drivers: [{ nodeId: 'u_and', portName: 'Y' }],
              loads: [{ nodeId: '$port:y', portName: 'y' }],
            }],
          }],
          messages: ['ok'],
        };
      }

      if (method === 'systemverilog/waveform/open') {
        return {
          duration: 200,
          endpoint: {
            kind: 'namedPipe',
            path: '\\\\.\\pipe\\pristine-engine-waveform-test',
          },
          protocol: 'pristine-waveform-columnar-v1',
          sessionId: '1',
          signalCount: 1,
          timescaleUnit: 'ns',
          title: 'counter_tb',
        };
      }

      if (method === 'systemverilog/waveform/close') {
        return { closed: true };
      }

      if (method === 'systemverilog/layout/open') {
        return {
          bbox: { x0: 0, y0: 0, x1: 1.2, y1: 3.78 },
          componentCount: 0,
          defPresent: false,
          diagnosticCount: 0,
          endpoint: {
            kind: 'namedPipe',
            path: '\\\\.\\pipe\\pristine-engine-layout-test',
          },
          fileUris: ['file:///C:/workspace/Pristine/.pristine/layout/sg13g2_stdcell.lef'],
          layerCount: 1,
          lefCount: 1,
          macroCount: 1,
          messages: [],
          netCount: 0,
          protocol: 'pristine-layout-columnar-v1',
          sessionId: 'layout-1',
          title: 'sg13g2_stdcell.lef',
          unitsPerMicron: 1000,
        };
      }

      if (method === 'systemverilog/layout/close') {
        return { closed: true };
      }

      return null;
    }),
    sendNotification: vi.fn(async () => undefined),
    onNotification: vi.fn((method: string, handler: (payload: any) => void) => {
      notificationHandlers.set(method, handler);
    }),
    onClose: vi.fn(),
    listen: vi.fn(),
    dispose: vi.fn(),
    _notificationHandlers: notificationHandlers,
  };
}

describe('LSP IPC handlers', () => {
  const expectedBinaryPattern = process.platform === 'win32'
    ? /binaries[\\/]pristine-engine\.exe$/
    : /binaries[\\/]pristine-engine$/;
  const send = vi.fn();
  const getMainWindow = () => ({ webContents: { send } } as any);
  let fakeProcess: FakeProcess;
  let fakeConnection: FakeConnection;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandle.mockClear();
    setLspProjectRoot('C:/workspace/Pristine');
    fakeProcess = createFakeProcess();
    fakeConnection = createFakeConnection();
    mockSpawn.mockReturnValue(fakeProcess);
    mockCreateMessageConnection.mockReturnValue(fakeConnection);
    registerLspHandlers(getMainWindow);
  });

  afterEach(() => {
    vi.useRealTimers();
    disposeLspSession();
  });

  it('opens, changes, and closes documents while reusing a single session', async () => {
    const openHandler = getHandler('async:lsp:open-document');
    const changeHandler = getHandler('async:lsp:change-document');
    const closeHandler = getHandler('async:lsp:close-document');

    await openHandler({}, 'rtl/core/cpu_top.sv', 'systemverilog', 'module cpu_top; endmodule');
    await openHandler({}, 'rtl/core/cpu_top.sv', 'systemverilog', 'module cpu_top; endmodule');
    await changeHandler({}, 'rtl/core/cpu_top.sv', 'module cpu_top; logic valid; endmodule');
    await closeHandler({}, 'rtl/core/cpu_top.sv');
    await closeHandler({}, 'rtl/core/cpu_top.sv');

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.stringMatching(expectedBinaryPattern),
      [],
      expect.objectContaining({
        cwd: expect.stringContaining('Pristine'),
        shell: false,
        windowsHide: true,
      }),
    );
    expect(fakeConnection.listen).toHaveBeenCalledTimes(1);
    expect(fakeConnection.sendRequest).toHaveBeenCalledWith('initialize', expect.objectContaining({
      rootPath: expect.stringContaining('Pristine'),
    }));
    expect(fakeConnection.sendNotification).toHaveBeenCalledWith('initialized', {});
    expect(fakeConnection.sendNotification).toHaveBeenCalledWith('textDocument/didOpen', expect.objectContaining({
      textDocument: expect.objectContaining({
        uri: 'file:///C:/workspace/Pristine/rtl/core/cpu_top.sv',
        languageId: 'systemverilog',
      }),
    }));
    expect(fakeConnection.sendNotification).toHaveBeenCalledWith('textDocument/didChange', expect.objectContaining({
      textDocument: expect.objectContaining({
        uri: 'file:///C:/workspace/Pristine/rtl/core/cpu_top.sv',
      }),
      contentChanges: [{ text: 'module cpu_top; logic valid; endmodule' }],
    }));
    expect(fakeConnection.sendNotification).toHaveBeenCalledWith('textDocument/didClose', {
      textDocument: {
        uri: 'file:///C:/workspace/Pristine/rtl/core/cpu_top.sv',
      },
    });

    expect(send).toHaveBeenCalledWith('stream:lsp:debug', expect.objectContaining({
      direction: 'session',
      kind: 'lifecycle',
      status: 'starting',
    }));
    expect(send).toHaveBeenCalledWith('stream:lsp:debug', expect.objectContaining({
      direction: 'client->server',
      kind: 'request',
      method: 'initialize',
    }));
    expect(send).toHaveBeenCalledWith('stream:lsp:debug', expect.objectContaining({
      direction: 'client->server',
      kind: 'notification',
      method: 'textDocument/didOpen',
      filePath: 'rtl/core/cpu_top.sv',
    }));
    expect(send).toHaveBeenCalledWith('stream:lsp:debug', expect.objectContaining({
      direction: 'client->server',
      kind: 'notification',
      method: 'textDocument/didChange',
      filePath: 'rtl/core/cpu_top.sv',
    }));
  });

  it('keeps a bounded LSP debug history for renderers that subscribe late', async () => {
    const openHandler = getHandler('async:lsp:open-document');
    const historyHandler = getHandler('async:lsp:get-debug-events');

    await openHandler({}, 'rtl/core/cpu_top.sv', 'systemverilog', 'module cpu_top; endmodule');

    const history = await historyHandler({});

    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({
        direction: 'session',
        kind: 'lifecycle',
        status: 'starting',
      }),
      expect.objectContaining({
        direction: 'client->server',
        kind: 'request',
        method: 'initialize',
      }),
      expect.objectContaining({
        direction: 'session',
        kind: 'lifecycle',
        status: 'ready',
      }),
    ]));
  });

  it('prewarms the LSP session without opening a document', async () => {
    const ensureHandler = getHandler('async:lsp:ensure-initialized');

    await ensureHandler({});

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(fakeConnection.sendRequest).toHaveBeenCalledWith('initialize', expect.any(Object));
    expect(fakeConnection.sendNotification).toHaveBeenCalledWith('initialized', {});
    expect(fakeConnection.sendNotification).not.toHaveBeenCalledWith('textDocument/didOpen', expect.anything());
    expect(send).toHaveBeenCalledWith('stream:lsp:debug', expect.objectContaining({
      direction: 'session',
      kind: 'lifecycle',
      status: 'ready',
    }));
  });

  it('forwards diagnostics and normalizes definition results to workspace-relative paths', async () => {
    const openHandler = getHandler('async:lsp:open-document');
    const definitionHandler = getHandler('async:lsp:definition');

    await openHandler({}, 'rtl/core/cpu_top.sv', 'systemverilog', 'module cpu_top; endmodule');

    fakeConnection._notificationHandlers.get('textDocument/publishDiagnostics')?.({
      uri: 'file:///C:/workspace/Pristine/rtl/core/cpu_top.sv',
      diagnostics: [{
        message: 'Undriven signal',
        range: {
          start: { line: 3, character: 4 },
          end: { line: 3, character: 9 },
        },
        severity: 1,
      }],
    });

    expect(send).toHaveBeenCalledWith('stream:lsp:diagnostics', {
      filePath: 'rtl/core/cpu_top.sv',
      diagnostics: [{
        message: 'Undriven signal',
        range: {
          start: { line: 3, character: 4 },
          end: { line: 3, character: 9 },
        },
        severity: 1,
      }],
    });

    const locations = await definitionHandler({}, 'rtl/core/cpu_top.sv', 3, 4);
    expect(locations).toEqual([{
      filePath: 'rtl/core/alu.sv',
      range: {
        start: { line: 8, character: 2 },
        end: { line: 8, character: 12 },
      },
    }]);

    expect(send).toHaveBeenCalledWith('stream:lsp:debug', expect.objectContaining({
      direction: 'server->client',
      kind: 'notification',
      method: 'textDocument/publishDiagnostics',
      filePath: 'rtl/core/cpu_top.sv',
    }));
    expect(send).toHaveBeenCalledWith('stream:lsp:debug', expect.objectContaining({
      direction: 'client->server',
      kind: 'request',
      method: 'textDocument/definition',
      filePath: 'rtl/core/cpu_top.sv',
    }));
    expect(send).toHaveBeenCalledWith('stream:lsp:debug', expect.objectContaining({
      direction: 'server->client',
      kind: 'response',
      method: 'textDocument/definition',
      filePath: 'rtl/core/alu.sv',
    }));
  });

  it('returns a safe completion fallback and emits a debug error when requests time out', async () => {
    const openHandler = getHandler('async:lsp:open-document');
    const completionHandler = getHandler('async:lsp:completion');

    await openHandler({}, 'rtl/core/cpu_top.sv', 'systemverilog', 'module cpu_top; endmodule');
    fakeConnection.sendRequest.mockImplementation((method: string) => {
      if (method === 'textDocument/completion') {
        return new Promise(() => undefined);
      }

      return Promise.resolve(null);
    });

    vi.useFakeTimers();
    const completion = completionHandler({}, 'rtl/core/cpu_top.sv', 3, 4);

    await vi.advanceTimersByTimeAsync(10_000);

    await expect(completion).resolves.toBeNull();
    expect(fakeConnection.sendRequest).toHaveBeenCalledWith('textDocument/completion', expect.objectContaining({
      textDocument: {
        uri: 'file:///C:/workspace/Pristine/rtl/core/cpu_top.sv',
      },
      position: {
        line: 3,
        character: 4,
      },
    }));
    expect(send).toHaveBeenCalledWith('stream:lsp:debug', expect.objectContaining({
      direction: 'server->client',
      kind: 'response',
      method: 'textDocument/completion',
      filePath: 'rtl/core/cpu_top.sv',
      text: expect.stringContaining('timed out after 10000ms'),
      payload: expect.objectContaining({
        error: expect.objectContaining({
          name: 'LspRequestTimeoutError',
          message: expect.stringContaining('textDocument/completion'),
        }),
      }),
    }));
  });

  it('uses a 30 second timeout for hierarchy requests', async () => {
    const hierarchyHandler = getHandler('async:lsp:module-hierarchy');

    fakeConnection.sendRequest.mockImplementation((method: string) => {
      if (method === 'initialize') {
        return Promise.resolve({});
      }
      if (method === 'systemverilog/moduleHierarchy') {
        return new Promise(() => undefined);
      }

      return Promise.resolve(null);
    });

    vi.useFakeTimers();
    const hierarchy = hierarchyHandler({}, { maxDepth: 8 });

    await vi.advanceTimersByTimeAsync(10_000);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(19_999);
    await Promise.resolve();

    let settled = false;
    void hierarchy.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    await expect(hierarchy).resolves.toEqual({
      roots: [],
      messages: [expect.stringContaining('timed out after 30000ms')],
    });
  });

  it('uses a 30 second timeout for outline requests', async () => {
    const outlineHandler = getHandler('async:lsp:outline');

    fakeConnection.sendRequest.mockImplementation((method: string) => {
      if (method === 'initialize') {
        return Promise.resolve({});
      }
      if (method === 'systemverilog/outline') {
        return new Promise(() => undefined);
      }

      return Promise.resolve(null);
    });

    vi.useFakeTimers();
    const outline = outlineHandler({}, 'rtl/core/cpu_top.sv');

    await vi.advanceTimersByTimeAsync(10_000);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(19_999);
    await Promise.resolve();

    let settled = false;
    void outline.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    await expect(outline).resolves.toEqual(expect.objectContaining({
      uri: 'file:///C:/workspace/Pristine/rtl/core/cpu_top.sv',
      filePath: 'rtl/core/cpu_top.sv',
      roots: [],
      items: [],
      messages: [expect.stringContaining('timed out after 30000ms')],
    }));
  });

  it('forwards and normalizes additional Monaco LSP capability requests', async () => {
    const resolveHandler = getHandler('async:lsp:completion-resolve');
    const typeDefinitionHandler = getHandler('async:lsp:type-definition');
    const documentSymbolsHandler = getHandler('async:lsp:document-symbols');
    const semanticTokensHandler = getHandler('async:lsp:semantic-tokens-full');
    const signatureHelpHandler = getHandler('async:lsp:signature-help');
    const renameHandler = getHandler('async:lsp:rename');

    await expect(resolveHandler({}, { label: 'data_ready', data: { source: 'semanticEngine' } })).resolves.toEqual(
      expect.objectContaining({
        label: 'data_ready',
        detail: 'logic resolved',
        documentation: { kind: 'markdown', value: 'Resolved docs' },
      }),
    );
    await expect(typeDefinitionHandler({}, 'rtl/core/cpu_top.sv', 2, 4)).resolves.toEqual([{
      filePath: 'rtl/core/types.sv',
      range: {
        start: { line: 2, character: 4 },
        end: { line: 2, character: 11 },
      },
    }]);
    await expect(documentSymbolsHandler({}, 'rtl/core/cpu_top.sv')).resolves.toEqual([
      expect.objectContaining({
        name: 'cpu_top',
        kind: 2,
      }),
    ]);
    await expect(semanticTokensHandler({}, 'rtl/core/cpu_top.sv')).resolves.toEqual({ data: [0, 7, 7, 1, 0] });
    await expect(signatureHelpHandler({}, 'rtl/core/cpu_top.sv', 3, 17, '(', 2, false)).resolves.toEqual({
      signatures: [{ label: 'child(input logic clk)', documentation: undefined, parameters: [{ label: 'clk', documentation: undefined }] }],
      activeSignature: 0,
      activeParameter: 0,
    });
    await expect(renameHandler({}, 'rtl/core/cpu_top.sv', 1, 2, 'valid')).resolves.toEqual({
      changes: {
        'rtl/core/cpu_top.sv': [{
          range: {
            start: { line: 1, character: 2 },
            end: { line: 1, character: 7 },
          },
          newText: 'valid',
        }],
      },
    });
  });

  it('emits stderr output as debug events', async () => {
    const openHandler = getHandler('async:lsp:open-document');

    await openHandler({}, 'rtl/core/cpu_top.sv', 'systemverilog', 'module cpu_top; endmodule');

    const stderrHandler = fakeProcess.stderr.on.mock.calls[0]?.[1];
    stderrHandler?.(Buffer.from('server warning\n'));

    expect(send).toHaveBeenCalledWith('stream:lsp:debug', expect.objectContaining({
      direction: 'server->client',
      kind: 'stderr',
      text: 'server warning',
    }));
  });

  it('forwards and normalizes SystemVerilog outline results', async () => {
    const outlineHandler = getHandler('async:lsp:outline');

    const outline = await outlineHandler({}, 'rtl/core/cpu_top.sv');

    expect(fakeConnection.sendRequest).toHaveBeenCalledWith('systemverilog/outline', {
      textDocument: { uri: 'file:///C:/workspace/Pristine/rtl/core/cpu_top.sv' },
      maxDepth: 8,
      limit: 2000,
      includeChildren: true,
      includeFlat: true,
    });
    expect(outline).toEqual({
      uri: 'file:///C:/workspace/Pristine/rtl/core/cpu_top.sv',
      filePath: 'rtl/core/cpu_top.sv',
      version: 3,
      generation: 7,
      partial: false,
      truncated: false,
      roots: [{
        id: 'outline:0',
        parentId: null,
        name: 'cpu_top',
        kind: 'module',
        symbolKind: 2,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 6, character: 9 },
        },
        selectionRange: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 14 },
        },
        depth: 0,
        children: [{
          id: 'outline:0.0',
          parentId: 'outline:0',
          name: 'ready',
          kind: 'port',
          detail: 'input logic',
          declaration: 'input logic ready',
          type: 'logic',
          direction: 'input',
          value: '1',
          moduleName: 'cpu_top',
          symbolKind: 13,
          range: {
            start: { line: 2, character: 2 },
            end: { line: 2, character: 13 },
          },
          selectionRange: {
            start: { line: 2, character: 8 },
            end: { line: 2, character: 13 },
          },
          depth: 1,
          children: [],
        }],
      }],
      items: [{
        id: 'outline:0',
        parentId: null,
        name: 'cpu_top',
        kind: 'module',
        symbolKind: 2,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 6, character: 9 },
        },
        selectionRange: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 14 },
        },
        depth: 0,
        children: [],
      }],
      messages: ['ok'],
    });
    expect(send).toHaveBeenCalledWith('stream:lsp:debug', expect.objectContaining({
      direction: 'client->server',
      kind: 'request',
      method: 'systemverilog/outline',
    }));
  });

  it('forwards and normalizes module hierarchy results', async () => {
    const hierarchyHandler = getHandler('async:lsp:module-hierarchy');

    const hierarchy = await hierarchyHandler({}, { maxDepth: 8 });

    expect(fakeConnection.sendRequest).toHaveBeenCalledWith('systemverilog/moduleHierarchy', { maxDepth: 8 });
    expect(hierarchy).toEqual({
      roots: [{
        moduleName: 'cpu_top',
        kind: 'module',
        instanceName: undefined,
        uri: 'file:///C:/workspace/Pristine/rtl/core/cpu_top.sv',
        filePath: 'rtl/core/cpu_top.sv',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 6, character: 9 },
        },
        selectionRange: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 14 },
        },
        instanceRange: undefined,
        instanceSelectionRange: undefined,
        moduleSelectionRange: undefined,
        unresolved: false,
        cycle: false,
        truncated: undefined,
        children: [{
          moduleName: 'alu',
          kind: 'module',
          instanceName: 'u_alu',
          uri: 'file:///C:/workspace/Pristine/rtl/core/alu.sv',
          filePath: 'rtl/core/alu.sv',
          range: undefined,
          selectionRange: undefined,
          instanceRange: undefined,
          instanceSelectionRange: {
            start: { line: 2, character: 6 },
            end: { line: 2, character: 11 },
          },
          moduleSelectionRange: undefined,
          unresolved: false,
          cycle: false,
          truncated: undefined,
          children: [],
        }, {
          moduleName: 'bus_if',
          kind: 'interface',
          instanceName: 'bus',
          uri: 'file:///C:/workspace/Pristine/rtl/core/bus_if.sv',
          filePath: 'rtl/core/bus_if.sv',
          range: undefined,
          selectionRange: undefined,
          instanceRange: undefined,
          instanceSelectionRange: undefined,
          moduleSelectionRange: undefined,
          unresolved: false,
          cycle: false,
          truncated: undefined,
          children: [],
        }, {
          moduleName: 'missing_block',
          kind: 'module',
          instanceName: 'u_missing',
          uri: undefined,
          filePath: undefined,
          range: undefined,
          selectionRange: undefined,
          instanceRange: undefined,
          instanceSelectionRange: undefined,
          moduleSelectionRange: undefined,
          unresolved: true,
          cycle: false,
          truncated: undefined,
          children: [],
        }],
      }],
      messages: ['ok'],
    });
    expect(send).toHaveBeenCalledWith('stream:lsp:debug', expect.objectContaining({
      direction: 'client->server',
      kind: 'request',
      method: 'systemverilog/moduleHierarchy',
    }));
  });

  it('forwards and normalizes schematic results', async () => {
    const schematicHandler = getHandler('async:lsp:schematic');

    const schematic = await schematicHandler({}, { moduleName: 'cpu_top', maxDepth: 8 });

    expect(fakeConnection.sendRequest).toHaveBeenCalledWith('systemverilog/schematic', { moduleName: 'cpu_top', maxDepth: 8 });
    expect(schematic).toEqual({
      rootModuleId: 'cpu_top',
      modules: [{
        id: 'cpu_top',
        name: 'cpu_top',
        uri: 'file:///C:/workspace/Pristine/rtl/core/cpu_top.sv',
        filePath: 'rtl/core/cpu_top.sv',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 8, character: 9 },
        },
        selectionRange: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 14 },
        },
        ports: [{
          name: 'clk',
          direction: 'input',
          widthText: '',
          range: undefined,
          selectionRange: undefined,
        }, {
          name: 'y',
          direction: 'output',
          widthText: '[7:0]',
          range: undefined,
          selectionRange: undefined,
        }],
        cells: [{
          id: 'u_and',
          name: 'u_and',
          type: 'and',
          kind: 'and',
          range: undefined,
          selectionRange: undefined,
          connections: [{ portName: 'Y', portIndex: 0, signal: 'y', range: undefined }],
        }],
        nets: [{
          name: 'y',
          drivers: [{ nodeId: 'u_and', portName: 'Y' }],
          loads: [{ nodeId: '$port:y', portName: 'y' }],
        }],
      }],
      messages: ['ok'],
    });
    expect(send).toHaveBeenCalledWith('stream:lsp:debug', expect.objectContaining({
      direction: 'client->server',
      kind: 'request',
      method: 'systemverilog/schematic',
    }));
  });

  it('opens waveform sessions through LSP control plane and pipe catalog metadata', async () => {
    const openHandler = getHandler('async:lsp:waveform-open');

    const result = await openHandler({});

    expect(fakeConnection.sendRequest).toHaveBeenCalledWith('systemverilog/waveform/open', { source: 'mock' });
    expect(fakeConnection.sendRequest).not.toHaveBeenCalledWith('systemverilog/waveformOpen', expect.anything());
    expect(mockNormalizeWaveformOpenSessionMetadata).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: {
        kind: 'namedPipe',
        path: '\\\\.\\pipe\\pristine-engine-waveform-test',
      },
      protocol: 'pristine-waveform-columnar-v1',
      sessionId: '1',
    }));
    expect(mockOpenWaveformPipeSession).toHaveBeenCalledWith(expect.objectContaining({
      protocol: 'pristine-waveform-columnar-v1',
      sessionId: '1',
    }));
    expect(result).toEqual(expect.objectContaining({
      sessionId: '1',
      title: 'counter_tb',
    }));
  });

  it('requests waveform frames from the pipe data plane instead of LSP', async () => {
    const frameHandler = getHandler('async:lsp:waveform-frame');
    const frameOptions = {
      endTime: 100,
      headerHeight: 22,
      height: 320,
      laneHeight: 30,
      maxSegments: 0,
      preparedEndTime: 120,
      preparedStartTime: -20,
      protocolVersion: 2,
      sessionId: '1',
      signalIds: ['tb-count'],
      startTime: 0,
      viewportEndTime: 100,
      viewportStartTime: 0,
      width: 640,
    };

    const frame = await frameHandler({}, frameOptions);

    expect(frame).toBeInstanceOf(ArrayBuffer);
    expect(mockRequestWaveformPipeFrame).toHaveBeenCalledWith(frameOptions);
    expect(fakeConnection.sendRequest).not.toHaveBeenCalledWith('systemverilog/waveformFrame', expect.anything());
  });

  it('closes waveform pipe sessions before LSP control-plane close', async () => {
    const closeHandler = getHandler('async:lsp:waveform-close');

    const result = await closeHandler({}, '1');

    expect(result).toBe(true);
    expect(mockCloseWaveformPipeSession).toHaveBeenCalledWith('1');
    expect(fakeConnection.sendRequest).toHaveBeenCalledWith('systemverilog/waveform/close', { sessionId: '1' });
    expect(fakeConnection.sendRequest).not.toHaveBeenCalledWith('systemverilog/waveformClose', expect.anything());
  });

  it('opens layout sessions through LSP control plane and pipe catalog metadata', async () => {
    setLspProjectRoot('C:/workspace/Pristine/test/fixtures/workspace');
    mockExistsSync.mockImplementation((filePath?: string) => String(filePath).endsWith('.pristine\\layout\\sg13g2_stdcell.lef') ? false : true);
    const openHandler = getHandler('async:lsp:layout-open');

    const result = await openHandler({});

    expect(mockMkdirSync).toHaveBeenCalledWith('C:\\workspace\\Pristine\\test\\fixtures\\workspace\\.pristine\\layout', { recursive: true });
    expect(mockCopyFileSync).toHaveBeenCalledWith(
      'C:\\workspace\\pristine-engine\\.deps\\src\\ihp-open-pdk\\ihp-sg13g2\\libs.ref\\sg13g2_stdcell\\lef\\sg13g2_stdcell.lef',
      'C:\\workspace\\Pristine\\test\\fixtures\\workspace\\.pristine\\layout\\sg13g2_stdcell.lef',
    );
    expect(fakeConnection.sendRequest).toHaveBeenCalledWith('systemverilog/layout/open', {
      defUri: undefined,
      lefUris: ['file:///C:/workspace/Pristine/test/fixtures/workspace/.pristine/layout/sg13g2_stdcell.lef'],
      title: 'sg13g2_stdcell.lef',
    });
    expect(fakeConnection.sendRequest).not.toHaveBeenCalledWith('systemverilog/layoutOpen', expect.anything());
    expect(mockNormalizeLayoutOpenSessionMetadata).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: {
        kind: 'namedPipe',
        path: '\\\\.\\pipe\\pristine-engine-layout-test',
      },
      protocol: 'pristine-layout-columnar-v1',
      sessionId: 'layout-1',
    }));
    expect(mockOpenLayoutPipeSession).toHaveBeenCalledWith(expect.objectContaining({
      protocol: 'pristine-layout-columnar-v1',
      sessionId: 'layout-1',
    }));
    expect(result).toEqual(expect.objectContaining({
      sessionId: 'layout-1',
      title: 'sg13g2_stdcell.lef',
    }));
    setLspProjectRoot('C:/workspace/Pristine');
  });

  it('requests layout geometry from the pipe data plane instead of LSP', async () => {
    const geometryHandler = getHandler('async:lsp:layout-geometry');
    const geometryOptions = {
      bbox: { x0: 0, y0: 0, x1: 1, y1: 1 },
      layerIndices: [0],
      maxShapes: 1024,
      sessionId: 'layout-1',
      shapeKinds: [1, 2],
    };

    const geometry = await geometryHandler({}, geometryOptions);

    expect(geometry).toEqual(expect.objectContaining({
      shapeCount: 1,
      unitsPerMicron: 1000,
    }));
    expect(mockRequestLayoutPipeGeometry).toHaveBeenCalledWith(geometryOptions);
    expect(fakeConnection.sendRequest).not.toHaveBeenCalledWith('systemverilog/layout/geometry', expect.anything());
  });

  it('closes layout pipe sessions before LSP control-plane close', async () => {
    const closeHandler = getHandler('async:lsp:layout-close');

    const result = await closeHandler({}, 'layout-1');

    expect(result).toBe(true);
    expect(mockCloseLayoutPipeSession).toHaveBeenCalledWith('layout-1');
    expect(fakeConnection.sendRequest).toHaveBeenCalledWith('systemverilog/layout/close', { sessionId: 'layout-1' });
    expect(fakeConnection.sendRequest).not.toHaveBeenCalledWith('systemverilog/layoutClose', expect.anything());
  });
});
