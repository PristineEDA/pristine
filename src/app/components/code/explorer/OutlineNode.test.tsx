import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LspOutlineItem } from '../../../../../types/systemverilog-lsp';
import {
  createPlainOutlineNode,
  getOutlineNodeKey,
  OutlineNode,
  type OutlineTreeNode,
} from './OutlineNode';

function createOutlineItem(overrides: Partial<LspOutlineItem>): LspOutlineItem {
  return {
    id: 'outline:0',
    parentId: null,
    name: 'top',
    kind: 'module',
    symbolKind: 2,
    range: {
      start: { line: 0, character: 0 },
      end: { line: 4, character: 9 },
    },
    selectionRange: {
      start: { line: 0, character: 7 },
      end: { line: 0, character: 10 },
    },
    depth: 0,
    children: [],
    ...overrides,
  };
}

function renderOutlineNode({
  expandedKeys = new Set<string>(),
  node,
  onLineJump,
  onToggleNode,
  pathSegments = ['0:outline:0:top'],
}: {
  expandedKeys?: Set<string>;
  node: OutlineTreeNode;
  onLineJump?: (line: number) => void;
  onToggleNode?: (nodeKey: string) => void;
  pathSegments?: string[];
}) {
  const resolvedOnLineJump = onLineJump ?? vi.fn<(line: number) => void>();
  const resolvedOnToggleNode = onToggleNode ?? vi.fn<(nodeKey: string) => void>();

  render(
    <OutlineNode
      depth={0}
      expandedKeys={expandedKeys}
      node={node}
      onLineJump={resolvedOnLineJump}
      onToggleNode={resolvedOnToggleNode}
      pathSegments={pathSegments}
    />,
  );

  return {
    onLineJump: resolvedOnLineJump,
    onToggleNode: resolvedOnToggleNode,
  };
}

describe('OutlineNode', () => {
  it('toggles nested children for expandable outline items without jumping', async () => {
    const user = userEvent.setup();
    const expandedKeys = new Set([getOutlineNodeKey(['0:outline:0:uart_tx'])]);
    const node = createPlainOutlineNode(createOutlineItem({
      id: 'outline:0',
      name: 'uart_tx',
      children: [
        createOutlineItem({
          id: 'outline:0.0',
          parentId: 'outline:0',
          name: 'clk',
          kind: 'variable',
          depth: 1,
          selectionRange: {
            start: { line: 11, character: 8 },
            end: { line: 11, character: 11 },
          },
        }),
      ],
    }));
    const { onLineJump, onToggleNode } = renderOutlineNode({
      expandedKeys,
      node,
      pathSegments: ['0:outline:0:uart_tx'],
    });

    expect(screen.getByText('clk')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse uart_tx' }));

    expect(onToggleNode).toHaveBeenCalledWith(getOutlineNodeKey(['0:outline:0:uart_tx']));
    expect(onLineJump).not.toHaveBeenCalled();
  });

  it('jumps to the target line when the item row or explicit line link is clicked', async () => {
    const user = userEvent.setup();
    const node = createPlainOutlineNode(createOutlineItem({
      id: 'outline:1',
      name: 'ready',
      kind: 'variable',
      selectionRange: {
        start: { line: 16, character: 9 },
        end: { line: 16, character: 14 },
      },
    }));
    const { onLineJump } = renderOutlineNode({
      node,
      pathSegments: ['1:outline:1:ready'],
    });

    await user.click(screen.getByTestId(`outline-node-${getOutlineNodeKey(['1:outline:1:ready'])}`));
    await user.click(screen.getByRole('button', { name: 'Open ready at line 17' }));

    expect(onLineJump).toHaveBeenNthCalledWith(1, 17);
    expect(onLineJump).toHaveBeenNthCalledWith(2, 17);
  });

  it('renders item detail with muted smaller text and omits the separator when detail is absent', () => {
    renderOutlineNode({
      node: createPlainOutlineNode(createOutlineItem({
        id: 'outline:1',
        name: 'clk',
        kind: 'port',
        detail: 'input logic',
      })),
    });

    expect(screen.getByTestId('outline-node-label-port-clk')).toHaveTextContent('clk');
    expect(screen.getByTestId('outline-node-label-port-clk')).toHaveTextContent('input logic');
    expect(screen.getByTestId('outline-node-detail-port-clk')).toHaveTextContent('input logic');
    expect(screen.getByTestId('outline-node-detail-port-clk')).toHaveClass('text-[11px]');
    expect(screen.getByTestId('outline-node-detail-port-clk')).toHaveClass('text-ide-text-muted');

    renderOutlineNode({
      node: createPlainOutlineNode(createOutlineItem({
        id: 'outline:2',
        name: 'ready',
        kind: 'variable',
      })),
      pathSegments: ['2:outline:2:ready'],
    });

    expect(screen.getByTestId('outline-node-label-variable-ready')).toHaveTextContent('ready');
    expect(screen.queryByTestId('outline-node-detail-variable-ready')).not.toBeInTheDocument();
  });

  it('shows item detail in a tooltip when the row is hovered', async () => {
    const user = userEvent.setup();

    renderOutlineNode({
      node: createPlainOutlineNode(createOutlineItem({
        id: 'outline:1',
        name: 'clk',
        kind: 'port',
        detail: 'input logic',
      })),
    });

    await user.hover(screen.getByTestId(`outline-node-${getOutlineNodeKey(['0:outline:0:top'])}`));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('input logic');
    expect(tooltip).toHaveClass('fixed');
    expect(tooltip).toHaveClass('duration-300');
  });

  it('renders and toggles kind groups without jumping to source', async () => {
    const user = userEvent.setup();
    const pathSegments = ['0:outline:0:top', '0:outline:0:kind:port'];
    const expandedKeys = new Set([getOutlineNodeKey(pathSegments)]);
    const node: OutlineTreeNode = {
      type: 'kind-group',
      id: 'outline:0:kind:port',
      kind: 'port',
      children: [
        createPlainOutlineNode(createOutlineItem({
          id: 'outline:0.0',
          parentId: 'outline:0',
          name: 'clk',
          kind: 'port',
          detail: 'input logic',
        })),
        createPlainOutlineNode(createOutlineItem({
          id: 'outline:0.1',
          parentId: 'outline:0',
          name: 'rst_n',
          kind: 'port',
          detail: 'input logic',
        })),
      ],
    };
    const { onLineJump, onToggleNode } = renderOutlineNode({
      expandedKeys,
      node,
      pathSegments,
    });

    expect(screen.getByTestId('outline-kind-group-label-port')).toHaveTextContent('Port');
    expect(screen.getByTestId('outline-kind-group-count-port')).toHaveTextContent('(2)');
    expect(screen.getByTestId('outline-kind-group-port')).toHaveClass('items-center');
    expect(screen.getByTestId('outline-kind-group-label-port')).toHaveClass('translate-y-px');
    expect(screen.getByTestId('outline-kind-group-label-port')).toHaveClass('leading-[13px]');
    expect(screen.getByTestId('outline-kind-group-count-port')).toHaveClass('translate-y-px');
    expect(screen.getByTestId('outline-kind-group-count-port')).toHaveClass('leading-[13px]');
    expect(screen.getByTestId('outline-node-label-port-clk')).toBeInTheDocument();

    await user.click(screen.getByTestId('outline-kind-group-port'));

    expect(onToggleNode).toHaveBeenCalledWith(getOutlineNodeKey(pathSegments));
    expect(onLineJump).not.toHaveBeenCalled();
  });
});
