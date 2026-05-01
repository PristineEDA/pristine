import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useFileOutlines } from '../../../../data/mockDataLoader';
import { refreshWorkspaceGitStatus, useWorkspaceGitStatus } from '../../../git/workspaceGitStatus';
import { FileTreeNode, type ExplorerContextMenuRequest } from './FileTreeNode';
import { ExplorerPanelTabs, ExplorerToolbar, type ExplorerPanelTab } from './LeftSidePanelChrome';
import { OutlinePanel } from './LeftSidePanelOutline';
import {
  DEFAULT_STARTUP_PROJECT_NAME,
  WORKSPACE_ROOT_PATH,
  getWorkspaceParentPath,
  isWorkspaceRelativeFilePath,
  type ExplorerSelectedNode,
  type ExplorerTreeEditSession,
  type WorkspaceClipboardState,
  type WorkspaceEntryType,
  type WorkspaceEntryNameValidationResult,
  validateWorkspaceEntryName,
} from '../../../workspace/workspaceFiles';
import { useWorkspaceTree, type WorkspaceRevealRequest } from '../../../workspace/useWorkspaceTree';
import {
  canRunExplorerDocumentKeyboardAction,
  getExplorerClipboardTarget,
  getExplorerContextMenuTargetPath,
  getExplorerDeleteTarget,
  getExplorerKeyboardAction,
  getExplorerKeyboardActionTargets,
  getExplorerPasteTargetPath,
  getExplorerRenameTarget,
  hasExplorerKeyboardActionTarget,
  isEditableKeyboardTarget,
  isExplorerContextMenuTarget,
  isMonacoTextInputKeyboardTarget,
} from './LeftSidePanelKeyboard';
import {
  createExplorerDraftEditState,
  createExplorerRenameEditState,
  createRealExplorerSelection,
  getExplorerEditCancelSelection,
} from './LeftSidePanelEditSession';
import { useExplorerTreeScrollLock } from './useExplorerTreeScrollLock';

export {
  getExplorerClipboardTarget,
  getExplorerDeleteTarget,
  getExplorerPasteTargetPath,
  getExplorerRenameTarget,
} from './LeftSidePanelKeyboard';

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
  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  const treeInteractionActiveRef = useRef(false);
  const monacoDeleteSelectionArmedRef = useRef(false);
  const pendingTreeDrivenActiveFileSelectionRef = useRef<string | null>(null);
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

  const {
    armTreeScrollLockForNextRefresh,
    releaseTreeScrollLock,
  } = useExplorerTreeScrollLock({
    refreshToken,
    syncDependencies: [selectedNode, treeEditSession, treeNodes, workspaceAvailable],
    treeContainerRef,
  });

  const handleRevealHandled = useCallback((token: number) => {
    setHandledRevealRequestToken((current) => (current === token ? current : token));
  }, []);

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
    const targets = getExplorerKeyboardActionTargets({
      activeFileId,
      keyboardAction,
      selectedNode,
    });
    const allowDeleteFromMonacoSelection = Boolean(
      targets.deleteTarget
      && isMonacoKeyboardTarget
      && monacoDeleteSelectionArmedRef.current,
    );
    const hasActionTarget = hasExplorerKeyboardActionTarget({
      keyboardAction,
      targets,
      workspaceClipboard,
    });

    if (!canRunExplorerDocumentKeyboardAction({
      allowDeleteFromMonacoSelection,
      editableKeyboardTarget,
      hasActionTarget,
      keyboardAction,
      tabIsExplorer: tab === 'explorer',
      treeEditActive: Boolean(treeEditSession),
      treeInteractionActive: treeInteractionActiveRef.current,
    })) {
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
    const editState = createExplorerRenameEditState({ entryType, path });

    if (!editState) {
      return;
    }

    setSelectedNode(editState.selectedNode);
    setTreeEditSession(editState.treeEditSession);
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
    const editState = createExplorerDraftEditState({
      entryType,
      parentPath: resolvedParentPath,
    });

    setSelectedNode(editState.selectedNode);
    setTreeEditSession(editState.treeEditSession);
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

    setTreeEditSession(null);
    setSelectedNode(getExplorerEditCancelSelection(treeEditSession));
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
    const targets = getExplorerKeyboardActionTargets({
      activeFileId,
      keyboardAction,
      selectedNode,
    });

    if (keyboardAction === 'delete' && targets.deleteTarget) {
      event.preventDefault();
      void startDeleteFromSelection();
      return;
    }

    if (keyboardAction === 'rename' && targets.renameTarget) {
      event.preventDefault();
      startRenameFromSelection();
      return;
    }

    if (keyboardAction === 'copy' && targets.clipboardTarget) {
      event.preventDefault();
      void startCopyFromSelection();
      return;
    }

    if (keyboardAction === 'cut' && targets.clipboardTarget) {
      event.preventDefault();
      void startCutFromSelection();
      return;
    }

    if (keyboardAction === 'paste' && workspaceClipboard && targets.pasteTargetPath) {
      event.preventDefault();
      void startPasteFromSelection();
      return;
    }

    if (keyboardAction === 'open-context-menu' && targets.contextMenuTargetPath) {
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
