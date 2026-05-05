import type { UIMessage } from 'ai';

const DEFAULT_AGENT_BASE_URL = 'http://localhost:4111';

export type AgentStatus = {
  agentId: string;
  chatPath: string;
  model: string;
  workspaceRoot: string;
  pendingFileChanges: number;
  pendingShellCommands: number;
  providers: {
    openrouter: boolean;
    openai: boolean;
    anthropic: boolean;
    google: boolean;
  };
  mcpServers: string[];
};

export type PendingChangeKind = 'create' | 'update' | 'delete' | 'rename';
export type PendingChangeStatus = 'pending' | 'applied' | 'discarded';

export type PendingFileChange = {
  id: string;
  kind: PendingChangeKind;
  path: string;
  targetPath?: string;
  summary: string;
  content?: string;
  originalContent?: string;
  unifiedDiff: string;
  status: PendingChangeStatus;
  createdAt: string;
  updatedAt: string;
};

export type ShellCommandStatus = 'pending' | 'running' | 'completed' | 'failed' | 'discarded';

export type PendingShellCommand = {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  summary: string;
  status: ShellCommandStatus;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  createdAt: string;
  updatedAt: string;
};

export type PendingFileChangesResponse = {
  changes: PendingFileChange[];
};

export type PendingShellCommandsResponse = {
  commands: PendingShellCommand[];
};

export type AgentThreadStatus = 'regular' | 'archived';

export type AgentThread = {
  id: string;
  title?: string;
  resourceId: string | null;
  status: AgentThreadStatus;
  createdAt: string;
  updatedAt: string;
  isLegacy: boolean;
};

export type AgentThreadsResponse = {
  resourceId: string;
  threads: AgentThread[];
};

export type AgentThreadResponse = {
  thread: AgentThread;
};

export type AgentThreadMessagesResponse<TMessage = UIMessage> = {
  thread: AgentThread;
  messages: unknown[];
  uiMessages: TMessage[];
  total: number;
};

export class AgentApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'AgentApiError';
  }
}

export function normalizeAgentBaseUrl(baseUrl: string): string {
  return (baseUrl.trim() || DEFAULT_AGENT_BASE_URL).replace(/\/+$/u, '');
}

export function getPristineAgentBaseUrl(): string {
  return normalizeAgentBaseUrl(import.meta.env.VITE_PRISTINE_AGENT_URL ?? DEFAULT_AGENT_BASE_URL);
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function createJsonRequestInit(method: string, body?: unknown): RequestInit {
  return body === undefined
    ? { method }
    : {
        method,
        body: JSON.stringify(body),
      };
}

function getErrorMessageFromPayload(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  return 'Agent server request failed.';
}

export async function fetchAgentJson<T>(baseUrl: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${normalizeAgentBaseUrl(baseUrl)}${path}`, {
    ...init,
    headers,
  });
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json() as unknown
    : await response.text();

  if (!response.ok) {
    throw new AgentApiError(getErrorMessageFromPayload(payload), response.status);
  }

  return payload as T;
}

export function postAgentAction<T>(baseUrl: string, path: string): Promise<T> {
  return fetchAgentJson<T>(baseUrl, path, { method: 'POST' });
}

export function listAgentThreads(baseUrl: string): Promise<AgentThreadsResponse> {
  return fetchAgentJson<AgentThreadsResponse>(baseUrl, '/agent/threads');
}

export function getAgentThread(baseUrl: string, threadId: string): Promise<AgentThreadResponse> {
  return fetchAgentJson<AgentThreadResponse>(baseUrl, `/agent/threads/${encodePathSegment(threadId)}`);
}

export function getAgentThreadMessages<TMessage = UIMessage>(
  baseUrl: string,
  threadId: string,
): Promise<AgentThreadMessagesResponse<TMessage>> {
  return fetchAgentJson<AgentThreadMessagesResponse<TMessage>>(
    baseUrl,
    `/agent/threads/${encodePathSegment(threadId)}/messages`,
  );
}

export function renameAgentThread(baseUrl: string, threadId: string, title: string): Promise<AgentThreadResponse> {
  return fetchAgentJson<AgentThreadResponse>(
    baseUrl,
    `/agent/threads/${encodePathSegment(threadId)}`,
    createJsonRequestInit('PUT', { title }),
  );
}

export function archiveAgentThread(baseUrl: string, threadId: string): Promise<AgentThreadResponse> {
  return postAgentAction<AgentThreadResponse>(baseUrl, `/agent/threads/${encodePathSegment(threadId)}/archive`);
}

export function unarchiveAgentThread(baseUrl: string, threadId: string): Promise<AgentThreadResponse> {
  return postAgentAction<AgentThreadResponse>(baseUrl, `/agent/threads/${encodePathSegment(threadId)}/unarchive`);
}

export function deleteAgentThread(baseUrl: string, threadId: string): Promise<{ deleted: boolean; threadId: string }> {
  return fetchAgentJson<{ deleted: boolean; threadId: string }>(
    baseUrl,
    `/agent/threads/${encodePathSegment(threadId)}`,
    { method: 'DELETE' },
  );
}