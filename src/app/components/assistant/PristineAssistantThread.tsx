import {
  AuiIf,
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  makeAssistantToolUI,
  useAssistantInstructions,
  unstable_useMentionAdapter,
  unstable_useSlashCommandAdapter,
} from '@assistant-ui/react';
import {
  ArrowDown,
  ArrowUpIcon,
  Copy,
  FileCode2,
  RotateCcw,
  Shell,
  Sparkles,
  SquareIcon,
} from 'lucide-react';
import type { PropsWithChildren, ReactNode } from 'react';

import { cn } from '@/lib/utils';
import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from '@/app/components/assistant-ui/attachment';
import { ContextDisplay } from '@/app/components/assistant-ui/context-display';
import { ComposerTriggerPopover } from '@/app/components/assistant-ui/composer-trigger-popover';
import { DirectiveText } from '@/app/components/assistant-ui/directive-text';
import { MarkdownText } from '@/app/components/assistant-ui/markdown-text';
import { Button } from '../ui/button';
import { TooltipIconButton } from "@/app/components/assistant-ui/tooltip-icon-button";
import {
  PRISTINE_CONTEXT_WINDOW,
  mockPristineContextUsage,
} from './pristineAssistantContext';
import {
  mockPristineMentionCategories,
  mockPristineSlashCommands,
} from './pristineAssistantTriggers';

type PristineAssistantThreadProps = {
  className?: string;
};

type FileChangeToolArgs = {
  kind?: string;
  path?: string;
  targetPath?: string;
  summary?: string;
};

type FileChangeToolResult = {
  id?: string;
  kind?: string;
  path?: string;
  targetPath?: string;
  summary?: string;
  status?: string;
  unifiedDiff?: string;
};

type ShellCommandToolArgs = {
  command?: string;
  args?: string[];
  cwd?: string;
  summary?: string;
};

type ShellCommandToolResult = {
  id?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  summary?: string;
  status?: string;
  stdout?: string;
  stderr?: string;
};

const messageSurfaceClassName = 'rounded-md border border-border bg-background px-3 py-2 shadow-xs';
const actionButtonClassName = 'inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50';

const triggerIconMap = {
  context: FileCode2,
  tools: Shell,
  FileCode2,
  Shell,
  Sparkles,
};

function PreviewText({ value }: { value: string }) {
  return (
    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
      {value}
    </pre>
  );
}

function ToolPanel({
  children,
  icon,
  status,
  title,
}: PropsWithChildren<{
  icon: ReactNode;
  status: string;
  title: string;
}>) {
  return (
    <div className="my-2 overflow-hidden rounded-md border border-border bg-muted/30 text-[11px]">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-2 py-1.5 text-muted-foreground">
        {icon}
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</span>
        <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[9px] uppercase tracking-normal text-muted-foreground">
          {status}
        </span>
      </div>
      <div className="space-y-2 p-2 text-muted-foreground">{children}</div>
    </div>
  );
}

function ToolMetaLine({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-[10px] text-muted-foreground/70">{label}</span>
      <span className="min-w-0 truncate font-mono text-[10px] text-foreground">{value}</span>
    </div>
  );
}

function formatToolStatus(status: { type: string }, hasResult: boolean): string {
  if (hasResult) {
    return 'ready';
  }

  return status.type;
}

const ProposedFileChangeToolUI = makeAssistantToolUI<FileChangeToolArgs, FileChangeToolResult>({
  toolName: 'propose_file_change',
  render: ({ args, result, status }) => {
    const path = result?.path ?? args.path;
    const title = result?.summary ?? args.summary ?? 'File change proposal';

    return (
      <ToolPanel
        icon={<FileCode2 className="size-3" />}
        status={formatToolStatus(status, Boolean(result))}
        title={title}
      >
        <ToolMetaLine label="path" value={path} />
        <ToolMetaLine label="kind" value={result?.kind ?? args.kind} />
        <ToolMetaLine label="target" value={result?.targetPath ?? args.targetPath} />
        {result?.unifiedDiff && <PreviewText value={result.unifiedDiff} />}
      </ToolPanel>
    );
  },
});

const ProposedShellCommandToolUI = makeAssistantToolUI<ShellCommandToolArgs, ShellCommandToolResult>({
  toolName: 'propose_shell_command',
  render: ({ args, result, status }) => {
    const command = [result?.command ?? args.command, ...(result?.args ?? args.args ?? [])].filter(Boolean).join(' ');
    const title = result?.summary ?? args.summary ?? 'Shell command proposal';

    return (
      <ToolPanel
        icon={<Shell className="size-3" />}
        status={formatToolStatus(status, Boolean(result))}
        title={title}
      >
        <ToolMetaLine label="cmd" value={command} />
        <ToolMetaLine label="cwd" value={result?.cwd ?? args.cwd} />
        {result?.stdout && <PreviewText value={result.stdout} />}
        {result?.stderr && <PreviewText value={result.stderr} />}
      </ToolPanel>
    );
  },
});

function PristineAssistantInstructions() {
  useAssistantInstructions('You are embedded in the Pristine IDE right sidebar. Keep responses concise, cite workspace-relative paths when useful, and use buffered file/shell proposal tools for mutations.');
  return null;
}

export function PristineAssistantToolUIs() {
  return (
    <>
      <ProposedFileChangeToolUI />
      <ProposedShellCommandToolUI />
    </>
  );
}

