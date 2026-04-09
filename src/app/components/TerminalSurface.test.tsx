import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TerminalSurface } from './TerminalSurface';
import { resetTerminalSessionStoreForTests } from './terminalSessionStore';
import type { ElectronAPI } from '../../../types/electron-api';

const terminalInstances: Array<{
  cols: number;
  rows: number;
  open: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}> = [];

const fitMock = vi.fn();

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = fitMock;
  },
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn(), toggleTheme: vi.fn() }),
}));

vi.mock('../editor/appearance', () => ({
  IDE_MONO_FONT_FAMILY: 'Mock Mono',
  createTerminalTheme: vi.fn(() => ({
    background: '#101010',
    foreground: '#f5f5f5',
    cursor: '#ffffff',
    selectionBackground: '#333333',
    black: '#000000',
    red: '#ff0000',
    green: '#00ff00',
    yellow: '#ffff00',
    blue: '#0000ff',
    magenta: '#ff00ff',
    cyan: '#00ffff',
    white: '#ffffff',
    brightBlack: '#111111',
    brightRed: '#ff1111',
    brightGreen: '#11ff11',
    brightYellow: '#ffff11',
    brightBlue: '#1111ff',
    brightMagenta: '#ff11ff',
    brightCyan: '#11ffff',
    brightWhite: '#fefefe',
  })),
}));

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    open = vi.fn();
    focus = vi.fn();
    write = vi.fn();
    reset = vi.fn();
    dispose = vi.fn();
    loadAddon = vi.fn();
    onData = vi.fn(() => ({ dispose: vi.fn() }));

    constructor() {
      terminalInstances.push({
        cols: this.cols,
        rows: this.rows,
        open: this.open,
        focus: this.focus,
        write: this.write,
        reset: this.reset,
        dispose: this.dispose,
      });
    }
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('TerminalSurface', () => {
  beforeEach(() => {
    resetTerminalSessionStoreForTests();
    terminalInstances.length = 0;
    fitMock.mockClear();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  it('shows startup state, syncs E2E terminal data, and focuses the host on click', async () => {
    const createRequest = deferred<{ id: string; pid: number; shell: string }>();
    const resizeMock = vi.fn().mockResolvedValue(true);
    let onDataCallback: ((payload: { id: string; data: string }) => void) | undefined;
    const baseApi = window.electronAPI as ElectronAPI;

    window.electronAPI = {
      ...baseApi,
      isE2E: true,
      terminal: {
        ...baseApi.terminal,
        create: vi.fn(() => createRequest.promise),
        resize: resizeMock,
        onData: vi.fn((callback: (payload: { id: string; data: string }) => void) => {
          onDataCallback = callback;
          return vi.fn();
        }),
        onExit: vi.fn(() => vi.fn()),
      },
    };

    render(<TerminalSurface />);

    expect(screen.getByText('Starting shell...')).toBeInTheDocument();

    createRequest.resolve({ id: 'term-e2e', pid: 404, shell: 'powershell.exe' });

    await waitFor(() => expect(resizeMock).toHaveBeenCalledWith('term-e2e', 80, 24));
    await waitFor(() => expect(screen.queryByText('Starting shell...')).not.toBeInTheDocument());

    onDataCallback?.({ id: 'term-e2e', data: 'PS> dir\r\n' });

    const host = screen.getByTestId('terminal-host');
    await waitFor(() => expect(host).toHaveAttribute('data-terminal-text', 'PS> dir\r\n'));
    expect(host).toHaveAttribute('data-terminal-pid', '404');

    fireEvent.click(host);
    expect(terminalInstances[0]?.focus).toHaveBeenCalledTimes(2);
  });

  it('renders the startup error overlay when the backend is unavailable', async () => {
    const baseApi = window.electronAPI as ElectronAPI;

    window.electronAPI = {
      ...baseApi,
      terminal: undefined as never,
    };

    render(<TerminalSurface />);

    await waitFor(() => expect(screen.getByText('Terminal failed to start')).toBeInTheDocument());
    expect(screen.getByText('Terminal backend is unavailable.')).toBeInTheDocument();
  });
});