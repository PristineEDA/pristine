import {
  getWorkspaceParentPath,
  isWorkspaceRelativeFilePath,
  type ExplorerSelectedNode,
  type WorkspaceClipboardState,
  type WorkspaceEntryType,
} from '../../../workspace/workspaceFiles';

export type ExplorerKeyboardAction =
  | 'rename'
  | 'delete'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'clear-clipboard'
  | 'open-context-menu';

export function getExplorerRenameTarget(
  selectedNode: ExplorerSelectedNode | null,
  activeFileId: string,
): { path: string; type: 'file' | 'folder' } | null {
  if (selectedNode?.source === 'real' && selectedNode.type !== 'root') {
    return {
      path: selectedNode.path,
      type: selectedNode.type,
    };
  }

  if (isWorkspaceRelativeFilePath(activeFileId)) {
    return {
      path: activeFileId,
      type: 'file',
    };
  }

  return null;
}

export function getExplorerClipboardTarget(
  selectedNode: ExplorerSelectedNode | null,
  activeFileId: string,
): { path: string; type: WorkspaceEntryType } | null {
  if (selectedNode?.source === 'real' && selectedNode.type !== 'root') {
    return {
      path: selectedNode.path,
      type: selectedNode.type,
    };
  }

  if (isWorkspaceRelativeFilePath(activeFileId)) {
    return {
      path: activeFileId,
      type: 'file',
    };
  }

  return null;
}

export function getExplorerPasteTargetPath(
  selectedNode: ExplorerSelectedNode | null,
  activeFileId: string,
): string | null {
  if (selectedNode?.source === 'real') {
    if (selectedNode.type === 'file') {
      return getWorkspaceParentPath(selectedNode.path);
    }

    return selectedNode.path;
  }

  if (isWorkspaceRelativeFilePath(activeFileId)) {
    return getWorkspaceParentPath(activeFileId);
  }

  return null;
}

export function getExplorerContextMenuTargetPath(
  selectedNode: ExplorerSelectedNode | null,
  activeFileId: string,
): string | null {
  if (selectedNode?.source === 'real') {
    return selectedNode.path;
  }

  if (isWorkspaceRelativeFilePath(activeFileId)) {
    return activeFileId;
  }

  return null;
}

export function getExplorerKeyboardAction(
  event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
): ExplorerKeyboardAction | null {
  const normalizedKey = event.key.toLowerCase();
  const hasPrimaryModifier = (event.ctrlKey || event.metaKey) && !(event.ctrlKey && event.metaKey);

  if (!event.altKey && !event.shiftKey && hasPrimaryModifier) {
    if (normalizedKey === 'c') {
      return 'copy';
    }

    if (normalizedKey === 'x') {
      return 'cut';
    }

    if (normalizedKey === 'v') {
      return 'paste';
    }

    return null;
  }

  if (!event.altKey && !event.ctrlKey && !event.metaKey && event.shiftKey && event.key === 'F10') {
    return 'open-context-menu';
  }

  if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key === 'ContextMenu') {
    return 'open-context-menu';
  }

  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return null;
  }

  if (event.key === 'F2') {
    return 'rename';
  }

  if (event.key === 'Delete') {
    return 'delete';
  }

  if (event.key === 'Escape') {
    return 'clear-clipboard';
  }

  return null;
}

export function getExplorerDeleteTarget(
  selectedNode: ExplorerSelectedNode | null,
): { path: string; type: 'file' | 'folder' } | null {
  if (selectedNode?.source === 'real' && selectedNode.type !== 'root') {
    return {
      path: selectedNode.path,
      type: selectedNode.type,
    };
  }

  return null;
}

export interface ExplorerKeyboardActionTargets {
  clipboardTarget: { path: string; type: WorkspaceEntryType } | null;
  contextMenuTargetPath: string | null;
  deleteTarget: { path: string; type: 'file' | 'folder' } | null;
  pasteTargetPath: string | null;
  renameTarget: { path: string; type: 'file' | 'folder' } | null;
}

export function getExplorerKeyboardActionTargets({
  activeFileId,
  keyboardAction,
  selectedNode,
}: {
  activeFileId: string;
  keyboardAction: ExplorerKeyboardAction | null;
  selectedNode: ExplorerSelectedNode | null;
}): ExplorerKeyboardActionTargets {
  return {
    clipboardTarget: keyboardAction === 'copy' || keyboardAction === 'cut'
      ? getExplorerClipboardTarget(selectedNode, activeFileId)
      : null,
    contextMenuTargetPath: keyboardAction === 'open-context-menu'
      ? getExplorerContextMenuTargetPath(selectedNode, activeFileId)
      : null,
    deleteTarget: keyboardAction === 'delete'
      ? getExplorerDeleteTarget(selectedNode)
      : null,
    pasteTargetPath: keyboardAction === 'paste'
      ? getExplorerPasteTargetPath(selectedNode, activeFileId)
      : null,
    renameTarget: keyboardAction === 'rename'
      ? getExplorerRenameTarget(selectedNode, activeFileId)
      : null,
  };
}

export function hasExplorerKeyboardActionTarget({
  keyboardAction,
  targets,
  workspaceClipboard,
}: {
  keyboardAction: ExplorerKeyboardAction | null;
  targets: ExplorerKeyboardActionTargets;
  workspaceClipboard: WorkspaceClipboardState | null;
}): boolean {
  if (keyboardAction === 'delete') {
    return Boolean(targets.deleteTarget);
  }

  if (keyboardAction === 'rename') {
    return Boolean(targets.renameTarget);
  }

  if (keyboardAction === 'copy' || keyboardAction === 'cut') {
    return Boolean(targets.clipboardTarget);
  }

  if (keyboardAction === 'paste') {
    return Boolean(workspaceClipboard && targets.pasteTargetPath);
  }

  if (keyboardAction === 'open-context-menu') {
    return Boolean(targets.contextMenuTargetPath);
  }

  if (keyboardAction === 'clear-clipboard') {
    return Boolean(workspaceClipboard);
  }

  return false;
}

export function canRunExplorerDocumentKeyboardAction({
  allowDeleteFromMonacoSelection,
  editableKeyboardTarget,
  hasActionTarget,
  keyboardAction,
  tabIsExplorer,
  treeEditActive,
  treeInteractionActive,
}: {
  allowDeleteFromMonacoSelection: boolean;
  editableKeyboardTarget: boolean;
  hasActionTarget: boolean;
  keyboardAction: ExplorerKeyboardAction;
  tabIsExplorer: boolean;
  treeEditActive: boolean;
  treeInteractionActive: boolean;
}): boolean {
  if (!tabIsExplorer || treeEditActive || !hasActionTarget) {
    return false;
  }

  if (!treeInteractionActive && !allowDeleteFromMonacoSelection) {
    return false;
  }

  if (editableKeyboardTarget && keyboardAction !== 'delete') {
    return false;
  }

  if (editableKeyboardTarget && !allowDeleteFromMonacoSelection) {
    return false;
  }

  return true;
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

export function isMonacoTextInputKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('.monaco-editor')
    && target.closest('textarea.inputarea, .inputarea, .native-edit-context'),
  );
}

export function isExplorerContextMenuTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest('[data-testid="explorer-context-menu"]'));
}
