import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { LspOutlineItem } from '../../../../../types/systemverilog-lsp';
import { getOutlineNodeKey, OutlineNode } from './OutlineNode';

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

describe('OutlineNode', () => {
  it('toggles nested children for expandable outline items', async () => {
    const user = userEvent.setup();
    const onLineJump = vi.fn();
    const onToggleNode = vi.fn();
    const expandedKeys = new Set([getOutlineNodeKey(['0:outline:0:uart_tx'])]);

    render(
      <OutlineNode
        item={createOutlineItem({
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
        })}
        depth={0}
        expandedKeys={expandedKeys}
        onLineJump={onLineJump}
        onToggleNode={onToggleNode}
        pathSegments={['0:outline:0:uart_tx']}
      />,
    );

    expect(screen.getByText('clk')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse uart_tx' }));

    expect(onToggleNode).toHaveBeenCalledWith(getOutlineNodeKey(['0:outline:0:uart_tx']));
    expect(onLineJump).not.toHaveBeenCalled();
  });

  it('jumps to the target line for labels and explicit line links', async () => {
    const user = userEvent.setup();
    const onLineJump = vi.fn();

    render(
      <OutlineNode
        item={createOutlineItem({
          id: 'outline:1',
          name: 'ready',
          kind: 'variable',
          selectionRange: {
            start: { line: 16, character: 9 },
            end: { line: 16, character: 14 },
          },
        })}
        depth={1}
        expandedKeys={new Set()}
        onLineJump={onLineJump}
        onToggleNode={vi.fn()}
        pathSegments={['1:outline:1:ready']}
      />,
    );

    await user.dblClick(screen.getByTestId('outline-node-label-variable-ready'));
    await user.click(screen.getByRole('button', { name: 'Open ready at line 17' }));

    expect(onLineJump).toHaveBeenNthCalledWith(1, 17);
    expect(onLineJump).toHaveBeenNthCalledWith(2, 17);
  });
});
