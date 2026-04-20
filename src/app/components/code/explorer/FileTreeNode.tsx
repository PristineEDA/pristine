import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
} from 'lucide-react';
import {
  WORKSPACE_ROOT_PATH,
  WorkspaceTreeNode,
  createExplorerDraftNode,
  mergeWorkspaceChildrenWithDraft,
  toTreeTestId,
  type ExplorerSelectedNode,
  type ExplorerTreeEditSession,
  type WorkspaceEntryNameValidationResult,
} from '../../../workspace/workspaceFiles';
import type { WorkspaceRevealRequest } from '../../../workspace/useWorkspaceTree';
import type { WorkspaceGitPathState } from '../../../../../types/workspace-git';
import { FileTypeBadge } from '../shared/FileTypeBadge';

interface ContextMenuItem {
  label: string;
  action: () => void;
}

const noop = () => {};
const treeRowIndentStyleCache = new Map<number, React.CSSProperties>();

function getTreeRowIndentStyle(depth: number): React.CSSProperties {
  const cachedStyle = treeRowIndentStyleCache.get(depth);

  if (cachedStyle) {
    return cachedStyle;
  }

  const nextStyle = { paddingLeft: depth * 12 + 4 };
  treeRowIndentStyleCache.set(depth, nextStyle);
  return nextStyle;
}

// ─── File Icon ────────────────────────────────────────────────────────────────
export function FileIcon({ name }: { name: string; language?: string }) {
  return <FileTypeBadge name={name} className="text-[10px] font-bold font-mono" />;
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
export function ContextMenu({
  x, y, onClose, items,
}: { x: number; y: number; onClose: () => void; items: ContextMenuItem[] }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed bg-popover border border-border shadow-2xl z-50 py-1 min-w-44"
        style={{ left: x, top: y }}
      >
        {items.map((item, i) =>
          item.label === '---' ? (
            <div key={i} className="h-px bg-border my-1" />
          ) : (
            <button
              key={i}
              className="w-full text-left px-3 py-1 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors text-[12px]"
              onClick={() => { item.action(); onClose(); }}
            >
              {item.label}
            </button>
          )
        )}
      </div>
    </>
  );
}

