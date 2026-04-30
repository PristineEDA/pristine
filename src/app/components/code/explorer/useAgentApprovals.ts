import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchAgentJson,
  postAgentAction,
  type AgentStatus,
  type PendingFileChange,
  type PendingFileChangesResponse,
  type PendingShellCommand,
  type PendingShellCommandsResponse,
} from './agentApi';

const AGENT_POLL_INTERVAL_MS = 4000;

export type AgentApprovalSnapshot = {
  status: AgentStatus | null;
  changes: PendingFileChange[];
  commands: PendingShellCommand[];
  isLoading: boolean;
  error: string | null;
};

const initialSnapshot: AgentApprovalSnapshot = {
  status: null,
  changes: [],
  commands: [],
  isLoading: true,
  error: null,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Agent server is unavailable.';
}

export function useAgentApprovals(baseUrl: string) {
  const mountedRef = useRef(true);
  const [snapshot, setSnapshot] = useState<AgentApprovalSnapshot>(initialSnapshot);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setSnapshot((current) => ({ ...current, isLoading: true }));
    }

    try {
      const [status, changesResponse, commandsResponse] = await Promise.all([
        fetchAgentJson<AgentStatus>(baseUrl, '/agent/status'),
        fetchAgentJson<PendingFileChangesResponse>(baseUrl, '/agent/pending-changes'),
        fetchAgentJson<PendingShellCommandsResponse>(baseUrl, '/agent/shell-commands'),
      ]);

      if (!mountedRef.current) {
        return;
      }

      setSnapshot({
        status,
        changes: changesResponse.changes,
        commands: commandsResponse.commands,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setSnapshot((current) => ({
        ...current,
        isLoading: false,
        error: getErrorMessage(error),
      }));
    }
  }, [baseUrl]);

  useEffect(() => {
    void refresh(true);
    const pollId = window.setInterval(() => {
      void refresh();
    }, AGENT_POLL_INTERVAL_MS);

    return () => window.clearInterval(pollId);
  }, [refresh]);

  const runAction = useCallback(async (actionId: string, action: () => Promise<unknown>) => {
    setBusyActionId(actionId);

    try {
      await action();
      await refresh();
    } catch (error) {
      setSnapshot((current) => ({
        ...current,
        error: getErrorMessage(error),
      }));
    } finally {
      if (mountedRef.current) {
        setBusyActionId(null);
      }
    }
  }, [refresh]);

  const applyChange = useCallback((changeId: string) => runAction(
    `change:${changeId}:apply`,
    () => postAgentAction(baseUrl, `/agent/pending-changes/${encodeURIComponent(changeId)}/apply`),
  ), [baseUrl, runAction]);

  const discardChange = useCallback((changeId: string) => runAction(
    `change:${changeId}:discard`,
    () => postAgentAction(baseUrl, `/agent/pending-changes/${encodeURIComponent(changeId)}/discard`),
  ), [baseUrl, runAction]);

  const runCommand = useCallback((commandId: string) => runAction(
    `command:${commandId}:run`,
    () => postAgentAction(baseUrl, `/agent/shell-commands/${encodeURIComponent(commandId)}/run`),
  ), [baseUrl, runAction]);

  const discardCommand = useCallback((commandId: string) => runAction(
    `command:${commandId}:discard`,
    () => postAgentAction(baseUrl, `/agent/shell-commands/${encodeURIComponent(commandId)}/discard`),
  ), [baseUrl, runAction]);

  return {
    snapshot,
    busyActionId,
    refresh: () => refresh(true),
    applyChange,
    discardChange,
    runCommand,
    discardCommand,
  };
}