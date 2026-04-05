import { useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { useOutputLog } from '../../data/mockDataLoader';

const levelConfig = {
  info: { color: '#9cdcfe', label: 'INFO' },
  warn: { color: '#cca700', label: 'WARN' },
  error: { color: '#f48771', label: 'ERROR' },
};

export function OutputPanel() {
  const outputLog = useOutputLog();
  const [filterText, setFilterText] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  const filtered = useMemo(() => outputLog.filter((entry) => {
    const matchLevel = levelFilter === 'all' || entry.level === levelFilter;
    const matchText = !filterText || entry.text.toLowerCase().includes(filterText.toLowerCase());
    return matchLevel && matchText;
  }), [filterText, levelFilter, outputLog]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border shrink-0">
        <div className="flex items-center gap-1 bg-muted/50 rounded px-2 py-0.5 flex-1 max-w-48">
          <Search size={11} className="text-muted-foreground" />
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter output..."
            className="bg-transparent outline-none text-foreground flex-1 text-[11px]"
          />
        </div>
        {(['all', 'info', 'warn', 'error'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLevelFilter(l)}
            className={`px-2 py-0.5 rounded transition-colors ${
              levelFilter === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            } text-[10px]`}
          >
            {l === 'all' ? 'All' : l.toUpperCase()}
          </button>
        ))}
        <button className="ml-auto p-1 text-muted-foreground hover:text-foreground transition-colors" title="Clear">
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1 font-mono text-[12px]">
        {filtered.map((entry, i) => {
          const cfg = levelConfig[entry.level as keyof typeof levelConfig];
          return (
            <div key={i} className="flex items-start gap-2 hover:bg-accent px-1 py-0.5 rounded">
              <span className="text-muted-foreground/70 shrink-0 text-[11px]">{entry.time}</span>
              <span
                className="px-1 rounded shrink-0 text-[9px] font-bold bg-[#2d2d2d] leading-[16px]"
                style={{ color: cfg?.color || '#cccccc' }}
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
