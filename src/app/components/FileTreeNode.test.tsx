import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenu, FileIcon, FileTreeNode } from './FileTreeNode';

describe('FileIcon', () => {
  it('renders extension-specific glyphs and falls back to the generic file icon', () => {
    const { rerender, container } = render(<FileIcon name="uart_tx.v" />);
    expect(screen.getByText('V')).toBeInTheDocument();

    rerender(<FileIcon name="tb_uart.sv" />);
    expect(screen.getByText('SV')).toBeInTheDocument();

    rerender(<FileIcon name="timing.xdc" />);
    expect(screen.getByText('X')).toBeInTheDocument();

    rerender(<FileIcon name="project.yml" />);
    expect(screen.getByText('Y')).toBeInTheDocument();

    rerender(<FileIcon name="README.md" />);
    expect(screen.getByText('M')).toBeInTheDocument();

    rerender(<FileIcon name="unknown.txt" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('ContextMenu', () => {
  it('runs menu actions and closes when selecting an item or backdrop', () => {
    const onClose = vi.fn();
    const action = vi.fn();
    const { container } = render(
      <ContextMenu
        x={20}
        y={30}
        onClose={onClose}
        items={[{ label: 'Open in Editor', action }, { label: '---', action: vi.fn() }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Open in Editor/i }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector('.fixed.inset-0.z-40') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('FileTreeNode', () => {
  it('toggles folders and renders nested children only when expanded', () => {
    const onToggleFolder = vi.fn();
    const onFileOpen = vi.fn();

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
        expandedFolders={new Set()}
        onToggleFolder={onToggleFolder}
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
        expandedFolders={new Set(['rtl'])}
        onToggleFolder={onToggleFolder}
      />,
    );

    expect(screen.getByTestId('file-tree-node-rtl_uart_tx_v')).toBeInTheDocument();
  });

  it('opens files from clicks and context-menu actions, including active error nodes', () => {
    const onToggleFolder = vi.fn();
    const onFileOpen = vi.fn();

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
        expandedFolders={new Set()}
        onToggleFolder={onToggleFolder}
      />,
    );

    const node = screen.getByTestId('file-tree-node-rtl_core_cpu_top_v');
    expect(node.className).toContain('bg-ide-selection');

    fireEvent.click(node);
    expect(onFileOpen).toHaveBeenCalledWith('rtl/core/cpu_top.v', 'cpu_top.v');

    fireEvent.contextMenu(node, { clientX: 100, clientY: 120 });
    fireEvent.click(screen.getByRole('button', { name: /Open in Editor/i }));

    expect(onFileOpen).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: /Open in Editor/i })).not.toBeInTheDocument();
    expect(screen.getByText('cpu_top.v')).toBeInTheDocument();
  });
});