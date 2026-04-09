import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RightSidePanel } from './RightSidePanel';

describe('RightSidePanel', () => {
  it('navigates static check items to their source file and line', async () => {
    const onFileOpen = vi.fn();
    const onLineJump = vi.fn();

    render(
      <RightSidePanel onFileOpen={onFileOpen} onLineJump={onLineJump} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /static check/i }));
  expect(await screen.findByText(/Static Check Report/i)).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /cpu_top\.v:65/i }));

    expect(onFileOpen).toHaveBeenCalledWith('cpu_top', 'cpu_top.v');
    expect(onLineJump).toHaveBeenCalledWith(65);
  });

  it('opens a reference target when a reference row is clicked', async () => {
    const onFileOpen = vi.fn();
    const onLineJump = vi.fn();

    render(
      <RightSidePanel onFileOpen={onFileOpen} onLineJump={onLineJump} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /references/i }));
  expect(await screen.findByText(/4 references · uart_tx\.v/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('L40'));

    expect(onFileOpen).toHaveBeenCalledWith('uart_tx', 'uart_tx.v');
    expect(onLineJump).toHaveBeenCalledWith(40);
  });
});