import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  ComposerQuotePreview,
  QuoteBlock,
  SelectionToolbar,
} from './quote';

vi.mock('@assistant-ui/react', () => ({
  ComposerPrimitive: {
    Quote: ({ children, ...props }: { children?: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
    QuoteDismiss: ({ asChild: _asChild, children, ...props }: { asChild?: boolean; children?: ReactNode }) => (
      <span {...props}>{children}</span>
    ),
    QuoteText: ({ children, ...props }: { children?: ReactNode }) => (
      <span {...props}>{children ?? 'Selected RTL timing context'}</span>
    ),
  },
  SelectionToolbarPrimitive: {
    Quote: ({ children, ...props }: { children?: ReactNode }) => (
      <button type="button" {...props}>{children}</button>
    ),
    Root: ({ children, ...props }: { children?: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

describe('Quote UI', () => {
  it('renders quoted text in user messages', () => {
    const { container } = render(
      <QuoteBlock text="The ALU carry path failed timing" messageId="assistant-message-1" />,
    );

    expect(container.querySelector('[data-slot="quote-block"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="quote-block-icon"]')).toBeInTheDocument();
    expect(screen.getByText('The ALU carry path failed timing')).toHaveAttribute('data-slot', 'quote-block-text');
  });

  it('renders the floating selection toolbar quote action', () => {
    const { container } = render(<SelectionToolbar />);

    const quoteAction = screen.getByText('Quote');

    expect(quoteAction).toHaveAttribute('data-slot', 'selection-toolbar-quote');
    expect(quoteAction).toHaveClass('text-[12px]', 'leading-relaxed');
    expect(quoteAction.closest('[data-slot="selection-toolbar"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="selection-toolbar-quote"] svg')).toHaveClass('size-3');
  });

  it('renders the composer quote preview with a dismiss button', () => {
    const { container } = render(<ComposerQuotePreview />);

    expect(container.querySelector('[data-slot="composer-quote"]')).toBeInTheDocument();
    expect(screen.getByText('Selected RTL timing context')).toHaveAttribute('data-slot', 'composer-quote-text');
    expect(container.querySelector('[data-slot="composer-quote-dismiss"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss quote' })).toBeInTheDocument();
  });
});
