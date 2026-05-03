import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { getAgentThreadMessages } from './agentApi';
import { usePristineThreadMessagesBootstrap } from './pristineThreadRuntime';

vi.mock('./agentApi', async () => {
  const actual = await vi.importActual<typeof import('./agentApi')>('./agentApi');

  return {
    ...actual,
    getAgentThreadMessages: vi.fn(),
  };
});

describe('usePristineThreadMessagesBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads persisted messages for existing remote threads', async () => {
    const setMessages = vi.fn();

    (getAgentThreadMessages as Mock).mockResolvedValue({
      uiMessages: [{ id: 'message-1', role: 'assistant', parts: [] }],
      messages: [],
      total: 1,
      thread: {
        id: 'thread-1',
        title: 'Thread 1',
        resourceId: 'pristine:workspace:c:/workspace/pristine',
        status: 'regular',
        createdAt: '2026-05-03T09:00:00.000Z',
        updatedAt: '2026-05-03T09:00:00.000Z',
        isLegacy: false,
      },
    });

    renderHook(() => usePristineThreadMessagesBootstrap({
      baseUrl: 'http://localhost:4111',
      threadId: 'thread-1',
      remoteId: 'thread-1',
      setMessages,
    }));

    await waitFor(() => {
      expect(getAgentThreadMessages).toHaveBeenCalledWith('http://localhost:4111', 'thread-1');
    });

    expect(setMessages).toHaveBeenNthCalledWith(1, []);
    await waitFor(() => {
      expect(setMessages).toHaveBeenLastCalledWith([{ id: 'message-1', role: 'assistant', parts: [] }]);
    });
  });

  it('skips persisted bootstrap for freshly initialized local threads', async () => {
    const setMessages = vi.fn();

    renderHook(() => usePristineThreadMessagesBootstrap({
      baseUrl: 'http://localhost:4111',
      threadId: '__LOCALID_thread-1',
      remoteId: 'thread-1',
      setMessages,
    }));

    await waitFor(() => {
      expect(getAgentThreadMessages).not.toHaveBeenCalled();
    });
    expect(setMessages).not.toHaveBeenCalled();
  });
});