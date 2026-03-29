import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeftSidePanel } from './LeftSidePanel';

describe('LeftSidePanel', () => {
  beforeEach(() => {
    const electronApi = window.electronAPI!;

    vi.mocked(electronApi.fs.exists).mockResolvedValue(true);
    vi.mocked(electronApi.fs.readDir).mockImplementation(async (dirPath: string) => {
      if (dirPath === '.') {
        return [{ name: 'rtl', isDirectory: true, isFile: false }];
      }

      if (dirPath === 'rtl') {
        return [{ name: 'peripherals', isDirectory: true, isFile: false }];
      }

      if (dirPath === 'rtl/peripherals') {
        return [{ name: 'uart_rx.v', isDirectory: false, isFile: true }];
      }

      return [];
    });
  });

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

  it('expands explorer items and opens a clicked file', async () => {
    const onFileOpen = vi.fn();

    render(
      <LeftSidePanel
        activeFileId="cpu_top"
        onFileOpen={onFileOpen}
        onLineJump={vi.fn()}
        currentOutlineId="cpu_top"
      />,
    );

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    expect(onFileOpen).toHaveBeenCalledWith('rtl/peripherals/uart_rx.v', 'uart_rx.v');
  });
});