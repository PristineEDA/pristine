import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Bot,
  ChevronUp,
  FileCode2,
  RefreshCw,
  ArrowUp,
  Plus,
  X,
} from "lucide-react";
import {
  AGENT_OPTIONS,
  ATTACH_OPTIONS,
  DEFAULT_MODEL,
  MODEL_OPTIONS,
  QUICK_ACTIONS,
  getTokenLimitForModel,
  type AssistantAgentMode,
  type AssistantAgentOption,
  type AssistantModelOption,
} from '../../aiAssistant/config';
import { MessageThread } from '../../aiAssistant/MessageThread';
import { useAIConversation } from '../../aiAssistant/useAIConversation';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Progress } from '../../ui/progress';
import { Separator } from '../../ui/separator';
import { Textarea } from '../../ui/textarea';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';

interface ContextBadgeProps {
  fileName: string;
  description?: string;
  meta?: string;
}

function ContextBadge({ fileName, description, meta }: ContextBadgeProps) {
  return (
    <Badge
      variant="outline"
      className="h-6 max-w-full justify-start gap-1 rounded-md border-border bg-background px-2 text-[10px] font-normal text-muted-foreground shadow-xs hover:bg-accent hover:text-accent-foreground"
    >
      <FileCode2 className="size-3 text-muted-foreground" />
      <span className="max-w-[72px] truncate font-medium text-foreground">{fileName}</span>
      {description && (
        <>
          <span className="text-muted-foreground/60">·</span>
          <span className="max-w-[92px] truncate">{description}</span>
        </>
      )}
      {meta && <span className="text-muted-foreground/70">{meta}</span>}
      <X className="ml-0.5 size-3 text-muted-foreground/70" aria-hidden="true" />
    </Badge>
  );
}

function TokenUsage({
  maxTokens,
  maxLabel,
  tokenLabel,
  tokenPct,
  usedTokens,
}: {
  maxTokens: number;
  maxLabel: string;
  tokenLabel: string;
  tokenPct: number;
  usedTokens: number;
}) {
  return (
    <div
      className="ml-auto mr-1 flex min-w-0 items-center gap-1.5"
      title={`${usedTokens.toLocaleString()} / ${maxTokens.toLocaleString()} tokens used`}
    >
      <Progress value={tokenPct} aria-label="Token usage" className="h-1.5 w-14 bg-muted" />
      <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
        {tokenLabel}/{maxLabel}
      </span>
    </div>
  );
}

