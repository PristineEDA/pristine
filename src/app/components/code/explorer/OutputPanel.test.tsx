import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OutputPanel } from './OutputPanel';

vi.mock('../../../../data/mockDataLoader', () => ({
  useOutputLog: vi.fn(() => [
    { time: '10:00:00', level: 'info', text: 'Compilation started' },
    { time: '10:00:02', level: 'warn', text: 'Unused signal detected' },
    { time: '10:00:03', level: 'error', text: 'Simulation failed' },
  ]),
}));

describe('OutputPanel', () => {
  it('filters log entries by text query', () => {
    render(<OutputPanel />);

    fireEvent.change(screen.getByPlaceholderText('Filter output...'), {
      target: { value: 'unused' },
    });

    expect(screen.getByText('Unused signal detected')).toBeInTheDocument();
    expect(screen.queryByText('Compilation started')).not.toBeInTheDocument();
    expect(screen.queryByText('Simulation failed')).not.toBeInTheDocument();
  });

  it('filters log entries by severity level', () => {
    render(<OutputPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'ERROR' }));

    expect(screen.getByText('Simulation failed')).toBeInTheDocument();
    expect(screen.queryByText('Compilation started')).not.toBeInTheDocument();
    expect(screen.queryByText('Unused signal detected')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ERROR' })).toHaveClass('bg-primary');
  });
});