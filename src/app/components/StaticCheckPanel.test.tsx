import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { staticChecks } from '../../data/mockData';

vi.mock('../../data/mockDataLoader', () => ({
  useStaticChecks: () => staticChecks,
}));

import { StaticCheckPanel } from './StaticCheckPanel';

describe('StaticCheckPanel', () => {
  it('filters results by severity and keeps the correct aggregate counts in the toolbar', async () => {
    render(<StaticCheckPanel onFileOpen={vi.fn()} onLineJump={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /All 6/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Critical 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /High 2/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Critical 1/i }));

    expect(screen.getByText(/Clock domain crossing without synchronizer detected/i)).toBeInTheDocument();
    expect(screen.queryByText(/Undriven port 'alu_src_b' left open/i)).not.toBeInTheDocument();
  });

  it('opens the linked file and jumps to the matching line when an issue location is clicked', async () => {
    const onFileOpen = vi.fn();
    const onLineJump = vi.fn();

    render(<StaticCheckPanel onFileOpen={onFileOpen} onLineJump={onLineJump} />);

    fireEvent.click(await screen.findByRole('button', { name: /cpu_top\.v:65/i }));

    expect(onFileOpen).toHaveBeenCalledWith('cpu_top', 'cpu_top.v');
    expect(onLineJump).toHaveBeenCalledWith(65);
  });

  it('marks fixable findings as fixed and keeps non-fixable items without autofix controls', async () => {
    render(<StaticCheckPanel onFileOpen={vi.fn()} onLineJump={vi.fn()} />);

    const autoFixButtons = await screen.findAllByRole('button', { name: /Auto-fix/i });
    const firstAutoFixButton = autoFixButtons[0];
    if (!firstAutoFixButton) {
      throw new Error('Expected at least one auto-fix button');
    }

    fireEvent.click(firstAutoFixButton);

    expect(screen.getByText(/✓ Fixed/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Auto-fix/i })).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /Critical 1/i }));
    expect(screen.queryByRole('button', { name: /Auto-fix/i })).not.toBeInTheDocument();
  });
});