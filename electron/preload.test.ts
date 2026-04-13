import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExposeInMainWorld, mockSendSync, mockInvoke, mockOn, mockRemoveListener } = vi.hoisted(() => ({
  mockExposeInMainWorld: vi.fn(),
  mockSendSync: vi.fn((channel: string, ...args: unknown[]) => {
    if (channel === 'sync:window:is-maximized') {
      return true;
    }
    if (channel === 'sync:config:get') {
      return args[0] === 'theme' ? 'dracula' : null;
    }
    return null;
  }),
  mockInvoke: vi.fn(),
  mockOn: vi.fn(),
  mockRemoveListener: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, api: unknown) => mockExposeInMainWorld(name, api),
  },
  ipcRenderer: {
    sendSync: (channel: string, ...args: unknown[]) => mockSendSync(channel, ...args),
    invoke: (channel: string, ...args: unknown[]) => mockInvoke(channel, ...args),
    on: (channel: string, listener: (...args: unknown[]) => void) => mockOn(channel, listener),
    removeListener: (channel: string, listener: (...args: unknown[]) => void) =>
      mockRemoveListener(channel, listener),
  },
}));

async function importPreload() {
  vi.resetModules();
  await import('./preload.ts');
}

describe('preload bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes a typed electronAPI bridge in the renderer world', async () => {
    await importPreload();

    expect(mockExposeInMainWorld).toHaveBeenCalledTimes(1);
    const [, api] = mockExposeInMainWorld.mock.calls[0];

    expect(mockSendSync).not.toHaveBeenCalledWith('sync:platform');
    expect(api.platform).toBe(process.platform);
    expect(api.arch).toBe(process.arch);
    expect(api.versions.electron).toBe(process.versions.electron);
    expect(api.isMaximized()).toBe(true);
    expect(api.config.get('theme')).toBe('dracula');
  });

  it('forwards async invocations and stream subscriptions through ipcRenderer', async () => {
    await importPreload();

    const [, api] = mockExposeInMainWorld.mock.calls[0];
    const onMaximizedChange = vi.fn();
    const onStdout = vi.fn();
    const onStderr = vi.fn();
    const onShellExit = vi.fn();
    const onTerminalData = vi.fn();
    const onTerminalExit = vi.fn();
    const onLspDiagnostics = vi.fn();
    const onLspState = vi.fn();

    api.minimize();
    api.maximize();
    api.show();
    api.hide();
    api.close();
    api.setFloatingInfoWindowVisible(true);
    api.fs.readFile('src/main.v', 'utf-8');
    api.fs.listFiles('rtl');
    api.fs.writeFile('rtl/main.v', 'module main; endmodule');
    api.fs.readDir('rtl');
    api.fs.stat('rtl/main.v');
    api.fs.exists('rtl/main.v');
    api.shell.exec('make', ['lint'], { cwd: 'rtl' });
    api.shell.kill('shell-1');
    api.terminal.create({ cwd: 'rtl', cols: 120, rows: 40 });
    api.terminal.write('terminal-1', 'help');
    api.terminal.resize('terminal-1', 160, 50);
    api.terminal.kill('terminal-1');
    api.lsp.openDocument('rtl/core/cpu_top.sv', 'systemverilog', 'module cpu_top; endmodule');
    api.lsp.changeDocument('rtl/core/cpu_top.sv', 'module cpu_top; logic a; endmodule');
    api.lsp.closeDocument('rtl/core/cpu_top.sv');
    api.lsp.completion('rtl/core/cpu_top.sv', 4, 6, '.', 2);
    api.lsp.hover('rtl/core/cpu_top.sv', 4, 6);
    api.lsp.definition('rtl/core/cpu_top.sv', 4, 6);
    api.lsp.references('rtl/core/cpu_top.sv', 4, 6, false);
    api.config.set('theme', 'dracula');

    const dispose = api.onMaximizedChange(onMaximizedChange);
    const disposeStdout = api.shell.onStdout(onStdout);
    const disposeStderr = api.shell.onStderr(onStderr);
    const disposeShellExit = api.shell.onExit(onShellExit);
    const disposeTerminalData = api.terminal.onData(onTerminalData);
    const disposeTerminalExit = api.terminal.onExit(onTerminalExit);
    const disposeLspDiagnostics = api.lsp.onDiagnostics(onLspDiagnostics);
    const disposeLspState = api.lsp.onState(onLspState);

    expect(mockInvoke).toHaveBeenCalledWith('async:window:minimize');
    expect(mockInvoke).toHaveBeenCalledWith('async:window:maximize');
    expect(mockInvoke).toHaveBeenCalledWith('async:window:show');
    expect(mockInvoke).toHaveBeenCalledWith('async:window:hide');
    expect(mockInvoke).toHaveBeenCalledWith('async:window:close');
    expect(mockInvoke).toHaveBeenCalledWith('async:window:set-floating-info-visibility', true);
    expect(mockInvoke).toHaveBeenCalledWith('async:fs:read-file', 'src/main.v', 'utf-8');
    expect(mockInvoke).toHaveBeenCalledWith('async:fs:list-files', 'rtl');
    expect(mockInvoke).toHaveBeenCalledWith('async:fs:write-file', 'rtl/main.v', 'module main; endmodule');
    expect(mockInvoke).toHaveBeenCalledWith('async:fs:read-dir', 'rtl');
    expect(mockInvoke).toHaveBeenCalledWith('async:fs:stat', 'rtl/main.v');
    expect(mockInvoke).toHaveBeenCalledWith('async:fs:exists', 'rtl/main.v');
    expect(mockInvoke).toHaveBeenCalledWith('async:shell:exec', 'make', ['lint'], { cwd: 'rtl' });
    expect(mockInvoke).toHaveBeenCalledWith('async:shell:kill', 'shell-1');
    expect(mockInvoke).toHaveBeenCalledWith('async:terminal:create', { cwd: 'rtl', cols: 120, rows: 40 });
    expect(mockInvoke).toHaveBeenCalledWith('async:terminal:write', 'terminal-1', 'help');
    expect(mockInvoke).toHaveBeenCalledWith('async:terminal:resize', 'terminal-1', 160, 50);
    expect(mockInvoke).toHaveBeenCalledWith('async:terminal:kill', 'terminal-1');
    expect(mockInvoke).toHaveBeenCalledWith('async:lsp:open-document', 'rtl/core/cpu_top.sv', 'systemverilog', 'module cpu_top; endmodule');
    expect(mockInvoke).toHaveBeenCalledWith('async:lsp:change-document', 'rtl/core/cpu_top.sv', 'module cpu_top; logic a; endmodule');
    expect(mockInvoke).toHaveBeenCalledWith('async:lsp:close-document', 'rtl/core/cpu_top.sv');
    expect(mockInvoke).toHaveBeenCalledWith('async:lsp:completion', 'rtl/core/cpu_top.sv', 4, 6, '.', 2);
    expect(mockInvoke).toHaveBeenCalledWith('async:lsp:hover', 'rtl/core/cpu_top.sv', 4, 6);
    expect(mockInvoke).toHaveBeenCalledWith('async:lsp:definition', 'rtl/core/cpu_top.sv', 4, 6);
    expect(mockInvoke).toHaveBeenCalledWith('async:lsp:references', 'rtl/core/cpu_top.sv', 4, 6, false);
    expect(mockInvoke).toHaveBeenCalledWith('async:config:set', 'theme', 'dracula');
    expect(mockOn).toHaveBeenCalledWith('stream:window:maximized-change', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('stream:shell:stdout', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('stream:shell:stderr', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('stream:shell:exit', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('stream:terminal:data', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('stream:terminal:exit', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('stream:lsp:diagnostics', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('stream:lsp:state', expect.any(Function));

    const handler = mockOn.mock.calls.find((call) => call[0] === 'stream:window:maximized-change')?.[1];
    handler({}, true);
    expect(onMaximizedChange).toHaveBeenCalledWith(true);

    const stdoutHandler = mockOn.mock.calls.find((call) => call[0] === 'stream:shell:stdout')?.[1];
    stdoutHandler({}, { id: 'shell-1', data: 'ok' });
    expect(onStdout).toHaveBeenCalledWith({ id: 'shell-1', data: 'ok' });

    const stderrHandler = mockOn.mock.calls.find((call) => call[0] === 'stream:shell:stderr')?.[1];
    stderrHandler({}, { id: 'shell-1', data: 'warn' });
    expect(onStderr).toHaveBeenCalledWith({ id: 'shell-1', data: 'warn' });

    const shellExitHandler = mockOn.mock.calls.find((call) => call[0] === 'stream:shell:exit')?.[1];
    shellExitHandler({}, { id: 'shell-1', code: 0, error: undefined });
    expect(onShellExit).toHaveBeenCalledWith({ id: 'shell-1', code: 0, error: undefined });

    const terminalDataHandler = mockOn.mock.calls.find((call) => call[0] === 'stream:terminal:data')?.[1];
    terminalDataHandler({}, { id: 'terminal-1', data: 'prompt' });
    expect(onTerminalData).toHaveBeenCalledWith({ id: 'terminal-1', data: 'prompt' });

    const terminalExitHandler = mockOn.mock.calls.find((call) => call[0] === 'stream:terminal:exit')?.[1];
    terminalExitHandler({}, { id: 'terminal-1', exitCode: 0, signal: 15 });
    expect(onTerminalExit).toHaveBeenCalledWith({ id: 'terminal-1', exitCode: 0, signal: 15 });

    const diagnosticsHandler = mockOn.mock.calls.find((call) => call[0] === 'stream:lsp:diagnostics')?.[1];
    diagnosticsHandler({}, { filePath: 'rtl/core/cpu_top.sv', diagnostics: [] });
    expect(onLspDiagnostics).toHaveBeenCalledWith({ filePath: 'rtl/core/cpu_top.sv', diagnostics: [] });

    const lspStateHandler = mockOn.mock.calls.find((call) => call[0] === 'stream:lsp:state')?.[1];
    lspStateHandler({}, { status: 'ready' });
    expect(onLspState).toHaveBeenCalledWith({ status: 'ready' });

    dispose();
    disposeStdout();
    disposeStderr();
    disposeShellExit();
    disposeTerminalData();
    disposeTerminalExit();
    disposeLspDiagnostics();
    disposeLspState();
    expect(mockRemoveListener).toHaveBeenCalledWith('stream:window:maximized-change', handler);
    expect(mockRemoveListener).toHaveBeenCalledWith('stream:shell:stdout', stdoutHandler);
    expect(mockRemoveListener).toHaveBeenCalledWith('stream:shell:stderr', stderrHandler);
    expect(mockRemoveListener).toHaveBeenCalledWith('stream:shell:exit', shellExitHandler);
    expect(mockRemoveListener).toHaveBeenCalledWith('stream:terminal:data', terminalDataHandler);
    expect(mockRemoveListener).toHaveBeenCalledWith('stream:terminal:exit', terminalExitHandler);
    expect(mockRemoveListener).toHaveBeenCalledWith('stream:lsp:diagnostics', diagnosticsHandler);
    expect(mockRemoveListener).toHaveBeenCalledWith('stream:lsp:state', lspStateHandler);
  });
});