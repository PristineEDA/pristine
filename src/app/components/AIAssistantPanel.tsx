import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Bot,
  User,
  Code2,
  ChevronUp,
  Wrench,
  FileCode2,
  Lightbulb,
  Zap,
  RefreshCw,
  ArrowUp,
  Plus,
  Cpu,
  X,
  Image,
  FileText,
  Check,
} from "lucide-react";
import { initialAIMessages, AIMessage } from "../../data/mockData";

// ─── AI Assistant Panel ────────────────────────────────────────────────────────
export function AIAssistantPanel() {
  const [messages, setMessages] = useState<AIMessage[]>(
    initialAIMessages,
  );
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<
    "agent" | "ask" | "edit"
  >("agent");
  const [selectedModel, setSelectedModel] = useState(
    "Claude Opus 4.6",
  );
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

  const simulatedResponses = {
    default:
      "I understand your question. Based on the current RTL code context, I recommend checking the signal drive logic and timing constraints. Would you like me to generate a specific code example?",
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: AIMessage = {
      id: `m${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsTyping(true);

    setTimeout(() => {
      const aiMsg: AIMessage = {
        id: `m${Date.now() + 1}`,
        role: "assistant",
        content: simulatedResponses.default,
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        codeBlock:
          input.toLowerCase().includes("code") ||
          input.toLowerCase().includes("generate")
            ? `// AI-generated code example\nalways @(posedge clk or negedge rst_n) begin\n    if (!rst_n)\n        q <= '0;\n    else\n        q <= d;\nend`
            : undefined,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1200);
  };

  const quickActions = [
    { label: "Explain Code", icon: Lightbulb },
    { label: "Optimize Design", icon: Zap },
    { label: "Generate Testbench", icon: Code2 },
    { label: "Fix Bug", icon: Wrench },
  ];

  const agents = [
    {
      id: "agent",
      label: "Agent",
      desc: "Autonomous multi-step tasks",
    },
    {
      id: "ask",
      label: "Ask",
      desc: "Ask questions about code",
    },
    {
      id: "edit",
      label: "Edit",
      desc: "Make targeted code edits",
    },
  ] as const;

  const models = [
    {
      id: "Claude Opus 4.6",
      label: "Claude Opus 4.6",
      tokens: "200k",
    },
    {
      id: "Claude Sonnet 4.6",
      label: "Claude Sonnet 4.6",
      tokens: "200k",
    },
    { id: "GPT-5.4", label: "GPT-5.4", tokens: "128k" },
    { id: "Gemini 3 Pro", label: "Gemini 3 Pro", tokens: "1M" },
  ];

  const attachOptions = [
    {
      icon: FileCode2,
      label: "Add File",
      desc: "Attach a source file",
    },
    {
      icon: Image,
      label: "Add Image",
      desc: "Attach a screenshot or diagram",
    },
    {
      icon: FileText,
      label: "Add Context",
      desc: "Add selection or symbol",
    },
  ];

  // Token usage mock
  const usedTokens = 2417;
  const maxTokens =
    selectedModel === "Gemini 1.5 Pro"
      ? 1000000
      : selectedModel.includes("Claude")
        ? 200000
        : 128000;
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

  const agentColors: Record<string, string> = {
    agent: "#c586c0",
    ask: "#4ec9b0",
    edit: "#dcdcaa",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ide-border shrink-0">
        <Sparkles size={14} className="text-ide-syntax-keyword" />
        <span
          className="text-ide-text text-[12px] font-[600]"
        >
          AI Assistant
        </span>
        <div className="ml-auto">
          <button
            className="p-1 text-ide-text-muted hover:text-ide-text transition-colors"
            title="Clear conversation"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-ide-border shrink-0">
        {quickActions.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className="flex items-center gap-1 px-2 py-0.5 bg-ide-tab-bg hover:bg-ide-accent-dark text-ide-text-muted hover:text-white rounded transition-colors text-[11px]"
            onClick={() => setInput(label)}
          >
            <Icon size={10} />
            {label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar */}
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                msg.role === "assistant"
                  ? "bg-ide-syntax-keyword"
                  : "bg-ide-accent"
              }`}
            >
              {msg.role === "assistant" ? (
                <Bot size={13} className="text-white" />
              ) : (
                <User size={13} className="text-white" />
              )}
            </div>

            <div
              className={`flex flex-col gap-1 max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`px-2.5 py-2 rounded-lg ${
                  msg.role === "user"
                    ? "bg-ide-accent-dark text-white"
                    : "bg-ide-tab-bg text-ide-text"
                }`}
              >
                <div className="text-[12px] leading-[1.5] whitespace-pre-wrap">
                  {msg.content.split("\n").map((line, i) => {
                    const parts = line.split(/\*\*(.*?)\*\*/g);
                    return (
                      <div key={i}>
                        {parts.map((part, j) =>
                          j % 2 === 1 ? (
                            <strong
                              key={j}
                              className="text-white"
                            >
                              {part}
                            </strong>
                          ) : part.includes("`") ? (
                            part
                              .split(/`([^`]+)`/g)
                              .map((p, k) =>
                                k % 2 === 1 ? (
                                  <code
                                    key={k}
                                    className="bg-ide-bg text-ide-syntax-string px-1 rounded text-[11px]"
                                  >
                                    {p}
                                  </code>
                                ) : (
                                  p
                                ),
                              )
                          ) : (
                            part
                          ),
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {msg.codeBlock && (
                <div className="w-full bg-ide-bg rounded border border-ide-border overflow-hidden">
                  <div className="flex items-center justify-between px-2 py-1 bg-ide-tab-bg border-b border-ide-border">
                    <span
                      className="text-ide-text-muted text-[10px]"
                    >
                      verilog
                    </span>
                    <button
                      className="text-ide-text-muted hover:text-ide-text transition-colors text-[10px]"
                    >
                      Copy
                    </button>
                  </div>
                  <pre
                    className="px-3 py-2 text-ide-info overflow-x-auto text-[11px] font-mono"
                  >
                    <code>{msg.codeBlock}</code>
                  </pre>
                </div>
              )}

              <span
                className="text-ide-text-dim text-[10px]"
              >
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-ide-syntax-keyword flex items-center justify-center shrink-0">
              <Bot size={13} className="text-white" />
            </div>
            <div className="flex items-center gap-1 px-3 py-2 bg-ide-tab-bg rounded-lg">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 bg-ide-text-muted rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Copilot-style Input Box ── */}
      <div className="px-2 pb-2 pt-1.5 border-t border-ide-border shrink-0">
        {/* Current task context chip */}
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          <div
            className="flex items-center gap-1 px-2 py-0.5 bg-ide-hover rounded border border-ide-chat-input-border text-ide-text-muted cursor-pointer hover:border-ide-text-dim transition-colors text-[10px]"
          >
            <FileCode2 size={9} className="text-ide-success" />
            <span className="text-ide-info">uart_tx.v</span>
            <span className="text-ide-text-dim">·</span>
            <span>CLINT pipeline</span>
            <span className="text-ide-text-dim mx-0.5">1/9</span>
            <X
              size={8}
              className="hover:text-ide-text ml-0.5"
            />
          </div>
          <div
            className="flex items-center gap-1 px-2 py-0.5 bg-ide-hover rounded border border-ide-chat-input-border text-ide-text-muted cursor-pointer hover:border-ide-text-dim transition-colors text-[10px]"
          >
            <FileCode2 size={9} className="text-ide-syntax-folder" />
            <span className="text-ide-syntax-function">cpu_top.v</span>
            <X
              size={8}
              className="hover:text-ide-text ml-0.5"
            />
          </div>
        </div>

        {/* Main prompt card */}
        <div
          className="rounded-lg border border-ide-border-light bg-ide-chat-bg focus-within:border-ide-chat-muted transition-colors"
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
                handleSend();
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
                  {attachOptions.map(
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
                    agents.find((a) => a.id === selectedAgent)
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
                  {agents.map((a) => (
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
                  {models.map((m) => (
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
              onClick={handleSend}
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
            <span style={{ color: agentColors[selectedAgent] }}>
              {selectedModel}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
