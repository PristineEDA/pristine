import type { WorkspaceGitPathState } from '../../../../../types/workspace-git';
import {
  WORKSPACE_ROOT_PATH,
  type WorkspaceTreeNode,
} from '../../../workspace/workspaceFiles';

type ExplorerGitIndicatorState = Exclude<WorkspaceGitPathState, 'ignored'>;

const EXPLORER_GIT_INDICATOR_ORDER: ExplorerGitIndicatorState[] = ['created', 'modified', 'deleted'];

function isExplorerGitIndicatorState(
  state: WorkspaceGitPathState | undefined,
): state is ExplorerGitIndicatorState {
  return state === 'created' || state === 'modified' || state === 'deleted';
}

function getExplorerGitToneClassName(state: ExplorerGitIndicatorState): string {
  if (state === 'created') {
    return 'text-ide-success';
  }

  if (state === 'deleted') {
    return 'text-ide-error';
  }

  return 'text-ide-warning';
}

export function getExplorerGitIndicatorStates(
  node: WorkspaceTreeNode,
  gitPathStates: Record<string, WorkspaceGitPathState>,
): ExplorerGitIndicatorState[] {
  if (node.type === 'file') {
    const directState = gitPathStates[node.path];
    return isExplorerGitIndicatorState(directState) ? [directState] : [];
  }

  const matchingStates = new Set<ExplorerGitIndicatorState>();
  const nodePathPrefix = node.path === WORKSPACE_ROOT_PATH ? '' : `${node.path}/`;

  Object.entries(gitPathStates).forEach(([path, state]) => {
    if (!isExplorerGitIndicatorState(state)) {
      return;
    }

    if (node.path === WORKSPACE_ROOT_PATH || path === node.path || path.startsWith(nodePathPrefix)) {
      matchingStates.add(state);
    }
  });

  return EXPLORER_GIT_INDICATOR_ORDER.filter((state) => matchingStates.has(state));
}

export function getExplorerGitLabelClassName(
  directGitPathState: WorkspaceGitPathState | undefined,
  indicatorStates: ExplorerGitIndicatorState[],
): string {
  if (directGitPathState === 'ignored') {
    return 'text-ide-text-muted-stronger dark:text-ide-text-muted';
  }

  const dominantState = indicatorStates[0];
  if (dominantState) {
    return getExplorerGitToneClassName(dominantState);
  }

  return 'text-foreground';
}

export function ExplorerGitIndicators({
  indicatorStates,
  testId,
}: {
  indicatorStates: ExplorerGitIndicatorState[];
  testId: string;
}) {
  if (indicatorStates.length === 0) {
    return null;
  }

  return (
    <span
      data-testid={`file-tree-git-indicators-${testId}`}
      className="ml-auto flex shrink-0 items-center gap-1.5 pr-2"
    >
      {indicatorStates.map((state) => (
        <span
          key={state}
          data-testid={`file-tree-git-indicator-${state}-${testId}`}
          className={`relative flex h-2.5 w-2.5 items-center justify-center rounded-full ${getExplorerGitToneClassName(state)}`}
        >
          <span className="absolute inset-0 rounded-full border border-current/80" />
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ))}
    </span>
  );
}
