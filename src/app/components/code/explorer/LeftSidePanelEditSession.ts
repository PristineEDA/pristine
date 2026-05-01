import {
  WORKSPACE_ROOT_PATH,
  createExplorerDraftId,
  getPathBaseName,
  getWorkspaceParentPath,
  type ExplorerSelectedNode,
  type ExplorerTreeEditSession,
} from '../../../workspace/workspaceFiles';

export function createRealExplorerSelection(
  path: string,
  type: ExplorerSelectedNode['type'],
): ExplorerSelectedNode {
  return {
    id: path,
    path,
    type,
    source: 'real',
  };
}

export function createExplorerRenameEditState({
  entryType,
  path,
}: {
  entryType: 'file' | 'folder';
  path: string;
}): { selectedNode: ExplorerSelectedNode; treeEditSession: ExplorerTreeEditSession } | null {
  if (path === WORKSPACE_ROOT_PATH) {
    return null;
  }

  const parentPath = getWorkspaceParentPath(path);

  return {
    selectedNode: createRealExplorerSelection(path, entryType),
    treeEditSession: {
      mode: 'rename',
      targetNodeId: path,
      targetPath: path,
      parentPath,
      entryType,
      source: 'real',
      value: getPathBaseName(path),
      isSubmitting: false,
      submitError: null,
    },
  };
}

export function createExplorerDraftEditState({
  entryType,
  parentPath,
}: {
  entryType: 'file' | 'folder';
  parentPath: string;
}): { selectedNode: ExplorerSelectedNode; treeEditSession: ExplorerTreeEditSession } {
  const resolvedParentPath = parentPath || WORKSPACE_ROOT_PATH;
  const draftId = createExplorerDraftId(resolvedParentPath, entryType);

  return {
    selectedNode: {
      id: draftId,
      path: resolvedParentPath,
      type: entryType,
      source: 'draft',
    },
    treeEditSession: {
      mode: entryType === 'file' ? 'create-file' : 'create-folder',
      targetNodeId: draftId,
      targetPath: resolvedParentPath,
      parentPath: resolvedParentPath,
      entryType,
      source: 'draft',
      value: '',
      isSubmitting: false,
      submitError: null,
    },
  };
}

export function getExplorerEditCancelSelection(
  treeEditSession: ExplorerTreeEditSession,
): ExplorerSelectedNode {
  if (treeEditSession.mode === 'rename') {
    return createRealExplorerSelection(treeEditSession.targetPath, treeEditSession.entryType);
  }

  return createRealExplorerSelection(
    treeEditSession.parentPath,
    treeEditSession.parentPath === WORKSPACE_ROOT_PATH ? 'root' : 'folder',
  );
}
