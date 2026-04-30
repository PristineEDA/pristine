import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/react-ai-sdk';
import {
  Check,
  FileCode2,
  Play,
  RefreshCw,
  Server,
  Shell,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useMemo } from 'react';

import { PristineAssistantThread } from '../../assistant/PristineAssistantThread';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Separator } from '../../ui/separator';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';
import {
  getPristineAgentBaseUrl,
  normalizeAgentBaseUrl,
  type PendingFileChange,
  type PendingShellCommand,
} from './agentApi';
import { useAgentApprovals } from './useAgentApprovals';

type AIAgentPanelProps = {
  baseUrl?: string;
};

const pendingLimit = 4;

function ProviderBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={`h-5 rounded-md px-1.5 text-[9px] font-normal ${enabled ? 'border-ide-success/50 text-ide-success' : 'text-muted-foreground'}`}
    >
      {label}
    </Badge>
  );
}

function PendingFileChangeCard({
  busyActionId,
  change,
  onApply,
  onDiscard,
}: {
  busyActionId: string | null;
  change: PendingFileChange;
  onApply: (changeId: string) => void;
  onDiscard: (changeId: string) => void;
}) {
  const applyActionId = `change:${change.id}:apply`;
  const discardActionId = `change:${change.id}:discard`;
  const isBusy = busyActionId === applyActionId || busyActionId === discardActionId;

  return (
    <div className="rounded-md border border-border bg-background p-2 shadow-xs">
      <div className="flex min-w-0 items-center gap-2">
        <FileCode2 className="size-3.5 shrink-0 text-ide-info" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-medium text-foreground">{change.summary}</div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">
            {change.targetPath ? `${change.path} -> ${change.targetPath}` : change.path}
          </div>
        </div>
        <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[9px] font-normal text-muted-foreground">
          {change.kind}
        </Badge>
      </div>
      {change.unifiedDiff && (
        <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          {change.unifiedDiff}
        </pre>
      )}
      <div className="mt-2 flex justify-end gap-1.5">
        <Button
          size="xs"
          variant="ghost"
          className="h-6 text-muted-foreground"
          disabled={isBusy}
          onClick={() => onDiscard(change.id)}
        >
          <Trash2 className="size-3" />
          Discard
        </Button>
        <Button
          size="xs"
          className="h-6"
          disabled={isBusy}
          onClick={() => onApply(change.id)}
        >
          <Check className="size-3" />
          Apply
        </Button>
      </div>
    </div>
  );
}

function PendingShellCommandCard({
  busyActionId,
  command,
  onDiscard,
  onRun,
}: {
  busyActionId: string | null;
  command: PendingShellCommand;
  onDiscard: (commandId: string) => void;
  onRun: (commandId: string) => void;
}) {
  const runActionId = `command:${command.id}:run`;
  const discardActionId = `command:${command.id}:discard`;
  const isBusy = busyActionId === runActionId || busyActionId === discardActionId;
  const commandLine = [command.command, ...command.args].join(' ');

  return (
    <div className="rounded-md border border-border bg-background p-2 shadow-xs">
      <div className="flex min-w-0 items-center gap-2">
        <Shell className="size-3.5 shrink-0 text-ide-warning" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-medium text-foreground">{command.summary}</div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">{commandLine}</div>
        </div>
        <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[9px] font-normal text-muted-foreground">
          {command.cwd}
        </Badge>
      </div>
      <div className="mt-2 flex justify-end gap-1.5">
        <Button
          size="xs"
          variant="ghost"
          className="h-6 text-muted-foreground"
          disabled={isBusy}
          onClick={() => onDiscard(command.id)}
        >
          <Trash2 className="size-3" />
          Discard
        </Button>
        <Button
          size="xs"
          className="h-6"
          disabled={isBusy}
          onClick={() => onRun(command.id)}
        >
          <Play className="size-3" />
          Run
        </Button>
      </div>
    </div>
  );
}

function ApprovalDock({ baseUrl }: { baseUrl: string }) {
  const {
    applyChange,
    busyActionId,
    discardChange,
    discardCommand,
    refresh,
    runCommand,
    snapshot,
  } = useAgentApprovals(baseUrl);
  const pendingChanges = snapshot.changes.filter((change) => change.status === 'pending').slice(0, pendingLimit);
  const pendingCommands = snapshot.commands.filter((command) => command.status === 'pending').slice(0, pendingLimit);
  const hasPendingItems = pendingChanges.length > 0 || pendingCommands.length > 0;

  return (
    <div className="shrink-0 border-b border-border bg-muted/30">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className={`size-2 rounded-full ${snapshot.error ? 'bg-destructive' : 'bg-ide-success'}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-medium text-foreground">
            {snapshot.status?.model ?? 'Agent server'}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">{baseUrl}</div>
        </div>
        <TooltipIconButton content="Refresh agent status" side="bottom">
          <Button
            aria-label="Refresh agent status"
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground"
            onClick={refresh}
          >
            <RefreshCw className={`size-3 ${snapshot.isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </TooltipIconButton>
      </div>

      {snapshot.status && (
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          <ProviderBadge enabled={snapshot.status.providers.openrouter} label="OpenRouter" />
          <ProviderBadge enabled={snapshot.status.providers.openai} label="OpenAI" />
          <ProviderBadge enabled={snapshot.status.providers.anthropic} label="Anthropic" />
          <ProviderBadge enabled={snapshot.status.providers.google} label="Google" />
          <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[9px] font-normal text-muted-foreground">
            MCP {snapshot.status.mcpServers.length}
          </Badge>
        </div>
      )}

      {snapshot.error && (
        <div className="mx-3 mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          {snapshot.error}
        </div>
      )}

      {hasPendingItems && (
        <>
          <Separator />
          <div className="max-h-72 space-y-2 overflow-y-auto p-2">
            <div className="flex items-center gap-2 px-1 text-[10px] font-medium uppercase tracking-normal text-muted-foreground">
              <ShieldCheck className="size-3" />
              Pending approvals
            </div>
            {pendingChanges.map((change) => (
              <PendingFileChangeCard
                key={change.id}
                busyActionId={busyActionId}
                change={change}
                onApply={applyChange}
                onDiscard={discardChange}
              />
            ))}
            {pendingCommands.map((command) => (
              <PendingShellCommandCard
                key={command.id}
                busyActionId={busyActionId}
                command={command}
                onDiscard={discardCommand}
                onRun={runCommand}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AIAgentPanel({ baseUrl = getPristineAgentBaseUrl() }: AIAgentPanelProps) {
  const normalizedBaseUrl = useMemo(() => normalizeAgentBaseUrl(baseUrl), [baseUrl]);
  const transport = useMemo(() => new AssistantChatTransport({
    api: `${normalizedBaseUrl}/chat/pristineAgent`,
  }), [normalizedBaseUrl]);
  const runtime = useChatRuntime({ transport });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Server className="size-3.5" />
          </div>
          <span className="text-xs font-semibold">Pristine Agent</span>
        </div>
        <ApprovalDock baseUrl={normalizedBaseUrl} />
        <PristineAssistantThread />
      </div>
    </AssistantRuntimeProvider>
  );
}