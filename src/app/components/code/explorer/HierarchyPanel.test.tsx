import type { ComponentProps } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HierarchyPanel } from './HierarchyPanel';

function renderHierarchyPanel(props: Partial<ComponentProps<typeof HierarchyPanel>> = {}) {
  const componentProps: ComponentProps<typeof HierarchyPanel> = {
    activeFileId: 'rtl/core/cpu_top.sv',
    isVisible: true,
    workspaceAvailable: true,
    onFileOpen: vi.fn(),
    onLineJump: vi.fn(),
    ...props,
  };

  return {
    ...render(<HierarchyPanel {...componentProps} />),
    props: componentProps,
  };
}

describe('HierarchyPanel', () => {
  beforeEach(() => {
    vi.mocked(window.electronAPI!.lsp.moduleHierarchy).mockResolvedValue({
      roots: [{
        moduleName: 'cpu_top',
        filePath: 'rtl/core/cpu_top.sv',
        selectionRange: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 14 },
        },
        unresolved: false,
        cycle: false,
        children: [{
          moduleName: 'alu',
          instanceName: 'u_alu',
          filePath: 'rtl/core/alu.sv',
          instanceSelectionRange: {
            start: { line: 12, character: 4 },
            end: { line: 12, character: 9 },
          },
          unresolved: false,
          cycle: false,
          children: [{
            moduleName: 'leaf',
            instanceName: 'u_leaf',
            filePath: 'rtl/core/leaf.sv',
            unresolved: false,
            cycle: false,
            children: [],
          }],
        }, {
          moduleName: 'missing_block',
          instanceName: 'u_missing',
          unresolved: true,
          cycle: false,
          children: [],
        }],
      }],
      messages: [],
    });
  });

  it('loads and renders module instantiation hierarchy from the LSP API', async () => {
    renderHierarchyPanel();

    expect(await screen.findByTestId('hierarchy-tree')).toBeInTheDocument();
    expect(window.electronAPI!.lsp.moduleHierarchy).toHaveBeenCalledWith({ maxDepth: 64 });
    expect(screen.getByTestId('hierarchy-node-label-cpu_top-root')).toHaveTextContent('cpu_top');
    expect(screen.getByTestId('hierarchy-node-label-cpu_top-root')).toHaveClass('ml-1', 'flex', 'items-center', 'text-[13px]');
    expect(screen.getByTestId('hierarchy-node-label-alu-u_alu')).toHaveTextContent(/^u_alu$/);
    expect(screen.getByTestId('hierarchy-node-status-unresolved-0_cpu_top__1_u_missing')).toBeInTheDocument();
    expect(screen.getByLabelText('Unresolved module missing_block')).toBeInTheDocument();
    expect(screen.queryByText('unresolved')).not.toBeInTheDocument();
  });

  it('expands nodes and opens resolved modules at their source line', async () => {
    const testUser = userEvent.setup();
    const onFileOpen = vi.fn();
    const onLineJump = vi.fn();
    renderHierarchyPanel({ onFileOpen, onLineJump });

    await screen.findByTestId('hierarchy-node-label-alu-u_alu');
    expect(screen.queryByTestId('hierarchy-node-label-leaf-u_leaf')).not.toBeInTheDocument();

    await testUser.click(screen.getByRole('button', { name: 'Expand u_alu' }));
    expect(screen.getByTestId('hierarchy-node-label-leaf-u_leaf')).toBeInTheDocument();

    await testUser.click(screen.getByTestId('hierarchy-node-label-alu-u_alu'));
    expect(onFileOpen).toHaveBeenCalledWith('rtl/core/alu.sv', 'alu.sv');
    expect(onLineJump).toHaveBeenCalledWith(13);
  });

  it('shows an empty hierarchy state when no roots are returned', async () => {
    vi.mocked(window.electronAPI!.lsp.moduleHierarchy).mockResolvedValueOnce({ roots: [], messages: [] });

    renderHierarchyPanel();

    await waitFor(() => expect(screen.getByTestId('left-panel-secondary-placeholder')).toHaveTextContent('Hierarchy is empty'));
  });
});
