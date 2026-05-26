import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HierarchyPanel } from './HierarchyPanel';
import type { LspModuleHierarchyNode } from '../../../../../types/systemverilog-lsp';

function createHierarchyNode(
  moduleName: string,
  overrides: Partial<LspModuleHierarchyNode> = {},
): LspModuleHierarchyNode {
  return {
    moduleName,
    filePath: `rtl/core/${moduleName}.sv`,
    moduleSelectionRange: {
      start: { line: 0, character: 7 },
      end: { line: 0, character: 7 + moduleName.length },
    },
    unresolved: false,
    cycle: false,
    children: [],
    ...overrides,
  };
}

function getRootLabels() {
  return screen.getAllByTestId(/^hierarchy-node-label-.*-root$/).map((node) => node.textContent);
}

function openContextMenuForHierarchyNode(testId: string) {
  fireEvent.contextMenu(screen.getByTestId(testId), { clientX: 120, clientY: 140 });
}

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
    expect(screen.getByTestId('hierarchy-node-label-cpu_top-root')).toHaveClass('font-semibold');
    expect(screen.getByTestId('hierarchy-node-top-indicator-0_cpu_top')).toHaveAccessibleName('Automatic top module');
    expect(screen.getByTestId('hierarchy-node-label-alu-u_alu')).toHaveTextContent(/^u_alu$/);
    expect(screen.getByTestId('hierarchy-node-status-unresolved-0_cpu_top__1_u_missing')).toBeInTheDocument();
    expect(screen.getByLabelText('Unresolved module missing_block')).toBeInTheDocument();
    expect(screen.queryByText('unresolved')).not.toBeInTheDocument();
  });

  it('sorts multi-root hierarchies and marks the automatic top root', async () => {
    vi.mocked(window.electronAPI!.lsp.moduleHierarchy).mockResolvedValueOnce({
      roots: [
        createHierarchyNode('beta_equal', {
          filePath: 'rtl/core/b_equal.sv',
          moduleSelectionRange: { start: { line: 2, character: 7 }, end: { line: 2, character: 17 } },
          children: [createHierarchyNode('beta_leaf', { instanceName: 'u_beta_leaf' })],
        }),
        createHierarchyNode('wide_top', {
          filePath: 'rtl/core/z_wide.sv',
          children: [
            createHierarchyNode('wide_leaf_a', { instanceName: 'u_wide_a' }),
            createHierarchyNode('wide_leaf_b', { instanceName: 'u_wide_b' }),
            createHierarchyNode('wide_leaf_c', { instanceName: 'u_wide_c' }),
          ],
        }),
        createHierarchyNode('alpha_second', {
          filePath: 'rtl/core/a_equal.sv',
          moduleSelectionRange: { start: { line: 12, character: 7 }, end: { line: 12, character: 19 } },
          children: [createHierarchyNode('alpha_second_leaf', { instanceName: 'u_alpha_second_leaf' })],
        }),
        createHierarchyNode('deep_top', {
          filePath: 'rtl/core/z_deep.sv',
          children: [createHierarchyNode('deep_mid', {
            instanceName: 'u_deep_mid',
            children: [createHierarchyNode('deep_leaf', { instanceName: 'u_deep_leaf' })],
          })],
        }),
        createHierarchyNode('alpha_first', {
          filePath: 'rtl/core/a_equal.sv',
          moduleSelectionRange: { start: { line: 4, character: 7 }, end: { line: 4, character: 18 } },
          children: [createHierarchyNode('alpha_first_leaf', { instanceName: 'u_alpha_first_leaf' })],
        }),
      ],
      messages: [],
    });

    renderHierarchyPanel();

    await screen.findByTestId('hierarchy-node-label-deep_top-root');
    expect(getRootLabels()).toEqual(['deep_top', 'wide_top', 'alpha_first', 'alpha_second', 'beta_equal']);
    expect(screen.getByTestId('hierarchy-node-top-indicator-3_deep_top')).toHaveAccessibleName('Automatic top module');
    expect(screen.getByTestId('hierarchy-node-label-deep_top-root')).toHaveClass('font-semibold');
    expect(screen.getByTestId('hierarchy-node-label-wide_top-root')).not.toHaveClass('font-semibold');
  });

  it('sets a root as the manual top from the hierarchy context menu', async () => {
    const testUser = userEvent.setup();
    vi.mocked(window.electronAPI!.lsp.moduleHierarchy).mockResolvedValue({
      roots: [
        createHierarchyNode('auto_top', {
          children: [createHierarchyNode('auto_leaf', { instanceName: 'u_auto_leaf' })],
        }),
        createHierarchyNode('manual_top'),
      ],
      messages: [],
    });

    const { rerender, props } = renderHierarchyPanel();

    await screen.findByTestId('hierarchy-node-label-auto_top-root');
    expect(getRootLabels()).toEqual(['auto_top', 'manual_top']);
    expect(screen.getByTestId('hierarchy-node-top-indicator-0_auto_top')).toHaveAccessibleName('Automatic top module');

    openContextMenuForHierarchyNode('hierarchy-node-1_manual_top');
    await testUser.click(screen.getByRole('menuitem', { name: '手动设置顶层' }));

    expect(getRootLabels()).toEqual(['manual_top', 'auto_top']);
    expect(screen.getByTestId('hierarchy-node-top-indicator-1_manual_top')).toHaveAccessibleName('Manual top module');
    expect(screen.getByTestId('hierarchy-node-label-manual_top-root')).toHaveClass('font-semibold');
    expect(screen.queryByRole('menuitem', { name: '手动设置顶层' })).not.toBeInTheDocument();

    rerender(<HierarchyPanel {...props} refreshToken={1} />);
    await waitFor(() => expect(window.electronAPI!.lsp.moduleHierarchy).toHaveBeenCalledTimes(2));
    expect(getRootLabels()).toEqual(['manual_top', 'auto_top']);
    expect(screen.getByTestId('hierarchy-node-top-indicator-1_manual_top')).toHaveAccessibleName('Manual top module');
  });

  it('keeps the manual top action root-only and returns to automatic top when that root disappears', async () => {
    const testUser = userEvent.setup();
    const autoTop = createHierarchyNode('auto_top', {
      children: [createHierarchyNode('auto_leaf', { instanceName: 'u_auto_leaf' })],
    });
    const manualTop = createHierarchyNode('manual_top');

    vi.mocked(window.electronAPI!.lsp.moduleHierarchy)
      .mockResolvedValueOnce({ roots: [autoTop, manualTop], messages: [] })
      .mockResolvedValueOnce({ roots: [autoTop], messages: [] });

    const { rerender, props } = renderHierarchyPanel();

    await screen.findByTestId('hierarchy-node-label-auto_leaf-u_auto_leaf');
    openContextMenuForHierarchyNode('hierarchy-node-0_auto_top__0_u_auto_leaf');
    expect(screen.queryByRole('menuitem', { name: '手动设置顶层' })).not.toBeInTheDocument();

    openContextMenuForHierarchyNode('hierarchy-node-1_manual_top');
    await testUser.click(screen.getByRole('menuitem', { name: '手动设置顶层' }));
    expect(getRootLabels()).toEqual(['manual_top', 'auto_top']);

    rerender(<HierarchyPanel {...props} refreshToken={1} />);
    await waitFor(() => expect(window.electronAPI!.lsp.moduleHierarchy).toHaveBeenCalledTimes(2));
    expect(getRootLabels()).toEqual(['auto_top']);
    expect(screen.getByTestId('hierarchy-node-top-indicator-0_auto_top')).toHaveAccessibleName('Automatic top module');
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