function TreeEditInputRow({
  depth,
  errorMessage,
  isDraft,
  isExpanded,
  isFolder,
  isSelected,
  isSubmitting,
  testId,
  value,
  onBlur,
  onCancel,
  onChange,
  onSubmit,
}: {
  depth: number;
  errorMessage: string | null;
  isDraft: boolean;
  isExpanded?: boolean;
  isFolder: boolean;
  isSelected: boolean;
  isSubmitting: boolean;
  testId: string;
  value: string;
  onBlur: () => void;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div>
      <div
        data-testid={`file-tree-node-${testId}`}
        className={`flex items-center gap-1 h-6 transition-colors ${
          isSelected
            ? 'bg-primary/20 text-foreground hover:bg-primary/20'
            : 'text-foreground hover:bg-accent'
        } ${isDraft ? 'opacity-65' : ''}`}
        style={getTreeRowIndentStyle(depth)}
      >
        {isFolder ? (
          <>
            <span className="text-muted-foreground">
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            {isExpanded
              ? <FolderOpen size={14} className="text-ide-syntax-folder shrink-0" />
              : <Folder size={14} className="text-ide-syntax-folder shrink-0" />}
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              <FileIcon name={value || 'new_file.sv'} />
            </span>
          </>
        )}
        <input
          ref={inputRef}
          data-testid={`file-tree-input-${testId}`}
          value={value}
          disabled={isSubmitting}
          aria-invalid={errorMessage ? 'true' : 'false'}
          className={`ml-1 h-5 flex-1 rounded border bg-background/80 px-2 text-[12px] outline-none transition-colors ${
            errorMessage
              ? 'border-destructive text-foreground focus:border-destructive'
              : 'border-border text-foreground focus:border-primary'
          } ${isSubmitting ? 'opacity-80' : ''}`}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void onSubmit();
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      </div>
      {errorMessage && (
        <div className="px-3 py-1 text-[11px] text-destructive" style={{ paddingLeft: depth * 12 + 28 }}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}

// ─── Recursive File Tree Node ─────────────────────────────────────────────────
export const FileTreeNode = memo(function FileTreeNode({
  node,
  depth,
  activeFileId,
  onFileOpen,
  onFilePreview,
  onCancelEdit,
  onEditValueChange,
  onSelectNode,
  onStartCreateFile,
  onStartCreateFolder,
  onStartDelete,
  onStartRename,
  onSubmitEdit,
  expandedFolders,
  onToggleFolder,
  selectedNode,
  treeEditSession,
  treeEditValidation,
  gitPathStates,
  onTreeInteract,
  revealRequest,
}: {
  node: WorkspaceTreeNode;
  depth: number;
  activeFileId: string;
  onFileOpen: (id: string, name: string) => void;
  onFilePreview: (id: string, name: string) => void;
  onCancelEdit?: () => void;
  onEditValueChange?: (value: string) => void;
  onSelectNode?: (node: ExplorerSelectedNode) => void;
  onStartCreateFile?: (entryType: 'file', parentPath?: string) => void;
  onStartCreateFolder?: (entryType: 'folder', parentPath?: string) => void;
  onStartDelete?: (path: string, entryType: 'file' | 'folder') => void;
  onStartRename?: (path: string, entryType: 'file' | 'folder') => void;
  onSubmitEdit?: () => void;
  expandedFolders: Set<string>;
  onToggleFolder: (id: string) => void;
  selectedNode?: ExplorerSelectedNode | null;
  treeEditSession?: ExplorerTreeEditSession | null;
  treeEditValidation?: WorkspaceEntryNameValidationResult | null;
  gitPathStates: Record<string, WorkspaceGitPathState>;
  onTreeInteract?: () => void;
  revealRequest?: WorkspaceRevealRequest | null;
}) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const isExpanded = expandedFolders.has(node.id);
  const isActive = node.id === activeFileId;
  const isSelected = selectedNode?.source === 'real' && selectedNode.path === node.path;
  const isActiveFileHighlighted = !selectedNode && isActive;
  const isPersistentlyHighlighted = isSelected || isActiveFileHighlighted;
  const gitPathState = gitPathStates[node.path];
  const treeTestId = toTreeTestId(node.path);
  const labelColorClassName = gitPathState === 'modified'
    ? 'text-ide-warning'
    : gitPathState === 'ignored'
    ? 'text-ide-text-muted'
    : 'text-foreground';
  const rowIndentStyle = getTreeRowIndentStyle(depth);
  const isEditingCurrentNode = treeEditSession?.mode === 'rename' && treeEditSession.targetPath === node.path;
  const draftNode = useMemo(() => {
    if (!treeEditSession || treeEditSession.mode === 'rename' || treeEditSession.parentPath !== node.path) {
      return null;
    }

    return createExplorerDraftNode(
      treeEditSession.parentPath,
      treeEditSession.entryType,
      treeEditSession.targetNodeId,
      treeEditSession.value,
    );
  }, [node.path, treeEditSession]);
  const childNodes = useMemo(
    () => mergeWorkspaceChildrenWithDraft(node.children, draftNode),
    [draftNode, node.children],
  );

  const openFileFromContextMenu = useCallback(() => {
    onFileOpen(node.path, node.name);
  }, [node.name, node.path, onFileOpen]);

  const selectCurrentNode = useCallback(() => {
    onSelectNode?.({
      id: node.id,
      path: node.path,
      type: node.path === WORKSPACE_ROOT_PATH ? 'root' : node.type,
      source: 'real',
    });
    onTreeInteract?.();
  }, [node.id, node.path, node.type, onSelectNode, onTreeInteract]);

  useEffect(() => {
    if (revealRequest?.path !== node.path) {
      return;
    }

    rowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [node.path, revealRequest]);

  const contextItems = useMemo<ContextMenuItem[]>(() => {
    if (node.type === 'folder') {
      const items = [
        {
          label: 'New File',
          action: () => onStartCreateFile?.('file', node.path),
        },
        {
          label: 'New Folder',
          action: () => onStartCreateFolder?.('folder', node.path),
        },
        { label: '---', action: noop },
      ];

      if (node.path !== WORKSPACE_ROOT_PATH) {
        items.push({ label: 'Rename', action: () => onStartRename?.(node.path, 'folder') });
        items.push({ label: 'Delete', action: () => onStartDelete?.(node.path, 'folder') });
        items.push({ label: '---', action: noop });
      }

      return [
        ...items,
        { label: 'Set as Simulation Top', action: noop },
        { label: 'Copy Path', action: noop },
      ];
    }

    return [
      { label: 'Open in Editor', action: openFileFromContextMenu },
      { label: '---', action: noop },
      { label: 'Rename', action: () => onStartRename?.(node.path, 'file') },
      { label: 'Delete', action: () => onStartDelete?.(node.path, 'file') },
      { label: '---', action: noop },
      { label: 'Set as Simulation Top', action: noop },
      { label: 'Copy Path', action: noop },
      { label: 'Copy Relative Path', action: noop },
    ];
  }, [node.path, node.type, onStartCreateFile, onStartCreateFolder, onStartDelete, onStartRename, openFileFromContextMenu]);

  if (isEditingCurrentNode && treeEditSession) {
    return (
      <div>
        <TreeEditInputRow
          depth={depth}
          errorMessage={treeEditSession.submitError ?? treeEditValidation?.errorMessage ?? null}
          isDraft={false}
          isExpanded={node.type === 'folder' ? isExpanded : undefined}
          isFolder={node.type === 'folder'}
          isSelected={true}
          isSubmitting={treeEditSession.isSubmitting}
          testId={treeTestId}
          value={treeEditSession.value}
          onBlur={() => onCancelEdit?.()}
          onCancel={() => onCancelEdit?.()}
          onChange={(value) => onEditValueChange?.(value)}
          onSubmit={() => onSubmitEdit?.()}
        />
        {node.type === 'folder' && isExpanded && node.isLoading && (
          <div className="text-[12px] text-muted-foreground pl-8 py-1">
            Loading...
          </div>
        )}
        {node.type === 'folder' && isExpanded && childNodes.map((child) => (
          child.isDraft ? (
            <TreeEditInputRow
              key={child.id}
              depth={depth + 1}
              errorMessage={treeEditSession.submitError ?? treeEditValidation?.errorMessage ?? null}
              isDraft={true}
              isFolder={child.type === 'folder'}
              isSelected={selectedNode?.source === 'draft' && selectedNode.id === child.id}
              isSubmitting={treeEditSession.isSubmitting}
              testId={toTreeTestId(child.path)}
              value={treeEditSession.value}
              onBlur={() => onCancelEdit?.()}
              onCancel={() => onCancelEdit?.()}
              onChange={(value) => onEditValueChange?.(value)}
              onSubmit={() => onSubmitEdit?.()}
            />
          ) : (
            <FileTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeFileId={activeFileId}
              onFileOpen={onFileOpen}
              onFilePreview={onFilePreview}
              onCancelEdit={onCancelEdit}
              onEditValueChange={onEditValueChange}
              onSelectNode={onSelectNode}
              onStartCreateFile={onStartCreateFile}
              onStartCreateFolder={onStartCreateFolder}
              onStartDelete={onStartDelete}
              onStartRename={onStartRename}
              onSubmitEdit={onSubmitEdit}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              selectedNode={selectedNode}
              treeEditSession={treeEditSession}
              treeEditValidation={treeEditValidation}
              gitPathStates={gitPathStates}
              onTreeInteract={onTreeInteract}
              revealRequest={revealRequest}
            />
          )
        ))}
      </div>
    );
  }

  return (
    <div>
      <div
        ref={rowRef}
        data-testid={`file-tree-node-${treeTestId}`}
        className={`flex items-center gap-1 h-6 cursor-pointer group transition-colors ${
          isPersistentlyHighlighted
            ? 'bg-primary/20 text-foreground hover:bg-primary/20'
            : 'text-foreground hover:bg-accent'
        }`}
        style={rowIndentStyle}
        onClick={() => {
          selectCurrentNode();
          if (node.type === 'folder') {
            onToggleFolder(node.id);
            return;
          }

          onFilePreview(node.path, node.name);
        }}
        onDoubleClick={() => {
          if (node.type === 'file') {
            selectCurrentNode();
            onFileOpen(node.path, node.name);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          selectCurrentNode();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {node.type === 'folder' ? (
          <>
            <span className="text-muted-foreground">
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            {isExpanded
              ? <FolderOpen size={14} className="text-ide-syntax-folder shrink-0" />
              : <Folder size={14} className="text-ide-syntax-folder shrink-0" />}
            <span
              data-testid={`file-tree-label-${treeTestId}`}
              className={`text-[13px] flex-1 truncate ml-1 ${labelColorClassName}`}
            >
              {node.name}
            </span>
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              <FileIcon name={node.name} />
            </span>
            <span
              data-testid={`file-tree-label-${treeTestId}`}
              className={`text-[13px] flex-1 truncate ml-1 ${labelColorClassName}`}
            >
              {node.name}
            </span>
          </>
        )}
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={contextItems}
        />
      )}

      {node.type === 'folder' && isExpanded && node.isLoading && (
        <div className="text-[12px] text-muted-foreground pl-8 py-1">
          Loading...
        </div>
      )}

      {node.type === 'folder' && isExpanded && childNodes.map((child) => (
        child.isDraft && treeEditSession ? (
          <TreeEditInputRow
            key={child.id}
            depth={depth + 1}
            errorMessage={treeEditSession.submitError ?? treeEditValidation?.errorMessage ?? null}
            isDraft={true}
            isFolder={child.type === 'folder'}
            isSelected={selectedNode?.source === 'draft' && selectedNode.id === child.id}
            isSubmitting={treeEditSession.isSubmitting}
            testId={toTreeTestId(child.path)}
            value={treeEditSession.value}
            onBlur={() => onCancelEdit?.()}
            onCancel={() => onCancelEdit?.()}
            onChange={(value) => onEditValueChange?.(value)}
            onSubmit={() => onSubmitEdit?.()}
          />
        ) : (
          <FileTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            activeFileId={activeFileId}
            onFileOpen={onFileOpen}
            onFilePreview={onFilePreview}
            onCancelEdit={onCancelEdit}
            onEditValueChange={onEditValueChange}
            onSelectNode={onSelectNode}
            onStartCreateFile={onStartCreateFile}
            onStartCreateFolder={onStartCreateFolder}
            onStartDelete={onStartDelete}
            onStartRename={onStartRename}
            onSubmitEdit={onSubmitEdit}
            expandedFolders={expandedFolders}
            onToggleFolder={onToggleFolder}
            selectedNode={selectedNode}
            treeEditSession={treeEditSession}
            treeEditValidation={treeEditValidation}
            gitPathStates={gitPathStates}
            onTreeInteract={onTreeInteract}
            revealRequest={revealRequest}
          />
        )
      ))}
    </div>
  );
});
