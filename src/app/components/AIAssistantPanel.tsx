import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Bot,
  ChevronUp,
  FileCode2,
  RefreshCw,
  ArrowUp,
  Plus,
  Cpu,
  X,
} from "lucide-react";
import {
  AGENT_COLORS,
  AGENT_OPTIONS,
  ATTACH_OPTIONS,
  Check,
  DEFAULT_MODEL,
  MODEL_OPTIONS,
  QUICK_ACTIONS,
  getTokenLimitForModel,
  type AssistantAgentMode,
} from './aiAssistant/config';
import { MessageThread } from './aiAssistant/MessageThread';
import { useAIConversation } from './aiAssistant/useAIConversation';

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = () => {
      setAgentOpen(false);
      setModelOpen(false);
      setAttachOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () =>
      document.removeEventListener("mousedown", handler);
  }, []);

  const autoResizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <Sparkles size={14} className="text-ide-syntax-keyword" />
        <span
          className="text-foreground text-[12px] font-[600]"
        >
          AI Assistant
        </span>
        <div className="ml-auto">
          <button
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Clear conversation"
            onClick={() => {
              clearConversation();
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
              }
            }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-border shrink-0">
        {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className="flex items-center gap-1 px-2 py-0.5 bg-muted hover:bg-primary text-muted-foreground hover:text-primary-foreground rounded transition-colors text-[11px]"
            onClick={() => setInput(label)}
          >
            <Icon size={10} />
            {label}
          </button>
        ))}
      </div>

      <MessageThread messages={messages} isTyping={isTyping} bottomRef={bottomRef} />

      {/* ── Copilot-style Input Box ── */}
      <div className="px-2 pb-2 pt-1.5 border-t border-border shrink-0">
        {/* Current task context chip */}
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          <div
            className="flex items-center gap-1 px-2 py-0.5 bg-accent rounded border border-ide-chat-input-border text-muted-foreground cursor-pointer hover:border-muted-foreground/70 transition-colors text-[10px]"
          >
            <FileCode2 size={9} className="text-emerald-500" />
            <span className="text-blue-400">uart_tx.v</span>
            <span className="text-muted-foreground/70">·</span>
            <span>CLINT pipeline</span>
            <span className="text-muted-foreground/70 mx-0.5">1/9</span>
            <X
              size={8}
              className="hover:text-foreground ml-0.5"
            />
          </div>
          <div
            className="flex items-center gap-1 px-2 py-0.5 bg-accent rounded border border-ide-chat-input-border text-muted-foreground cursor-pointer hover:border-muted-foreground/70 transition-colors text-[10px]"
          >
            <FileCode2 size={9} className="text-ide-syntax-folder" />
            <span className="text-ide-syntax-function">cpu_top.v</span>
            <X
              size={8}
              className="hover:text-foreground ml-0.5"
            />
          </div>
        </div>

        {/* Main prompt card */}
        <div
          className="rounded-lg border border-border bg-ide-chat-bg focus-within:border-ide-chat-muted transition-colors"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoResizeTextarea();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                }
              }
            }}
            placeholder="Ask a question about your RTL code… (Shift+Enter for new line)"
            className="w-full bg-transparent text-ide-chat-text resize-none outline-none px-3 pt-2.5 pb-1 text-[12px] leading-[1.5] min-h-[38px] max-h-[120px] caret-[#f8f8f2]"
            rows={1}
          />

          {/* Bottom toolbar */}
          <div className="flex items-center gap-1 px-2 pb-2 pt-1 relative">
            {/* Attach button + dropdown */}
            <div
              className="relative"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setAttachOpen((v) => !v);
                  setAgentOpen(false);
                  setModelOpen(false);
                }}
                className="flex items-center justify-center w-6 h-6 rounded text-ide-chat-muted hover:text-ide-chat-text hover:bg-ide-chat-input transition-colors"
                title="Add attachment"
              >
                <Plus size={13} />
              </button>
              {attachOpen && (
                <div className="absolute bottom-full mb-1.5 left-0 z-50 w-44 bg-ide-chat-dropdown border border-ide-chat-border rounded-lg shadow-xl overflow-hidden">
                  <div className="px-2 py-1 border-b border-ide-chat-border">
                    <span
                      className="text-ide-chat-muted text-[10px]"
                    >
                      Add context
                    </span>
                  </div>
                  {ATTACH_OPTIONS.map(
                    ({ icon: Icon, label, desc }) => (
                      <button
                        key={label}
                        className="w-full flex items-start gap-2 px-2.5 py-2 hover:bg-ide-chat-hover transition-colors text-left"
                        onClick={() => setAttachOpen(false)}
                      >
                        <Icon
                          size={12}
                          className="text-ide-chat-muted mt-0.5 shrink-0"
                        />
                        <div>
                          <div
                            className="text-ide-chat-text text-[11px]"
                          >
                            {label}
                          </div>
                          <div
                            className="text-ide-chat-muted text-[10px]"
                          >
                            {desc}
                          </div>
                        </div>
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>

            {/* Agent mode dropdown */}
            <div
              className="relative"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setAgentOpen((v) => !v);
                  setModelOpen(false);
                  setAttachOpen(false);
                }}
                className="flex items-center gap-1 px-1.5 h-6 rounded text-ide-chat-purple hover:bg-ide-chat-input transition-colors text-[11px]"
              >
                <Bot size={11} />
                <span
                  className="text-[10px] font-[500]"
                >
                  {
                    AGENT_OPTIONS.find((a) => a.id === selectedAgent)
                      ?.label
                  }
                </span>
                <ChevronUp
                  size={9}
                  className={`transition-transform text-ide-chat-muted ${agentOpen ? "" : "rotate-180"}`}
                />
              </button>
              {agentOpen && (
                <div className="absolute bottom-full mb-1.5 left-0 z-50 w-52 bg-ide-chat-dropdown border border-ide-chat-border rounded-lg shadow-xl overflow-hidden">
                  <div className="px-2 py-1 border-b border-ide-chat-border">
                    <span
                      className="text-ide-chat-muted text-[10px]"
                    >
                      Mode
                    </span>
                  </div>
                  {AGENT_OPTIONS.map((a) => (
                    <button
                      key={a.id}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-ide-chat-hover transition-colors text-left"
                      onClick={() => {
                        setSelectedAgent(a.id);
                        setAgentOpen(false);
                      }}
                    >
                      <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                        {selectedAgent === a.id && (
                          <Check
                            size={11}
                            className="text-ide-chat-purple"
                          />
                        )}
                      </div>
                      <div>
                        <div
                          className="text-ide-chat-text"
                          style={{
                            fontSize: "11px",
                            fontWeight:
                              selectedAgent === a.id
                                ? 600
                                : 400,
                          }}
                        >
                          {a.label}
                        </div>
                        <div
                          className="text-ide-chat-muted text-[10px]"
                        >
                          {a.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Model dropdown */}
            <div
              className="relative"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setModelOpen((v) => !v);
                  setAgentOpen(false);
                  setAttachOpen(false);
                }}
                className="flex items-center gap-1 px-1.5 h-6 rounded text-ide-chat-cyan hover:bg-ide-chat-input transition-colors text-[11px]"
              >
                <Cpu size={10} />
                <span
                  className="max-w-[80px] truncate text-ide-chat-text-bright p-[0px] mx-[1px] my-[0px] text-[10px] font-[500]"
                >
                  {selectedModel}
                </span>
                <ChevronUp
                  size={9}
                  className={`transition-transform text-ide-chat-muted ${modelOpen ? "" : "rotate-180"}`}
                />
              </button>
              {modelOpen && (
                <div className="absolute bottom-full mb-1.5 left-0 z-50 w-52 bg-ide-chat-dropdown border border-ide-chat-border rounded-lg shadow-xl overflow-hidden">
                  <div className="px-2 py-1 border-b border-ide-chat-border">
                    <span
                      className="text-ide-chat-muted text-[10px]"
                    >
                      Model
                    </span>
                  </div>
                  {MODEL_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-ide-chat-hover transition-colors text-left"
                      onClick={() => {
                        setSelectedModel(m.id);
                        setModelOpen(false);
                      }}
                    >
                      <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                        {selectedModel === m.id && (
                          <Check
                            size={11}
                            className="text-ide-chat-cyan"
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <div
                          className="text-ide-chat-text"
                          style={{
                            fontSize: "11px",
                            fontWeight:
                              selectedModel === m.id
                                ? 600
                                : 400,
                          }}
                        >
                          {m.label}
                        </div>
                        <div
                          className="text-ide-chat-muted text-[10px]"
                        >
                          ctx {m.tokens}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Token usage */}
            <div className="ml-auto flex items-center gap-1.5 mr-1">
              <div
                className="flex items-center gap-1"
                title={`${usedTokens.toLocaleString()} / ${maxTokens.toLocaleString()} tokens used`}
              >
                {/* mini progress bar */}
                <div className="w-12 h-1 bg-ide-chat-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${tokenPct}%`,
                      background:
                        tokenPct > 80
                          ? "#ff5555"
                          : tokenPct > 50
                            ? "#ffb86c"
                            : "#6272a4",
                    }}
                  />
                </div>
                <span
                  className="text-ide-chat-muted text-[9px]"
                >
                  {tokenLabel}/{maxLabel}
                </span>
              </div>
            </div>

            {/* Send button */}
            <button
              onClick={() => {
                sendMessage();
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                }
              }}
              disabled={!input.trim()}
              className={`flex items-center justify-center w-6 h-6 rounded transition-all ${
                input.trim()
                  ? "bg-ide-chat-purple hover:bg-ide-chat-purple-hover text-ide-chat-hover shadow-md"
                  : "bg-ide-chat-input text-ide-chat-border cursor-not-allowed"
              }`}
              title="Send (Enter)"
            >
              <ArrowUp size={13} />
            </button>
          </div>
        </div>

        {/* Hint */}
        <div className="flex items-center gap-2 mt-1 px-0.5">
          <span
            className="text-ide-chat-border text-[9px]"
          >
            Enter to send · Shift+Enter newline
          </span>
          <span
            className="ml-auto text-ide-chat-border text-[9px]"
          >
            <span className="text-ide-chat-muted">
              {selectedAgent}
            </span>{" "}
            ·{" "}
            <span style={{ color: AGENT_COLORS[selectedAgent] }}>
              {selectedModel}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
