import type { CodeView } from '../../../../codeViewPanels';
import { CODE_VIEW_LABELS } from '../../../../codeViewPanels';
import { StatusBar, type StatusBarProps } from './StatusBar';
import { StatusBarPlaceholder } from './StatusBarPlaceholder';

interface CodeStatusBarProps extends StatusBarProps {
  activeView: CodeView;
}

export function CodeStatusBar({ activeView, activeFileId, cursorLine, cursorCol }: CodeStatusBarProps) {
  if (activeView === 'explorer') {
    return <StatusBar activeFileId={activeFileId} cursorLine={cursorLine} cursorCol={cursorCol} />;
  }

  return (
    <StatusBarPlaceholder
      statusBarId={`code-${activeView}`}
      viewName={CODE_VIEW_LABELS[activeView]}
    />
  );
}
