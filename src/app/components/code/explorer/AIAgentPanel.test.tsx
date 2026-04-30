import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AIAgentPanel } from './AIAgentPanel';

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
  PristineAssistantThread: () => <div data-testid="assistant-thread" />,
}));

const statusResponse = {
  agentId: 'pristineAgent',
  chatPath: '/chat/pristineAgent',
  model: 'openrouter/openrouter/free',
  workspaceRoot: 'C:/workspace/pristine',
  pendingFileChanges: 1,
  pendingShellCommands: 1,
  providers: {
    openrouter: true,
    openai: false,
    anthropic: false,
    google: false,
  },
  mcpServers: ['filesystem'],
};

const pendingChangesResponse = {
  changes: [
    {
      id: 'change-1',
      kind: 'update',
      path: 'src/foo.ts',
      summary: 'Update foo helper',
      unifiedDiff: '--- src/foo.ts\n+++ src/foo.ts\n@@\n-old\n+new',
      status: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

const pendingCommandsResponse = {
  commands: [
    {
      id: 'command-1',
      command: 'pnpm',
      args: ['typecheck'],
      cwd: '.',
      summary: 'Run typecheck',
      status: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  }));
}

describe('AIAgentPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (method === 'GET' && url.endsWith('/agent/status')) {
        return jsonResponse(statusResponse);
      }

      if (method === 'GET' && url.endsWith('/agent/pending-changes')) {
        return jsonResponse(pendingChangesResponse);
      }

      if (method === 'GET' && url.endsWith('/agent/shell-commands')) {
        return jsonResponse(pendingCommandsResponse);
      }

      if (method === 'POST' && url.endsWith('/agent/pending-changes/change-1/apply')) {
        return jsonResponse({ change: { ...pendingChangesResponse.changes[0], status: 'applied' } });
      }

      if (method === 'POST' && url.endsWith('/agent/shell-commands/command-1/run')) {
        return jsonResponse({ command: { ...pendingCommandsResponse.commands[0], status: 'completed' } });
      }

      return Promise.resolve(new Response('not found', { status: 404 }));
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the real agent shell and approved action buffers', async () => {
    render(<AIAgentPanel baseUrl="http://localhost:4111/" />);

    expect(screen.getByText('Pristine Agent')).toBeInTheDocument();
    expect(screen.getByTestId('assistant-thread')).toBeInTheDocument();

    expect(await screen.findByText('openrouter/openrouter/free')).toBeInTheDocument();
    expect(screen.getByText('OpenRouter')).toHaveClass('text-ide-success');
    expect(screen.getByText('MCP 1')).toBeInTheDocument();

    expect(screen.getByText('Update foo helper')).toBeInTheDocument();
    expect(screen.getByText('Run typecheck')).toBeInTheDocument();
    expect(screen.getByText(/--- src\/foo\.ts/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:4111/agent/pending-changes/change-1/apply',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /run/i }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:4111/agent/shell-commands/command-1/run',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});