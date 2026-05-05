import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThreadList } from './thread-list';

const mocks = vi.hoisted(() => ({
  isLoading: false,
  rename: vi.fn(async (nextTitle: string) => {
    mocks.threadTitle = nextTitle;
  }),
  threadId: 'thread-1',
  threadTitle: 'Alpha Chat',
}));

vi.mock('@assistant-ui/react', () => ({
  AuiIf: ({ children, condition }: { children?: ReactNode; condition: (state: { threads: { isLoading: boolean } }) => boolean }) => (
    condition({ threads: { isLoading: mocks.isLoading } }) ? <>{children}</> : null
  ),
  ThreadListPrimitive: {
    Root: ({ children, className }: { children?: ReactNode; className?: string }) => <div className={className}>{children}</div>,
    New: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Items: ({ children }: { children: () => ReactNode }) => <div>{children()}</div>,
  },
  ThreadListItemPrimitive: {
    Root: ({ children, className }: { children?: ReactNode; className?: string }) => <div className={className}>{children}</div>,
    Trigger: ({ children, className }: { children?: ReactNode; className?: string }) => <button className={className} type="button">{children}</button>,
    Title: ({ fallback }: { fallback?: string }) => <span>{mocks.threadTitle || fallback}</span>,
    Archive: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Delete: ({ children }: { children?: ReactNode }) => <>{children}</>,
  },
  ThreadListItemMorePrimitive: {
    Root: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Trigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Item: ({ children, className, onSelect }: { children?: ReactNode; className?: string; onSelect?: () => void }) => (
      <button className={className} type="button" onClick={onSelect}>{children}</button>
    ),
  },
  useAuiState: (selector: (state: { threadListItem: { id: string; title: string }; threads: { isLoading: boolean } }) => unknown) => selector({
    threadListItem: {
      id: mocks.threadId,
      title: mocks.threadTitle,
    },
    threads: {
      isLoading: mocks.isLoading,
    },
  }),
  useThreadListItemRuntime: () => ({
    rename: mocks.rename,
  }),
}));

describe('ThreadList', () => {
  beforeEach(() => {
    mocks.isLoading = false;
    mocks.threadId = 'thread-1';
    mocks.threadTitle = 'Alpha Chat';
    mocks.rename.mockClear();
    mocks.rename.mockImplementation(async (nextTitle: string) => {
      mocks.threadTitle = nextTitle;
    });
  });

  it('renders chat-focused copy for new and existing items', () => {
    render(<ThreadList />);

    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();
    expect(screen.getByText('Alpha Chat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument();
  });

  it('renames a chat from the more menu and submits on Enter', async () => {
    const user = userEvent.setup();

    render(<ThreadList />);

    await user.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByTestId('thread-list-rename-input');
    expect(input).toHaveValue('Alpha Chat');

    await user.clear(input);
    await user.type(input, 'Renamed Chat');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mocks.rename).toHaveBeenCalledWith('Renamed Chat');
    });
    expect(screen.queryByTestId('thread-list-rename-input')).not.toBeInTheDocument();
    expect(screen.getByText('Renamed Chat')).toBeInTheDocument();
  });

  it('cancels rename on Escape without calling the runtime, even if blur follows', async () => {
    const user = userEvent.setup();

    render(<ThreadList />);

    await user.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByTestId('thread-list-rename-input');
    await user.clear(input);
    await user.type(input, 'Discarded Chat');
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);

    expect(mocks.rename).not.toHaveBeenCalled();
    expect(screen.queryByTestId('thread-list-rename-input')).not.toBeInTheDocument();
    expect(screen.getByText('Alpha Chat')).toBeInTheDocument();
  });
});