import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContextDisplay } from './context-display';

const mocks = vi.hoisted(() => ({
  useAuiState: vi.fn(),
  useThreadTokenUsage: vi.fn(),
}));

vi.mock('@assistant-ui/react', () => ({
  useAuiState: (selector: (state: { threadListItem: { id: string } }) => unknown) =>
    mocks.useAuiState(selector),
}));

vi.mock('@assistant-ui/react-ai-sdk', () => ({
  useThreadTokenUsage: () => mocks.useThreadTokenUsage(),
}));

vi.mock('@/app/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children, side, className }: { children?: ReactNode; side?: string; className?: string }) => (
    <div className={className} data-side={side} data-testid="context-tooltip">
      {children}
    </div>
  ),
  TooltipTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

describe('ContextDisplay', () => {
  beforeEach(() => {
    mocks.useAuiState.mockImplementation((selector: (state: { threadListItem: { id: string } }) => unknown) =>
      selector({ threadListItem: { id: 'thread-1' } }),
    );
    mocks.useThreadTokenUsage.mockReturnValue(undefined);
  });

  it('renders supplied mock usage without reading backend token metadata', () => {
    render(
      <ContextDisplay.Bar
        modelContextWindow={128_000}
        side="bottom"
        usage={{
          totalTokens: 53_760,
          inputTokens: 42_180,
          cachedInputTokens: 8_400,
          outputTokens: 9_920,
          reasoningTokens: 1_660,
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Context usage' })).toHaveTextContent('53.8k (42%)');
    expect(screen.getByTestId('context-tooltip')).toHaveAttribute('data-side', 'bottom');
    expect(screen.getByText('Usage')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('42.2k')).toBeInTheDocument();
    expect(screen.getByText('Cached')).toBeInTheDocument();
    expect(screen.getByText('8.4k')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText('9.9k')).toBeInTheDocument();
    expect(screen.getByText('Reasoning')).toBeInTheDocument();
    expect(screen.getByText('1.7k')).toBeInTheDocument();
    expect(screen.getByText('53.8k / 128.0k')).toBeInTheDocument();
    expect(mocks.useThreadTokenUsage).not.toHaveBeenCalled();
  });

  it('falls back to internal token usage when usage is not supplied', () => {
    mocks.useThreadTokenUsage.mockReturnValue({ totalTokens: 92_160 });

    render(<ContextDisplay.Text modelContextWindow={128_000} />);

    expect(screen.getByRole('button', { name: 'Context usage' })).toHaveTextContent('92.2k / 128.0k');
    expect(mocks.useThreadTokenUsage).toHaveBeenCalledTimes(1);
  });
});