import type { ReactNode } from 'react';
import {
  GitBranch, AlertCircle, AlertTriangle, Bell, CheckCircle2,
  Zap,
  Save,
  LoaderCircle,
} from 'lucide-react';
import { getWorkspaceGitBranchLabel, useWorkspaceGitStatus } from '../../../../git/workspaceGitStatus';
import { summarizeLspProblems, useLspProblems } from '../../../../lsp/lspProblems';
import { getEditorLanguageLabel } from '../../../../workspace/workspaceFiles';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../../../ui/hover-card';
import { StatusBarFrame } from './StatusBarFrame';

interface StatusBarHoverCopy {
  description: string;
  meta?: string;
  title: string;
}

type StatusBarHoverKey =
  | 'branch'
  | 'sync'
  | 'unsaved'
  | 'saving'
  | 'saveError'
  | 'saveAll'
  | 'problems'
  | 'verilator'
  | 'cursor'
  | 'indentation'
  | 'encoding'
  | 'lineEnding'
  | 'language'
  | 'notifications';

const STATUS_BAR_HOVER_COPY: Record<StatusBarHoverKey, StatusBarHoverCopy> = {
  branch: {
    title: 'Git Branch',
    description: 'Placeholder details about the current workspace branch.',
    meta: 'Preview content only',
  },
  sync: {
    title: 'Sync Status',
    description: 'Placeholder details about repository synchronization.',
    meta: 'Preview content only',
  },
  unsaved: {
    title: 'Unsaved Files',
    description: 'Placeholder details about modified files waiting to be reviewed.',
    meta: 'Preview content only',
  },
  saving: {
    title: 'Save Progress',
    description: 'Placeholder details about files currently being written.',
    meta: 'Preview content only',
  },
  saveError: {
    title: 'Save Errors',
    description: 'Placeholder details about files that could not be saved.',
    meta: 'Preview content only',
  },
  saveAll: {
    title: 'Save All',
    description: 'Placeholder details about saving every pending file at once.',
    meta: 'Preview content only',
  },
  problems: {
    title: 'Problems',
    description: 'Placeholder details about active errors and warnings.',
    meta: 'Preview content only',
  },
  verilator: {
    title: 'Verilator',
    description: 'Placeholder details about the current simulator toolchain.',
    meta: 'Preview content only',
  },
  cursor: {
    title: 'Cursor Position',
    description: 'Placeholder details about the active editor cursor state.',
    meta: 'Preview content only',
  },
  indentation: {
    title: 'Indentation',
    description: 'Placeholder details about the active indentation mode.',
    meta: 'Preview content only',
  },
  encoding: {
    title: 'Encoding',
    description: 'Placeholder details about the active file encoding.',
    meta: 'Preview content only',
  },
  lineEnding: {
    title: 'Line Endings',
    description: 'Placeholder details about the active line ending mode.',
    meta: 'Preview content only',
  },
  language: {
    title: 'Language Mode',
    description: 'Placeholder details about the active editor language.',
    meta: 'Preview content only',
  },
  notifications: {
    title: 'Notifications',
    description: 'Placeholder details about editor and workspace alerts.',
    meta: 'Preview content only',
  },
};

const STATUS_BAR_HOVER_OPEN_DELAY_MS = 160;
const STATUS_BAR_HOVER_TRIGGER_CLASS_NAME = 'h-full transition-colors hover:bg-primary-foreground/30 dark:hover:bg-primary-foreground/10';
const STATUS_BAR_HOVER_CONTENT_CLASS_NAME = 'data-[state=closed]:animate-none';

function StatusBarHoverDetails({ copy }: { copy: StatusBarHoverCopy }) {
  return (
    <div className="space-y-1.5">
      <div className="space-y-1">
        <p className="text-sm font-semibold leading-none">{copy.title}</p>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>
      <p className="text-xs text-muted-foreground">{copy.meta ?? 'Preview content only'}</p>
    </div>
  );
}

