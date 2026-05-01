import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useFileOutlines } from '../../../../data/mockDataLoader';
import { refreshWorkspaceGitStatus, useWorkspaceGitStatus } from '../../../git/workspaceGitStatus';
import { FileTreeNode, type ExplorerContextMenuRequest } from './FileTreeNode';
import { ExplorerPanelTabs, ExplorerToolbar, type ExplorerPanelTab } from './LeftSidePanelChrome';
import { OutlinePanel } from './LeftSidePanelOutline';
import {
  DEFAULT_STARTUP_PROJECT_NAME,
  WORKSPACE_ROOT_PATH,
  createExplorerDraftId,
  getPathBaseName,
  getWorkspaceParentPath,
  isWorkspaceRelativeFilePath,
  toTreeTestId,
  type ExplorerSelectedNode,
  type ExplorerTreeEditSession,
  type WorkspaceClipboardState,
  type WorkspaceEntryType,
  type WorkspaceEntryNameValidationResult,
  validateWorkspaceEntryName,
} from '../../../workspace/workspaceFiles';
import { useWorkspaceTree, type WorkspaceRevealRequest } from '../../../workspace/useWorkspaceTree';

interface LeftSidePanelProps {
  activeFileId: string;
  onClearWorkspaceClipboard: () => void;
  onCopyWorkspaceEntry: (targetPath: string, entryType: WorkspaceEntryType) => Promise<boolean>;
  onCreateWorkspaceFile: (targetPath: string) => Promise<void>;
  onCreateWorkspaceFolder: (targetPath: string) => Promise<void>;
  onCutWorkspaceEntry: (targetPath: string, entryType: WorkspaceEntryType) => Promise<boolean>;
  onDeleteWorkspaceEntry: (targetPath: string, entryType: 'file' | 'folder') => Promise<boolean>;
  onFileOpen: (fileId: string, fileName: string) => void;
  onFilePreview: (fileId: string, fileName: string) => void;
  onLineJump: (line: number) => void;
  onPasteWorkspaceEntry: (destinationFolderPath: string) => Promise<{
    path: string;
    entryType: WorkspaceEntryType;
  } | null>;
  onRenameWorkspaceEntry: (currentPath: string, nextPath: string, entryType: 'file' | 'folder') => Promise<void>;
  currentOutlineId: string;
  refreshToken?: number;
  revealRequest?: WorkspaceRevealRequest | null;
  onWorkspaceRefresh?: () => void;
  workspaceClipboard: WorkspaceClipboardState | null;
}

function createRealExplorerSelection(path: string, type: ExplorerSelectedNode['type']): ExplorerSelectedNode {
  return {
    id: path,
    path,
    type,
    source: 'real',
  };
}

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

function getExplorerContextMenuTargetPath(
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

type ExplorerKeyboardAction = 'rename' | 'delete' | 'copy' | 'cut' | 'paste' | 'clear-clipboard' | 'open-context-menu';

function getExplorerKeyboardAction(event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>): ExplorerKeyboardAction | null {
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

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function isMonacoTextInputKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('.monaco-editor')
    && target.closest('textarea.inputarea, .inputarea, .native-edit-context'),
  );
}

function isExplorerContextMenuTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest('[data-testid="explorer-context-menu"]'));
}