function ThreadWelcome() {
  const suggestions = [
    'Inspect the current RTL project structure',
    'Find likely lint or synthesis issues',
    'Propose a focused test plan',
  ];

  return (
    <ThreadPrimitive.Empty>
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted text-primary">
          <Sparkles className="size-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Pristine Agent</h3>
          <p className="max-w-56 text-[11px] leading-relaxed text-muted-foreground">
            Workspace-aware coding help with buffered changes and approved shell runs.
          </p>
        </div>
        <div className="flex w-full max-w-64 flex-col gap-1.5">
          {suggestions.map((prompt) => (
            <ThreadPrimitive.Suggestion
              key={prompt}
              prompt={prompt}
              className="min-h-8 rounded-md border border-border bg-background px-2 py-1.5 text-left text-[11px] font-normal text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              {prompt}
            </ThreadPrimitive.Suggestion>
          ))}
        </div>
      </div>
    </ThreadPrimitive.Empty>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end px-1 py-2">
      <div className="flex max-w-[88%] flex-col items-end gap-2">
        <UserMessageAttachments />
        <div className={cn(messageSurfaceClassName, 'border-primary/20 bg-primary text-[12px] leading-relaxed text-primary-foreground')}>
          <MessagePrimitive.Parts components={{ Text: DirectiveText }} />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="group flex px-1 py-2">
      <div className="flex max-w-[92%] items-start">
        <div className="min-w-0 flex-1">
          <div className={cn(messageSurfaceClassName, 'text-[12px] leading-relaxed')}>
            <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
          </div>
          <ActionBarPrimitive.Root
            autohide="not-last"
            hideWhenRunning
            className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 data-[floating=true]:opacity-100"
          >
            <ActionBarPrimitive.Copy className={actionButtonClassName} aria-label="Copy response">
              <Copy className="size-3" />
            </ActionBarPrimitive.Copy>
            <ActionBarPrimitive.Reload className={actionButtonClassName} aria-label="Regenerate response">
              <RotateCcw className="size-3" />
            </ActionBarPrimitive.Reload>
          </ActionBarPrimitive.Root>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function SystemMessage() {
  return null;
}

function ThreadScrollToBottom() {
  return (
    <ThreadPrimitive.ScrollToBottom className="absolute bottom-24 right-3 inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:hidden">
      <ArrowDown className="size-3.5" />
    </ThreadPrimitive.ScrollToBottom>
  );
}

function Composer() {
  const mention = unstable_useMentionAdapter({ categories: mockPristineMentionCategories });
  const slash = unstable_useSlashCommandAdapter({ commands: mockPristineSlashCommands });

  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      <ComposerPrimitive.Root className="relative rounded-md border border-border bg-background [--composer-padding:0.25rem] [--composer-radius:0.375rem] focus-within:border-ring focus-within:ring-[1px] focus-within:ring-ring/40">
        <ComposerPrimitive.AttachmentDropzone className="flex min-h-16 w-full flex-col rounded-md outline-none transition-colors data-[dragging=true]:bg-accent/30">
          <ComposerAttachments />
          <ComposerPrimitive.Input
            autoFocus
            className="max-h-36 min-h-16 w-full resize-none bg-transparent px-3 py-2 text-[12px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="Type @ for context, / for commands..."
            submitMode="enter"
            aria-label="Message input"
          />
          <div className="flex min-h-8 items-center justify-between gap-2 border-t border-border/60 px-2 py-1">
            <ContextDisplay.Bar
              modelContextWindow={PRISTINE_CONTEXT_WINDOW}
              usage={mockPristineContextUsage}
              side="top"
              className="h-6 rounded-md border border-border bg-muted/30 text-[10px] hover:bg-accent hover:text-accent-foreground"
            />
            <div className="flex items-center gap-1">
              <ComposerAddAttachment />
              <AuiIf condition={(s) => !s.thread.isRunning}>
                <ComposerPrimitive.Send asChild>
                  <TooltipIconButton
                    tooltip="Send message"
                    side="bottom"
                    variant="default"
                    size="icon"
                    className="size-6 rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                    aria-label="Send message"
                  >
                    <ArrowUpIcon className="size-3" />
                  </TooltipIconButton>
                </ComposerPrimitive.Send>
              </AuiIf>

              <AuiIf condition={(s) => s.thread.isRunning}>
                <ComposerPrimitive.Cancel asChild>
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    className="size-6 rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                    aria-label="Stop generating"
                  >
                    <SquareIcon className="size-3" />
                  </Button>
                </ComposerPrimitive.Cancel>
              </AuiIf>
            </div>
          </div>
        </ComposerPrimitive.AttachmentDropzone>
        <ComposerTriggerPopover
          char="@"
          adapter={mention.adapter}
          directive={mention.directive}
          iconMap={triggerIconMap}
          fallbackIcon={Sparkles}
        />
        <ComposerTriggerPopover
          char="/"
          adapter={slash.adapter}
          action={slash.action}
          iconMap={triggerIconMap}
          fallbackIcon={Sparkles}
        />
      </ComposerPrimitive.Root>
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  );
}

export function PristineAssistantThread({ className }: PristineAssistantThreadProps) {
  return (
    <ThreadPrimitive.Root className={cn('relative flex min-h-0 flex-1 flex-col bg-background', className)}>
      <PristineAssistantInstructions />
      <PristineAssistantToolUIs />
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-2 py-1" autoScroll turnAnchor="bottom">
        <ThreadWelcome />
        <ThreadPrimitive.Messages
          components={{
            AssistantMessage,
            SystemMessage,
            UserMessage,
          }}
        />
      </ThreadPrimitive.Viewport>
      <ThreadScrollToBottom />
      <div className="shrink-0 bg-background p-2">
        <Composer />
      </div>
    </ThreadPrimitive.Root>
  );
}
