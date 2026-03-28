import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { terminalHistory } from '../../data/mockData';

export function TerminalPanel() {
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
      setInput(next === -1 ? '' : (cmdHistory[next] ?? ''));
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  };

  const colorClass = (text: string) => {
    if (text.includes('[ERROR]')) return 'text-ide-error';
    if (text.includes('[WARN]')) return 'text-ide-warning';
    if (text.includes('[INFO]')) return 'text-ide-info';
    if (text.startsWith('#')) return 'text-ide-success';
    return 'text-ide-text';
  };

  return (
    <div
      className="flex flex-col h-full bg-ide-bg cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px]">
        {history.map((line, i) => (
          <div key={i} className="flex flex-wrap leading-5">
            {line.type === 'prompt' && (
              <span>
                <span className="text-ide-success">rtl</span>
                <span className="text-ide-text">@</span>
                <span className="text-ide-info">soc-dev</span>
                <span className="text-ide-text">:</span>
                <span className="text-ide-syntax-keyword">~/my_soc_project</span>
                <span className="text-ide-text">$ </span>
                {i === history.length - 1 && (
                  <span className="inline-flex items-center">
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="bg-transparent outline-none text-ide-text caret-white text-[12px] min-w-px"
                      style={{ width: `${Math.max(input.length, 1)}ch` }}
                      autoFocus
                    />
                    <span className="w-2 h-4 bg-ide-cursor animate-pulse inline-block ml-px" />
                  </span>
                )}
              </span>
            )}
            {line.type === 'cmd' && (
              <span className="text-ide-text">{line.text}</span>
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
