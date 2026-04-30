import { fireEvent, render, screen, userEvent } from '@/test/render';
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

function openContextMenuForNode(testId: string, coordinates = { clientX: 100, clientY: 120 }) {
  fireEvent.contextMenu(screen.getByTestId(testId), coordinates);
}

describe('FileIcon', () => {
  it.each([
    ['uart_tx.v', 'verilog'],
    ['uart_defs.vh', 'verilog-header'],
    ['axi_if.sv', 'systemverilog'],
    ['axi_pkg.svh', 'systemverilog-header'],
    ['Makefile', 'makefile'],
    ['crt0.S', 'assembly'],
    ['package.json', 'nodejs'],
    ['hazard3.adoc', 'asciidoc'],
    ['soc.f', 'eda-filelist'],
    ['retrosoc.sdc', 'timing-constraint'],
    ['constraints_io.xdc', 'fpga-constraint'],
    ['waves.gtkw', 'gtkwave'],
    ['synth_retrosoc.ys', 'yosys'],
    ['unknown.txt', 'file'],
  ])('renders %s with the %s icon', (name, iconKey) => {
    const { container } = render(<FileIcon name={name} />);

    expect(container.querySelector(`img[data-icon-key="${iconKey}"]`)).toBeInTheDocument();
  });
});

