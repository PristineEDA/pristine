import type { CodeView, MainContentView } from '../../../../codeViewPanels';
import { MAIN_CONTENT_VIEW_LABELS } from '../../../../codeViewPanels';
import { CodeStatusBar } from './CodeStatusBar';
import { StatusBarPlaceholder } from './StatusBarPlaceholder';

interface AppStatusBarProps {
  mainContentView: MainContentView;
  activeView: CodeView;
  activeFileId: string;
  cursorLine: number;
  cursorCol: number;
}

export function AppStatusBar({ mainContentView, activeView, activeFileId, cursorLine, cursorCol }: AppStatusBarProps) {
  if (mainContentView === 'code') {
    return (
      <CodeStatusBar
        activeView={activeView}
        activeFileId={activeFileId}
        cursorLine={cursorLine}
        cursorCol={cursorCol}
      />
    );
  }

  return (
    <StatusBarPlaceholder
      statusBarId={mainContentView}
      viewName={MAIN_CONTENT_VIEW_LABELS[mainContentView]}
    />
  );
}