function StatusBarHoverItem({
  children,
  copy,
}: {
  children: ReactNode;
  copy: StatusBarHoverCopy;
}) {
  return (
    <HoverCard openDelay={STATUS_BAR_HOVER_OPEN_DELAY_MS} closeDelay={0}>
      <HoverCardTrigger asChild>
        <div className={STATUS_BAR_HOVER_TRIGGER_CLASS_NAME}>
          {children}
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="top" className={STATUS_BAR_HOVER_CONTENT_CLASS_NAME}>
        <StatusBarHoverDetails copy={copy} />
      </HoverCardContent>
    </HoverCard>
  );
}

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
  const gitStatus = useWorkspaceGitStatus();
  const problemsList = useLspProblems(activeFileId);
  const { errorCount, warningCount } = summarizeLspProblems(problemsList);
  const branchLabel = getWorkspaceGitBranchLabel(gitStatus);
  const lang = activeFileId ? getEditorLanguageLabel(activeFileId) : 'Plain Text';
  const buttonItemClassName = 'flex h-full items-center gap-1 px-2 text-[11px] disabled:cursor-default disabled:opacity-60';
  const compactItemClassName = 'flex h-full items-center gap-1 px-2 text-[11px] cursor-pointer';
  const compactTextItemClassName = 'flex h-full items-center px-2 text-[11px] cursor-pointer';
  const groupedItemClassName = 'flex h-full items-center gap-2.5 px-2 text-[11px] cursor-pointer';
  const wideItemClassName = 'flex h-full items-center gap-1 px-2.5 text-[11px] cursor-pointer';
  const wideTextItemClassName = 'flex h-full items-center px-2.5 text-[11px] cursor-pointer';

  return (
    <StatusBarFrame
      statusBarId="code-explorer"
      left={(
        <>
          <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.branch}>
            <div className={wideItemClassName}>
              <GitBranch size={12} />
              <span data-testid="status-bar-branch-label">{branchLabel}</span>
            </div>
          </StatusBarHoverItem>
          <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.sync}>
            <div className={compactItemClassName}>
              <CheckCircle2 size={11} />
              <span>Sync</span>
            </div>
          </StatusBarHoverItem>
          {(dirtyFileCount > 0 || savingFileCount > 0 || failedSaveFileCount > 0) && (
            <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.unsaved}>
              <button
                type="button"
                data-testid="status-bar-unsaved-summary"
                className={buttonItemClassName}
                onClick={onOpenUnsavedFiles}
              >
                {savingFileCount > 0 ? <LoaderCircle size={11} className="animate-spin" /> : <Save size={11} />}
                <span>{dirtyFileCount === 1 ? '1 Unsaved' : `${dirtyFileCount} Unsaved`}</span>
              </button>
            </StatusBarHoverItem>
          )}
          {savingFileCount > 0 && (
            <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.saving}>
              <div className={compactItemClassName} data-testid="status-bar-saving-summary">
                <LoaderCircle size={11} className="animate-spin" />
                <span>Saving {savingFileCount}</span>
              </div>
            </StatusBarHoverItem>
          )}
          {failedSaveFileCount > 0 && (
            <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.saveError}>
              <button
                type="button"
                data-testid="status-bar-save-error-summary"
                className={buttonItemClassName}
                onClick={onOpenUnsavedFiles}
              >
                <AlertCircle size={11} />
                <span>{failedSaveFileCount === 1 ? '1 Save Failed' : `${failedSaveFileCount} Saves Failed`}</span>
              </button>
            </StatusBarHoverItem>
          )}
          {dirtyFileCount > 0 && onSaveAll && (
            <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.saveAll}>
              <button
                type="button"
                data-testid="status-bar-save-all"
                className={buttonItemClassName}
                disabled={savingFileCount > 0}
                onClick={onSaveAll}
              >
                <Save size={11} />
                <span>Save All</span>
              </button>
            </StatusBarHoverItem>
          )}
          <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.problems}>
            <div className={groupedItemClassName}>
              <div className="flex items-center gap-1">
                <AlertCircle size={11} />
                <span data-testid="status-bar-error-count">{errorCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle size={11} />
                <span data-testid="status-bar-warning-count">{warningCount}</span>
              </div>
            </div>
          </StatusBarHoverItem>
          <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.verilator}>
            <div className={compactItemClassName}>
              <Zap size={11} />
              <span>Verilator 5.024</span>
            </div>
          </StatusBarHoverItem>
        </>
      )}
      right={(
        <>
          <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.cursor}>
            <div className={wideTextItemClassName}>
              <span>
                Ln {cursorLine}, Col {cursorCol}
              </span>
            </div>
          </StatusBarHoverItem>
          <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.indentation}>
            <div className={compactTextItemClassName}>
              <span>Spaces: 4</span>
            </div>
          </StatusBarHoverItem>
          <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.encoding}>
            <div className={compactTextItemClassName}>
              <span>UTF-8</span>
            </div>
          </StatusBarHoverItem>
          <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.lineEnding}>
            <div className={compactTextItemClassName}>
              <span>LF</span>
            </div>
          </StatusBarHoverItem>
          <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.language}>
            <div className={wideTextItemClassName}>
              <span>{lang}</span>
            </div>
          </StatusBarHoverItem>
          <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.notifications}>
            <div className={compactTextItemClassName}>
              <Bell size={12} />
            </div>
          </StatusBarHoverItem>
        </>
      )}
    />
  );
}
