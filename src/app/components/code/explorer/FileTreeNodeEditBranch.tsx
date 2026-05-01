import type { ReactNode } from 'react';
import {
  type ExplorerSelectedNode,
  type ExplorerTreeEditSession,
  type WorkspaceEntryNameValidationResult,
  type WorkspaceTreeNode,
} from '../../../workspace/workspaceFiles';
import { FileTreeNodeChildren } from './FileTreeNodeChildren';
import { TreeEditInputRow } from './FileTreeNodeEditRow';

export function FileTreeNodeEditBranch({
  childNodes,
  depth,
  isExpanded,
  node,
  selectedNode,
  testId,
  treeEditSession,
  treeEditValidation,
  onCancelEdit,
  onEditValueChange,
  onSubmitEdit,
  renderChildNode,
}: {
  childNodes: WorkspaceTreeNode[];
  depth: number;
  isExpanded: boolean;
  node: WorkspaceTreeNode;
  selectedNode?: ExplorerSelectedNode | null;
  testId: string;
  treeEditSession: ExplorerTreeEditSession;
  treeEditValidation?: WorkspaceEntryNameValidationResult | null;
  onCancelEdit?: () => void;
  onEditValueChange?: (value: string) => void;
  onSubmitEdit?: () => void;
  renderChildNode: (child: WorkspaceTreeNode) => ReactNode;
}) {
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
        testId={testId}
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
      {node.type === 'folder' && isExpanded && (
        <FileTreeNodeChildren
          childNodes={childNodes}
          depth={depth + 1}
          selectedNode={selectedNode}
          treeEditSession={treeEditSession}
          treeEditValidation={treeEditValidation}
          onCancelEdit={onCancelEdit}
          onEditValueChange={onEditValueChange}
          onSubmitEdit={onSubmitEdit}
          renderChildNode={renderChildNode}
        />
      )}
    </div>
  );
}
