import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  FilePlus, FolderPlus, RefreshCw, ChevronsUpDown,
} from 'lucide-react';
import { useFileOutlines } from '../../../../data/mockDataLoader';
import { refreshWorkspaceGitStatus, useWorkspaceGitStatus } from '../../../git/workspaceGitStatus';
import { FileTreeNode } from './FileTreeNode';
import { OutlineNode } from './OutlineNode';
import {
  DEFAULT_STARTUP_PROJECT_NAME,
  WORKSPACE_ROOT_PATH,
  createExplorerDraftId,
  getPathBaseName,
  getWorkspaceParentPath,
  isWorkspaceRelativeFilePath,
  type ExplorerSelectedNode,
  type ExplorerTreeEditSession,
  type WorkspaceEntryNameValidationResult,
  validateWorkspaceEntryName,
} from '../../../workspace/workspaceFiles';
import { useWorkspaceTree, type WorkspaceRevealRequest } from '../../../workspace/useWorkspaceTree';
import { Button } from '../../ui/button';
import { ScrollArea } from '../../ui/scroll-area';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';

interface LeftSidePanelProps {
  activeFileId: string;
  onCreateWorkspaceFile: (targetPath: string) => Promise<void>;
  onCreateWorkspaceFolder: (targetPath: string) => Promise<void>;
  onDeleteWorkspaceEntry: (targetPath: string, entryType: 'file' | 'folder') => Promise<boolean>;
  onFileOpen: (fileId: string, fileName: string) => void;
  onFilePreview: (fileId: string, fileName: string) => void;
  onLineJump: (line: number) => void;
  onRenameWorkspaceEntry: (currentPath: string, nextPath: string, entryType: 'file' | 'folder') => Promise<void>;
  currentOutlineId: string;
  refreshToken?: number;
  revealRequest?: WorkspaceRevealRequest | null;
  onWorkspaceRefresh?: () => void;
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

export function LeftSidePanel({
  activeFileId,
  onCreateWorkspaceFile,
  onCreateWorkspaceFolder,
  onDeleteWorkspaceEntry,
  onFileOpen,
  onFilePreview,
  onLineJump,
  onRenameWorkspaceEntry,
  currentOutlineId,
  refreshToken = 0,
  revealRequest,
  onWorkspaceRefresh,
}: LeftSidePanelProps) {
  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  const treeInteractionActiveRef = useRef(false);
  const monacoDeleteSelectionArmedRef = useRef(false);
  const [selectedNode, setSelectedNode] = useState<ExplorerSelectedNode | null>(null);
  const [treeEditSession, setTreeEditSession] = useState<ExplorerTreeEditSession | null>(null);
  const [tab, setTab] = useState<'explorer' | 'outline'>('explorer');
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

  const outline = fileOutlines[currentOutlineId] || [];
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

  const handleDocumentKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const isMonacoKeyboardTarget = isMonacoTextInputKeyboardTarget(event.target);

    if (event.key !== 'F2' && event.key !== 'Delete') {
      if (isMonacoKeyboardTarget) {
        monacoDeleteSelectionArmedRef.current = false;
      }

      return;
    }

    const editableKeyboardTarget = isEditableKeyboardTarget(event.target);
    const deleteTarget = event.key === 'Delete' ? getExplorerDeleteTarget(selectedNode) : null;
    const allowDeleteFromMonacoSelection = Boolean(
      deleteTarget
      && isMonacoKeyboardTarget
      && monacoDeleteSelectionArmedRef.current,
    );

    if (
      event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.shiftKey
      || tab !== 'explorer'
      || Boolean(treeEditSession)
      || (!treeInteractionActiveRef.current && !allowDeleteFromMonacoSelection)
      || (editableKeyboardTarget && !allowDeleteFromMonacoSelection)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Delete') {
      monacoDeleteSelectionArmedRef.current = false;

      if (!deleteTarget) {
        return;
      }

      void startDeleteFromSelection();
      return;
    }

    if (!getExplorerRenameTarget(selectedNode, activeFileId)) {
      return;
    }

    startRenameFromSelection();
  });

  const handleDocumentPointerDown = useEffectEvent((event: PointerEvent) => {
    const treeContainer = treeContainerRef.current;

    if (!treeContainer) {
      treeInteractionActiveRef.current = false;
      monacoDeleteSelectionArmedRef.current = false;
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
      return;
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
    setSelectedNode(nextNode);
    monacoDeleteSelectionArmedRef.current = nextNode.source === 'real' && nextNode.type !== 'root';
    focusTree();
  }, [focusTree]);

  const handleFilePreview = useCallback((fileId: string, fileName: string) => {
    setSelectedNode(createRealExplorerSelection(fileId, 'file'));
    monacoDeleteSelectionArmedRef.current = true;
    onFilePreview(fileId, fileName);
    focusTree();
  }, [focusTree, onFilePreview]);

  const handleFileOpen = useCallback((fileId: string, fileName: string) => {
    setSelectedNode(createRealExplorerSelection(fileId, 'file'));
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
    focusTree();
  }, [focusTree]);

  const startRenameFromSelection = useCallback(() => {
    const renameTarget = getExplorerRenameTarget(selectedNode, activeFileId);

    if (renameTarget) {
      startRenameForNode(renameTarget.path, renameTarget.type);
    }
  }, [activeFileId, selectedNode, startRenameForNode]);

  const startDeleteForNode = useCallback(async (path: string, entryType: 'file' | 'folder') => {
    const parentPath = getWorkspaceParentPath(path);

    setSelectedNode(createRealExplorerSelection(path, entryType));

    const deleted = await onDeleteWorkspaceEntry(path, entryType);
    if (!deleted) {
      focusTree();
      return;
    }

    setSelectedNode(createRealExplorerSelection(
      parentPath,
      parentPath === WORKSPACE_ROOT_PATH ? 'root' : 'folder',
    ));
    focusTree();
  }, [focusTree, onDeleteWorkspaceEntry]);

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
    focusTree();
  }, [ensureFolderExpanded, focusTree, selectedParentPath]);

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
    treeEditSession,
    treeEditValidation,
  ]);

  const handleTreeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (tab !== 'explorer' || treeEditSession) {
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      void startDeleteFromSelection();
      return;
    }

    if (event.key === 'F2') {
      event.preventDefault();
      startRenameFromSelection();
    }
  }, [startDeleteFromSelection, startRenameFromSelection, tab, treeEditSession]);

  return (
    <div className="flex flex-col h-full bg-muted/40 overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-border">
        {(['explorer', 'outline'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 transition-colors border-b-2 ${
              tab === t
                ? 'text-[11px] font-semibold text-foreground border-primary'
                : 'text-[11px] text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {t === 'explorer' ? 'Explorer' : 'Outline'}
          </button>
        ))}
      </div>

      {/* Explorer */}
      {tab === 'explorer' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center px-3 shrink-0">
            <span className="flex-1 text-muted-foreground uppercase text-[11px] font-bold tracking-wide">
              {DEFAULT_STARTUP_PROJECT_NAME}
            </span>
            <div className="flex items-center">
              <TooltipIconButton content="New File">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="New File"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => startCreateEntry('file')}
                ><FilePlus size={14} /></Button>
              </TooltipIconButton>
              <TooltipIconButton content="New Folder">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="New Folder"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => startCreateEntry('folder')}
                ><FolderPlus size={14} /></Button>
              </TooltipIconButton>
              <TooltipIconButton content="Refresh">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Refresh"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    onWorkspaceRefresh?.();
                    refreshTree();
                    refreshWorkspaceGitStatus();
                  }}
                ><RefreshCw size={13} /></Button>
              </TooltipIconButton>
              <TooltipIconButton content="Collapse All">
                <Button variant="ghost" size="icon-sm" aria-label="Collapse All" className="text-muted-foreground hover:text-foreground" onClick={collapseAll}><ChevronsUpDown size={13} /></Button>
              </TooltipIconButton>
            </div>
          </div>
          <div
            ref={treeContainerRef}
            tabIndex={0}
            className="explorer-tree-scrollbar flex-1 overflow-y-auto overflow-x-hidden outline-none"
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
                onStartDelete={startDeleteForNode}
                onStartRename={startRenameForNode}
                onSubmitEdit={handleTreeEditSubmit}
                selectedNode={selectedNode}
                treeEditSession={treeEditSession}
                treeEditValidation={treeEditValidation}
                onTreeInteract={focusTree}
                gitPathStates={gitStatus.pathStates}
                revealRequest={revealRequest}
              />
            ))}
          </div>
        </div>
      )}

      {/* Outline */}
      {tab === 'outline' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-1.5 shrink-0">
            <span className="text-muted-foreground uppercase text-[11px] font-bold tracking-wide">
              OUTLINE — {currentOutlineId || 'No file open'}
            </span>
          </div>
          <ScrollArea className="flex-1">
            {outline.length === 0 ? (
              <div className="px-4 py-3 text-muted-foreground text-[12px]">
                No outline information available
              </div>
            ) : (
              outline.map((item) => (
                <OutlineNode key={item.id} item={item} depth={0} onLineJump={onLineJump} />
              ))
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
