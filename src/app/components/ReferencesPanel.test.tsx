import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReferencesPanel } from './ReferencesPanel';

vi.mock('../../data/mockDataLoader', () => ({
  useReferences: vi.fn(() => [
    {
      id: 'ref-1',
      fileId: 'uart_tx',
      file: 'uart_tx.v',
      line: 40,
      type: 'read',
      preview: 'assign next = shift_reg[0];',
    },
    {
      id: 'ref-2',
      fileId: 'uart_tx',
      file: 'uart_tx.v',
      line: 72,
      type: 'write',
      preview: 'always_ff @(posedge clk) shift_reg <= data;',
    },
  ]),
}));

describe('ReferencesPanel', () => {
  it('renders the aggregate counts and highlights the matched symbol in previews', () => {
    render(<ReferencesPanel onFileOpen={vi.fn()} onLineJump={vi.fn()} />);

    expect(screen.getByText('References')).toBeInTheDocument();
    expect(screen.getByText('2 references · uart_tx.v')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.getAllByText('shift_reg')).toHaveLength(3);
    expect(screen.getByText('RD')).toBeInTheDocument();
    expect(screen.getByText('WR')).toBeInTheDocument();
  });

  it('opens the referenced file and jumps to the selected line when a row is clicked', () => {
    const onFileOpen = vi.fn();
    const onLineJump = vi.fn();

    render(<ReferencesPanel onFileOpen={onFileOpen} onLineJump={onLineJump} />);

    fireEvent.click(screen.getByText('L72'));

    expect(onFileOpen).toHaveBeenCalledWith('uart_tx', 'uart_tx.v');
    expect(onLineJump).toHaveBeenCalledWith(72);
  });
});