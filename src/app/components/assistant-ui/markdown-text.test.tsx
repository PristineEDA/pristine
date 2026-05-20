import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MarkdownText } from './markdown-text';

const mocks = vi.hoisted(() => ({
  streamdownProps: [] as Array<Record<string, any>>,
}));

vi.mock('@assistant-ui/react-streamdown', () => ({
  StreamdownTextPrimitive: (props: Record<string, any>) => {
    mocks.streamdownProps.push(props);
    const CodeHeader = props.components.CodeHeader;

    return (
      <div data-has-mermaid={String(Boolean(props.componentsByLanguage?.mermaid?.SyntaxHighlighter))} data-testid="streamdown-text">
        <CodeHeader code="const answer = 42;" language="TypeScript" />
      </div>
    );
  },
  useIsStreamdownCodeBlock: () => false,
}));

vi.mock('@/app/components/assistant-ui/mermaid-diagram', () => ({
  MermaidDiagram: () => <pre data-testid="mermaid-diagram" />,
}));

vi.mock('@/app/components/assistant-ui/tooltip-icon-button', () => ({
  TooltipIconButton: ({ children, onClick, tooltip }: { children?: ReactNode; onClick?: () => void; tooltip: string }) => (
    <button aria-label={tooltip} onClick={onClick} type="button">
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  CheckIcon: () => <span data-testid="check-icon" />,
  CopyIcon: () => <span data-testid="copy-icon" />,
}));

describe('MarkdownText', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.streamdownProps.length = 0;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers the mermaid syntax highlighter with Streamdown', () => {
    render(<MarkdownText />);

    expect(screen.getByTestId('streamdown-text')).toHaveAttribute('data-has-mermaid', 'true');
    expect(mocks.streamdownProps[0]?.remarkPlugins).toHaveLength(1);
  });

  it('copies code once while the copied state is active and resets after the timeout', async () => {
    render(<MarkdownText />);

    const button = screen.getByRole('button', { name: 'Copy' });
    fireEvent.click(button);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('const answer = 42;');
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();

    fireEvent.click(button);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();

    fireEvent.click(button);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
  });
});