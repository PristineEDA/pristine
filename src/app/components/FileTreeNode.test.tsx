import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenu, FileIcon, FileTreeNode } from './FileTreeNode';

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
      />,
    );

    expect(screen.getByTestId('file-tree-node-rtl_uart_tx_v')).toBeInTheDocument();
  });

  it('previews on single click, pins on double click, and opens from the context menu', () => {
    const onToggleFolder = vi.fn();
    const onFileOpen = vi.fn();
    const onFilePreview = vi.fn();

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
        expandedFolders={new Set()}
        onToggleFolder={onToggleFolder}
      />,
    );

    const node = screen.getByTestId('file-tree-node-rtl_core_cpu_top_v');
    expect(node.className).toContain('bg-primary/20');

    fireEvent.click(node);
  expect(onFilePreview).toHaveBeenCalledWith('rtl/core/cpu_top.v', 'cpu_top.v');

  fireEvent.doubleClick(node);
  expect(onFileOpen).toHaveBeenCalledWith('rtl/core/cpu_top.v', 'cpu_top.v');

    fireEvent.contextMenu(node, { clientX: 100, clientY: 120 });
    fireEvent.click(screen.getByRole('button', { name: /Open in Editor/i }));

    expect(onFileOpen).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: /Open in Editor/i })).not.toBeInTheDocument();
    expect(screen.getByText('cpu_top.v')).toBeInTheDocument();
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
        revealRequest={{ path: 'rtl/core/reg_file.v', token: 1 }}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });
});