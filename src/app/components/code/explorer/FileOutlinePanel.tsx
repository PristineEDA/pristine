import { useFileOutlines } from '../../../../data/mockDataLoader';
import { getPathBaseName, splitWorkspaceEntryName } from '../../../workspace/workspaceFiles';
import { OutlinePanel } from './LeftSidePanelOutline';

interface FileOutlinePanelProps {
  currentOutlineId: string;
  onLineJump: (line: number) => void;
}

function getOutlineLookupId(currentOutlineId: string) {
  const baseName = getPathBaseName(currentOutlineId);
  const { stem } = splitWorkspaceEntryName(baseName);

  return stem || baseName;
}

function getOutlineDisplayName(currentOutlineId: string) {
  return currentOutlineId ? getPathBaseName(currentOutlineId) : currentOutlineId;
}

export function FileOutlinePanel({ currentOutlineId, onLineJump }: FileOutlinePanelProps) {
  const fileOutlines = useFileOutlines();
  const outlineLookupId = getOutlineLookupId(currentOutlineId);
  const outline = fileOutlines[outlineLookupId] || [];

  return (
    <OutlinePanel
      currentOutlineId={getOutlineDisplayName(currentOutlineId)}
      outline={outline}
      onLineJump={onLineJump}
    />
  );
}