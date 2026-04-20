import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetWorkspaceGitStatusStoreForTests } from '../../../git/workspaceGitStatus';
import { getExplorerRenameTarget, LeftSidePanel } from './LeftSidePanel';

function renderLeftSidePanel(props: Partial<ComponentProps<typeof LeftSidePanel>> = {}) {
  const componentProps: ComponentProps<typeof LeftSidePanel> = {
    activeFileId: 'cpu_top',
    onCreateWorkspaceFile: vi.fn().mockResolvedValue(undefined),
    onCreateWorkspaceFolder: vi.fn().mockResolvedValue(undefined),
    onFileOpen: vi.fn(),
    onFilePreview: vi.fn(),
    onLineJump: vi.fn(),
    onRenameWorkspaceEntry: vi.fn().mockResolvedValue(undefined),
    currentOutlineId: 'cpu_top',
    ...props,
  };

  return {
    ...render(<LeftSidePanel {...componentProps} />),
    props: componentProps,
  };
}

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
    renderLeftSidePanel();

    expect(screen.getByRole('button', { name: 'Explorer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Outline' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /problems/i })).not.toBeInTheDocument();
    expect(await screen.findByTestId('file-tree-node-rtl')).toBeInTheDocument();
  });

  it('expands explorer items and opens a clicked file', async () => {
    const onFileOpen = vi.fn();
    const onFilePreview = vi.fn();

    renderLeftSidePanel({ onFileOpen, onFilePreview });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    expect(onFilePreview).toHaveBeenCalledWith('rtl/peripherals/uart_rx.v', 'uart_rx.v');
  });

  it('pins a file on explorer double click and applies the explorer hover scrollbar class', async () => {
    const onFileOpen = vi.fn();

    const { container } = renderLeftSidePanel({ onFileOpen });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));

    const fileNode = await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v');
    fireEvent.doubleClick(fileNode);

    expect(onFileOpen).toHaveBeenCalledWith('rtl/peripherals/uart_rx.v', 'uart_rx.v');
    expect(container.querySelector('.explorer-tree-scrollbar')).not.toBeNull();
  });

  it('keeps a clicked explorer folder highlighted after the pointer leaves the tree', async () => {
    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'cpu_top',
    });

    const folderNode = await screen.findByTestId('file-tree-node-rtl');

    fireEvent.click(folderNode);

    expect(screen.getByTestId('file-tree-node-rtl').className).toContain('bg-primary/20');
    expect(screen.getByTestId('file-tree-node-rtl').className).toContain('hover:bg-primary/20');

    fireEvent.mouseLeave(screen.getByTestId('file-tree-node-rtl'));

    expect(screen.getByTestId('file-tree-node-rtl').className).toContain('bg-primary/20');
  });

  it('moves the persistent highlight from folders to files so only one explorer row stays highlighted', async () => {
    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
    });

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
    const { rerender } = renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));

    expect(screen.getByTestId('file-tree-node-rtl_peripherals').className).toContain('bg-primary/20');
    expect((await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v')).className).not.toContain('hover:bg-primary/20');

    rerender(
      <LeftSidePanel
        activeFileId="rtl/core/cpu_top.v"
        onCreateWorkspaceFile={vi.fn().mockResolvedValue(undefined)}
        onCreateWorkspaceFolder={vi.fn().mockResolvedValue(undefined)}
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        onLineJump={vi.fn()}
        onRenameWorkspaceEntry={vi.fn().mockResolvedValue(undefined)}
        currentOutlineId="cpu_top"
      />,
    );

    expect(screen.getByTestId('file-tree-node-rtl_peripherals').className).not.toContain('hover:bg-primary/20');
  });

  it('allows the workspace root row to collapse and expand', async () => {
    renderLeftSidePanel();

    const rootNode = await screen.findByTestId('file-tree-node-root');
    expect(await screen.findByTestId('file-tree-node-rtl')).toBeInTheDocument();

    fireEvent.click(rootNode);
    expect(screen.queryByTestId('file-tree-node-rtl')).not.toBeInTheDocument();

    fireEvent.click(rootNode);
    expect(await screen.findByTestId('file-tree-node-rtl')).toBeInTheDocument();
  });

  it('collapses the workspace root when using collapse all', async () => {
    renderLeftSidePanel();

    expect(await screen.findByTestId('file-tree-node-rtl')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse All' }));

    expect(screen.getByTestId('file-tree-node-root')).toBeInTheDocument();
    expect(screen.queryByTestId('file-tree-node-rtl')).not.toBeInTheDocument();
  });

  it('starts inline rename with F2 for the selected explorer file and submits a real rename', async () => {
    const onRenameWorkspaceEntry = vi.fn().mockResolvedValue(undefined);
    const { container } = renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onRenameWorkspaceEntry,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));

    const fileNode = await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v');
    fireEvent.click(fileNode);
    fireEvent.keyDown(container.querySelector('.explorer-tree-scrollbar') as HTMLElement, { key: 'F2' });

    const renameInput = await screen.findByTestId('file-tree-input-rtl_peripherals_uart_rx_v');
    fireEvent.change(renameInput, { target: { value: 'uart_tx.v' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });

    await waitFor(() => {
      expect(onRenameWorkspaceEntry).toHaveBeenCalledWith(
        'rtl/peripherals/uart_rx.v',
        'rtl/peripherals/uart_tx.v',
        'file',
      );
    });
  });

  it('starts inline rename when F2 is pressed on document after selecting a file in the tree', async () => {
    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    fireEvent.keyDown(document, { key: 'F2' });

    expect(await screen.findByTestId('file-tree-input-rtl_peripherals_uart_rx_v')).toBeInTheDocument();
  });

  it('falls back to the highlighted active workspace file when F2 has no explicit tree selection', () => {
    expect(getExplorerRenameTarget(null, 'rtl/peripherals/uart_rx.v')).toEqual({
      path: 'rtl/peripherals/uart_rx.v',
      type: 'file',
    });
  });

  it('creates a real file from the selected folder through the draft row', async () => {
    const onCreateWorkspaceFile = vi.fn().mockResolvedValue(undefined);

    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onCreateWorkspaceFile,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(screen.getByRole('button', { name: 'New File' }));

    const draftInput = screen.getByRole('textbox');
    fireEvent.change(draftInput, { target: { value: 'uart_tx.sv' } });
    fireEvent.keyDown(draftInput, { key: 'Enter' });

    await waitFor(() => {
      expect(onCreateWorkspaceFile).toHaveBeenCalledWith('rtl/peripherals/uart_tx.sv');
    });
  });

  it('removes an invalid draft folder when Enter is pressed', async () => {
    const onCreateWorkspaceFolder = vi.fn().mockResolvedValue(undefined);

    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onCreateWorkspaceFolder,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(screen.getByRole('button', { name: 'New Folder' }));

    const draftInput = screen.getByRole('textbox');
    fireEvent.keyDown(draftInput, { key: 'Enter' });

    await waitFor(() => {
      expect(onCreateWorkspaceFolder).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });
});