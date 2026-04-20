import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileIcon, FileTreeNode } from './FileTreeNode';

function getContextMenuItem(label: string): HTMLElement {
  return screen.getByRole('menuitem', { name: label });
}

function getContextMenuShortcut(label: string): HTMLElement {
  const shortcut = getContextMenuItem(label).querySelector('[data-slot="context-menu-shortcut"]');

  if (!(shortcut instanceof HTMLElement)) {
    throw new Error(`Context menu shortcut not found for label: ${label}`);
  }

  return shortcut;
}

describe('FileIcon', () => {
  it('renders extension-specific glyphs for supported workspace file types and falls back to the generic file icon', () => {
    const { rerender, container } = render(<FileIcon name="uart_tx.v" />);
    expect(screen.getByText('V')).toBeInTheDocument();

    rerender(<FileIcon name="tb_uart.sv" />);
    expect(screen.getByText('SV')).toBeInTheDocument();

    rerender(<FileIcon name="defs.vh" />);
    expect(screen.getByText('VH')).toBeInTheDocument();

    rerender(<FileIcon name="tb_defs.svh" />);
    expect(screen.getByText('SH')).toBeInTheDocument();

    rerender(<FileIcon name="startup.c" />);
    expect(screen.getByText('C')).toBeInTheDocument();

    rerender(<FileIcon name="startup.hpp" />);
    expect(screen.getByText('H')).toBeInTheDocument();

    rerender(<FileIcon name="cocotb_test.py" />);
    expect(screen.getByText('Py')).toBeInTheDocument();

    rerender(<FileIcon name=".gitignore" />);
    expect(screen.getByText('IG')).toHaveClass('text-ide-file-git');

    rerender(<FileIcon name=".gitmodules" />);
    expect(screen.getByText('GM')).toHaveClass('text-ide-file-git');

    rerender(<FileIcon name="LICENSE" />);
    expect(screen.getByText('LC')).toHaveClass('text-ide-file-license');

    rerender(<FileIcon name="deploy.sh" />);
    expect(screen.getByText('SH')).toHaveClass('text-ide-file-shell');

    rerender(<FileIcon name="timing.xdc" />);
    expect(screen.getByText('X')).toBeInTheDocument();

    rerender(<FileIcon name="timing.sdc" />);
    expect(screen.getByText('SD')).toBeInTheDocument();

    rerender(<FileIcon name="build.tcl" />);
    expect(screen.getByText('TC')).toBeInTheDocument();

    rerender(<FileIcon name="Makefile" />);
    expect(screen.getByText('MK')).toBeInTheDocument();

    rerender(<FileIcon name="synth.ys" />);
    expect(screen.getByText('YS')).toBeInTheDocument();

    rerender(<FileIcon name="crt0.S" />);
    expect(screen.getByText('AS')).toBeInTheDocument();

    rerender(<FileIcon name="memory.lds" />);
    expect(screen.getByText('LD')).toBeInTheDocument();

    rerender(<FileIcon name="sources.FL" />);
    expect(screen.getByText('FL')).toBeInTheDocument();

    rerender(<FileIcon name="manifest.json" />);
    expect(screen.getByText('J')).toBeInTheDocument();

    rerender(<FileIcon name="layout.xml" />);
    expect(screen.getByText('XM')).toBeInTheDocument();

    rerender(<FileIcon name="project.yml" />);
    expect(screen.getByText('Y')).toBeInTheDocument();

    rerender(<FileIcon name="README.md" />);
    expect(screen.getByText('M')).toBeInTheDocument();

    rerender(<FileIcon name="unknown.txt" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('FileTreeNode', () => {
  it('toggles folders and renders nested children only when expanded', () => {
    const onToggleFolder = vi.fn();
    const onFileOpen = vi.fn();
    const onFilePreview = vi.fn();

    const { rerender } = render(
      <FileTreeNode
        node={{
          id: 'rtl',
          path: 'rtl',
          name: 'rtl',
          type: 'folder',
          children: [{ id: 'rtl/uart_tx.v', path: 'rtl/uart_tx.v', name: 'uart_tx.v', type: 'file', hasLoadedChildren: true, isLoading: false }],
          hasLoadedChildren: true,
          isLoading: false,
        }}
        depth={0}
        activeFileId=""
        onFileOpen={onFileOpen}
        onFilePreview={onFilePreview}
        expandedFolders={new Set()}
        onToggleFolder={onToggleFolder}
        gitPathStates={{}}
      />,
    );

    expect(screen.queryByTestId('file-tree-node-rtl_uart_tx_v')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('file-tree-node-rtl'));
    expect(onToggleFolder).toHaveBeenCalledWith('rtl');

    rerender(
      <FileTreeNode
        node={{
          id: 'rtl',
          path: 'rtl',
          name: 'rtl',
          type: 'folder',
          children: [{ id: 'rtl/uart_tx.v', path: 'rtl/uart_tx.v', name: 'uart_tx.v', type: 'file', hasLoadedChildren: true, isLoading: false }],
          hasLoadedChildren: true,
          isLoading: false,
        }}
        depth={0}
        activeFileId=""
        onFileOpen={onFileOpen}
        onFilePreview={onFilePreview}
        expandedFolders={new Set(['rtl'])}
        onToggleFolder={onToggleFolder}
        gitPathStates={{}}
      />,
    );

    expect(screen.getByTestId('file-tree-node-rtl_uart_tx_v')).toBeInTheDocument();
  });

  it('previews on single click, pins on double click, and opens from the context menu', () => {
    const onToggleFolder = vi.fn();
    const onFileOpen = vi.fn();
    const onFilePreview = vi.fn();
    const onStartCopy = vi.fn();
    const onStartCut = vi.fn();
    const onStartDelete = vi.fn();

    render(
      <FileTreeNode
        node={{
          id: 'rtl/core/cpu_top.v',
          path: 'rtl/core/cpu_top.v',
          name: 'cpu_top.v',
          type: 'file',
          hasLoadedChildren: true,
          isLoading: false,
        }}
        depth={1}
        activeFileId="rtl/core/cpu_top.v"
        onFileOpen={onFileOpen}
        onFilePreview={onFilePreview}
        onStartCopy={onStartCopy}
        onStartCut={onStartCut}
        onStartDelete={onStartDelete}
        expandedFolders={new Set()}
        onToggleFolder={onToggleFolder}
        gitPathStates={{}}
      />,
    );

    const node = screen.getByTestId('file-tree-node-rtl_core_cpu_top_v');
    expect(node.className).toContain('bg-primary/20');
    expect(node.className).toContain('hover:bg-primary/20');

    fireEvent.click(node);
    expect(onFilePreview).toHaveBeenCalledWith('rtl/core/cpu_top.v', 'cpu_top.v');

    fireEvent.doubleClick(node);
    expect(onFileOpen).toHaveBeenCalledWith('rtl/core/cpu_top.v', 'cpu_top.v');

    fireEvent.contextMenu(node, { clientX: 100, clientY: 120 });
    fireEvent.click(getContextMenuItem('Open in Editor'));

    expect(onFileOpen).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('menuitem', { name: 'Open in Editor' })).not.toBeInTheDocument();
    expect(screen.getByText('cpu_top.v')).toBeInTheDocument();

    fireEvent.contextMenu(node, { clientX: 100, clientY: 120 });
    fireEvent.click(getContextMenuItem('Copy'));

    expect(onStartCopy).toHaveBeenCalledWith('rtl/core/cpu_top.v', 'file');

    fireEvent.contextMenu(node, { clientX: 100, clientY: 120 });
    fireEvent.click(getContextMenuItem('Cut'));

    expect(onStartCut).toHaveBeenCalledWith('rtl/core/cpu_top.v', 'file');

    fireEvent.contextMenu(node, { clientX: 100, clientY: 120 });
    fireEvent.click(getContextMenuItem('Delete'));

    expect(onStartDelete).toHaveBeenCalledWith('rtl/core/cpu_top.v', 'file');
  });

  it('does not keep a file highlighted while another folder is selected', () => {
    render(
      <FileTreeNode
        node={{
          id: 'rtl/core/cpu_top.v',
          path: 'rtl/core/cpu_top.v',
          name: 'cpu_top.v',
          type: 'file',
          hasLoadedChildren: true,
          isLoading: false,
        }}
        depth={1}
        activeFileId="rtl/core/cpu_top.v"
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        expandedFolders={new Set()}
        onToggleFolder={vi.fn()}
        selectedNode={{
          id: 'rtl',
          path: 'rtl',
          type: 'folder',
          source: 'real',
        }}
        gitPathStates={{}}
      />,
    );

    const node = screen.getByTestId('file-tree-node-rtl_core_cpu_top_v');
    expect(node.className).toContain('hover:bg-accent');
    expect(node.className).not.toContain('hover:bg-primary/20');
  });

  it('shows the static folder context menu entries when right-clicking a folder', () => {
    const onStartDelete = vi.fn();

    render(
      <FileTreeNode
        node={{
          id: 'rtl',
          path: 'rtl',
          name: 'rtl',
          type: 'folder',
          children: [],
          hasLoadedChildren: true,
          isLoading: false,
        }}
        depth={0}
        activeFileId=""
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        onStartDelete={onStartDelete}
        expandedFolders={new Set()}
        onToggleFolder={vi.fn()}
        gitPathStates={{}}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId('file-tree-node-rtl'), { clientX: 40, clientY: 60 });

    expect(screen.getByRole('menu')).toHaveAttribute('data-slot', 'context-menu-content');
    expect(getContextMenuItem('New File')).toBeInTheDocument();
    expect(getContextMenuItem('Copy')).toBeInTheDocument();
    expect(getContextMenuItem('Cut')).toBeInTheDocument();
    expect(getContextMenuItem('Paste')).toHaveAttribute('data-disabled');
    expect(getContextMenuShortcut('Copy')).toHaveTextContent('Ctrl+C');
    expect(getContextMenuShortcut('Cut')).toHaveTextContent('Ctrl+X');
    expect(getContextMenuShortcut('Paste')).toHaveTextContent('Ctrl+V');
    expect(getContextMenuShortcut('Rename')).toHaveTextContent('F2');
    expect(getContextMenuShortcut('Delete')).toHaveTextContent('Delete');
    expect(getContextMenuItem('Copy Path')).toBeInTheDocument();
    expect(getContextMenuItem('Delete')).toHaveAttribute('data-variant', 'destructive');
    expect(document.querySelectorAll('[data-slot="context-menu-separator"]')).toHaveLength(3);

    fireEvent.click(getContextMenuItem('Delete'));

    expect(onStartDelete).toHaveBeenCalledWith('rtl', 'folder');
  });

  it('formats explorer context menu shortcuts with macOS symbols', () => {
    window.electronAPI!.platform = 'darwin';

    render(
      <FileTreeNode
        node={{
          id: 'rtl',
          path: 'rtl',
          name: 'rtl',
          type: 'folder',
          children: [],
          hasLoadedChildren: true,
          isLoading: false,
        }}
        depth={0}
        activeFileId=""
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        expandedFolders={new Set()}
        onToggleFolder={vi.fn()}
        gitPathStates={{}}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId('file-tree-node-rtl'), { clientX: 40, clientY: 60 });

    expect(getContextMenuShortcut('Copy')).toHaveTextContent('⌘C');
    expect(getContextMenuShortcut('Cut')).toHaveTextContent('⌘X');
    expect(getContextMenuShortcut('Paste')).toHaveTextContent('⌘V');
    expect(getContextMenuShortcut('Rename')).toHaveTextContent('F2');
    expect(getContextMenuShortcut('Delete')).toHaveTextContent('Delete');
  });

  it('omits the delete action for the workspace root context menu', () => {
    render(
      <FileTreeNode
        node={{
          id: '.',
          path: '.',
          name: 'workspace',
          type: 'folder',
          children: [],
          hasLoadedChildren: true,
          isLoading: false,
        }}
        depth={0}
        activeFileId=""
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        onStartDelete={vi.fn()}
        expandedFolders={new Set()}
        onToggleFolder={vi.fn()}
        gitPathStates={{}}
      />,
    );

    fireEvent.contextMenu(screen.getByTestId('file-tree-node-root'), { clientX: 40, clientY: 60 });

    expect(getContextMenuItem('Paste')).toHaveAttribute('data-disabled');
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="context-menu-separator"]')).toHaveLength(2);
  });

  it('dims the cut source row and enables paste when clipboard data is available', () => {
    render(
      <FileTreeNode
        node={{
          id: 'rtl/core/cpu_top.v',
          path: 'rtl/core/cpu_top.v',
          name: 'cpu_top.v',
          type: 'file',
          hasLoadedChildren: true,
          isLoading: false,
        }}
        depth={1}
        activeFileId=""
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        expandedFolders={new Set()}
        onToggleFolder={vi.fn()}
        workspaceClipboard={{
          sourcePath: 'rtl/core/cpu_top.v',
          entryType: 'file',
          mode: 'cut',
        }}
        gitPathStates={{}}
      />,
    );

    const node = screen.getByTestId('file-tree-node-rtl_core_cpu_top_v');
    expect(node.className).toContain('opacity-50');

    fireEvent.contextMenu(node, { clientX: 100, clientY: 120 });
    expect(getContextMenuItem('Paste')).not.toHaveAttribute('data-disabled');
  });

  it('keeps a clicked folder highlighted when the selected folder id matches', () => {
    const onSelectNode = vi.fn();
    const onToggleFolder = vi.fn();
    const folderNode = {
      id: 'rtl',
      path: 'rtl',
      name: 'rtl',
      type: 'folder' as const,
      children: [],
      hasLoadedChildren: true,
      isLoading: false,
    };

    const { rerender } = render(
      <FileTreeNode
        node={folderNode}
        depth={0}
        activeFileId=""
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        expandedFolders={new Set()}
        onToggleFolder={onToggleFolder}
        onSelectNode={onSelectNode}
        selectedNode={null}
        gitPathStates={{}}
      />,
    );

    fireEvent.click(screen.getByTestId('file-tree-node-rtl'));

    expect(onSelectNode).toHaveBeenCalledWith({
      id: 'rtl',
      path: 'rtl',
      type: 'folder',
      source: 'real',
    });
    expect(onToggleFolder).toHaveBeenCalledWith('rtl');

    rerender(
      <FileTreeNode
        node={folderNode}
        depth={0}
        activeFileId=""
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        expandedFolders={new Set()}
        onToggleFolder={onToggleFolder}
        onSelectNode={onSelectNode}
        selectedNode={{
          id: 'rtl',
          path: 'rtl',
          type: 'folder',
          source: 'real',
        }}
        gitPathStates={{}}
      />,
    );

    expect(screen.getByTestId('file-tree-node-rtl').className).toContain('bg-primary/20');
    expect(screen.getByTestId('file-tree-node-rtl').className).toContain('hover:bg-primary/20');
  });

  it('scrolls a revealed file node into view when requested', () => {
    const onToggleFolder = vi.fn();
    const onFileOpen = vi.fn();
    const onFilePreview = vi.fn();
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');

    render(
      <FileTreeNode
        node={{
          id: 'rtl/core/reg_file.v',
          path: 'rtl/core/reg_file.v',
          name: 'reg_file.v',
          type: 'file',
          hasLoadedChildren: true,
          isLoading: false,
        }}
        depth={2}
        activeFileId="rtl/core/reg_file.v"
        onFileOpen={onFileOpen}
        onFilePreview={onFilePreview}
        expandedFolders={new Set()}
        onToggleFolder={onToggleFolder}
        gitPathStates={{}}
        revealRequest={{ path: 'rtl/core/reg_file.v', token: 1 }}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('colors git-modified files yellow and ignored folders gray', () => {
    const onToggleFolder = vi.fn();

    const { rerender } = render(
      <FileTreeNode
        node={{
          id: 'rtl/core/cpu_top.v',
          path: 'rtl/core/cpu_top.v',
          name: 'cpu_top.v',
          type: 'file',
          hasLoadedChildren: true,
          isLoading: false,
        }}
        depth={1}
        activeFileId=""
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        expandedFolders={new Set()}
        onToggleFolder={onToggleFolder}
        gitPathStates={{ 'rtl/core/cpu_top.v': 'modified' }}
      />,
    );

    expect(screen.getByTestId('file-tree-label-rtl_core_cpu_top_v')).toHaveClass('text-ide-warning');

    rerender(
      <FileTreeNode
        node={{
          id: 'build',
          path: 'build',
          name: 'build',
          type: 'folder',
          children: [],
          hasLoadedChildren: true,
          isLoading: false,
        }}
        depth={0}
        activeFileId=""
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        expandedFolders={new Set()}
        onToggleFolder={onToggleFolder}
        gitPathStates={{ build: 'ignored' }}
      />,
    );

    expect(screen.getByTestId('file-tree-label-build')).toHaveClass('text-ide-text-muted');
  });
});