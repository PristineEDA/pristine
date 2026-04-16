import {
  GitBranch, AlertCircle, AlertTriangle, Bell, CheckCircle2,
  Zap,
  Save,
  LoaderCircle,
} from 'lucide-react';
import { summarizeLspProblems, useLspProblems } from '../../../../lsp/lspProblems';
import { getEditorLanguageLabel } from '../../../../workspace/workspaceFiles';
import { StatusBarFrame } from './StatusBarFrame';

export interface StatusBarProps {
  activeFileId: string;
  cursorLine: number;
  cursorCol: number;
  dirtyFileCount?: number;
  failedSaveFileCount?: number;
  savingFileCount?: number;
  onOpenUnsavedFiles?: () => void;
  onSaveAll?: () => void;
}

export function StatusBar({
  activeFileId,
  cursorLine,
  cursorCol,
  dirtyFileCount = 0,
  failedSaveFileCount = 0,
  savingFileCount = 0,
  onOpenUnsavedFiles,
  onSaveAll,
}: StatusBarProps) {
  const problemsList = useLspProblems(activeFileId);
  const { errorCount, warningCount } = summarizeLspProblems(problemsList);
  const lang = activeFileId ? getEditorLanguageLabel(activeFileId) : 'Plain Text';
  const interactiveItemClassName = 'flex items-center gap-1 px-2 h-full transition-colors';
  const interactiveButtonClassName = `${interactiveItemClassName} hover:bg-primary-foreground/10 disabled:cursor-default disabled:opacity-60`;

  return (
    <StatusBarFrame
      statusBarId="code-explorer"
      left={(
        <>
          <div className="flex items-center gap-1 px-2.5 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <GitBranch size={12} />
            <span className="text-[11px]">main</span>
          </div>
          <div className="flex items-center gap-1 px-2 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <CheckCircle2 size={11} />
            <span className="text-[11px]">Sync</span>
          </div>
          {(dirtyFileCount > 0 || savingFileCount > 0 || failedSaveFileCount > 0) && (
            <button
              type="button"
              data-testid="status-bar-unsaved-summary"
              className={interactiveButtonClassName}
              onClick={onOpenUnsavedFiles}
            >
              {savingFileCount > 0 ? <LoaderCircle size={11} className="animate-spin" /> : <Save size={11} />}
              <span className="text-[11px]">
                {dirtyFileCount === 1 ? '1 Unsaved' : `${dirtyFileCount} Unsaved`}
              </span>
            </button>
          )}
          {savingFileCount > 0 && (
            <div className="flex items-center gap-1 px-2 h-full" data-testid="status-bar-saving-summary">
              <LoaderCircle size={11} className="animate-spin" />
              <span className="text-[11px]">Saving {savingFileCount}</span>
            </div>
          )}
          {failedSaveFileCount > 0 && (
            <button
              type="button"
              data-testid="status-bar-save-error-summary"
              className={interactiveButtonClassName}
              onClick={onOpenUnsavedFiles}
            >
              <AlertCircle size={11} />
              <span className="text-[11px]">
                {failedSaveFileCount === 1 ? '1 Save Failed' : `${failedSaveFileCount} Saves Failed`}
              </span>
            </button>
          )}
          {dirtyFileCount > 0 && onSaveAll && (
            <button
              type="button"
              data-testid="status-bar-save-all"
              className={interactiveButtonClassName}
              disabled={savingFileCount > 0}
              onClick={onSaveAll}
            >
              <Save size={11} />
              <span className="text-[11px]">Save All</span>
            </button>
          )}
          <div className="flex items-center gap-2.5 px-2 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <div className="flex items-center gap-1">
              <AlertCircle size={11} />
              <span data-testid="status-bar-error-count" className="text-[11px]">{errorCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle size={11} />
              <span data-testid="status-bar-warning-count" className="text-[11px]">{warningCount}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <Zap size={11} />
            <span className="text-[11px]">Verilator 5.024</span>
          </div>
        </>
      )}
      right={(
        <>
          <div className="flex items-center px-2.5 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <span className="text-[11px]">
              Ln {cursorLine}, Col {cursorCol}
            </span>
          </div>
          <div className="flex items-center px-2 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <span className="text-[11px]">Spaces: 4</span>
          </div>
          <div className="flex items-center px-2 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <span className="text-[11px]">UTF-8</span>
          </div>
          <div className="flex items-center px-2 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <span className="text-[11px]">LF</span>
          </div>
          <div className="flex items-center px-2.5 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <span className="text-[11px]">{lang}</span>
          </div>
          <div className="flex items-center px-2 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <Bell size={12} />
          </div>
        </>
      )}
    />
  );
}
