import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { getAgentThreadMessages } from './agentApi';
import { createPristineChatRequestBody, usePristineThreadMessagesBootstrap } from './pristineThreadRuntime';

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

  it('writes the active thread under Mastra memory options', () => {
    const requestBody = createPristineChatRequestBody({
      body: {
        config: { model: 'test-model' },
        memory: { resource: 'pristine:workspace:c:/workspace/pristine' },
      },
      id: 'thread-1',
      messageId: 'message-1',
      messages: [],
      requestMetadata: { source: 'test' },
      trigger: 'submit-message',
    });

    expect(requestBody).toMatchObject({
      config: { model: 'test-model' },
      memory: {
        resource: 'pristine:workspace:c:/workspace/pristine',
        thread: 'thread-1',
      },
      messageId: 'message-1',
      messages: [],
      metadata: { source: 'test' },
      trigger: 'submit-message',
    });
    expect(requestBody).not.toHaveProperty('threadId');
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
      threadId: '__optimistic__thread-1',
      remoteId: '__optimistic__thread-1',
      setMessages,
    }));

    await waitFor(() => {
      expect(getAgentThreadMessages).not.toHaveBeenCalled();
    });
    expect(setMessages).not.toHaveBeenCalled();
  });
});