import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LspProblem } from '../../../lsp/lspProblems';
import { BottomPanel } from './BottomPanel';

let mockedProblems: LspProblem[] = [];

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn(), toggleTheme: vi.fn() }),
}));

vi.mock('../../../lsp/lspProblems', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lsp/lspProblems')>();
  return {
    ...actual,
    useLspProblems: () => mockedProblems,
  };
});

const terminateTerminalSessionMock = vi.fn().mockResolvedValue(undefined);

vi.mock('./terminalSessionStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./terminalSessionStore')>();
  return {
    ...actual,
    terminateTerminalSession: () => terminateTerminalSessionMock(),
  };
});

describe('BottomPanel', () => {
  beforeEach(() => {
    terminateTerminalSessionMock.mockClear();
    mockedProblems = [
      {
        id: 'error-1',
        severity: 'error',
        message: 'Undriven signal',
        file: 'cpu_top.sv',
        fileId: 'rtl/core/cpu_top.sv',
        line: 4,
        column: 5,
      },
      {
        id: 'error-2',
        severity: 'error',
        message: 'Missing reset assignment',
        file: 'alu.sv',
        fileId: 'rtl/core/alu.sv',
        line: 11,
        column: 2,
      },
      {
        id: 'warning-1',
        severity: 'warning',
        message: 'Potential latch inferred',
        file: 'alu.sv',
        fileId: 'rtl/core/alu.sv',
        line: 18,
        column: 9,
      },
      {
        id: 'warning-2',
        severity: 'warning',
        message: 'Unused output',
        file: 'cpu_top.sv',
        fileId: 'rtl/core/cpu_top.sv',
        line: 22,
        column: 1,
      },
      {
        id: 'info-1',
        severity: 'info',
        message: 'Consider registering this signal',
        file: 'cpu_top.sv',
        fileId: 'rtl/core/cpu_top.sv',
        line: 25,
        column: 7,
      },
      {
        id: 'hint-1',
        severity: 'hint',
        message: 'Inline this temporary variable',
        file: 'cpu_top.sv',
        fileId: 'rtl/core/cpu_top.sv',
        line: 27,
        column: 3,
      },
    ];
  });

  it('terminates the terminal session before closing the panel', async () => {
    const onClose = vi.fn();

    render(<BottomPanel onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /close panel/i }));

    await waitFor(() => expect(terminateTerminalSessionMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('switches between tabs and closes the panel', async () => {
    const onClose = vi.fn();

    render(<BottomPanel onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /problems \(6\)/i }));
    expect(await screen.findByText(/2 errors/i)).toBeInTheDocument();
    expect(await screen.findByText(/2 warnings/i)).toBeInTheDocument();
    expect(await screen.findByText(/1 infos/i)).toBeInTheDocument();
    expect(await screen.findByText(/1 hints/i)).toBeInTheDocument();
    expect(await screen.findByText(/Undriven signal/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /debug console/i }));
    expect(screen.getByRole('button', { name: /start debugging/i })).toBeInTheDocument();
    expect(screen.getByText(/Debug session not started/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^lsp$/i }));
    expect(await screen.findByTestId('lsp-panel')).toBeInTheDocument();
    expect(screen.getByText(/No LSP debug events yet\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close panel/i }));
    expect(terminateTerminalSessionMock).toHaveBeenCalled();
  });

  it('filters output entries by text and severity', async () => {
    const { container } = render(<BottomPanel />);

    expect(container.firstChild).toHaveClass('min-h-0');

    fireEvent.click(screen.getByRole('button', { name: /^output$/i }));

    const initialEntry = await screen.findByText(/RTL Analyzer v2\.4\.1 started/i);
    expect(initialEntry.closest('.bottom-panel-scrollbar')).not.toBeNull();

    const filterInput = await screen.findByPlaceholderText(/filter output/i);
    fireEvent.change(filterInput, { target: { value: 'cpu_top' } });

    expect(await screen.findByText(/cpu_top\.v \[L56\]: Unconnected port alu_src_b/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/RTL Analyzer v2\.4\.1 started/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^INFO$/i }));

    await waitFor(() => {
      expect(screen.queryByText(/cpu_top\.v \[L56\]: Unconnected port alu_src_b/i)).not.toBeInTheDocument();
    });
  });
});