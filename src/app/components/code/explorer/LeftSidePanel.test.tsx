import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetWorkspaceGitStatusStoreForTests } from '../../../git/workspaceGitStatus';
import { LeftSidePanel } from './LeftSidePanel';

describe('LeftSidePanel', () => {
  beforeEach(() => {
    const electronApi = window.electronAPI!;

    resetWorkspaceGitStatusStoreForTests();

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

  it('renders only explorer and outline tabs', async () => {
    render(
      <LeftSidePanel
        activeFileId="cpu_top"
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        onLineJump={vi.fn()}
        currentOutlineId="cpu_top"
      />,
    );

    expect(screen.getByRole('button', { name: 'Explorer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Outline' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /problems/i })).not.toBeInTheDocument();
    expect(await screen.findByTestId('file-tree-node-rtl')).toBeInTheDocument();
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

  it('keeps a clicked explorer folder highlighted after the pointer leaves the tree', async () => {
    render(
      <LeftSidePanel
        activeFileId="rtl/peripherals/uart_rx.v"
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        onLineJump={vi.fn()}
        currentOutlineId="cpu_top"
      />,
    );

    const folderNode = await screen.findByTestId('file-tree-node-rtl');

    fireEvent.click(folderNode);

    expect(screen.getByTestId('file-tree-node-rtl').className).toContain('bg-primary/20');
    expect(screen.getByTestId('file-tree-node-rtl').className).toContain('hover:bg-primary/20');

    fireEvent.mouseLeave(screen.getByTestId('file-tree-node-rtl'));

    expect(screen.getByTestId('file-tree-node-rtl').className).toContain('bg-primary/20');
  });

  it('moves the persistent highlight from folders to files so only one explorer row stays highlighted', async () => {
    render(
      <LeftSidePanel
        activeFileId="rtl/peripherals/uart_rx.v"
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        onLineJump={vi.fn()}
        currentOutlineId="uart_rx"
      />,
    );

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));

    const folderNode = screen.getByTestId('file-tree-node-rtl_peripherals');
    const fileNode = await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v');

    expect(folderNode.className).toContain('bg-primary/20');
    expect(fileNode.className).not.toContain('hover:bg-primary/20');

    fireEvent.click(fileNode);

    expect(screen.getByTestId('file-tree-node-rtl_peripherals').className).not.toContain('hover:bg-primary/20');
    expect(screen.getByTestId('file-tree-node-rtl_peripherals_uart_rx_v').className).toContain('bg-primary/20');
    expect(screen.getByTestId('file-tree-node-rtl_peripherals_uart_rx_v').className).toContain('hover:bg-primary/20');
  });

  it('clears the selected folder highlight when another entry activates a file', async () => {
    const { rerender } = render(
      <LeftSidePanel
        activeFileId="rtl/peripherals/uart_rx.v"
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        onLineJump={vi.fn()}
        currentOutlineId="uart_rx"
      />,
    );

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));

    expect(screen.getByTestId('file-tree-node-rtl_peripherals').className).toContain('bg-primary/20');
    expect((await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v')).className).not.toContain('hover:bg-primary/20');

    rerender(
      <LeftSidePanel
        activeFileId="rtl/core/cpu_top.v"
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        onLineJump={vi.fn()}
        currentOutlineId="cpu_top"
      />,
    );

    expect(screen.getByTestId('file-tree-node-rtl_peripherals').className).not.toContain('hover:bg-primary/20');
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