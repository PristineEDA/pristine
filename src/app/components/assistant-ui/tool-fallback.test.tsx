import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToolFallback } from './tool-fallback';

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

const noop = vi.fn();

describe('ToolFallback', () => {
  beforeEach(() => {
    mocks.useScrollLock.mockReturnValue(undefined);
    noop.mockClear();
  });

  it('renders mock tool args and results for unregistered tool calls', () => {
    const { container } = render(
      <ToolFallback
        type="tool-call"
        toolCallId="call-1"
        toolName="inspect_workspace"
        args={{ path: 'src/top.sv' }}
        argsText={'{"path":"src/top.sv"}'}
        result={{ files: 3, status: 'ok' }}
        status={{ type: 'complete' }}
        addResult={noop}
        resume={noop}
      />,
    );

    expect(container.querySelector('[data-slot="tool-fallback-trigger"]')).toHaveClass('text-[12px]', 'leading-relaxed');
    expect(container.querySelector('[data-slot="tool-fallback-content"]')).toHaveClass('text-[12px]', 'leading-relaxed');
    expect(container.querySelector('[data-slot="tool-fallback-root"]')).toHaveClass('border');
    expect(screen.getByText('inspect_workspace')).toBeInTheDocument();
    expect(screen.getByText('{"path":"src/top.sv"}')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="tool-fallback-result"]')).toHaveTextContent('"status": "ok"');
  });

  it('shows running state with spinner and shimmer affordance', () => {
    const { container } = render(
      <ToolFallback
        type="tool-call"
        toolCallId="call-2"
        toolName="trace_signal"
        args={{ signal: 'clk' }}
        argsText={'{"signal":"clk"}'}
        status={{ type: 'running' }}
        addResult={noop}
        resume={noop}
      />,
    );

    expect(container.querySelector('[data-slot="tool-fallback-trigger-icon"]')).toHaveClass('animate-spin');
    expect(container.querySelector('[data-slot="tool-fallback-trigger-shimmer"]')).toHaveTextContent('Used tool:');
    expect(screen.getAllByText('trace_signal')).toHaveLength(2);
  });

  it('renders cancellation details without showing stale results', () => {
    const { container } = render(
      <ToolFallback
        type="tool-call"
        toolCallId="call-3"
        toolName="long_running_task"
        args={{ timeout: 120 }}
        argsText={'{"timeout":120}'}
        result="finished late"
        status={{ type: 'incomplete', reason: 'cancelled', error: 'User stopped generation' }}
        addResult={noop}
        resume={noop}
      />,
    );

    expect(container.querySelector('[data-slot="tool-fallback-root"]')).toHaveClass('bg-muted/30');
    expect(screen.getByText('Cancelled tool:')).toBeInTheDocument();
    expect(screen.getByText('Cancelled reason:')).toBeInTheDocument();
    expect(screen.getByText('User stopped generation')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="tool-fallback-result"]')).not.toBeInTheDocument();
  });
});