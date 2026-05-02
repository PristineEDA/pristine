import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

import { AIAgentPanel } from './AIAgentPanel';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';

const mocks = vi.hoisted(() => ({
  pristineAssistantThread: vi.fn(({ agentBaseUrl }: { agentBaseUrl?: string }) => (
    <div data-agent-base-url={agentBaseUrl} data-testid="assistant-thread" />
  )),
}));

vi.mock('@assistant-ui/react', () => ({
  AssistantRuntimeProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="assistant-runtime">{children}</div>
  ),
}));

vi.mock('@assistant-ui/react-ai-sdk', () => ({
  AssistantChatTransport: class AssistantChatTransportMock {
    constructor(readonly options: { api: string }) {}
  },
  useChatRuntime: vi.fn(() => ({ thread: {} })),
}));

vi.mock('../../assistant/PristineAssistantThread', () => ({
  PristineAssistantThread: mocks.pristineAssistantThread,
}));

describe('AIAgentPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the real agent shell and passes the normalized agent URL to the thread', () => {
    render(<AIAgentPanel baseUrl="http://localhost:4111/" />);

    expect(screen.getByText('Pristine Agent')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-thread')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-thread')).toHaveAttribute('data-agent-base-url', 'http://localhost:4111');
    expect(mocks.pristineAssistantThread).toHaveBeenCalledWith(
      expect.objectContaining({ agentBaseUrl: 'http://localhost:4111' }),
      undefined,
    );
    expect((useChatRuntime as Mock).mock.calls[0]?.[0].transport.options.api).toBe(
      'http://localhost:4111/chat/pristineAgent',
    );
  });
});
