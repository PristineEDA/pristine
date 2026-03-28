import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OutlineNode } from './OutlineNode';

describe('OutlineNode', () => {
  it('toggles nested children for expandable outline items', () => {
    const onLineJump = vi.fn();

    render(
      <OutlineNode
        item={{
          id: 'module-1',
          name: 'uart_tx',
          type: 'module',
          line: 8,
          expanded: true,
          children: [
            { id: 'child-1', name: 'clk', type: 'input', line: 12, detail: 'wire' },
          ],
        }}
        depth={0}
        onLineJump={onLineJump}
      />,
    );

    expect(screen.getByText('clk')).toBeInTheDocument();

    fireEvent.click(screen.getByText('uart_tx'));
    expect(screen.queryByText('clk')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('uart_tx'));
    expect(screen.getByText('clk')).toBeInTheDocument();
    expect(onLineJump).not.toHaveBeenCalled();
  });

  it('jumps to the target line for leaf nodes and explicit line links', () => {
    const onLineJump = vi.fn();

    render(
      <>
        <OutlineNode
          item={{ id: 'leaf-1', name: 'ready', type: 'output', line: 17, detail: 'wire' }}
          depth={1}
          onLineJump={onLineJump}
        />
        <OutlineNode
          item={{
            id: 'module-2',
            name: 'FSM States',
            type: 'fsm',
            line: 29,
            expanded: true,
            children: [{ id: 'child-2', name: 'S_IDLE', type: 'localparam', line: 30 }],
          }}
          depth={0}
          onLineJump={onLineJump}
        />
      </>,
    );

    fireEvent.click(screen.getByText('ready'));
    fireEvent.click(screen.getByText(':29'));

    expect(onLineJump).toHaveBeenNthCalledWith(1, 17);
    expect(onLineJump).toHaveBeenNthCalledWith(2, 29);
  });
});