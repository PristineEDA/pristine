import {
  getWorkspaceParentPath,
  isWorkspaceRelativeFilePath,
  type ExplorerSelectedNode,
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
