import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TerminalPanel } from './TerminalPanel';

describe('TerminalPanel', () => {
  it('runs a known command and appends simulated output', () => {
    render(<TerminalPanel />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'make lint' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('make lint')).toBeInTheDocument();
    expect(screen.getByText(/Running Verilator lint pass/i)).toBeInTheDocument();
    expect(screen.getByText(/Unconnected port alu_src_b/i)).toBeInTheDocument();
    expect(screen.getByText(/Lint completed: 1 error, 1 warning/i)).toBeInTheDocument();
  });

  it('supports history navigation and clear command', () => {
    render(<TerminalPanel />);

    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'help' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const activeInput = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.keyDown(activeInput, { key: 'ArrowUp' });
    expect(activeInput.value).toBe('help');

    fireEvent.change(activeInput, { target: { value: 'clear' } });
    fireEvent.keyDown(activeInput, { key: 'Enter' });

    expect(screen.queryByText(/Available commands:/i)).not.toBeInTheDocument();
  });
});