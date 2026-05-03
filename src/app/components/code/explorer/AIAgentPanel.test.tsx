import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { AIAgentPanel } from './AIAgentPanel';
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

      if (key === 'explorer.aiAssistant.threadListWidth') {
        return 312;
      }

      return undefined;
    });
  });

  it('renders the assistant shell and restores the saved thread selection and width', () => {
    render(<AIAgentPanel baseUrl="http://localhost:4111/" />);

    expect(screen.getByText('Pristine Agent')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-thread')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-thread-list')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-thread')).toHaveAttribute('data-agent-base-url', 'http://localhost:4111');
    expect(screen.getByTestId('assistant-thread-list-panel')).toHaveStyle({ width: '312px' });
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
    render(<AIAgentPanel baseUrl="http://localhost:4111/" />);

    const configSet = window.electronAPI?.config.set as Mock;

    expect(configSet).toHaveBeenCalledWith('explorer.aiAssistant.activeThreadId', 'thread-remote-1');

    configSet.mockClear();
    (mocks.runtime.threads.mainItem.getState as Mock).mockReturnValue({ remoteId: 'thread-remote-2' });

    mocks.threadSubscription?.();

    expect(configSet).toHaveBeenCalledWith('explorer.aiAssistant.activeThreadId', 'thread-remote-2');
  });

  it('resizes the thread list panel and persists the updated width', () => {
    (window.electronAPI?.config.get as Mock).mockImplementation((key: string) => {
      if (key === 'explorer.aiAssistant.threadListWidth') {
        return 280;
      }

      return undefined;
    });

    render(<AIAgentPanel baseUrl="http://localhost:4111/" />);

    const root = screen.getByTestId('assistant-panel-root');
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 120,
        y: 0,
        top: 0,
        left: 120,
        right: 900,
        bottom: 700,
        width: 780,
        height: 700,
        toJSON: () => ({}),
      }),
    });

    fireEvent.pointerDown(screen.getByTestId('assistant-thread-list-resize-handle'), { button: 0 });
    fireEvent.pointerMove(window, { clientX: 650 });

    expect(screen.getByTestId('assistant-thread-list-panel')).toHaveStyle({ width: '250px' });

    fireEvent.pointerUp(window);

    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('explorer.aiAssistant.threadListWidth', 250);
  });
});
