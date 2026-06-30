import type { ReactNode } from 'react';
import {
  GitBranch, AlertCircle, AlertTriangle, Bell, CheckCircle2, CircleX, Info, TriangleAlert, X,
  AlignHorizontalSpaceAround,
  Briefcase,
  ClipboardType,
  Save,
  SquareMousePointer,
  LoaderCircle,
  type LucideIcon,
} from 'lucide-react';
import { getWorkspaceGitBranchLabel, useWorkspaceGitStatus } from '../../../../git/workspaceGitStatus';
import { summarizeLspProblems, useLspProblems } from '../../../../lsp/lspProblems';
import { getEditorLanguageLabel, getPathBaseName } from '../../../../workspace/workspaceFiles';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../../../ui/hover-card';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '../../../../notifications/useNotificationStore';
import type { NotificationLevel, NotificationRecord } from '../../../../../../types/notification';
import { WorkspaceFileIcon } from '../WorkspaceEntryIcon';
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
  | 'fileFormat'
  | 'language';

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
  fileFormat: {
    title: 'File Format',
    description: 'Placeholder details about the active line ending and encoding.',
    meta: 'Preview content only',
  },
  language: {
    title: 'Language Mode',
    description: 'Placeholder details about the active editor language.',
    meta: 'Preview content only',
  },
};

const STATUS_BAR_HOVER_OPEN_DELAY_MS = 160;
const STATUS_BAR_HOVER_TRIGGER_CLASS_NAME = 'h-full transition-colors hover:bg-[var(--status-bar-item-hover)]';
const STATUS_BAR_HOVER_CONTENT_CLASS_NAME = 'data-[state=closed]:animate-none';

function StatusBarHoverDetails({ copy }: { copy: StatusBarHoverCopy }) {
  return (
    <div className="space-y-1.5">
      <div className="space-y-1">
        <p className="text-sm font-semibold leading-none">{copy.title}</p>
        <p className="text-sm text-ide-text-muted">{copy.description}</p>
      </div>
      <p className="text-xs text-ide-text-muted">{copy.meta ?? 'Preview content only'}</p>
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
        <div className={STATUS_BAR_HOVER_TRIGGER_CLASS_NAME} tabIndex={0}>
          {children}
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="top" className={STATUS_BAR_HOVER_CONTENT_CLASS_NAME}>
        <StatusBarHoverDetails copy={copy} />
      </HoverCardContent>
    </HoverCard>
  );
}

const notificationLevelMeta: Record<NotificationLevel, {
  accentClassName: string;
  icon: LucideIcon;
  label: string;
}> = {
  error: {
    accentClassName: 'text-ide-error',
    icon: CircleX,
    label: 'Error',
  },
  info: {
    accentClassName: 'text-ide-info',
    icon: Info,
    label: 'Info',
  },
  warning: {
    accentClassName: 'text-ide-warning',
    icon: TriangleAlert,
    label: 'Warning',
  },
};

function formatNotificationTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function NotificationHistoryCard({ record }: { record: NotificationRecord }) {
  const dismiss = useNotificationStore((state) => state.dismiss);
  const meta = notificationLevelMeta[record.level];
  const Icon = meta.icon;

  return (
    <article
      className="rounded-md border border-ide-border bg-ide-bg/95 px-3 py-2 shadow-sm"
      data-testid={`status-bar-notification-card-${record.level}`}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn('mt-0.5 size-3.5 shrink-0', meta.accentClassName)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[12px] font-semibold leading-4 text-ide-text">{record.title}</p>
            <span className={cn('shrink-0 text-[10px] font-medium uppercase leading-3', meta.accentClassName)}>
              {meta.label}
            </span>
          </div>
          {record.body ? (
            <p className="mt-1 text-[11px] leading-4 text-ide-text-muted">{record.body}</p>
          ) : null}
          <p className="mt-1 text-[10px] leading-3 text-ide-text-muted">{formatNotificationTime(record.createdAt)}</p>
        </div>
        <button
          type="button"
          aria-label={`Dismiss ${record.title}`}
          className="rounded-sm p-0.5 text-ide-text-muted transition-colors hover:bg-ide-hover hover:text-ide-text"
          data-testid={`status-bar-notification-dismiss-${record.id}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void dismiss(record.id);
          }}
        >
          <X className="size-3" />
        </button>
      </div>
    </article>
  );
}

function StatusBarNotifications({ itemClassName }: { itemClassName: string }) {
  const history = useNotificationStore((state) => state.history);
  const hasNotifications = history.length > 0;

  return (
    <HoverCard openDelay={STATUS_BAR_HOVER_OPEN_DELAY_MS} closeDelay={0}>
      <HoverCardTrigger asChild>
        <div className={STATUS_BAR_HOVER_TRIGGER_CLASS_NAME} tabIndex={0}>
          <div
            className={cn(itemClassName, hasNotifications ? 'text-ide-info' : undefined)}
            data-testid="status-bar-notifications"
          >
            <Bell size={12} />
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        align="end"
        side="top"
        className={cn(STATUS_BAR_HOVER_CONTENT_CLASS_NAME, 'w-80 p-0')}
        data-testid="status-bar-notifications-popover"
      >
        <div className="border-b border-ide-border px-3 py-2">
          <p className="text-[12px] font-semibold leading-4 text-ide-text">Notifications</p>
          <p className="text-[11px] leading-4 text-ide-text-muted">
            {hasNotifications ? `${history.length} recent notification${history.length === 1 ? '' : 's'}` : 'No notifications yet.'}
          </p>
        </div>
        {hasNotifications ? (
          <div
            className="max-h-72 space-y-2 overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            data-testid="status-bar-notifications-list"
          >
            {history.map((record) => (
              <NotificationHistoryCard key={record.id} record={record} />
            ))}
          </div>
        ) : (
          <div className="px-3 py-5 text-center text-[12px] text-ide-text-muted" data-testid="status-bar-notifications-empty">
            No notifications yet.
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

interface StatusBarIconTextItemProps {
  icon: LucideIcon;
  iconTestId?: string;
  itemClassName: string;
  text: string;
  textClassName?: string;
}

function StatusBarIconTextItem({
  icon: Icon,
  iconTestId,
  itemClassName,
  text,
  textClassName,
}: StatusBarIconTextItemProps) {
  return (
    <div className={itemClassName}>
      <Icon size={12} data-testid={iconTestId} />
      <span className={textClassName}>{text}</span>
    </div>
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
  const hasActiveEditor = activeFileId.length > 0;
  const lang = hasActiveEditor ? getEditorLanguageLabel(activeFileId) : '';
  const activeFileName = hasActiveEditor ? getPathBaseName(activeFileId) : '';
  const languageHoverCopy = hasActiveEditor
    ? { ...STATUS_BAR_HOVER_COPY.language, description: lang }
    : STATUS_BAR_HOVER_COPY.language;
  const buttonItemClassName = 'flex h-full items-center gap-1 px-2 text-[11px] disabled:cursor-default disabled:opacity-60';
  const compactItemClassName = 'flex h-full items-center gap-1 px-2 text-[11px] cursor-pointer';
  const compactEditorStatusItemClassName = 'flex h-full shrink-0 items-center gap-1 px-1.5 text-[11px] cursor-pointer';
  const compactTextItemClassName = 'flex h-full shrink-0 items-center px-2 text-[11px] cursor-pointer';
  const groupedItemClassName = 'flex h-full items-center gap-2.5 px-2 text-[11px] cursor-pointer';
  const wideItemClassName = 'flex h-full items-center gap-1 px-2.5 text-[11px] cursor-pointer';

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
              <CheckCircle2 size={11} className="text-ide-success" />
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
                {savingFileCount > 0 ? <LoaderCircle size={11} className="animate-spin text-ide-info" /> : <Save size={11} className="text-ide-warning" />}
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
                className={`${buttonItemClassName} text-ide-error`}
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
                <Save size={11} className="text-ide-warning" />
                <span>Save All</span>
              </button>
            </StatusBarHoverItem>
          )}
          <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.problems}>
            <div className={groupedItemClassName}>
              <div className="flex items-center gap-1">
                <AlertCircle size={11} className="text-ide-error" />
                <span data-testid="status-bar-error-count">{errorCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle size={11} className="text-ide-warning" />
                <span data-testid="status-bar-warning-count">{warningCount}</span>
              </div>
            </div>
          </StatusBarHoverItem>
          <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.verilator}>
            <div className={compactItemClassName}>
              <Briefcase size={11} />
              <span>Verilator 5.024</span>
            </div>
          </StatusBarHoverItem>
        </>
      )}
      right={(
        <>
          {hasActiveEditor && (
            <>
              <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.cursor}>
                <StatusBarIconTextItem
                  icon={SquareMousePointer}
                  iconTestId="status-bar-cursor-icon"
                  itemClassName={compactEditorStatusItemClassName}
                  text={`${cursorLine}:${cursorCol}`}
                  textClassName="tabular-nums"
                />
              </StatusBarHoverItem>
              <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.fileFormat}>
                <StatusBarIconTextItem
                  icon={ClipboardType}
                  iconTestId="status-bar-file-format-icon"
                  itemClassName={compactEditorStatusItemClassName}
                  text="LF:UTF-8"
                />
              </StatusBarHoverItem>
              <StatusBarHoverItem copy={STATUS_BAR_HOVER_COPY.indentation}>
                <StatusBarIconTextItem
                  icon={AlignHorizontalSpaceAround}
                  iconTestId="status-bar-indentation-icon"
                  itemClassName={compactEditorStatusItemClassName}
                  text="4 spaces"
                />
              </StatusBarHoverItem>
              <StatusBarHoverItem copy={languageHoverCopy}>
                <div className={compactTextItemClassName}>
                  <WorkspaceFileIcon
                    name={activeFileName}
                    path={activeFileId}
                    className="h-3.5 w-3.5"
                    testId="status-bar-language-icon"
                  />
                </div>
              </StatusBarHoverItem>
            </>
          )}
          <StatusBarNotifications itemClassName={compactTextItemClassName} />
        </>
      )}
    />
  );
}
