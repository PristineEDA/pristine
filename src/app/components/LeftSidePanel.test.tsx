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

  it('opens a file and jumps to the selected problem line', async () => {
    const onFileOpen = vi.fn();
    const onFilePreview = vi.fn();
    const onLineJump = vi.fn();

    render(
      <LeftSidePanel
        activeFileId="cpu_top"
        onFileOpen={onFileOpen}
        onFilePreview={onFilePreview}
        onLineJump={onLineJump}
        currentOutlineId="cpu_top"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /problems/i }));
  fireEvent.click(await screen.findByText(/Port 'alu_src_b' of module 'ctrl_unit' not connected/i));

    expect(onFileOpen).toHaveBeenCalledWith('cpu_top', 'cpu_top.v');
    expect(onLineJump).toHaveBeenCalledWith(56);
  });

  it('expands explorer items and opens a clicked file', async () => {
    const onFileOpen = vi.fn();
    const onFilePreview = vi.fn();

    render(
      <LeftSidePanel
        activeFileId="cpu_top"
        onFileOpen={onFileOpen}
        onFilePreview={onFilePreview}
        onLineJump={vi.fn()}
        currentOutlineId="cpu_top"
      />,
    );

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    expect(onFilePreview).toHaveBeenCalledWith('rtl/peripherals/uart_rx.v', 'uart_rx.v');
  });

  it('pins a file on explorer double click and applies the explorer hover scrollbar class', async () => {
    const onFileOpen = vi.fn();

    const { container } = render(
      <LeftSidePanel
        activeFileId="cpu_top"
        onFileOpen={onFileOpen}
        onFilePreview={vi.fn()}
        onLineJump={vi.fn()}
        currentOutlineId="cpu_top"
      />,
    );

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));

    const fileNode = await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v');
    fireEvent.doubleClick(fileNode);

    expect(onFileOpen).toHaveBeenCalledWith('rtl/peripherals/uart_rx.v', 'uart_rx.v');
    expect(container.querySelector('.explorer-tree-scrollbar')).not.toBeNull();
  });

  it('allows the workspace root row to collapse and expand', async () => {
    render(
      <LeftSidePanel
        activeFileId="cpu_top"
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        onLineJump={vi.fn()}
        currentOutlineId="cpu_top"
      />,
    );

    const rootNode = await screen.findByTestId('file-tree-node-root');
    expect(await screen.findByTestId('file-tree-node-rtl')).toBeInTheDocument();

    fireEvent.click(rootNode);
    expect(screen.queryByTestId('file-tree-node-rtl')).not.toBeInTheDocument();

    fireEvent.click(rootNode);
    expect(await screen.findByTestId('file-tree-node-rtl')).toBeInTheDocument();
  });

  it('collapses the workspace root when using collapse all', async () => {
    render(
      <LeftSidePanel
        activeFileId="cpu_top"
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        onLineJump={vi.fn()}
        currentOutlineId="cpu_top"
      />,
    );

    expect(await screen.findByTestId('file-tree-node-rtl')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse All' }));

    expect(screen.getByTestId('file-tree-node-root')).toBeInTheDocument();
    expect(screen.queryByTestId('file-tree-node-rtl')).not.toBeInTheDocument();
  });
});