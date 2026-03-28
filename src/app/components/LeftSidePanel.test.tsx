import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LeftSidePanel } from './LeftSidePanel';

describe('LeftSidePanel', () => {
  it('opens a file and jumps to the selected problem line', () => {
    const onFileOpen = vi.fn();
    const onLineJump = vi.fn();

    render(
      <LeftSidePanel
        activeFileId="cpu_top"
        onFileOpen={onFileOpen}
        onLineJump={onLineJump}
        currentOutlineId="cpu_top"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /problems/i }));
    fireEvent.click(screen.getByText(/Port 'alu_src_b' of module 'ctrl_unit' not connected/i));

    expect(onFileOpen).toHaveBeenCalledWith('cpu_top', 'cpu_top.v');
    expect(onLineJump).toHaveBeenCalledWith(56);
  });

  it('expands explorer items and opens a clicked file', () => {
    const onFileOpen = vi.fn();

    render(
      <LeftSidePanel
        activeFileId="cpu_top"
        onFileOpen={onFileOpen}
        onLineJump={vi.fn()}
        currentOutlineId="cpu_top"
      />,
    );

    fireEvent.click(screen.getByTestId('file-tree-node-peripherals'));
    fireEvent.click(screen.getByTestId('file-tree-node-uart_rx'));

    expect(onFileOpen).toHaveBeenCalledWith('uart_rx', 'uart_rx.v');
  });
});