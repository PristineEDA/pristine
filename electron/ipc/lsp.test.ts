import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockHandle = vi.fn();
const mockExistsSync = vi.fn((_filePath?: string) => true);
const mockSpawn = vi.fn();
const mockCreateMessageConnection = vi.fn();

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
  },
  existsSync: (filePath: string) => mockExistsSync(filePath),
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

      if (method === 'systemverilog/moduleHierarchy') {
        return {
          roots: [{
            moduleName: 'cpu_top',
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

  it('forwards and normalizes module hierarchy results', async () => {
    const hierarchyHandler = getHandler('async:lsp:module-hierarchy');

    const hierarchy = await hierarchyHandler({}, { maxDepth: 8 });

    expect(fakeConnection.sendRequest).toHaveBeenCalledWith('systemverilog/moduleHierarchy', { maxDepth: 8 });
    expect(hierarchy).toEqual({
      roots: [{
        moduleName: 'cpu_top',
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
          moduleName: 'missing_block',
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
});
