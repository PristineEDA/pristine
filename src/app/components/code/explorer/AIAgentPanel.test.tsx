import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { AIAgentPanel, normalizeThreadListWidth } from './AIAgentPanel';
import { usePristineAgentRuntime } from './pristineThreadRuntime';

const mocks = vi.hoisted(() => ({
  pristineAssistantThread: vi.fn(({ agentBaseUrl }: { agentBaseUrl?: string }) => (
    <div data-agent-base-url={agentBaseUrl} data-testid="assistant-thread" />
  )),
  threadList: vi.fn(() => <div data-testid="assistant-thread-list" />),
  threadSubscription: undefined as (() => void) | undefined,
  runtime: {
    thread: {},
    threads: {
      mainItem: {
        getState: vi.fn(() => ({ remoteId: 'thread-remote-1' })),
      },
      subscribe: vi.fn((callback: () => void) => {
        mocks.threadSubscription = callback;
        return vi.fn();
      }),
    },
  },
  usePristineAgentRuntime: vi.fn(),
}));

vi.mock('@assistant-ui/react', () => ({
  AssistantRuntimeProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="assistant-runtime">{children}</div>
  ),
}));

vi.mock('../../assistant/PristineAssistantThread', () => ({
  PristineAssistantThread: mocks.pristineAssistantThread,
}));

vi.mock('../../assistant-ui/thread-list', () => ({
  ThreadList: mocks.threadList,
}));

vi.mock('./pristineThreadRuntime', () => ({
  usePristineAgentRuntime: mocks.usePristineAgentRuntime,
}));

describe('AIAgentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.usePristineAgentRuntime.mockReturnValue(mocks.runtime);
    (mocks.runtime.threads.mainItem.getState as Mock).mockReturnValue({ remoteId: 'thread-remote-1' });

    (window.electronAPI?.config.get as Mock).mockImplementation((key: string) => {
      if (key === 'explorer.aiAssistant.activeThreadId') {
        return 'thread-remote-1';
      }

      if (key === 'explorer.aiAssistant.threadListExpanded') {
        return true;
      }

      if (key === 'explorer.aiAssistant.threadListWidth') {
        return 312;
      }

      return undefined;
    });
  });

  it('renders the assistant shell and restores the saved thread selection and width', () => {
    render(<AIAgentPanel baseUrl="http://localhost:4111/" initialThreadListExpanded={false} />);

    expect(screen.getByText('Pristine Agent')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-thread-list-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('assistant-thread')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-thread')).toHaveAttribute('data-agent-base-url', 'http://localhost:4111');
    expect(screen.queryByTestId('assistant-thread-list-panel')).not.toBeInTheDocument();
    expect(mocks.pristineAssistantThread).toHaveBeenCalledWith(
      expect.objectContaining({ agentBaseUrl: 'http://localhost:4111' }),
      undefined,
    );
    expect(usePristineAgentRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'http://localhost:4111',
        initialThreadId: 'thread-remote-1',
      }),
    );
  });

  it('persists the active remote thread id when the runtime thread changes', () => {
    render(<AIAgentPanel baseUrl="http://localhost:4111/" initialThreadListExpanded={false} />);

    const configSet = window.electronAPI?.config.set as Mock;

    expect(configSet).toHaveBeenCalledWith('explorer.aiAssistant.activeThreadId', 'thread-remote-1');

    configSet.mockClear();
    (mocks.runtime.threads.mainItem.getState as Mock).mockReturnValue({ remoteId: 'thread-remote-2' });

    mocks.threadSubscription?.();

    expect(configSet).toHaveBeenCalledWith('explorer.aiAssistant.activeThreadId', 'thread-remote-2');
  });

  it('defaults the chat list to collapsed and expands it on demand', () => {
    (window.electronAPI?.config.get as Mock).mockImplementation((key: string) => {
      if (key === 'explorer.aiAssistant.activeThreadId') {
        return 'thread-remote-1';
      }

      return undefined;
    });

    render(<AIAgentPanel baseUrl="http://localhost:4111/" initialThreadListExpanded={false} />);

    expect(screen.getByTestId('assistant-thread-list-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('assistant-thread-list-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assistant-thread-list-resize-handle')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('assistant-thread-list-toggle'));

    expect(screen.getByTestId('assistant-thread-list-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('assistant-thread-list-panel')).toHaveStyle({ width: '140px' });
  });

  it('clamps very small chat list widths to the reduced minimum', () => {
    expect(normalizeThreadListWidth(120)).toBe(140);
    expect(normalizeThreadListWidth(139.2)).toBe(140);
  });

  it('resizes the thread list panel, persists the width, and reports state changes upward', () => {
    const onThreadListExpandedChange = vi.fn();
    const onThreadListWidthChange = vi.fn();

    render(
      <AIAgentPanel
        baseUrl="http://localhost:4111/"
        initialThreadListExpanded={true}
        initialThreadListWidth={280}
        onThreadListExpandedChange={onThreadListExpandedChange}
        onThreadListWidthChange={onThreadListWidthChange}
      />,
    );

    const resizeHandle = screen.getByTestId('assistant-thread-list-resize-handle');

    fireEvent.pointerDown(resizeHandle, { button: 0, clientX: 650, pointerId: 1 });
    fireEvent.pointerMove(resizeHandle, { clientX: 620, pointerId: 1 });

    expect(onThreadListWidthChange).toHaveBeenLastCalledWith(310);
    expect(screen.getByTestId('assistant-thread-list-panel')).toHaveStyle({ width: '310px' });

    fireEvent.pointerUp(resizeHandle, { clientX: 620, pointerId: 1 });

    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('explorer.aiAssistant.threadListWidth', 310);

    const toggle = screen.getByTestId('assistant-thread-list-toggle');

    fireEvent.click(toggle);

    expect(onThreadListExpandedChange).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('assistant-thread-list-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assistant-thread-list-resize-handle')).not.toBeInTheDocument();
  });
});
