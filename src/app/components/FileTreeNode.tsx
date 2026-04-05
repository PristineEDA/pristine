import { useEffect, useRef, useState, memo } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
} from 'lucide-react';
import { WorkspaceTreeNode, toTreeTestId } from '../workspace/workspaceFiles';
import type { WorkspaceRevealRequest } from '../workspace/useWorkspaceTree';
import { FileTypeBadge } from './FileTypeBadge';

// ─── File Icon ────────────────────────────────────────────────────────────────
export function FileIcon({ name }: { name: string; language?: string }) {
  return <FileTypeBadge name={name} className="text-[10px] font-bold font-mono" />;
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
export function ContextMenu({
  x, y, onClose, items,
}: { x: number; y: number; onClose: () => void; items: { label: string; action: () => void }[] }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed bg-muted/40 border border-border shadow-2xl z-50 py-1 min-w-44"
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

// ─── Recursive File Tree Node ─────────────────────────────────────────────────
export const FileTreeNode = memo(function FileTreeNode({
  node,
  depth,
  activeFileId,
  onFileOpen,
  onFilePreview,
  expandedFolders,
  onToggleFolder,
  revealRequest,
}: {
  node: WorkspaceTreeNode;
  depth: number;
  activeFileId: string;
  onFileOpen: (id: string, name: string) => void;
  onFilePreview: (id: string, name: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (id: string) => void;
  revealRequest?: WorkspaceRevealRequest | null;
}) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const isExpanded = expandedFolders.has(node.id);
  const isActive = node.id === activeFileId;

  useEffect(() => {
    if (revealRequest?.path !== node.path) {
      return;
    }

    rowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [node.path, revealRequest]);

  const contextItems = node.type === 'folder'
    ? [
        { label: 'New File', action: () => {} },
        { label: 'New Folder', action: () => {} },
        { label: '---', action: () => {} },
        { label: 'Rename', action: () => {} },
        { label: 'Delete', action: () => {} },
        { label: '---', action: () => {} },
        { label: 'Set as Simulation Top', action: () => {} },
        { label: 'Copy Path', action: () => {} },
      ]
    : [
      { label: 'Open in Editor', action: () => onFileOpen(node.path, node.name) },
        { label: '---', action: () => {} },
        { label: 'Rename', action: () => {} },
        { label: 'Delete', action: () => {} },
        { label: '---', action: () => {} },
        { label: 'Set as Simulation Top', action: () => {} },
        { label: 'Copy Path', action: () => {} },
        { label: 'Copy Relative Path', action: () => {} },
      ];

  return (
    <div>
      <div
        ref={rowRef}
        data-testid={`file-tree-node-${toTreeTestId(node.path)}`}
        className={`flex items-center gap-1 h-6 cursor-pointer group hover:bg-accent transition-colors ${
          isActive ? 'bg-primary/20 text-foreground' : 'text-foreground'
        }`}
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={() => {
          if (node.type === 'folder') onToggleFolder(node.id);
          else onFilePreview(node.path, node.name);
        }}
        onDoubleClick={() => {
          if (node.type === 'file') {
            onFileOpen(node.path, node.name);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
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
            <span className="text-[13px] flex-1 truncate ml-1">{node.name}</span>
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              <FileIcon name={node.name} />
            </span>
            <span className="text-[13px] flex-1 truncate ml-1">{node.name}</span>
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

      {node.type === 'folder' && isExpanded && node.children?.map((child) => (
        <FileTreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          activeFileId={activeFileId}
          onFileOpen={onFileOpen}
          onFilePreview={onFilePreview}
          expandedFolders={expandedFolders}
          onToggleFolder={onToggleFolder}
          revealRequest={revealRequest}
        />
      ))}
    </div>
  );
});
