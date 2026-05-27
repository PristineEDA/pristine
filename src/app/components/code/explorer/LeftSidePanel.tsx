import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Library, ListTree, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceGitStatus } from '../../../git/workspaceGitStatus';
import { FileTreeNode, type ExplorerContextMenuRequest } from './FileTreeNode';
import { ExplorerPanelTabs, type ExplorerPanelTab } from './LeftSidePanelChrome';
import { FileOutlinePanel } from './FileOutlinePanel';
import { HierarchyPanel } from './HierarchyPanel';
import { SPLIT_PANEL_CONTENT_TRANSITION_STYLE, useAnimatedSplitPanelPresence } from './useAnimatedSplitPanelPresence';
import { useCodeViewerLayout } from '../../../context/CodeViewerLayoutContext';
import { Button } from '../../ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../ui/resizable';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';
import {
  compactIconTabToggleIconSize,
  compactIconTabToggleItemClassName,
  IconTabToggleGroup,
} from '../shared/IconTabToggleGroup';
import {
  getCodeWorkspacePanelFrameClassName,
  getCodeWorkspacePanelGroupLayoutGapPx,
  getCodeWorkspaceResizeHandleClassName,
  getPanelHeaderClassName,
} from '../shared/codeViewerLayoutStyles';
import {
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

type ExplorerSecondaryPanelTab = 'hierarchy' | 'libraries';

const explorerSecondaryPanelTabs = [
  { value: 'hierarchy', label: 'Hierarchy', icon: ListTree, testId: 'left-panel-secondary-tab-hierarchy' },
  { value: 'libraries', label: 'Libraries', icon: Library, testId: 'left-panel-secondary-tab-libraries' },
] as const;

interface LeftSidePanelProps {
  activeFileId: string;
  onClearWorkspaceClipboard: () => void;
  onCopyWorkspaceEntry: (targetPath: string, entryType: WorkspaceEntryType) => Promise<boolean>;
  onCreateWorkspaceFile: (targetPath: string) => Promise<void>;
  onCreateWorkspaceFolder: (targetPath: string) => Promise<void>;
  onCutWorkspaceEntry: (targetPath: string, entryType: WorkspaceEntryType) => Promise<boolean>;
  onDeleteWorkspaceEntry: (targetPath: string, entryType: 'file' | 'folder') => Promise<boolean>;
  onGitDiffOpen?: (fileId: string, fileName: string) => void;
  onFileOpen: (fileId: string, fileName: string) => void;
  onFilePreview: (fileId: string, fileName: string) => void;
  onLineJump: (line: number) => void;
  onPasteWorkspaceEntry: (destinationFolderPath: string) => Promise<{
    path: string;
    entryType: WorkspaceEntryType;
  } | null>;
  onRenameWorkspaceEntry: (currentPath: string, nextPath: string, entryType: 'file' | 'folder') => Promise<void>;
  currentOutlineId: string;
  onSplitPanelVisibleChange?: (isVisible: boolean) => void;
  refreshToken?: number;
  revealRequest?: WorkspaceRevealRequest | null;
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
  onGitDiffOpen,
  onFileOpen,
  onFilePreview,
  onLineJump,
  onPasteWorkspaceEntry,
  onRenameWorkspaceEntry,
  currentOutlineId,
  onSplitPanelVisibleChange,
  refreshToken = 0,
  revealRequest,
  workspaceClipboard,
}: LeftSidePanelProps) {
  const { layoutMode } = useCodeViewerLayout();
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
  const [isSplitPanelVisible, setIsSplitPanelVisible] = useState(false);
  const splitPanelPresence = useAnimatedSplitPanelPresence(isSplitPanelVisible);
  const gitStatus = useWorkspaceGitStatus();
  const {
    treeNodes,
    workspaceAvailable,
    expandedFolders,
    toggleFolder,
  } = useWorkspaceTree(revealRequest, refreshToken);

  latestSelectedNodeRef.current = selectedNode;

  useEffect(() => {
    onSplitPanelVisibleChange?.(splitPanelPresence.shouldRender);
  }, [onSplitPanelVisibleChange, splitPanelPresence.shouldRender]);

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
      toggleFolder(folderPath);
    }
  }, [expandedFolders, toggleFolder]);

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

  const handleGitDiffOpen = useCallback((fileId: string, fileName: string) => {
    flushSync(() => {
      setSelectedNode(createRealExplorerSelection(fileId, 'file'));
    });
    monacoDeleteSelectionArmedRef.current = false;
    onGitDiffOpen?.(fileId, fileName);
    focusTree();
  }, [focusTree, onGitDiffOpen]);

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

  const handleToggleSplitPanel = useCallback(() => {
    setIsSplitPanelVisible((current) => !current);
  }, []);
  const splitPanelFrameClassName = getCodeWorkspacePanelFrameClassName(layoutMode, 'flex h-full flex-col bg-ide-bg text-ide-text');

  const primaryPanelContent = (
    <>
      {tab === 'explorer' && (
        <div data-testid="left-panel-explorer-content" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            ref={treeContainerRef}
            tabIndex={0}
            className="explorer-tree-scrollbar flex-1 overflow-y-auto overflow-x-hidden outline-none [overflow-anchor:none]"
            onKeyDown={handleTreeKeyDown}
          >
            {workspaceAvailable === null && (
              <div className="px-4 py-3 text-ide-text-muted text-[12px]">Loading workspace...</div>
            )}
            {workspaceAvailable === false && (
              <div className="px-4 py-3 text-ide-text-muted text-[12px]">No workspace files available</div>
            )}
            {workspaceAvailable && treeNodes.map((node) => (
              <FileTreeNode
                key={node.id}
                node={node}
                depth={0}
                activeFileId={activeFileId}
                onGitDiffOpen={onGitDiffOpen ? handleGitDiffOpen : undefined}
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

      {tab === 'outline' && (
        <FileOutlinePanel
          currentOutlineId={currentOutlineId}
          onLineJump={onLineJump}
        />
      )}
    </>
  );

  return (
    <div
      data-testid="left-panel-root"
      className={cn(
        'flex h-full min-h-0 flex-col text-ide-text overflow-hidden',
        !(layoutMode === 'minimal' && splitPanelPresence.shouldRender) && 'bg-ide-bg',
      )}
    >
      {!splitPanelPresence.shouldRender && (
        <>
          <ExplorerPanelTabs
            activeTab={tab}
            isSplitPanelVisible={isSplitPanelVisible}
            onTabChange={setTab}
            onToggleSplitPanel={handleToggleSplitPanel}
          />

          <div data-testid="left-panel-primary-panel" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {primaryPanelContent}
          </div>
        </>
      )}

      {splitPanelPresence.shouldRender && (
        <ResizablePanelGroup
          data-testid="left-panel-split-group"
          className="flex-1"
          orientation="vertical"
          layoutGapPx={getCodeWorkspacePanelGroupLayoutGapPx(layoutMode)}
        >
          <ResizablePanel id="left-panel-primary" defaultSize={50} minSize={25} minSizePx={120}>
            <section data-testid="left-panel-primary-panel" className={splitPanelFrameClassName}>
              <ExplorerPanelTabs
                activeTab={tab}
                isSplitPanelVisible={isSplitPanelVisible}
                onTabChange={setTab}
                onToggleSplitPanel={handleToggleSplitPanel}
              />

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {primaryPanelContent}
              </div>
            </section>
          </ResizablePanel>

          <ResizableHandle
            data-testid="left-panel-split-resize-handle"
            hidden={!splitPanelPresence.isExpanded}
            className={getCodeWorkspaceResizeHandleClassName(layoutMode)}
          />

          <ResizablePanel id="left-panel-secondary" defaultSize={50} minSize={25} minSizePx={120} collapsed={!splitPanelPresence.isExpanded}>
            <ExplorerSecondaryPanel
              activeFileId={activeFileId}
              isExpanded={splitPanelPresence.isExpanded}
              onFileOpen={onFileOpen}
              onLineJump={onLineJump}
              refreshToken={refreshToken}
              workspaceAvailable={workspaceAvailable}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}

function ExplorerSecondaryPanel({
  activeFileId,
  isExpanded,
  onFileOpen,
  onLineJump,
  refreshToken,
  workspaceAvailable,
}: {
  activeFileId: string;
  isExpanded: boolean;
  onFileOpen: (fileId: string, fileName: string) => void;
  onLineJump: (line: number) => void;
  refreshToken: number;
  workspaceAvailable: boolean | null;
}) {
  const { layoutMode } = useCodeViewerLayout();
  const [secondaryTab, setSecondaryTab] = useState<ExplorerSecondaryPanelTab>('hierarchy');
  const [hierarchyReloadNonce, setHierarchyReloadNonce] = useState(0);
  const splitPanelFrameClassName = getCodeWorkspacePanelFrameClassName(layoutMode, 'flex h-full flex-col bg-ide-bg text-ide-text');
  const hierarchyRefreshToken = refreshToken + hierarchyReloadNonce;

  return (
    <section
      data-testid="left-panel-secondary-panel"
      className={splitPanelFrameClassName}
      style={{
        ...SPLIT_PANEL_CONTENT_TRANSITION_STYLE,
        opacity: isExpanded ? 1 : 0,
      }}
    >
      <div
        data-testid="left-panel-secondary-header"
        data-code-viewer-layout-mode={layoutMode}
        className={getPanelHeaderClassName(layoutMode)}
      >
        <IconTabToggleGroup
          items={explorerSecondaryPanelTabs}
          value={secondaryTab}
          onValueChange={(tab) => setSecondaryTab(tab as ExplorerSecondaryPanelTab)}
          groupLabel="Left panel secondary tabs"
          groupTestId="left-panel-secondary-tabs"
          tooltipSide="bottom"
          itemClassName={compactIconTabToggleItemClassName}
          iconSize={compactIconTabToggleIconSize}
        />

        <div className="ml-auto flex items-center gap-1">
          <TooltipIconButton content="Reload Hierarchy" side="bottom">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-ide-text-muted hover:text-ide-text"
              aria-label="Reload module hierarchy"
              onClick={() => setHierarchyReloadNonce((currentNonce) => currentNonce + 1)}
            >
              <RefreshCw size={13} />
            </Button>
          </TooltipIconButton>
        </div>
      </div>

      {secondaryTab === 'hierarchy' ? (
        <HierarchyPanel
          activeFileId={activeFileId}
          isVisible={isExpanded && secondaryTab === 'hierarchy'}
          onFileOpen={onFileOpen}
          onLineJump={onLineJump}
          refreshToken={hierarchyRefreshToken}
          workspaceAvailable={workspaceAvailable}
        />
      ) : (
        <div
          data-testid="left-panel-libraries-placeholder"
          className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 text-center text-[12px] text-ide-text-muted"
        >
          Libraries is empty
        </div>
      )}
    </section>
  );
}
