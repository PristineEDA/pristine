import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BottomPanel } from './BottomPanel';

describe('BottomPanel', () => {
  it('switches between tabs and closes the panel', () => {
    const onClose = vi.fn();

    render(<BottomPanel onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /problems \(6\)/i }));
    expect(screen.getByText(/2 errors/i)).toBeInTheDocument();
    expect(screen.getByText(/3 warnings/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /debug console/i }));
    expect(screen.getByRole('button', { name: /start debugging/i })).toBeInTheDocument();
    expect(screen.getByText(/Debug session not started/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle(/close panel/i));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('filters output entries by text and severity', () => {
    render(<BottomPanel />);

    fireEvent.click(screen.getByRole('button', { name: /^output$/i }));

    const filterInput = screen.getByPlaceholderText(/filter output/i);
    fireEvent.change(filterInput, { target: { value: 'cpu_top' } });

    expect(screen.getByText(/cpu_top\.v \[L56\]: Unconnected port alu_src_b/i)).toBeInTheDocument();
    expect(screen.queryByText(/RTL Analyzer v2\.4\.1 started/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^INFO$/i }));

    expect(screen.queryByText(/cpu_top\.v \[L56\]: Unconnected port alu_src_b/i)).not.toBeInTheDocument();
  });
});