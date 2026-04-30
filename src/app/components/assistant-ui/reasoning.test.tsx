import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Reasoning, ReasoningGroup } from './reasoning';

const mocks = vi.hoisted(() => ({
  useAuiState: vi.fn(),
  useScrollLock: vi.fn(),
}));

vi.mock('@assistant-ui/react', async () => {
  const actual = await vi.importActual<typeof import('@assistant-ui/react')>('@assistant-ui/react');

  return {
    ...actual,
    useAuiState: (selector: (state: { message: { parts: Array<{ type: string }>; status?: { type: string } } }) => unknown) =>
      mocks.useAuiState(selector),
    useScrollLock: () => mocks.useScrollLock,
  };
});

vi.mock('@/app/components/assistant-ui/markdown-text', () => ({
  MarkdownText: () => <div data-testid="reasoning-markdown">mock reasoning markdown</div>,
}));

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

describe('Reasoning', () => {
  beforeEach(() => {
    mocks.useScrollLock.mockReturnValue(undefined);
    mocks.useAuiState.mockImplementation((selector: (state: { message: { parts: Array<{ type: string }>; status?: { type: string } } }) => unknown) =>
      selector({
        message: {
          parts: [{ type: 'reasoning' }],
          status: { type: 'running' },
        },
      }),
    );
  });

  it('renders individual reasoning content with the markdown renderer', () => {
    render(<Reasoning type="reasoning" text="Check the carry chain" status={{ type: 'complete' }} />);

    expect(screen.getByTestId('reasoning-markdown')).toHaveTextContent('mock reasoning markdown');
  });

  it('supports ghost reasoning containers through the official compound API', () => {
    const { container } = render(
      <Reasoning.Root variant="ghost" defaultOpen>
        <Reasoning.Trigger active />
        <Reasoning.Content>
          <Reasoning.Text>Review timing paths</Reasoning.Text>
        </Reasoning.Content>
      </Reasoning.Root>,
    );

    const root = container.querySelector('[data-slot="reasoning-root"]');
    expect(root).toHaveAttribute('data-variant', 'ghost');
    expect(root).not.toHaveClass('border');
    expect(screen.getByText('Review timing paths')).toHaveAttribute('data-slot', 'reasoning-text');
  });

  it('keeps the default grouped reasoning behavior available for mock reasoning parts', () => {
    const { container } = render(
      <ReasoningGroup startIndex={0} endIndex={0}>
        <div>Grouped reasoning</div>
      </ReasoningGroup>,
    );

    expect(container.querySelector('[data-slot="reasoning-root"]')).toBeInTheDocument();
    expect(screen.getByText('Grouped reasoning')).toBeInTheDocument();
  });
});