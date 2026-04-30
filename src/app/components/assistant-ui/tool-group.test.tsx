import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToolGroup } from './tool-group';

const mocks = vi.hoisted(() => ({
  useScrollLock: vi.fn(),
}));

vi.mock('@assistant-ui/react', async () => {
  const actual = await vi.importActual<typeof import('@assistant-ui/react')>('@assistant-ui/react');

  return {
    ...actual,
    useScrollLock: () => mocks.useScrollLock,
  };
});

vi.mock('@/app/components/ui/collapsible', () => ({
  Collapsible: ({ children, className, onOpenChange: _onOpenChange, open: _open, ...props }: { children?: ReactNode; className?: string; onOpenChange?: (open: boolean) => void; open?: boolean }) => (
    <div className={className} {...props}>{children}</div>
  ),
  CollapsibleContent: ({ children, className, ...props }: { children?: ReactNode; className?: string }) => (
    <div className={className} {...props}>{children}</div>
  ),
  CollapsibleTrigger: ({ children, className, ...props }: { children?: ReactNode; className?: string }) => (
    <button className={className} type="button" {...props}>{children}</button>
  ),
}));

describe('ToolGroup', () => {
  beforeEach(() => {
    mocks.useScrollLock.mockReturnValue(undefined);
  });

  it('groups consecutive mock tool calls with the default outline container', () => {
    const { container } = render(
      <ToolGroup startIndex={2} endIndex={4}>
        <div>inspect_workspace</div>
        <div>trace_signal</div>
        <div>summarize_lint</div>
      </ToolGroup>,
    );

    const root = container.querySelector('[data-slot="tool-group-root"]');
    expect(root).toHaveAttribute('data-variant', 'outline');
    expect(root).toHaveClass('border');
    expect(container.querySelector('[data-slot="tool-group-trigger-label"]')).toHaveTextContent('3 tool calls');
    expect(screen.getByText('trace_signal')).toBeInTheDocument();
  });

  it('supports ghost grouped tool containers through the compound API', () => {
    const { container } = render(
      <ToolGroup.Root variant="ghost" defaultOpen>
        <ToolGroup.Trigger count={1} active />
        <ToolGroup.Content>
          <div>running_tool</div>
        </ToolGroup.Content>
      </ToolGroup.Root>,
    );

    const root = container.querySelector('[data-slot="tool-group-root"]');
    expect(root).toHaveAttribute('data-variant', 'ghost');
    expect(root).not.toHaveClass('border');
    expect(container.querySelector('[data-slot="tool-group-trigger-loader"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="tool-group-trigger-label"]')).toHaveTextContent('1 tool call');
  });
});