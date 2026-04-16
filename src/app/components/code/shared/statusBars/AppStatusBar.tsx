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
  dirtyFileCount?: number;
  failedSaveFileCount?: number;
  savingFileCount?: number;
  onOpenUnsavedFiles?: () => void;
  onSaveAll?: () => void;
}

export function AppStatusBar({
  mainContentView,
  activeView,
  activeFileId,
  cursorLine,
  cursorCol,
  dirtyFileCount,
  failedSaveFileCount,
  savingFileCount,
  onOpenUnsavedFiles,
  onSaveAll,
}: AppStatusBarProps) {
  if (mainContentView === 'code') {
    return (
      <CodeStatusBar
        activeView={activeView}
        activeFileId={activeFileId}
        cursorLine={cursorLine}
        cursorCol={cursorCol}
        dirtyFileCount={dirtyFileCount}
        failedSaveFileCount={failedSaveFileCount}
        savingFileCount={savingFileCount}
        onOpenUnsavedFiles={onOpenUnsavedFiles}
        onSaveAll={onSaveAll}
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
