import { useEffect, useSyncExternalStore } from 'react';
import type { WorkspaceGitPathState, WorkspaceGitStatusPayload } from '../../../types/workspace-git';
import { normalizeWorkspacePath } from '../workspace/workspaceFiles';

export interface WorkspaceGitSnapshot extends WorkspaceGitStatusPayload {
  isLoading: boolean;
}

const EMPTY_WORKSPACE_GIT_STATUS: WorkspaceGitStatusPayload = {
  branchName: null,
  hasProjectFiles: false,
  isGitRepo: false,
  pathStates: {},
};

let currentSnapshot: WorkspaceGitSnapshot = {
  ...EMPTY_WORKSPACE_GIT_STATUS,
  isLoading: false,
};

const listeners = new Set<() => void>();
let inFlightLoad: Promise<void> | null = null;

function emitChange() {
  listeners.forEach((listener) => listener());
}

function normalizePathStates(pathStates: Record<string, WorkspaceGitPathState>): Record<string, WorkspaceGitPathState> {
  return Object.entries(pathStates).reduce<Record<string, WorkspaceGitPathState>>((current, [path, state]) => {
    const normalizedPath = normalizeWorkspacePath(path.replace(/\/$/, ''));

    if (normalizedPath !== '.') {
      current[normalizedPath] = state;
    }

    return current;
  }, {});
}

async function loadWorkspaceGitStatus(force = false): Promise<void> {
  if (inFlightLoad && !force) {
    return inFlightLoad;
  }

  const gitApi = window.electronAPI?.git;
  if (!gitApi) {
    currentSnapshot = {
      ...EMPTY_WORKSPACE_GIT_STATUS,
      isLoading: false,
      pathStates: {},
    };
    emitChange();
    return;
  }

  currentSnapshot = {
    ...currentSnapshot,
    isLoading: true,
  };
  emitChange();

  const nextLoad = gitApi.getStatus()
    .then((nextStatus) => {
      currentSnapshot = {
        ...nextStatus,
        isLoading: false,
        pathStates: normalizePathStates(nextStatus.pathStates),
      };
    })
    .catch(() => {
      currentSnapshot = {
        ...EMPTY_WORKSPACE_GIT_STATUS,
        isLoading: false,
        pathStates: {},
      };
    })
    .finally(() => {
      inFlightLoad = null;
      emitChange();
    });

  inFlightLoad = nextLoad;
  return nextLoad;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getWorkspaceGitBranchLabel(snapshot: WorkspaceGitSnapshot): string {
  if (!snapshot.hasProjectFiles || !snapshot.isGitRepo || !snapshot.branchName) {
    return 'git';
  }

  return snapshot.branchName;
}

export function getWorkspaceGitPathState(
  snapshot: WorkspaceGitSnapshot,
  path: string,
): WorkspaceGitPathState | undefined {
  if (!path) {
    return undefined;
  }

  return snapshot.pathStates[normalizeWorkspacePath(path)];
}

export function refreshWorkspaceGitStatus() {
  void loadWorkspaceGitStatus(true);
}

export function resetWorkspaceGitStatusStoreForTests() {
  currentSnapshot = {
    ...EMPTY_WORKSPACE_GIT_STATUS,
    isLoading: false,
    pathStates: {},
  };
  inFlightLoad = null;
  listeners.clear();
}

export function useWorkspaceGitStatus(): WorkspaceGitSnapshot {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => currentSnapshot,
    () => currentSnapshot,
  );

  useEffect(() => {
    void loadWorkspaceGitStatus();
  }, []);

  return snapshot;
}