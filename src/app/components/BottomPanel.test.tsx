import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomPanel } from './BottomPanel';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn(), toggleTheme: vi.fn() }),
}));

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
  });

  it('terminates the terminal session before closing the panel', async () => {
    const onClose = vi.fn();

    render(<BottomPanel onClose={onClose} />);

    fireEvent.click(screen.getByTitle(/close panel/i));

    await waitFor(() => expect(terminateTerminalSessionMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('switches between tabs and closes the panel', async () => {
    const onClose = vi.fn();

    render(<BottomPanel onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /problems/i }));
    expect(await screen.findByText(/2 errors/i)).toBeInTheDocument();
    expect(await screen.findByText(/3 warnings/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /debug console/i }));
    expect(screen.getByRole('button', { name: /start debugging/i })).toBeInTheDocument();
    expect(screen.getByText(/Debug session not started/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle(/close panel/i));
    expect(terminateTerminalSessionMock).toHaveBeenCalled();
  });

  it('filters output entries by text and severity', async () => {
    render(<BottomPanel />);

    fireEvent.click(screen.getByRole('button', { name: /^output$/i }));

    const filterInput = await screen.findByPlaceholderText(/filter output/i);
    fireEvent.change(filterInput, { target: { value: 'cpu_top' } });

    expect(screen.getByText(/cpu_top\.v \[L56\]: Unconnected port alu_src_b/i)).toBeInTheDocument();
    expect(screen.queryByText(/RTL Analyzer v2\.4\.1 started/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^INFO$/i }));

    expect(screen.queryByText(/cpu_top\.v \[L56\]: Unconnected port alu_src_b/i)).not.toBeInTheDocument();
  });
});