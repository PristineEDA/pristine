export type WorkspaceGitPathState = 'created' | 'modified' | 'deleted' | 'ignored';

export interface WorkspaceGitChangeEvent {
  refreshGitStatus: boolean;
  refreshWorkspaceTree: boolean;
}

export interface WorkspaceGitStatusPayload {
  branchName: string | null;
  hasProjectFiles: boolean;
  isGitRepo: boolean;
  pathStates: Record<string, WorkspaceGitPathState>;
}