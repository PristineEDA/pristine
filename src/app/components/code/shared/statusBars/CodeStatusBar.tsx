import type { CodeView } from '../../../../codeViewPanels';
import { CODE_VIEW_LABELS } from '../../../../codeViewPanels';
import { StatusBar, type StatusBarProps } from './StatusBar';
import { StatusBarPlaceholder } from './StatusBarPlaceholder';

interface CodeStatusBarProps extends StatusBarProps {
  activeView: CodeView;
}

export function CodeStatusBar({
  activeView,
  activeFileId,
  cursorLine,
  cursorCol,
  dirtyFileCount,
  failedSaveFileCount,
  savingFileCount,
  onOpenUnsavedFiles,
  onSaveAll,
}: CodeStatusBarProps) {
  if (activeView === 'explorer') {
    return (
      <StatusBar
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
      statusBarId={`code-${activeView}`}
      viewName={CODE_VIEW_LABELS[activeView]}
    />
  );
}
