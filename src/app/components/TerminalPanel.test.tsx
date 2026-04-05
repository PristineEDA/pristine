import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TerminalPanel } from './TerminalPanel';
import type { ElectronAPI } from '../../../types/electron-api';
import { createTerminalTheme, IDE_MONO_FONT_FAMILY } from '../editor/appearance';
import { resetTerminalSessionStoreForTests } from './terminalSessionStore';

const terminalInstances: Array<{
  cols: number;
  rows: number;
  loadAddon: ReturnType<typeof vi.fn>;
  open: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  onData: ReturnType<typeof vi.fn>;
  emitData: (data: string) => void;
}> = [];
const terminalConstructorOptions: Array<Record<string, unknown>> = [];

const fitMock = vi.fn();

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = fitMock;
  },
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn(), toggleTheme: vi.fn() }),
}));

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    loadAddon = vi.fn();
    open = vi.fn();
    focus = vi.fn();
    write = vi.fn();
    reset = vi.fn();
    dispose = vi.fn();
    private onDataHandler: ((data: string) => void) | null = null;
    onData = vi.fn((callback: (data: string) => void) => {
      this.onDataHandler = callback;
      return { dispose: vi.fn() };
    });

    constructor(options: Record<string, unknown>) {
      terminalConstructorOptions.push(options);
      terminalInstances.push({
        cols: this.cols,
        rows: this.rows,
        loadAddon: this.loadAddon,
        open: this.open,
        focus: this.focus,
        write: this.write,
        reset: this.reset,
        dispose: this.dispose,
        onData: this.onData,
        emitData: (data: string) => this.onDataHandler?.(data),
      });
    }
  },
}));

describe('TerminalPanel', () => {
  beforeEach(() => {
    resetTerminalSessionStoreForTests();
    terminalInstances.length = 0;
    terminalConstructorOptions.length = 0;
    fitMock.mockClear();
  });

  it('creates a terminal session and writes streamed output to xterm', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 'term-1', pid: 101, shell: 'powershell.exe' });
    let onDataCallback: ((payload: { id: string; data: string }) => void) | undefined;
    const onDataMock = vi.fn((callback: (payload: { id: string; data: string }) => void) => {
      onDataCallback = callback;
      return vi.fn();
    });
    const onExitMock = vi.fn(() => vi.fn());
    const baseApi = window.electronAPI as ElectronAPI;

    window.electronAPI = {
      ...baseApi,
      terminal: {
        ...baseApi.terminal,
        create: createMock,
        onData: onDataMock,
        onExit: onExitMock,
      },
    };

    render(<TerminalPanel />);

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(terminalInstances[0]?.open).toHaveBeenCalled();
    expect(terminalConstructorOptions[0]?.fontFamily).toBe(IDE_MONO_FONT_FAMILY);
    expect(terminalConstructorOptions[0]?.theme).toEqual(createTerminalTheme('dark', null));

    onDataCallback?.({ id: 'term-1', data: 'PS> dir\r\n' });
    await waitFor(() => expect(terminalInstances[0]?.write).toHaveBeenCalledWith('PS> dir\r\n'));
  });

  it('forwards terminal input to the backend session', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 'term-2', pid: 202, shell: 'powershell.exe' });
    const writeMock = vi.fn().mockResolvedValue(true);
    const baseApi = window.electronAPI as ElectronAPI;

    window.electronAPI = {
      ...baseApi,
      terminal: {
        ...baseApi.terminal,
        create: createMock,
        write: writeMock,
      },
    };

    render(<TerminalPanel />);

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    terminalInstances[0]?.emitData('dir\r');

    await waitFor(() => expect(writeMock).toHaveBeenCalledWith('term-2', 'dir\r'));
  });

  it('keeps the terminal session alive across unmount and remount', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 'term-3', pid: 303, shell: 'powershell.exe' });
    const killMock = vi.fn().mockResolvedValue(true);
    let onDataCallback: ((payload: { id: string; data: string }) => void) | undefined;
    const baseApi = window.electronAPI as ElectronAPI;

    window.electronAPI = {
      ...baseApi,
      terminal: {
        ...baseApi.terminal,
        create: createMock,
        kill: killMock,
        onData: vi.fn((callback: (payload: { id: string; data: string }) => void) => {
          onDataCallback = callback;
          return vi.fn();
        }),
      },
    };

    const view = render(<TerminalPanel />);
    await waitFor(() => expect(createMock).toHaveBeenCalled());
    view.unmount();

    expect(killMock).not.toHaveBeenCalled();
    expect(terminalInstances[0]?.dispose).toHaveBeenCalled();

    onDataCallback?.({ id: 'term-3', data: 'persisted\r\n' });

    render(<TerminalPanel />);

    await waitFor(() => expect(terminalInstances[1]?.write).toHaveBeenCalledWith('persisted\r\n'));
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});