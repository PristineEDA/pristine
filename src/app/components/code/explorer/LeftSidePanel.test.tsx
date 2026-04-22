import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetWorkspaceGitStatusStoreForTests } from '../../../git/workspaceGitStatus';
import {
  getExplorerClipboardTarget,
  getExplorerDeleteTarget,
  getExplorerPasteTargetPath,
  getExplorerRenameTarget,
  LeftSidePanel,
} from './LeftSidePanel';

function renderLeftSidePanel(props: Partial<ComponentProps<typeof LeftSidePanel>> = {}) {
  const componentProps: ComponentProps<typeof LeftSidePanel> = {
    activeFileId: 'cpu_top',
    onClearWorkspaceClipboard: vi.fn(),
    onCopyWorkspaceEntry: vi.fn().mockResolvedValue(true),
    onCreateWorkspaceFile: vi.fn().mockResolvedValue(undefined),
    onCreateWorkspaceFolder: vi.fn().mockResolvedValue(undefined),
    onCutWorkspaceEntry: vi.fn().mockResolvedValue(true),
    onDeleteWorkspaceEntry: vi.fn().mockResolvedValue(false),
    onFileOpen: vi.fn(),
    onFilePreview: vi.fn(),
    onLineJump: vi.fn(),
    onPasteWorkspaceEntry: vi.fn().mockResolvedValue(null),
    onRenameWorkspaceEntry: vi.fn().mockResolvedValue(undefined),
    currentOutlineId: 'cpu_top',
    workspaceClipboard: null,
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
        onClearWorkspaceClipboard={vi.fn()}
        onCopyWorkspaceEntry={vi.fn().mockResolvedValue(true)}
        onCreateWorkspaceFile={vi.fn().mockResolvedValue(undefined)}
        onCreateWorkspaceFolder={vi.fn().mockResolvedValue(undefined)}
        onCutWorkspaceEntry={vi.fn().mockResolvedValue(true)}
        onDeleteWorkspaceEntry={vi.fn().mockResolvedValue(false)}
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        onLineJump={vi.fn()}
        onPasteWorkspaceEntry={vi.fn().mockResolvedValue(null)}
        onRenameWorkspaceEntry={vi.fn().mockResolvedValue(undefined)}
        currentOutlineId="cpu_top"
        workspaceClipboard={null}
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

  it('starts inline rename for a folder when F2 is pressed immediately after selecting it', async () => {
    const onRenameWorkspaceEntry = vi.fn().mockResolvedValue(undefined);
    const { container } = renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onRenameWorkspaceEntry,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));

    const peripheralsFolderNode = await screen.findByTestId('file-tree-node-rtl_peripherals');
    fireEvent.click(peripheralsFolderNode);
    fireEvent.keyDown(container.querySelector('.explorer-tree-scrollbar') as HTMLElement, { key: 'F2' });

    const renameInput = await screen.findByTestId('file-tree-input-rtl_peripherals');
    fireEvent.change(renameInput, { target: { value: 'renamed_peripherals' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });

    await waitFor(() => {
      expect(onRenameWorkspaceEntry).toHaveBeenCalledWith(
        'rtl/peripherals',
        'rtl/renamed_peripherals',
        'folder',
      );
    });
  });

  it('keeps a newly selected folder as the rename target when a delayed tree-driven active file sync arrives', async () => {
    const onRenameWorkspaceEntry = vi.fn().mockResolvedValue(undefined);
    const { container, props, rerender } = renderLeftSidePanel({
      activeFileId: 'cpu_top',
      currentOutlineId: 'cpu_top',
      onRenameWorkspaceEntry,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));

    const fileNode = await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v');
    fireEvent.click(fileNode);

    const peripheralsFolderNode = await screen.findByTestId('file-tree-node-rtl_peripherals');
    fireEvent.click(peripheralsFolderNode);

    rerender(
      <LeftSidePanel
        {...props}
        activeFileId="rtl/peripherals/uart_rx.v"
        currentOutlineId="uart_rx"
        onRenameWorkspaceEntry={onRenameWorkspaceEntry}
      />,
    );

    fireEvent.keyDown(container.querySelector('.explorer-tree-scrollbar') as HTMLElement, { key: 'F2' });

    const renameInput = await screen.findByTestId('file-tree-input-rtl_peripherals');
    fireEvent.change(renameInput, { target: { value: 'renamed_peripherals' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });

    await waitFor(() => {
      expect(onRenameWorkspaceEntry).toHaveBeenCalledWith(
        'rtl/peripherals',
        'rtl/renamed_peripherals',
        'folder',
      );
    });
  });

  it('falls back to the highlighted active workspace file when F2 has no explicit tree selection', () => {
    expect(getExplorerRenameTarget(null, 'rtl/peripherals/uart_rx.v')).toEqual({
      path: 'rtl/peripherals/uart_rx.v',
      type: 'file',
    });
  });

  it('falls back to the highlighted active workspace file for explorer copy targets', () => {
    expect(getExplorerClipboardTarget(null, 'rtl/peripherals/uart_rx.v')).toEqual({
      path: 'rtl/peripherals/uart_rx.v',
      type: 'file',
    });
  });

  it('resolves paste targets to the selected file parent path', () => {
    expect(getExplorerPasteTargetPath({
      id: 'rtl/peripherals/uart_rx.v',
      path: 'rtl/peripherals/uart_rx.v',
      type: 'file',
      source: 'real',
    }, 'rtl/peripherals/uart_rx.v')).toBe('rtl/peripherals');
  });

  it('starts delete when Delete is pressed on document after selecting a file in the tree', async () => {
    const onDeleteWorkspaceEntry = vi.fn().mockResolvedValue(false);

    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onDeleteWorkspaceEntry,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    fireEvent.keyDown(document, { key: 'Delete' });

    await waitFor(() => {
      expect(onDeleteWorkspaceEntry).toHaveBeenCalledWith('rtl/peripherals/uart_rx.v', 'file');
    });
  });

  it('starts copy when Ctrl+C is pressed on document after selecting a file in the tree', async () => {
    const onCopyWorkspaceEntry = vi.fn().mockResolvedValue(true);

    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onCopyWorkspaceEntry,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    fireEvent.keyDown(document, { key: 'c', ctrlKey: true });

    await waitFor(() => {
      expect(onCopyWorkspaceEntry).toHaveBeenCalledWith('rtl/peripherals/uart_rx.v', 'file');
    });
  });

  it('opens the selected explorer context menu when Shift+F10 is pressed on the tree', async () => {
    const { container } = renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    fireEvent.keyDown(container.querySelector('.explorer-tree-scrollbar') as HTMLElement, { key: 'F10', shiftKey: true });

    expect(await screen.findByTestId('explorer-context-menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open in Editor' })).toHaveFocus();
  });

  it('does not trigger explorer shortcuts while the explorer context menu owns focus', async () => {
    const onDeleteWorkspaceEntry = vi.fn().mockResolvedValue(false);
    const { container } = renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onDeleteWorkspaceEntry,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    fireEvent.keyDown(container.querySelector('.explorer-tree-scrollbar') as HTMLElement, { key: 'F10', shiftKey: true });

    const menuItem = await screen.findByRole('menuitem', { name: 'Open in Editor' });
    fireEvent.keyDown(menuItem, { key: 'Delete' });

    expect(onDeleteWorkspaceEntry).not.toHaveBeenCalled();
  });

  it('starts cut when Ctrl+X is pressed on the explorer tree', async () => {
    const onCutWorkspaceEntry = vi.fn().mockResolvedValue(true);
    const { container } = renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onCutWorkspaceEntry,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    fireEvent.keyDown(container.querySelector('.explorer-tree-scrollbar') as HTMLElement, { key: 'x', ctrlKey: true });

    await waitFor(() => {
      expect(onCutWorkspaceEntry).toHaveBeenCalledWith('rtl/peripherals/uart_rx.v', 'file');
    });
  });

  it('starts paste into the selected file parent when Ctrl+V is pressed and clipboard is armed', async () => {
    const onPasteWorkspaceEntry = vi.fn().mockResolvedValue({
      path: 'rtl/peripherals/uart_rx-copy.v',
      entryType: 'file',
    });

    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onPasteWorkspaceEntry,
      workspaceClipboard: {
        sourcePath: 'rtl/peripherals/uart_rx.v',
        entryType: 'file',
        mode: 'copy',
      },
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    fireEvent.keyDown(document, { key: 'v', ctrlKey: true });

    await waitFor(() => {
      expect(onPasteWorkspaceEntry).toHaveBeenCalledWith('rtl/peripherals');
    });
  });

  it('clears the clipboard when Escape is pressed while the explorer owns the interaction scope', async () => {
    const onClearWorkspaceClipboard = vi.fn();

    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onClearWorkspaceClipboard,
      workspaceClipboard: {
        sourcePath: 'rtl/peripherals/uart_rx.v',
        entryType: 'file',
        mode: 'copy',
      },
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClearWorkspaceClipboard).toHaveBeenCalledTimes(1);
  });

  it('starts delete when Monaco text input regains focus after selecting a file in the tree', async () => {
    const onDeleteWorkspaceEntry = vi.fn().mockResolvedValue(false);

    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onDeleteWorkspaceEntry,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    const monacoRoot = document.createElement('div');
    monacoRoot.className = 'monaco-editor';
    const monacoInput = document.createElement('textarea');
    monacoInput.className = 'inputarea';
    monacoRoot.appendChild(monacoInput);
    document.body.appendChild(monacoRoot);

    try {
      monacoInput.focus();
      fireEvent.keyDown(monacoInput, { key: 'Delete' });

      await waitFor(() => {
        expect(onDeleteWorkspaceEntry).toHaveBeenCalledWith('rtl/peripherals/uart_rx.v', 'file');
      });
    } finally {
      monacoRoot.remove();
    }
  });

  it('starts delete from the folder context menu for the selected node', async () => {
    const onDeleteWorkspaceEntry = vi.fn().mockResolvedValue(false);

    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onDeleteWorkspaceEntry,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.contextMenu(await screen.findByTestId('file-tree-node-rtl_peripherals'), { clientX: 50, clientY: 60 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

    await waitFor(() => {
      expect(onDeleteWorkspaceEntry).toHaveBeenCalledWith('rtl/peripherals', 'folder');
    });
  });

  it('does not start delete while an explorer input is focused', async () => {
    const onDeleteWorkspaceEntry = vi.fn().mockResolvedValue(false);

    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onDeleteWorkspaceEntry,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(screen.getByRole('button', { name: 'New File' }));

    const draftInput = screen.getByRole('textbox');
    draftInput.focus();
    fireEvent.keyDown(document, { key: 'Delete' });

    expect(onDeleteWorkspaceEntry).not.toHaveBeenCalled();
  });

  it('does not start delete while a non-Monaco textarea is focused', async () => {
    const onDeleteWorkspaceEntry = vi.fn().mockResolvedValue(false);

    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onDeleteWorkspaceEntry,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    try {
      textarea.focus();
      fireEvent.keyDown(textarea, { key: 'Delete' });

      expect(onDeleteWorkspaceEntry).not.toHaveBeenCalled();
    } finally {
      textarea.remove();
    }
  });

  it('does not start copy while a non-Monaco textarea is focused', async () => {
    const onCopyWorkspaceEntry = vi.fn().mockResolvedValue(true);

    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onCopyWorkspaceEntry,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    try {
      textarea.focus();
      fireEvent.keyDown(textarea, { key: 'c', ctrlKey: true });

      expect(onCopyWorkspaceEntry).not.toHaveBeenCalled();
    } finally {
      textarea.remove();
    }
  });

  it('does not start delete after Monaco receives a real pointer interaction outside the tree', async () => {
    const onDeleteWorkspaceEntry = vi.fn().mockResolvedValue(false);

    renderLeftSidePanel({
      activeFileId: 'rtl/peripherals/uart_rx.v',
      currentOutlineId: 'uart_rx',
      onDeleteWorkspaceEntry,
    });

    fireEvent.click(await screen.findByTestId('file-tree-node-rtl'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals'));
    fireEvent.click(await screen.findByTestId('file-tree-node-rtl_peripherals_uart_rx_v'));

    const monacoRoot = document.createElement('div');
    monacoRoot.className = 'monaco-editor';
    const monacoInput = document.createElement('textarea');
    monacoInput.className = 'inputarea';
    monacoRoot.appendChild(monacoInput);
    document.body.appendChild(monacoRoot);

    try {
      fireEvent.pointerDown(monacoInput);
      monacoInput.focus();
      fireEvent.keyDown(monacoInput, { key: 'Delete' });

      expect(onDeleteWorkspaceEntry).not.toHaveBeenCalled();
    } finally {
      monacoRoot.remove();
    }
  });

  it('ignores delete targets for the workspace root', () => {
    expect(getExplorerDeleteTarget({
      id: '.',
      path: '.',
      type: 'root',
      source: 'real',
    })).toBeNull();
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