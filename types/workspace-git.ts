export type WorkspaceGitPathState = 'modified' | 'ignored';

export interface WorkspaceGitStatusPayload {
  branchName: string | null;
  hasProjectFiles: boolean;
  isGitRepo: boolean;
  pathStates: Record<string, WorkspaceGitPathState>;
}