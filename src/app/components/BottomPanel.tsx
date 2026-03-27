import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import {
  Terminal, X, Maximize2, Minimize2, ChevronUp, Plus,
  AlertCircle, AlertTriangle, Info, Filter, Trash2, Search,
  Bug, Square,
} from 'lucide-react';
import { terminalHistory, outputLog, problemsList } from '../../data/mockData';

interface BottomPanelProps {
  onClose?: () => void;
}

// ─── Terminal Panel ────────────────────────────────────────────────────────────
function TerminalPanel() {
  const [history, setHistory] = useState(terminalHistory);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [history]);

  const handleCommand = (cmd: string) => {
    const newHistory = [...history, { type: 'cmd', text: cmd }];

    // Simulate common commands
    if (cmd === 'clear' || cmd === 'cls') {
      setHistory([{ type: 'prompt', text: 'rtl@soc-dev:~/my_soc_project$ ' }]);
      return;
    }

    const responses: Record<string, Array<{ type: string; text: string }>> = {
      'ls': [
        { type: 'output', text: '\x1b[34mrtl/\x1b[0m  \x1b[34mtb/\x1b[0m  \x1b[34mconstraints/\x1b[0m  project.yml  README.md' },
      ],
      'ls rtl': [
        { type: 'output', text: '\x1b[34mcore/\x1b[0m  \x1b[34mperipherals/\x1b[0m  \x1b[34mmemory/\x1b[0m  \x1b[34mclock/\x1b[0m' },
      ],
      'make clean': [
        { type: 'output', text: '[INFO] Cleaning build artifacts...' },
        { type: 'output', text: '[INFO] Removed: obj_dir/, build/, *.vcd' },
        { type: 'output', text: '[INFO] Clean completed' },
      ],
      'make lint': [
        { type: 'output', text: '[INFO] Running Verilator lint pass...' },
        { type: 'output', text: '[WARN] alu.v:51: Default case X-propagation' },
        { type: 'output', text: '[ERROR] cpu_top.v:56: Unconnected port alu_src_b' },
        { type: 'output', text: '[INFO] Lint completed: 1 error, 1 warning' },
      ],
      'help': [
        { type: 'output', text: 'Available commands: make [target], ls, cd, clear, git ...' },
        { type: 'output', text: 'Targets: elaborate, lint, sim, synth, impl, report' },
      ],
    };

    const resp = responses[cmd.trim()] || [{ type: 'output', text: `bash: ${cmd}: command found — simulated environment` }];
    setHistory([...newHistory, ...resp, { type: 'prompt', text: 'rtl@soc-dev:~/my_soc_project$ ' }]);
    setCmdHistory((prev) => [cmd, ...prev]);
    setHistIdx(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (input.trim()) handleCommand(input.trim());
      else setHistory((h) => [...h, { type: 'prompt', text: 'rtl@soc-dev:~/my_soc_project$ ' }]);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(next);
      setInput(cmdHistory[next] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next);
      setInput(next === -1 ? '' : cmdHistory[next]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  };

  const colorClass = (text: string) => {
    if (text.includes('[ERROR]')) return 'text-[#f48771]';
    if (text.includes('[WARN]')) return 'text-[#cca700]';
    if (text.includes('[INFO]')) return 'text-[#9cdcfe]';
    if (text.startsWith('#')) return 'text-[#4ec9b0]';
    return 'text-[#cccccc]';
  };

  return (
    <div
      className="flex flex-col h-full bg-[#1e1e1e] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono" style={{ fontSize: '12px' }}>
        {history.map((line, i) => (
          <div key={i} className="flex flex-wrap leading-5">
            {line.type === 'prompt' && (
              <span>
                <span className="text-[#4ec9b0]">rtl</span>
                <span className="text-[#cccccc]">@</span>
                <span className="text-[#9cdcfe]">soc-dev</span>
                <span className="text-[#cccccc]">:</span>
                <span className="text-[#c586c0]">~/my_soc_project</span>
                <span className="text-[#cccccc]">$ </span>
                {i === history.length - 1 && (
                  <span className="inline-flex items-center">
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="bg-transparent outline-none text-[#cccccc] caret-white"
                      style={{ fontSize: '12px', fontFamily: 'inherit', minWidth: '1px', width: `${Math.max(input.length, 1)}ch` }}
                      autoFocus
                    />
                    <span className="w-2 h-4 bg-[#aeafad] animate-pulse inline-block ml-px" />
                  </span>
                )}
              </span>
            )}
            {line.type === 'cmd' && (
              <span className="text-[#cccccc]">{line.text}</span>
            )}
            {line.type === 'output' && (
              <span className={colorClass(line.text)}>{line.text}</span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Output Panel ─────────────────────────────────────────────────────────────
function OutputPanel() {
  const [filterText, setFilterText] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  const filtered = outputLog.filter((entry) => {
    const matchLevel = levelFilter === 'all' || entry.level === levelFilter;
    const matchText = !filterText || entry.text.toLowerCase().includes(filterText.toLowerCase());
    return matchLevel && matchText;
  });

  const levelConfig = {
    info: { color: '#9cdcfe', label: 'INFO' },
    warn: { color: '#cca700', label: 'WARN' },
    error: { color: '#f48771', label: 'ERROR' },
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1 border-b border-[#3d3d3d] shrink-0">
        <div className="flex items-center gap-1 bg-[#3c3c3c] rounded px-2 py-0.5 flex-1 max-w-48">
          <Search size={11} className="text-[#858585]" />
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter output..."
            className="bg-transparent outline-none text-[#cccccc] flex-1"
            style={{ fontSize: '11px' }}
          />
        </div>
        {(['all', 'info', 'warn', 'error'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLevelFilter(l)}
            className={`px-2 py-0.5 rounded transition-colors ${
              levelFilter === l ? 'bg-[#094771] text-white' : 'text-[#858585] hover:text-[#cccccc]'
            }`}
            style={{ fontSize: '10px' }}
          >
            {l === 'all' ? 'All' : l.toUpperCase()}
          </button>
        ))}
        <button className="ml-auto p-1 text-[#858585] hover:text-[#cccccc] transition-colors" title="Clear">
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1 font-mono" style={{ fontSize: '12px' }}>
        {filtered.map((entry, i) => {
          const cfg = levelConfig[entry.level as keyof typeof levelConfig];
          return (
            <div key={i} className="flex items-start gap-2 hover:bg-[#2a2d2e] px-1 py-0.5 rounded">
              <span className="text-[#555] shrink-0" style={{ fontSize: '11px' }}>{entry.time}</span>
              <span
                className="px-1 rounded shrink-0"
                style={{ fontSize: '9px', fontWeight: 700, color: cfg?.color || '#cccccc', background: '#2d2d2d', lineHeight: '16px' }}
              >
                {cfg?.label || entry.level.toUpperCase()}
              </span>
              <span style={{ color: cfg?.color || '#cccccc' }}>{entry.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Problems Tab Panel ────────────────────────────────────────────────────────
function ProblemsTabPanel() {
  const errors = problemsList.filter((p) => p.severity === 'error');
  const warnings = problemsList.filter((p) => p.severity === 'warning');
  const infos = problemsList.filter((p) => p.severity === 'info');

  const sections = [
    { label: 'Errors', items: errors, icon: AlertCircle, color: '#f48771' },
    { label: 'Warnings', items: warnings, icon: AlertTriangle, color: '#cca700' },
    { label: 'Infos', items: infos, icon: Info, color: '#75beff' },
  ];

  return (
    <div className="flex-1 overflow-y-auto py-1">
      {sections.map(({ label, items, icon: Icon, color }) =>
        items.length === 0 ? null : (
          <div key={label}>
            <div className="flex items-center gap-2 px-3 py-1" style={{ fontSize: '11px' }}>
              <Icon size={12} style={{ color }} />
              <span className="text-[#cccccc]">{label}</span>
              <span className="text-[#858585]">({items.length})</span>
            </div>
            {items.map((p) => (
              <div key={p.id} className="flex items-start gap-2 px-4 py-1 hover:bg-[#2a2d2e] cursor-pointer">
                <Icon size={12} style={{ color }} className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[#cccccc] truncate" style={{ fontSize: '12px' }}>{p.message}</div>
                  <div className="text-[#858585]" style={{ fontSize: '11px' }}>
                    {p.file} L{p.line}:{p.column}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ─── Debug Console ─────────────────────────────────────────────────────────────
function DebugConsole() {
  const logs = [
    { type: 'info', text: 'Debug session not started' },
    { type: 'info', text: 'Set a breakpoint first, then click "Start Debugging"' },
    { type: 'hint', text: 'Tip: click in the gutter next to a line number to add a breakpoint' },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 font-mono" style={{ fontSize: '12px' }}>
      {logs.map((log, i) => (
        <div key={i} className={`leading-6 ${
          log.type === 'info' ? 'text-[#9cdcfe]' : 'text-[#858585]'
        }`}>
          {log.text}
        </div>
      ))}
      <div className="flex items-center mt-2 text-[#858585]">
        <span className="mr-2">&gt;</span>
        <span className="w-2 h-4 bg-[#aeafad] animate-pulse" />
      </div>
    </div>
  );
}

// ─── Bottom Panel ──────────────────────────────────────────────────────────────
export function BottomPanel({ onClose }: BottomPanelProps) {
  const [tab, setTab] = useState<'terminal' | 'output' | 'problems' | 'debug'>('terminal');

  const tabs = [
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'output', label: 'Output', icon: null },
    { id: 'problems', label: `Problems (${problemsList.length})`, icon: null },
    { id: 'debug', label: 'Debug Console', icon: Bug },
  ] as const;

  const errCount = problemsList.filter((p) => p.severity === 'error').length;
  const warnCount = problemsList.filter((p) => p.severity === 'warning').length;

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-t border-[#3d3d3d] overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center h-8 bg-[#252526] border-b border-[#3d3d3d] shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 h-full transition-colors border-b-2 ${
              tab === t.id
                ? 'text-white border-[#0e639c]'
                : 'text-[#858585] border-transparent hover:text-[#cccccc]'
            }`}
            style={{ fontSize: '12px' }}
          >
            {t.id === 'problems' && errCount > 0 && (
              <AlertCircle size={11} className="text-[#f48771]" />
            )}
            {t.label}
          </button>
        ))}

        <div className="flex items-center gap-1 ml-auto pr-2">
          <button
            title="New Terminal"
            className="p-1 text-[#858585] hover:text-[#cccccc] transition-colors"
            onClick={() => setTab('terminal')}
          >
            <Plus size={13} />
          </button>
          <button
            title="Close Panel"
            className="p-1 text-[#858585] hover:text-[#cccccc] transition-colors"
            onClick={onClose}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'terminal' && <TerminalPanel />}
        {tab === 'output' && <OutputPanel />}
        {tab === 'problems' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 py-1 border-b border-[#3d3d3d] shrink-0">
              <AlertCircle size={11} className="text-[#f48771]" />
              <span className="text-[#f48771]" style={{ fontSize: '11px' }}>{errCount} errors</span>
              <AlertTriangle size={11} className="text-[#cca700]" />
              <span className="text-[#cca700]" style={{ fontSize: '11px' }}>{warnCount} warnings</span>
            </div>
            <ProblemsTabPanel />
          </div>
        )}
        {tab === 'debug' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 py-1 border-b border-[#3d3d3d] shrink-0">
              <button className="flex items-center gap-1 px-2 py-0.5 bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors" style={{ fontSize: '11px' }}>
                <Bug size={11} />
                Start Debugging
              </button>
              <button className="flex items-center gap-1 px-2 py-0.5 text-[#858585] hover:text-[#cccccc] rounded transition-colors" style={{ fontSize: '11px' }}>
                <Square size={11} />
                Stop
              </button>
            </div>
            <DebugConsole />
          </div>
        )}
      </div>
    </div>
  );
}