describe('FileTreeNode', () => {
  it('toggles folders and renders nested children only when expanded', async () => {
    const user = userEvent.setup();
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
    expect(screen.getByTestId('file-tree-icon-rtl')).toHaveAttribute('data-icon-key', 'folder');

    await user.click(screen.getByTestId('file-tree-node-rtl'));
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

    expect(screen.getByTestId('file-tree-icon-rtl')).toHaveAttribute('data-icon-key', 'folder-open');
    expect(screen.getByTestId('file-tree-node-rtl_uart_tx_v')).toBeInTheDocument();
  });

  it('previews on single click, pins on double click, and opens from the context menu', async () => {
    const user = userEvent.setup();
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

    await user.click(node);
    expect(onFilePreview).toHaveBeenCalledWith('rtl/core/cpu_top.v', 'cpu_top.v');

    await user.dblClick(node);
    expect(onFileOpen).toHaveBeenCalledWith('rtl/core/cpu_top.v', 'cpu_top.v');

    openContextMenuForNode('file-tree-node-rtl_core_cpu_top_v');
    await user.click(getContextMenuItem('Open in Editor'));

    expect(onFileOpen).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('menuitem', { name: 'Open in Editor' })).not.toBeInTheDocument();
    expect(screen.getByText('cpu_top.v')).toBeInTheDocument();

    openContextMenuForNode('file-tree-node-rtl_core_cpu_top_v');
    await user.click(getContextMenuItem('Copy'));

    expect(onStartCopy).toHaveBeenCalledWith('rtl/core/cpu_top.v', 'file');

    openContextMenuForNode('file-tree-node-rtl_core_cpu_top_v');
    await user.click(getContextMenuItem('Cut'));

    expect(onStartCut).toHaveBeenCalledWith('rtl/core/cpu_top.v', 'file');

    openContextMenuForNode('file-tree-node-rtl_core_cpu_top_v');
    await user.click(getContextMenuItem('Delete'));

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

    openContextMenuForNode('file-tree-node-rtl', { clientX: 40, clientY: 60 });

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
    expect(getContextMenuItem('Delete')).not.toHaveClass('text-destructive', 'hover:bg-destructive/10', 'hover:text-destructive');
    expect(document.querySelectorAll('[data-slot="context-menu-separator"]')).toHaveLength(3);

    fireEvent.click(getContextMenuItem('Delete'));

    expect(onStartDelete).toHaveBeenCalledWith('rtl', 'folder');
  });

  it('opens the explorer context menu upward when the click is near the viewport bottom', () => {
    const originalInnerHeight = window.innerHeight;
    const getBoundingClientRectMock = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mockRect(this: HTMLElement) {
      if (this.getAttribute('data-testid') === 'explorer-context-menu') {
        return {
          x: 40,
          y: 190,
          top: 190,
          left: 40,
          bottom: 350,
          right: 200,
          width: 160,
          height: 160,
          toJSON: () => ({}),
        } as DOMRect;
      }

      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 240,
    });

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

    openContextMenuForNode('file-tree-node-rtl', { clientX: 40, clientY: 190 });

    const menu = screen.getByTestId('explorer-context-menu');
    expect(menu).toHaveAttribute('data-side', 'top');
    expect(menu).toHaveStyle({ left: '40px', top: '30px' });

    getBoundingClientRectMock.mockRestore();
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
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

    openContextMenuForNode('file-tree-node-rtl', { clientX: 40, clientY: 60 });

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

    openContextMenuForNode('file-tree-node-root', { clientX: 40, clientY: 60 });

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

    openContextMenuForNode('file-tree-node-rtl_core_cpu_top_v');
    expect(getContextMenuItem('Paste')).not.toHaveAttribute('data-disabled');
  });

  it('focuses the first enabled menu item on open and restores tree focus on Escape', () => {
    const onRequestTreeFocus = vi.fn();

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
        onRequestTreeFocus={onRequestTreeFocus}
        gitPathStates={{}}
      />,
    );

    openContextMenuForNode('file-tree-node-rtl_core_cpu_top_v');

    const firstItem = getContextMenuItem('Open in Editor');
    expect(firstItem).toHaveFocus();

    fireEvent.keyDown(firstItem, { key: 'Escape' });

    expect(screen.queryByTestId('explorer-context-menu')).not.toBeInTheDocument();
    expect(onRequestTreeFocus).toHaveBeenCalledTimes(1);
  });

  it('supports roving focus with Arrow keys, skips disabled items, and activates the focused item with Enter', () => {
    const onStartRename = vi.fn();

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
        onStartRename={onStartRename}
        expandedFolders={new Set()}
        onToggleFolder={vi.fn()}
        gitPathStates={{}}
      />,
    );

    openContextMenuForNode('file-tree-node-rtl', { clientX: 40, clientY: 60 });

    const newFileItem = getContextMenuItem('New File');
    expect(newFileItem).toHaveFocus();

    fireEvent.keyDown(newFileItem, { key: 'ArrowDown' });
    expect(getContextMenuItem('New Folder')).toHaveFocus();

    fireEvent.keyDown(getContextMenuItem('New Folder'), { key: 'ArrowDown' });
    expect(getContextMenuItem('Copy')).toHaveFocus();

    fireEvent.keyDown(getContextMenuItem('Copy'), { key: 'ArrowDown' });
    expect(getContextMenuItem('Cut')).toHaveFocus();

    fireEvent.keyDown(getContextMenuItem('Cut'), { key: 'ArrowDown' });
    expect(getContextMenuItem('Rename')).toHaveFocus();

    fireEvent.keyDown(getContextMenuItem('Rename'), { key: 'Enter' });
    expect(onStartRename).toHaveBeenCalledWith('rtl', 'folder');
  });

  it('supports Home and End keys and closes on Tab while restoring tree focus', () => {
    const onRequestTreeFocus = vi.fn();

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
        onRequestTreeFocus={onRequestTreeFocus}
        gitPathStates={{}}
      />,
    );

    openContextMenuForNode('file-tree-node-rtl_core_cpu_top_v');

    const firstItem = getContextMenuItem('Open in Editor');
    fireEvent.keyDown(firstItem, { key: 'End' });
    expect(getContextMenuItem('Copy Relative Path')).toHaveFocus();

    fireEvent.keyDown(getContextMenuItem('Copy Relative Path'), { key: 'Home' });
    expect(getContextMenuItem('Open in Editor')).toHaveFocus();

    fireEvent.keyDown(getContextMenuItem('Open in Editor'), { key: 'Tab' });
    expect(screen.queryByTestId('explorer-context-menu')).not.toBeInTheDocument();
    expect(onRequestTreeFocus).toHaveBeenCalledTimes(1);
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

  it('renders right-aligned git badges for files and strengthens ignored folder text in light mode', () => {
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
    expect(screen.getByTestId('file-tree-git-indicators-rtl_core_cpu_top_v')).toHaveClass('ml-auto');
    expect(screen.getByTestId('file-tree-git-indicator-modified-rtl_core_cpu_top_v')).toBeInTheDocument();

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

    expect(screen.getByTestId('file-tree-label-build')).toHaveClass('text-ide-text-muted-stronger');
    expect(screen.queryByTestId('file-tree-git-indicators-build')).not.toBeInTheDocument();
  });

  it('aggregates created, modified, and deleted badges on parent folders in display order', () => {
    render(
      <FileTreeNode
        node={{
          id: 'rtl/core',
          path: 'rtl/core',
          name: 'core',
          type: 'folder',
          children: [],
          hasLoadedChildren: true,
          isLoading: false,
        }}
        depth={1}
        activeFileId=""
        onFileOpen={vi.fn()}
        onFilePreview={vi.fn()}
        expandedFolders={new Set()}
        onToggleFolder={vi.fn()}
        gitPathStates={{
          'rtl/core/new_file.v': 'created',
          'rtl/core/cpu_top.v': 'modified',
          'rtl/core/old_file.v': 'deleted',
        }}
      />,
    );

    const indicators = screen.getByTestId('file-tree-git-indicators-rtl_core');
    const indicatorIds = Array.from(indicators.querySelectorAll('[data-testid]')).map((element) => element.getAttribute('data-testid'));

    expect(screen.getByTestId('file-tree-label-rtl_core')).toHaveClass('text-ide-success');
    expect(indicatorIds).toEqual([
      'file-tree-git-indicator-created-rtl_core',
      'file-tree-git-indicator-modified-rtl_core',
      'file-tree-git-indicator-deleted-rtl_core',
    ]);
  });
});
