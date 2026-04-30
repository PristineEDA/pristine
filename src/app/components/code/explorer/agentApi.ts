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