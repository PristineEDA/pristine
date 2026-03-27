import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Bot,
  User,
  Code2,
  AlertCircle,
  ChevronRight,
  Wrench,
  ExternalLink,
  FileCode2,
  Info,
  ChevronDown,
  Lightbulb,
  Zap,
  RefreshCw,
  Paperclip,
  ArrowUp,
  Plus,
  Cpu,
  SlidersHorizontal,
  ChevronUp,
  X,
  Image,
  FileText,
  Check,
} from "lucide-react";
import {
  initialAIMessages,
  staticChecks,
  references,
  AIMessage,
  StaticCheckItem,
} from "../../data/mockData";

interface RightSidePanelProps {
  onFileOpen: (fileId: string, fileName: string) => void;
  onLineJump: (line: number) => void;
}

// ─── AI Assistant Panel ────────────────────────────────────────────────────────
function AIAssistantPanel() {
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

  const simulatedResponses: Record<string, string> = {
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
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3d3d3d] shrink-0">
        <Sparkles size={14} className="text-[#c586c0]" />
        <span
          className="text-[#cccccc]"
          style={{ fontSize: "12px", fontWeight: 600 }}
        >
          AI Assistant
        </span>
        <div className="ml-auto">
          <button
            className="p-1 text-[#858585] hover:text-[#cccccc] transition-colors"
            title="Clear conversation"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-[#3d3d3d] shrink-0">
        {quickActions.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className="flex items-center gap-1 px-2 py-0.5 bg-[#2d2d2d] hover:bg-[#094771] text-[#858585] hover:text-white rounded transition-colors"
            style={{ fontSize: "11px" }}
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
                  ? "bg-[#c586c0]"
                  : "bg-[#0e639c]"
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
                    ? "bg-[#094771] text-white"
                    : "bg-[#2d2d2d] text-[#cccccc]"
                }`}
              >
                <div
                  style={{
                    fontSize: "12px",
                    lineHeight: "1.5",
                    whiteSpace: "pre-wrap",
                  }}
                >
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
                                    className="bg-[#1e1e1e] text-[#ce9178] px-1 rounded"
                                    style={{ fontSize: "11px" }}
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
                <div className="w-full bg-[#1e1e1e] rounded border border-[#3d3d3d] overflow-hidden">
                  <div className="flex items-center justify-between px-2 py-1 bg-[#2d2d2d] border-b border-[#3d3d3d]">
                    <span
                      className="text-[#858585]"
                      style={{ fontSize: "10px" }}
                    >
                      verilog
                    </span>
                    <button
                      className="text-[#858585] hover:text-[#cccccc] transition-colors"
                      style={{ fontSize: "10px" }}
                    >
                      Copy
                    </button>
                  </div>
                  <pre
                    className="px-3 py-2 text-[#9cdcfe] overflow-x-auto"
                    style={{
                      fontSize: "11px",
                      fontFamily: "Consolas, monospace",
                    }}
                  >
                    <code>{msg.codeBlock}</code>
                  </pre>
                </div>
              )}

              <span
                className="text-[#555]"
                style={{ fontSize: "10px" }}
              >
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-[#c586c0] flex items-center justify-center shrink-0">
              <Bot size={13} className="text-white" />
            </div>
            <div className="flex items-center gap-1 px-3 py-2 bg-[#2d2d2d] rounded-lg">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 bg-[#858585] rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Copilot-style Input Box ── */}
      <div className="px-2 pb-2 pt-1.5 border-t border-[#3d3d3d] shrink-0">
        {/* Current task context chip */}
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          <div
            className="flex items-center gap-1 px-2 py-0.5 bg-[#2a2d2e] rounded border border-[#3a3d3e] text-[#858585] cursor-pointer hover:border-[#555] transition-colors"
            style={{ fontSize: "10px" }}
          >
            <FileCode2 size={9} className="text-[#4ec9b0]" />
            <span className="text-[#9cdcfe]">uart_tx.v</span>
            <span className="text-[#555]">·</span>
            <span>CLINT pipeline</span>
            <span className="text-[#555] mx-0.5">1/9</span>
            <X
              size={8}
              className="hover:text-[#cccccc] ml-0.5"
            />
          </div>
          <div
            className="flex items-center gap-1 px-2 py-0.5 bg-[#2a2d2e] rounded border border-[#3a3d3e] text-[#858585] cursor-pointer hover:border-[#555] transition-colors"
            style={{ fontSize: "10px" }}
          >
            <FileCode2 size={9} className="text-[#dcb67a]" />
            <span className="text-[#dcdcaa]">cpu_top.v</span>
            <X
              size={8}
              className="hover:text-[#cccccc] ml-0.5"
            />
          </div>
        </div>

        {/* Main prompt card */}
        <div
          className="rounded-lg border border-[#454545] bg-[#1e1f29] focus-within:border-[#6272a4] transition-colors"
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
            className="w-full bg-transparent text-[#f8f8f2] resize-none outline-none px-3 pt-2.5 pb-1"
            style={{
              fontSize: "12px",
              minHeight: 38,
              maxHeight: 120,
              lineHeight: "1.5",
              caretColor: "#f8f8f2",
            }}
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
                className="flex items-center justify-center w-6 h-6 rounded text-[#6272a4] hover:text-[#f8f8f2] hover:bg-[#2d2f3e] transition-colors"
                title="Add attachment"
              >
                <Plus size={13} />
              </button>
              {attachOpen && (
                <div className="absolute bottom-full mb-1.5 left-0 z-50 w-44 bg-[#21222c] border border-[#44475a] rounded-lg shadow-xl overflow-hidden">
                  <div className="px-2 py-1 border-b border-[#44475a]">
                    <span
                      className="text-[#6272a4]"
                      style={{ fontSize: "10px" }}
                    >
                      Add context
                    </span>
                  </div>
                  {attachOptions.map(
                    ({ icon: Icon, label, desc }) => (
                      <button
                        key={label}
                        className="w-full flex items-start gap-2 px-2.5 py-2 hover:bg-[#282a36] transition-colors text-left"
                        onClick={() => setAttachOpen(false)}
                      >
                        <Icon
                          size={12}
                          className="text-[#6272a4] mt-0.5 shrink-0"
                        />
                        <div>
                          <div
                            className="text-[#f8f8f2]"
                            style={{ fontSize: "11px" }}
                          >
                            {label}
                          </div>
                          <div
                            className="text-[#6272a4]"
                            style={{ fontSize: "10px" }}
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
                className="flex items-center gap-1 px-1.5 h-6 rounded text-[#bd93f9] hover:bg-[#2d2f3e] transition-colors"
                style={{ fontSize: "11px" }}
              >
                <Bot size={11} />
                <span
                  className="text-[10px]"
                  style={{ fontWeight: 500 }}
                >
                  {
                    agents.find((a) => a.id === selectedAgent)
                      ?.label
                  }
                </span>
                <ChevronUp
                  size={9}
                  className={`transition-transform text-[#6272a4] ${agentOpen ? "" : "rotate-180"}`}
                />
              </button>
              {agentOpen && (
                <div className="absolute bottom-full mb-1.5 left-0 z-50 w-52 bg-[#21222c] border border-[#44475a] rounded-lg shadow-xl overflow-hidden">
                  <div className="px-2 py-1 border-b border-[#44475a]">
                    <span
                      className="text-[#6272a4]"
                      style={{ fontSize: "10px" }}
                    >
                      Mode
                    </span>
                  </div>
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-[#282a36] transition-colors text-left"
                      onClick={() => {
                        setSelectedAgent(a.id);
                        setAgentOpen(false);
                      }}
                    >
                      <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                        {selectedAgent === a.id && (
                          <Check
                            size={11}
                            className="text-[#bd93f9]"
                          />
                        )}
                      </div>
                      <div>
                        <div
                          className="text-[#f8f8f2]"
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
                          className="text-[#6272a4]"
                          style={{ fontSize: "10px" }}
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
                className="flex items-center gap-1 px-1.5 h-6 rounded text-[#8be9fd] hover:bg-[#2d2f3e] transition-colors"
                style={{ fontSize: "11px" }}
              >
                <Cpu size={10} />
                <span
                  className="max-w-[80px] truncate text-[#fcfcfc] p-[0px] mx-[1px] my-[0px] text-[10px]"
                  style={{ fontWeight: 500 }}
                >
                  {selectedModel}
                </span>
                <ChevronUp
                  size={9}
                  className={`transition-transform text-[#6272a4] ${modelOpen ? "" : "rotate-180"}`}
                />
              </button>
              {modelOpen && (
                <div className="absolute bottom-full mb-1.5 left-0 z-50 w-52 bg-[#21222c] border border-[#44475a] rounded-lg shadow-xl overflow-hidden">
                  <div className="px-2 py-1 border-b border-[#44475a]">
                    <span
                      className="text-[#6272a4]"
                      style={{ fontSize: "10px" }}
                    >
                      Model
                    </span>
                  </div>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-[#282a36] transition-colors text-left"
                      onClick={() => {
                        setSelectedModel(m.id);
                        setModelOpen(false);
                      }}
                    >
                      <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                        {selectedModel === m.id && (
                          <Check
                            size={11}
                            className="text-[#8be9fd]"
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <div
                          className="text-[#f8f8f2]"
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
                          className="text-[#6272a4]"
                          style={{ fontSize: "10px" }}
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
                <div className="w-12 h-1 bg-[#44475a] rounded-full overflow-hidden">
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
                  className="text-[#6272a4]"
                  style={{ fontSize: "9px" }}
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
                  ? "bg-[#bd93f9] hover:bg-[#caa8ff] text-[#282a36] shadow-md"
                  : "bg-[#2d2f3e] text-[#44475a] cursor-not-allowed"
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
            className="text-[#44475a]"
            style={{ fontSize: "9px" }}
          >
            Enter to send · Shift+Enter newline
          </span>
          <span
            className="ml-auto text-[#44475a]"
            style={{ fontSize: "9px" }}
          >
            <span className="text-[#6272a4]">
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

// ─── Static Check Panel ────────────────────────────────────────────────────────
const severityConfig: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  critical: {
    color: "#f48771",
    bg: "#3d1515",
    label: "Critical",
  },
  high: { color: "#f48771", bg: "#3d1515", label: "High" },
  medium: { color: "#cca700", bg: "#3d3000", label: "Medium" },
  low: { color: "#75beff", bg: "#0a2840", label: "Low" },
};

function StaticCheckPanel({
  onFileOpen,
  onLineJump,
}: {
  onFileOpen: (id: string, name: string) => void;
  onLineJump: (l: number) => void;
}) {
  const [filter, setFilter] = useState<
    "all" | "critical" | "high" | "medium" | "low"
  >("all");
  const [fixedIds, setFixedIds] = useState<Set<string>>(
    new Set(),
  );

  const filtered =
    filter === "all"
      ? staticChecks
      : staticChecks.filter((c) => c.severity === filter);
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  staticChecks.forEach((c) => counts[c.severity]++);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-1.5 border-b border-[#3d3d3d] shrink-0">
        <div className="flex items-center gap-1 mb-1.5">
          <AlertCircle size={13} className="text-[#f48771]" />
          <span
            className="text-[#cccccc]"
            style={{ fontSize: "12px", fontWeight: 600 }}
          >
            Static Check Report
          </span>
          <span
            className="ml-auto text-[#858585]"
            style={{ fontSize: "11px" }}
          >
            {staticChecks.length} rules
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              "all",
              "critical",
              "high",
              "medium",
              "low",
            ] as const
          ).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                filter === f
                  ? "bg-[#094771] text-white"
                  : "text-[#858585] hover:bg-[#2d2d2d]"
              }`}
              style={{ fontSize: "10px" }}
            >
              {f === "all"
                ? `All ${staticChecks.length}`
                : `${severityConfig[f].label} ${counts[f]}`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((item) => {
          const isFixed = fixedIds.has(item.id);
          const cfg = severityConfig[item.severity];
          return (
            <div
              key={item.id}
              className={`border-b border-[#2d2d2d] px-3 py-2 transition-colors ${isFixed ? "opacity-40" : "hover:bg-[#2a2d2e]"}`}
            >
              <div className="flex items-start gap-2">
                <span
                  className="px-1 py-0.5 rounded shrink-0 mt-0.5"
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    color: cfg.color,
                    background: cfg.bg,
                  }}
                >
                  {cfg.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span
                      className="text-[#858585]"
                      style={{ fontSize: "10px" }}
                    >
                      {item.rule}
                    </span>
                  </div>
                  <div
                    className="text-[#cccccc] mt-0.5"
                    style={{
                      fontSize: "11px",
                      lineHeight: 1.4,
                    }}
                  >
                    {isFixed ? (
                      <s>{item.description}</s>
                    ) : (
                      item.description
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      className="flex items-center gap-1 text-[#858585] hover:text-[#cccccc] transition-colors"
                      style={{ fontSize: "10px" }}
                      onClick={() => {
                        onFileOpen(item.fileId, item.file);
                        onLineJump(item.line);
                      }}
                    >
                      <FileCode2 size={10} />
                      {item.file}:{item.line}
                    </button>
                    {item.fixable && !isFixed && (
                      <button
                        className="flex items-center gap-1 px-1.5 py-0.5 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors"
                        style={{ fontSize: "10px" }}
                        onClick={() =>
                          setFixedIds(
                            (prev) =>
                              new Set([...prev, item.id]),
                          )
                        }
                      >
                        <Wrench size={9} />
                        Auto-fix
                      </button>
                    )}
                    {isFixed && (
                      <span
                        className="text-[#4ec9b0]"
                        style={{ fontSize: "10px" }}
                      >
                        ✓ Fixed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── References Panel ──────────────────────────────────────────────────────────
function ReferencesPanel({
  onFileOpen,
  onLineJump,
}: {
  onFileOpen: (id: string, name: string) => void;
  onLineJump: (l: number) => void;
}) {
  const typeColors: Record<string, string> = {
    definition: "#4ec9b0",
    write: "#f48771",
    read: "#9cdcfe",
  };
  const typeLabels: Record<string, string> = {
    definition: "DEF",
    write: "WR",
    read: "RD",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#3d3d3d] shrink-0">
        <div className="flex items-center gap-2">
          <ExternalLink size={13} className="text-[#9cdcfe]" />
          <span
            className="text-[#cccccc]"
            style={{ fontSize: "12px", fontWeight: 600 }}
          >
            References
          </span>
          <span
            className="text-[#858585] ml-1"
            style={{ fontSize: "11px" }}
          >
            shift_reg
          </span>
        </div>
        <div
          className="text-[#858585] mt-1"
          style={{ fontSize: "11px" }}
        >
          {references.length} references · uart_tx.v
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-1.5 border-b border-[#2d2d2d]">
          <div
            className="flex items-center gap-1.5 text-[#cccccc]"
            style={{ fontSize: "12px" }}
          >
            <FileCode2 size={12} className="text-[#dcb67a]" />
            uart_tx.v
            <span
              className="text-[#858585]"
              style={{ fontSize: "11px" }}
            >
              ({references.length})
            </span>
          </div>
        </div>
        {references.map((ref) => (
          <div
            key={ref.id}
            className="flex items-start gap-2 px-3 py-1.5 hover:bg-[#2a2d2e] cursor-pointer border-b border-[#1e1e1e] transition-colors"
            onClick={() => {
              onFileOpen(ref.fileId, ref.file);
              onLineJump(ref.line);
            }}
          >
            <span
              className="shrink-0 mt-0.5 px-1 rounded"
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: typeColors[ref.type],
                background: "#2d2d2d",
              }}
            >
              {typeLabels[ref.type]}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-[#858585]"
                  style={{
                    fontSize: "11px",
                    fontFamily: "monospace",
                  }}
                >
                  L{ref.line}
                </span>
              </div>
              <div
                className="text-[#cccccc] font-mono truncate"
                style={{ fontSize: "11px" }}
                dangerouslySetInnerHTML={{
                  __html: ref.preview.replace(
                    /shift_reg/g,
                    '<span style="background:#264f78;border-radius:2px;padding:0 1px">shift_reg</span>',
                  ),
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Right Side Panel ──────────────────────────────────────────────────────────
export function RightSidePanel({
  onFileOpen,
  onLineJump,
}: RightSidePanelProps) {
  const [tab, setTab] = useState<
    "ai" | "static" | "references"
  >("ai");

  const tabs = [
    { id: "ai", label: "AI Assistant" },
    { id: "static", label: "Static Check" },
    { id: "references", label: "References" },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-[#252526] overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-[#3d3d3d]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 transition-colors border-b-2 ${
              tab === t.id
                ? "text-white border-[#0e639c]"
                : "text-[#858585] border-transparent hover:text-[#cccccc]"
            }`}
            style={{
              fontSize: "11px",
              fontWeight: tab === t.id ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === "ai" && <AIAssistantPanel />}
        {tab === "static" && (
          <StaticCheckPanel
            onFileOpen={onFileOpen}
            onLineJump={onLineJump}
          />
        )}
        {tab === "references" && (
          <ReferencesPanel
            onFileOpen={onFileOpen}
            onLineJump={onLineJump}
          />
        )}
      </div>
    </div>
  );
}