function AgentModeMenu({
  open,
  selectedAgent,
  selectedAgentOption,
  onOpenChange,
  onSelectAgent,
}: {
  open: boolean;
  selectedAgent: AssistantAgentMode;
  selectedAgentOption?: AssistantAgentOption;
  onOpenChange: (open: boolean) => void;
  onSelectAgent: (agent: AssistantAgentMode) => void;
}) {
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" className="h-7 cursor-pointer px-2 text-primary">
          <Bot className="size-3" />
          <span className="max-w-[52px] truncate text-[10px] font-medium">
            {selectedAgentOption?.label}
          </span>
          <ChevronUp className={`size-3 text-muted-foreground transition-transform ${open ? '' : 'rotate-180'}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Mode</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={selectedAgent}
          onValueChange={(value) => onSelectAgent(value as AssistantAgentMode)}
        >
          {AGENT_OPTIONS.map((agent) => (
            <DropdownMenuRadioItem key={agent.id} value={agent.id} className="items-start py-2 text-xs">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium text-foreground">{agent.label}</span>
                <span className="text-[10px] leading-snug text-muted-foreground">{agent.desc}</span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ModelMenu({
  open,
  selectedModel,
  onOpenChange,
  onSelectModel,
}: {
  open: boolean;
  selectedModel: string;
  onOpenChange: (open: boolean) => void;
  onSelectModel: (model: string) => void;
}) {
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" className="h-7 min-w-0 cursor-pointer px-2">
          <span className="max-w-[86px] truncate text-[10px] font-medium text-foreground">
            {selectedModel}
          </span>
          <ChevronUp className={`size-3 text-muted-foreground transition-transform ${open ? '' : 'rotate-180'}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Model</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={selectedModel} onValueChange={onSelectModel}>
          {MODEL_OPTIONS.map((model: AssistantModelOption) => (
            <DropdownMenuRadioItem key={model.id} value={model.id} className="items-start py-2 text-xs">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium text-foreground">{model.label}</span>
                <span className="text-[10px] leading-snug text-muted-foreground">ctx {model.tokens}</span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── AI Assistant Panel ────────────────────────────────────────────────────────
export function AIAssistantPanel() {
  const { input, isTyping, messages, setInput, sendMessage, clearConversation } = useAIConversation();
  const [agentOpen, setAgentOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AssistantAgentMode>('agent');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedAgentOption = AGENT_OPTIONS.find((agent) => agent.id === selectedAgent);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const autoResizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const closeSiblingMenus = (menu: 'agent' | 'attach' | 'model') => {
    if (menu !== 'agent') setAgentOpen(false);
    if (menu !== 'attach') setAttachOpen(false);
    if (menu !== 'model') setModelOpen(false);
  };

  // Token usage mock
  const usedTokens = 2417;
  const maxTokens = getTokenLimitForModel(selectedModel);
  const tokenPct = Math.min(
    (usedTokens / maxTokens) * 100,
    100,
  );
  const tokenLabel =
    usedTokens >= 1000
      ? `${(usedTokens / 1000).toFixed(1)}k`
      : `${usedTokens}`;
  const maxLabel =
    maxTokens >= 1000000
      ? `${maxTokens / 1000000}M`
      : `${maxTokens / 1000}k`;

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="size-3.5" />
        </div>
        <span className="text-xs font-semibold">AI Assistant</span>
        <div className="ml-auto">
          <TooltipIconButton content="Clear conversation">
            <Button
              aria-label="Clear conversation"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              onClick={() => {
                clearConversation();
                resetTextareaHeight();
              }}
            >
              <RefreshCw className="size-3" />
            </Button>
          </TooltipIconButton>
        </div>
      </div>

      <Separator />

      {/* Quick actions */}
      <div className="flex shrink-0 flex-wrap gap-1 px-2 py-1.5">
        {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
          <Button
            key={label}
            variant="secondary"
            size="xs"
            className="h-6 cursor-pointer rounded-md px-2 text-[11px]"
            onClick={() => setInput(label)}
          >
            <Icon className="size-3" />
            {label}
          </Button>
        ))}
      </div>

      <Separator />

      <MessageThread messages={messages} isTyping={isTyping} bottomRef={bottomRef} />

      <Separator />
      {/* ── Copilot-style Input Box ── */}
      <div className="shrink-0 space-y-1.5 px-2 pb-2 pt-1.5">
        {/* Current task context chip */}
        <div className="flex flex-wrap items-center gap-1">
          <ContextBadge fileName="uart_tx.v" description="uart_core" meta="240-349" />
        </div>

        {/* Main prompt card */}
        <Card className="gap-0 rounded-lg border-border bg-card py-0 shadow-xs">
          <CardContent className="px-0">
            {/* Textarea */}
            <Textarea
              ref={textareaRef}
              value={input}
              spellCheck={false}
              onChange={(e) => {
                setInput(e.target.value);
                autoResizeTextarea();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                  resetTextareaHeight();
                }
              }}
              placeholder="describe your plans or tasks"
              className="min-h-[52px] max-h-[120px] resize-none rounded-b-none border-0 bg-transparent px-3 pb-1 pt-2.5 text-xs leading-relaxed shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-xs"
              rows={1}
            />

            <Separator />

            {/* Bottom toolbar */}
            <div className="space-y-1 px-2 py-1.5">
              <div className="flex min-w-0 items-center gap-1">
                {/* Attach button + dropdown */}
                <DropdownMenu
                  modal={false}
                  open={attachOpen}
                  onOpenChange={(open) => {
                    setAttachOpen(open);
                    if (open) closeSiblingMenus('attach');
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button aria-label="Add attachment" variant="ghost" size="icon-xs" className="cursor-pointer text-muted-foreground">
                      <Plus className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start" className="w-48">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Add context</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ATTACH_OPTIONS.map(({ icon: Icon, label, desc }) => (
                      <DropdownMenuItem
                        key={label}
                        className="items-start gap-2 py-2 text-xs"
                        onSelect={() => setAttachOpen(false)}
                      >
                        <Icon className="mt-0.5 size-3.5 text-muted-foreground" />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-medium text-foreground">{label}</span>
                          <span className="text-[10px] leading-snug text-muted-foreground">{desc}</span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex min-w-0 items-center gap-0.5">
                  {/* Agent mode dropdown */}
                  <AgentModeMenu
                    open={agentOpen}
                    selectedAgent={selectedAgent}
                    selectedAgentOption={selectedAgentOption}
                    onOpenChange={(open) => {
                      setAgentOpen(open);
                      if (open) closeSiblingMenus('agent');
                    }}
                    onSelectAgent={(agent) => {
                      setSelectedAgent(agent);
                      setAgentOpen(false);
                    }}
                  />

                  {/* Model dropdown */}
                  <ModelMenu
                    open={modelOpen}
                    selectedModel={selectedModel}
                    onOpenChange={(open) => {
                      setModelOpen(open);
                      if (open) closeSiblingMenus('model');
                    }}
                    onSelectModel={(model) => {
                      setSelectedModel(model);
                      setModelOpen(false);
                    }}
                  />
                </div>

                {/* Send button */}
                <div className="ml-auto">
                  <TooltipIconButton content="Send (Enter)" wrapTrigger>
                    <Button
                      aria-label="Send (Enter)"
                      size="icon-xs"
                      className="cursor-pointer"
                      onClick={() => {
                        sendMessage();
                        resetTextareaHeight();
                      }}
                      disabled={!input.trim()}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                  </TooltipIconButton>
                </div>
              </div>

              <div className="flex min-w-0 items-center">
                {/* Token usage */}
                <TokenUsage
                  maxTokens={maxTokens}
                  maxLabel={maxLabel}
                  tokenLabel={tokenLabel}
                  tokenPct={tokenPct}
                  usedTokens={usedTokens}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}