export function LeftSidePanel({
  activeFileId,
  onCreateWorkspaceFile,
  onCreateWorkspaceFolder,
  onClearWorkspaceClipboard,
  onCopyWorkspaceEntry,
  onCutWorkspaceEntry,
  onDeleteWorkspaceEntry,
  onFileOpen,
  onFilePreview,
  onLineJump,
  onPasteWorkspaceEntry,
  onRenameWorkspaceEntry,
  currentOutlineId,
  refreshToken = 0,
  revealRequest,
  onWorkspaceRefresh,
  workspaceClipboard,
}: LeftSidePanelProps) {
  type ExplorerTreeScrollLock = {
    anchorTestId: string | null;
    anchorTop: number | null;
    top: number;
    releaseAfterRefreshToken: number;
  };

  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  const treeInteractionActiveRef = useRef(false);
  const monacoDeleteSelectionArmedRef = useRef(false);
  const pendingTreeDrivenActiveFileSelectionRef = useRef<string | null>(null);
  const treeScrollLockRef = useRef<ExplorerTreeScrollLock | null>(null);
  const treeScrollLockAnimationFrameRef = useRef<number | null>(null);
  const treeScrollLockReleaseTimeoutRef = useRef<number | null>(null);
  const [selectedNode, setSelectedNode] = useState<ExplorerSelectedNode | null>(null);
  const latestSelectedNodeRef = useRef<ExplorerSelectedNode | null>(null);
  const [treeEditSession, setTreeEditSession] = useState<ExplorerTreeEditSession | null>(null);
  const [contextMenuRequest, setContextMenuRequest] = useState<ExplorerContextMenuRequest | null>(null);
  const [handledRevealRequestToken, setHandledRevealRequestToken] = useState<number | null>(null);
  const [tab, setTab] = useState<ExplorerPanelTab>('explorer');
  const fileOutlines = useFileOutlines();
  const gitStatus = useWorkspaceGitStatus();
  const {
    treeNodes,
    workspaceAvailable,
    expandedFolders,
    toggleFolder,
    refreshTree,
    collapseAll,
  } = useWorkspaceTree(revealRequest, refreshToken);

  latestSelectedNodeRef.current = selectedNode;

  const outline = fileOutlines[currentOutlineId] || [];
  const effectiveRevealRequest = revealRequest && revealRequest.token !== handledRevealRequestToken
    ? revealRequest
    : null;
  const treeEditValidation = useMemo<WorkspaceEntryNameValidationResult | null>(() => {
    if (!treeEditSession) {
      return null;
    }

    return validateWorkspaceEntryName({
      value: treeEditSession.value,
      parentPath: treeEditSession.parentPath,
      rootNodes: treeNodes,
      currentPath: treeEditSession.mode === 'rename' ? treeEditSession.targetPath : null,
    });
  }, [treeEditSession, treeNodes]);

  const focusTree = useCallback(() => {
    treeInteractionActiveRef.current = true;
    treeContainerRef.current?.focus();
  }, []);

  const syncTreeScrollLockPosition = useCallback(() => {
    const treeScrollLock = treeScrollLockRef.current;
    const treeContainer = treeContainerRef.current;

    if (!treeScrollLock || !treeContainer) {
      return false;
    }

    if (treeScrollLock.anchorTestId && treeScrollLock.anchorTop !== null) {
      const anchorElement = treeContainer.querySelector<HTMLElement>(`[data-testid="${treeScrollLock.anchorTestId}"]`);

      if (anchorElement) {
        const currentAnchorTop = Math.round(anchorElement.getBoundingClientRect().top);
        const delta = currentAnchorTop - treeScrollLock.anchorTop;

        if (delta !== 0) {
          treeContainer.scrollTop += delta;
          treeScrollLock.top = Math.round(treeContainer.scrollTop);
        }

        return true;
      }
    }

    if (Math.round(treeContainer.scrollTop) !== treeScrollLock.top) {
      treeContainer.scrollTop = treeScrollLock.top;
    }

    return true;
  }, []);

  const stopTreeScrollLockLoop = useCallback(() => {
    if (treeScrollLockAnimationFrameRef.current === null || typeof window === 'undefined') {
      return;
    }

    window.cancelAnimationFrame(treeScrollLockAnimationFrameRef.current);
    treeScrollLockAnimationFrameRef.current = null;
  }, []);

  const clearTreeScrollLockReleaseTimeout = useCallback(() => {
    if (treeScrollLockReleaseTimeoutRef.current === null || typeof window === 'undefined') {
      return;
    }

    window.clearTimeout(treeScrollLockReleaseTimeoutRef.current);
    treeScrollLockReleaseTimeoutRef.current = null;
  }, []);

  const releaseTreeScrollLock = useCallback(() => {
    clearTreeScrollLockReleaseTimeout();
    treeScrollLockRef.current = null;
    stopTreeScrollLockLoop();
  }, [clearTreeScrollLockReleaseTimeout, stopTreeScrollLockLoop]);

  const startTreeScrollLockLoop = useCallback(() => {
    if (treeScrollLockAnimationFrameRef.current !== null || typeof window === 'undefined') {
      return;
    }

    const syncScrollTop = () => {
      if (!syncTreeScrollLockPosition()) {
        treeScrollLockAnimationFrameRef.current = null;
        return;
      }

      treeScrollLockAnimationFrameRef.current = window.requestAnimationFrame(syncScrollTop);
    };

    treeScrollLockAnimationFrameRef.current = window.requestAnimationFrame(syncScrollTop);
  }, [syncTreeScrollLockPosition]);

  const armTreeScrollLockForNextRefresh = useCallback((targetPath: string) => {
    const treeContainer = treeContainerRef.current;

    if (!treeContainer) {
      treeScrollLockRef.current = null;
      stopTreeScrollLockLoop();
      clearTreeScrollLockReleaseTimeout();
      return;
    }

    const top = Math.round(treeContainer.scrollTop);
    const rowElements = Array.from(treeContainer.querySelectorAll<HTMLElement>('[data-testid^="file-tree-node-"]'));
    const targetTestId = `file-tree-node-${toTreeTestId(targetPath)}`;
    const targetIndex = rowElements.findIndex((element) => element.getAttribute('data-testid') === targetTestId);
    const anchorElement = targetIndex >= 0
      ? rowElements[targetIndex + 1] ?? rowElements[targetIndex - 1] ?? rowElements[targetIndex] ?? null
      : null;

    treeScrollLockRef.current = {
      anchorTestId: anchorElement?.getAttribute('data-testid') ?? null,
      anchorTop: anchorElement ? Math.round(anchorElement.getBoundingClientRect().top) : null,
      top,
      releaseAfterRefreshToken: refreshToken + 1,
    };
    treeContainer.scrollTop = top;
    clearTreeScrollLockReleaseTimeout();
    startTreeScrollLockLoop();
  }, [clearTreeScrollLockReleaseTimeout, refreshToken, startTreeScrollLockLoop, stopTreeScrollLockLoop]);

  const handleRevealHandled = useCallback((token: number) => {
    setHandledRevealRequestToken((current) => (current === token ? current : token));
  }, []);

  useLayoutEffect(() => {
    syncTreeScrollLockPosition();
  }, [refreshToken, selectedNode, syncTreeScrollLockPosition, treeEditSession, treeNodes, workspaceAvailable]);

  useEffect(() => {
    const treeScrollLock = treeScrollLockRef.current;

    if (!treeScrollLock || refreshToken < treeScrollLock.releaseAfterRefreshToken || typeof window === 'undefined') {
      return;
    }

    clearTreeScrollLockReleaseTimeout();
    treeScrollLockReleaseTimeoutRef.current = window.setTimeout(() => {
      releaseTreeScrollLock();
    }, 150);

    return () => {
      clearTreeScrollLockReleaseTimeout();
    };
  }, [clearTreeScrollLockReleaseTimeout, refreshToken, releaseTreeScrollLock]);

  useEffect(() => {
    return () => {
      releaseTreeScrollLock();
    };
  }, [releaseTreeScrollLock]);

  const startCopyForNode = useCallback(async (path: string, entryType: WorkspaceEntryType) => {
    setSelectedNode(createRealExplorerSelection(path, entryType));
    await onCopyWorkspaceEntry(path, entryType);
    focusTree();
  }, [focusTree, onCopyWorkspaceEntry]);

  const startCopyFromSelection = useCallback(async () => {
    const clipboardTarget = getExplorerClipboardTarget(selectedNode, activeFileId);

    if (!clipboardTarget) {
      return;
    }

    await startCopyForNode(clipboardTarget.path, clipboardTarget.type);
  }, [activeFileId, selectedNode, startCopyForNode]);

  const startCutForNode = useCallback(async (path: string, entryType: WorkspaceEntryType) => {
    setSelectedNode(createRealExplorerSelection(path, entryType));
    await onCutWorkspaceEntry(path, entryType);
    focusTree();
  }, [focusTree, onCutWorkspaceEntry]);

  const startCutFromSelection = useCallback(async () => {
    const clipboardTarget = getExplorerClipboardTarget(selectedNode, activeFileId);

    if (!clipboardTarget) {
      return;
    }

    await startCutForNode(clipboardTarget.path, clipboardTarget.type);
  }, [activeFileId, selectedNode, startCutForNode]);

  const startPasteIntoPath = useCallback(async (destinationFolderPath: string) => {
    const pastedEntry = await onPasteWorkspaceEntry(destinationFolderPath);

    if (!pastedEntry) {
      focusTree();
      return;
    }

    setSelectedNode(createRealExplorerSelection(pastedEntry.path, pastedEntry.entryType));
    monacoDeleteSelectionArmedRef.current = true;
    focusTree();
  }, [focusTree, onPasteWorkspaceEntry]);

  const startPasteForNode = useCallback(async (path: string, entryType: ExplorerSelectedNode['type']) => {
    const destinationFolderPath = entryType === 'file' ? getWorkspaceParentPath(path) : path;
    await startPasteIntoPath(destinationFolderPath);
  }, [startPasteIntoPath]);

  const startPasteFromSelection = useCallback(async () => {
    const pasteTargetPath = getExplorerPasteTargetPath(selectedNode, activeFileId);

    if (!pasteTargetPath) {
      return;
    }

    await startPasteIntoPath(pasteTargetPath);
  }, [activeFileId, selectedNode, startPasteIntoPath]);

  const clearClipboardOperation = useCallback(() => {
    if (!workspaceClipboard) {
      return;
    }

    onClearWorkspaceClipboard();
    focusTree();
  }, [focusTree, onClearWorkspaceClipboard, workspaceClipboard]);

  const openContextMenuForSelection = useCallback(() => {
    const targetPath = getExplorerContextMenuTargetPath(selectedNode, activeFileId);

    if (!targetPath) {
      return;
    }

    treeInteractionActiveRef.current = true;
    setContextMenuRequest((current) => ({
      path: targetPath,
      token: (current?.token ?? 0) + 1,
    }));
  }, [activeFileId, selectedNode]);

  const handleDocumentKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (isExplorerContextMenuTarget(event.target)) {
      return;
    }

    const keyboardAction = getExplorerKeyboardAction(event);
    const isMonacoKeyboardTarget = isMonacoTextInputKeyboardTarget(event.target);

    if (!keyboardAction) {
      if (isMonacoKeyboardTarget) {
        monacoDeleteSelectionArmedRef.current = false;
      }

      return;
    }

    const editableKeyboardTarget = isEditableKeyboardTarget(event.target);
    const deleteTarget = keyboardAction === 'delete' ? getExplorerDeleteTarget(selectedNode) : null;
    const renameTarget = keyboardAction === 'rename' ? getExplorerRenameTarget(selectedNode, activeFileId) : null;
    const clipboardTarget = keyboardAction === 'copy' || keyboardAction === 'cut'
      ? getExplorerClipboardTarget(selectedNode, activeFileId)
      : null;
    const pasteTargetPath = keyboardAction === 'paste'
      ? getExplorerPasteTargetPath(selectedNode, activeFileId)
      : null;
    const contextMenuTargetPath = keyboardAction === 'open-context-menu'
      ? getExplorerContextMenuTargetPath(selectedNode, activeFileId)
      : null;
    const allowDeleteFromMonacoSelection = Boolean(
      deleteTarget
      && isMonacoKeyboardTarget
      && monacoDeleteSelectionArmedRef.current,
    );
    const hasActionTarget = keyboardAction === 'delete'
      ? Boolean(deleteTarget)
      : keyboardAction === 'rename'
      ? Boolean(renameTarget)
      : keyboardAction === 'copy' || keyboardAction === 'cut'
      ? Boolean(clipboardTarget)
      : keyboardAction === 'paste'
      ? Boolean(workspaceClipboard && pasteTargetPath)
      : keyboardAction === 'open-context-menu'
      ? Boolean(contextMenuTargetPath)
      : Boolean(workspaceClipboard);

    if (
      tab !== 'explorer'
      || Boolean(treeEditSession)
      || !hasActionTarget
      || (!treeInteractionActiveRef.current && !allowDeleteFromMonacoSelection)
      || (editableKeyboardTarget && keyboardAction !== 'delete')
      || (editableKeyboardTarget && !allowDeleteFromMonacoSelection)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (keyboardAction === 'delete') {
      monacoDeleteSelectionArmedRef.current = false;
      void startDeleteFromSelection();
      return;
    }

    if (keyboardAction === 'rename') {
      startRenameFromSelection();
      return;
    }

    if (keyboardAction === 'copy') {
      void startCopyFromSelection();
      return;
    }

    if (keyboardAction === 'cut') {
      void startCutFromSelection();
      return;
    }

    if (keyboardAction === 'paste') {
      void startPasteFromSelection();
      return;
    }

    if (keyboardAction === 'open-context-menu') {
      openContextMenuForSelection();
      return;
    }

    clearClipboardOperation();
  });

  const handleDocumentPointerDown = useEffectEvent((event: PointerEvent) => {
    const treeContainer = treeContainerRef.current;

    if (!treeContainer) {
      treeInteractionActiveRef.current = false;
      monacoDeleteSelectionArmedRef.current = false;
      return;
    }

    if (isExplorerContextMenuTarget(event.target)) {
      return;
    }

    if (event.target instanceof Node && treeContainer.contains(event.target)) {
      return;
    }

    treeInteractionActiveRef.current = false;
    monacoDeleteSelectionArmedRef.current = false;
  });

  useEffect(() => {
    const keydownListener = (event: KeyboardEvent) => {
      handleDocumentKeyDown(event);
    };
    const pointerDownListener = (event: PointerEvent) => {
      handleDocumentPointerDown(event);
    };

    document.addEventListener('keydown', keydownListener, true);
    document.addEventListener('pointerdown', pointerDownListener, true);

    return () => {
      document.removeEventListener('keydown', keydownListener, true);
      document.removeEventListener('pointerdown', pointerDownListener, true);
    };
  }, []);

  useEffect(() => {
    if (!activeFileId || treeEditSession || !isWorkspaceRelativeFilePath(activeFileId)) {
      pendingTreeDrivenActiveFileSelectionRef.current = null;
      return;
    }

    const latestSelectedNode = latestSelectedNodeRef.current;
    const hasNewerRealSelection = Boolean(
      latestSelectedNode
      && latestSelectedNode.source === 'real'
      && latestSelectedNode.path !== activeFileId,
    );

    if (pendingTreeDrivenActiveFileSelectionRef.current === activeFileId) {
      pendingTreeDrivenActiveFileSelectionRef.current = null;

      if (hasNewerRealSelection) {
        return;
      }
    } else {
      pendingTreeDrivenActiveFileSelectionRef.current = null;
    }

    setSelectedNode(createRealExplorerSelection(activeFileId, 'file'));
  }, [activeFileId, treeEditSession]);

  const ensureFolderExpanded = useCallback((folderPath: string) => {
    if (!expandedFolders.has(folderPath)) {
      onWorkspaceRefresh?.();
      toggleFolder(folderPath);
    }
  }, [expandedFolders, onWorkspaceRefresh, toggleFolder]);

  const selectedParentPath = useMemo(() => {
    if (!selectedNode || selectedNode.source !== 'real') {
      return WORKSPACE_ROOT_PATH;
    }

    if (selectedNode.type === 'file') {
      return getWorkspaceParentPath(selectedNode.path);
    }

    return selectedNode.path;
  }, [selectedNode]);

  const handleNodeSelect = useCallback((nextNode: ExplorerSelectedNode) => {
    flushSync(() => {
      setSelectedNode(nextNode);
    });
    monacoDeleteSelectionArmedRef.current = nextNode.source === 'real' && nextNode.type !== 'root';
    focusTree();
  }, [focusTree]);

  const handleFilePreview = useCallback((fileId: string, fileName: string) => {
    pendingTreeDrivenActiveFileSelectionRef.current = fileId;
    flushSync(() => {
      setSelectedNode(createRealExplorerSelection(fileId, 'file'));
    });
    monacoDeleteSelectionArmedRef.current = true;
    onFilePreview(fileId, fileName);
    focusTree();
  }, [focusTree, onFilePreview]);

  const handleFileOpen = useCallback((fileId: string, fileName: string) => {
    pendingTreeDrivenActiveFileSelectionRef.current = fileId;
    flushSync(() => {
      setSelectedNode(createRealExplorerSelection(fileId, 'file'));
    });
    monacoDeleteSelectionArmedRef.current = true;
    onFileOpen(fileId, fileName);
    focusTree();
  }, [focusTree, onFileOpen]);

  const startRenameForNode = useCallback((path: string, entryType: 'file' | 'folder') => {
    if (path === WORKSPACE_ROOT_PATH) {
      return;
    }

    const parentPath = getWorkspaceParentPath(path);
    setSelectedNode(createRealExplorerSelection(path, entryType));
    setTreeEditSession({
      mode: 'rename',
      targetNodeId: path,
      targetPath: path,
      parentPath,
      entryType,
      source: 'real',
      value: getPathBaseName(path),
      isSubmitting: false,
      submitError: null,
    });
  }, []);

  const startRenameFromSelection = useCallback(() => {
    const renameTarget = getExplorerRenameTarget(selectedNode, activeFileId);

    if (renameTarget) {
      startRenameForNode(renameTarget.path, renameTarget.type);
    }
  }, [activeFileId, selectedNode, startRenameForNode]);

  const startDeleteForNode = useCallback(async (path: string, entryType: 'file' | 'folder') => {
    const parentPath = getWorkspaceParentPath(path);

    setSelectedNode(createRealExplorerSelection(path, entryType));
    armTreeScrollLockForNextRefresh(path);

    const deleted = await onDeleteWorkspaceEntry(path, entryType);
    if (!deleted) {
      releaseTreeScrollLock();
      focusTree();
      return;
    }

    setSelectedNode(createRealExplorerSelection(
      parentPath,
      parentPath === WORKSPACE_ROOT_PATH ? 'root' : 'folder',
    ));
    focusTree();
  }, [armTreeScrollLockForNextRefresh, focusTree, onDeleteWorkspaceEntry, releaseTreeScrollLock]);

  const startDeleteFromSelection = useCallback(async () => {
    const deleteTarget = getExplorerDeleteTarget(selectedNode);

    if (!deleteTarget) {
      return;
    }

    await startDeleteForNode(deleteTarget.path, deleteTarget.type);
  }, [selectedNode, startDeleteForNode]);

  const startCreateEntry = useCallback((entryType: 'file' | 'folder', parentPath = selectedParentPath) => {
    const resolvedParentPath = parentPath || WORKSPACE_ROOT_PATH;
    ensureFolderExpanded(resolvedParentPath);

    const draftId = createExplorerDraftId(resolvedParentPath, entryType);

    setSelectedNode({
      id: draftId,
      path: resolvedParentPath,
      type: entryType,
      source: 'draft',
    });
    setTreeEditSession({
      mode: entryType === 'file' ? 'create-file' : 'create-folder',
      targetNodeId: draftId,
      targetPath: resolvedParentPath,
      parentPath: resolvedParentPath,
      entryType,
      source: 'draft',
      value: '',
      isSubmitting: false,
      submitError: null,
    });
  }, [ensureFolderExpanded, selectedParentPath]);

  const handleCreateFile = useCallback(() => {
    startCreateEntry('file');
  }, [startCreateEntry]);

  const handleCreateFolder = useCallback(() => {
    startCreateEntry('folder');
  }, [startCreateEntry]);

  const handleRefreshExplorer = useCallback(() => {
    onWorkspaceRefresh?.();
    refreshTree();
    refreshWorkspaceGitStatus();
  }, [onWorkspaceRefresh, refreshTree]);

  const cancelTreeEdit = useCallback(() => {
    if (!treeEditSession || treeEditSession.isSubmitting) {
      return;
    }

    const nextSelection = treeEditSession.mode === 'rename'
      ? createRealExplorerSelection(treeEditSession.targetPath, treeEditSession.entryType)
      : createRealExplorerSelection(
          treeEditSession.parentPath,
          treeEditSession.parentPath === WORKSPACE_ROOT_PATH ? 'root' : 'folder',
        );

    setTreeEditSession(null);
    setSelectedNode(nextSelection);
    focusTree();
  }, [focusTree, treeEditSession]);

  const handleTreeEditValueChange = useCallback((value: string) => {
    setTreeEditSession((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        value,
        submitError: null,
      };
    });
  }, []);

  const handleTreeEditSubmit = useCallback(async () => {
    if (!treeEditSession || treeEditSession.isSubmitting) {
      return;
    }

    if (!treeEditValidation?.isValid || !treeEditValidation.nextPath) {
      if (treeEditSession.mode !== 'rename') {
        cancelTreeEdit();
      }
      return;
    }

    if (treeEditSession.mode === 'rename' && treeEditValidation.nextPath === treeEditSession.targetPath) {
      setTreeEditSession(null);
      setSelectedNode(createRealExplorerSelection(treeEditSession.targetPath, treeEditSession.entryType));
      focusTree();
      return;
    }

    setTreeEditSession((current) => (current ? {
      ...current,
      isSubmitting: true,
      submitError: null,
    } : current));

    try {
      if (treeEditSession.mode === 'rename') {
        armTreeScrollLockForNextRefresh(treeEditSession.targetPath);
      }

      if (treeEditSession.mode === 'rename') {
        await onRenameWorkspaceEntry(
          treeEditSession.targetPath,
          treeEditValidation.nextPath,
          treeEditSession.entryType,
        );
        setSelectedNode(createRealExplorerSelection(treeEditValidation.nextPath, treeEditSession.entryType));
      } else if (treeEditSession.mode === 'create-file') {
        await onCreateWorkspaceFile(treeEditValidation.nextPath);
        setSelectedNode(createRealExplorerSelection(treeEditValidation.nextPath, 'file'));
      } else {
        await onCreateWorkspaceFolder(treeEditValidation.nextPath);
        setSelectedNode(createRealExplorerSelection(treeEditValidation.nextPath, 'folder'));
      }

      setTreeEditSession(null);
      focusTree();
    } catch (error: unknown) {
      releaseTreeScrollLock();
      const message = error instanceof Error ? error.message : 'Unable to complete explorer action.';
      setTreeEditSession((current) => (current ? {
        ...current,
        isSubmitting: false,
        submitError: message,
      } : current));
    }
  }, [
    cancelTreeEdit,
    focusTree,
    onCreateWorkspaceFile,
    onCreateWorkspaceFolder,
    onRenameWorkspaceEntry,
    armTreeScrollLockForNextRefresh,
    releaseTreeScrollLock,
    treeEditSession,
    treeEditValidation,
  ]);

  const handleTreeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (tab !== 'explorer' || treeEditSession) {
      return;
    }

    if (isExplorerContextMenuTarget(event.target)) {
      return;
    }

    const keyboardAction = getExplorerKeyboardAction(event.nativeEvent);
    const clipboardTarget = keyboardAction === 'copy' || keyboardAction === 'cut'
      ? getExplorerClipboardTarget(selectedNode, activeFileId)
      : null;
    const pasteTargetPath = keyboardAction === 'paste'
      ? getExplorerPasteTargetPath(selectedNode, activeFileId)
      : null;
    const contextMenuTargetPath = keyboardAction === 'open-context-menu'
      ? getExplorerContextMenuTargetPath(selectedNode, activeFileId)
      : null;

    if (keyboardAction === 'delete' && getExplorerDeleteTarget(selectedNode)) {
      event.preventDefault();
      void startDeleteFromSelection();
      return;
    }

    if (keyboardAction === 'rename' && getExplorerRenameTarget(selectedNode, activeFileId)) {
      event.preventDefault();
      startRenameFromSelection();
      return;
    }

    if (keyboardAction === 'copy' && clipboardTarget) {
      event.preventDefault();
      void startCopyFromSelection();
      return;
    }

    if (keyboardAction === 'cut' && clipboardTarget) {
      event.preventDefault();
      void startCutFromSelection();
      return;
    }

    if (keyboardAction === 'paste' && workspaceClipboard && pasteTargetPath) {
      event.preventDefault();
      void startPasteFromSelection();
      return;
    }

    if (keyboardAction === 'open-context-menu' && contextMenuTargetPath) {
      event.preventDefault();
      openContextMenuForSelection();
      return;
    }

    if (keyboardAction === 'clear-clipboard' && workspaceClipboard) {
      event.preventDefault();
      clearClipboardOperation();
    }
  }, [
    activeFileId,
    clearClipboardOperation,
    selectedNode,
    startCopyFromSelection,
    startCutFromSelection,
    startDeleteFromSelection,
    openContextMenuForSelection,
    startPasteFromSelection,
    startRenameFromSelection,
    tab,
    treeEditSession,
    workspaceClipboard,
  ]);

  return (
    <div className="flex flex-col h-full bg-muted/40 overflow-hidden">
      <ExplorerPanelTabs activeTab={tab} onTabChange={setTab} />

      {/* Explorer */}
      {tab === 'explorer' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <ExplorerToolbar
            projectName={DEFAULT_STARTUP_PROJECT_NAME}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onRefresh={handleRefreshExplorer}
            onCollapseAll={collapseAll}
          />
          <div
            ref={treeContainerRef}
            tabIndex={0}
            className="explorer-tree-scrollbar flex-1 overflow-y-auto overflow-x-hidden outline-none [overflow-anchor:none]"
            onKeyDown={handleTreeKeyDown}
          >
            {workspaceAvailable === null && (
              <div className="px-4 py-3 text-muted-foreground text-[12px]">Loading workspace...</div>
            )}
            {workspaceAvailable === false && (
              <div className="px-4 py-3 text-muted-foreground text-[12px]">No workspace files available</div>
            )}
            {workspaceAvailable && treeNodes.map((node) => (
              <FileTreeNode
                key={node.id}
                node={node}
                depth={0}
                activeFileId={activeFileId}
                onFileOpen={handleFileOpen}
                onFilePreview={handleFilePreview}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
                onCancelEdit={cancelTreeEdit}
                onEditValueChange={handleTreeEditValueChange}
                onSelectNode={handleNodeSelect}
                onStartCreateFile={startCreateEntry}
                onStartCreateFolder={startCreateEntry}
                onStartCopy={startCopyForNode}
                onStartCut={startCutForNode}
                onStartDelete={startDeleteForNode}
                onStartPaste={startPasteForNode}
                onStartRename={startRenameForNode}
                onSubmitEdit={handleTreeEditSubmit}
                selectedNode={selectedNode}
                treeEditSession={treeEditSession}
                treeEditValidation={treeEditValidation}
                workspaceClipboard={workspaceClipboard}
                onTreeInteract={focusTree}
                onRequestTreeFocus={focusTree}
                contextMenuRequest={contextMenuRequest}
                gitPathStates={gitStatus.pathStates}
                revealRequest={effectiveRevealRequest}
                onRevealHandled={handleRevealHandled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Outline */}
      {tab === 'outline' && (
        <OutlinePanel
          currentOutlineId={currentOutlineId}
          outline={outline}
          onLineJump={onLineJump}
        />
      )}
    </div>
  );
}
