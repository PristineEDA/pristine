import { memo, type CSSProperties, type MouseEvent, type RefObject } from 'react';
import {
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  WORKSPACE_ROOT_PATH,
  type WorkspaceTreeNode,
} from '../../../workspace/workspaceFiles';
import { WorkspaceFileIcon, WorkspaceFolderIcon } from '../shared/WorkspaceEntryIcon';
import { ExplorerGitIndicators } from './FileTreeNodeGitIndicators';

export const FileTreeNodeRow = memo(function FileTreeNodeRow({
  gitIndicatorStates,
  isCutSource,
  isExpanded,
  isPersistentlyHighlighted,
  labelColorClassName,
  node,
  rowIndentStyle,
  rowRef,
  testId,
  onClick,
  onContextMenu,
  onDoubleClick,
}: {
  gitIndicatorStates: Parameters<typeof ExplorerGitIndicators>[0]['indicatorStates'];
  isCutSource: boolean;
  isExpanded: boolean;
  isPersistentlyHighlighted: boolean;
  labelColorClassName: string;
  node: WorkspaceTreeNode;
  rowIndentStyle: CSSProperties;
  rowRef: RefObject<HTMLDivElement | null>;
  testId: string;
  onClick: () => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
}) {
  return (
    <div
      ref={rowRef}
      data-testid={`file-tree-node-${testId}`}
      className={`flex items-center gap-1 h-6 cursor-pointer group transition-colors ${
        isPersistentlyHighlighted
          ? 'bg-primary/20 text-foreground hover:bg-primary/20'
          : 'text-foreground hover:bg-accent'
      } ${isCutSource ? 'opacity-50' : ''}`}
      style={rowIndentStyle}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {node.type === 'folder' ? (
        <>
          <span className="text-muted-foreground">
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          <WorkspaceFolderIcon
            name={node.name}
            isOpen={isExpanded}
            isRoot={node.path === WORKSPACE_ROOT_PATH}
            className="h-4 w-4"
            testId={`file-tree-icon-${testId}`}
          />
          <span className="ml-1 flex min-w-0 flex-1 items-center">
            <span
              data-testid={`file-tree-label-${testId}`}
              className={`min-w-0 truncate text-[13px] ${labelColorClassName}`}
            >
              {node.name}
            </span>
          </span>
          <ExplorerGitIndicators indicatorStates={gitIndicatorStates} testId={testId} />
        </>
      ) : (
        <>
          <span className="w-3.5" />
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            <WorkspaceFileIcon name={node.name} className="h-4 w-4" testId={`file-tree-icon-${testId}`} />
          </span>
          <span className="ml-1 flex min-w-0 flex-1 items-center">
            <span
              data-testid={`file-tree-label-${testId}`}
              className={`min-w-0 truncate text-[13px] ${labelColorClassName}`}
            >
              {node.name}
            </span>
          </span>
          <ExplorerGitIndicators indicatorStates={gitIndicatorStates} testId={testId} />
        </>
      )}
    </div>
  );
});
