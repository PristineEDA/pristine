import { Fragment, type ReactNode } from 'react';
import {
  toTreeTestId,
  type ExplorerSelectedNode,
  type ExplorerTreeEditSession,
  type WorkspaceEntryNameValidationResult,
  type WorkspaceTreeNode,
} from '../../../workspace/workspaceFiles';
import { TreeEditInputRow } from './FileTreeNodeEditRow';

export function FileTreeNodeChildren({
  childNodes,
  depth,
  selectedNode,
  treeEditSession,
  treeEditValidation,
  onCancelEdit,
  onEditValueChange,
  onSubmitEdit,
  renderChildNode,
}: {
  childNodes: WorkspaceTreeNode[];
  depth: number;
  selectedNode?: ExplorerSelectedNode | null;
  treeEditSession?: ExplorerTreeEditSession | null;
  treeEditValidation?: WorkspaceEntryNameValidationResult | null;
  onCancelEdit?: () => void;
  onEditValueChange?: (value: string) => void;
  onSubmitEdit?: () => void;
  renderChildNode: (child: WorkspaceTreeNode) => ReactNode;
}) {
  return (
    <>
      {childNodes.map((child) => (
        child.isDraft && treeEditSession ? (
          <TreeEditInputRow
            key={child.id}
            depth={depth}
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
          <Fragment key={child.id}>
            {renderChildNode(child)}
          </Fragment>
        )
      ))}
    </>
  );
}
