import {
  Files, Search, GitBranch, Bug, Puzzle, Settings, ChevronRight,
} from 'lucide-react';

interface ActivityBarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const topItems = [
  { id: 'explorer', icon: Files, label: 'Explorer' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'git', icon: GitBranch, label: 'Source Control' },
  { id: 'debug', icon: Bug, label: 'Run & Debug' },
  { id: 'extensions', icon: Puzzle, label: 'Extensions' },
];

export function ActivityBar({ activeView, onViewChange }: ActivityBarProps) {
  return (
    <div className="flex flex-col items-center w-12 bg-[#333333] border-r border-[#252526] shrink-0 z-10">
      <div className="flex flex-col flex-1">
        {topItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => onViewChange(id)}
            className={`relative w-12 h-12 flex items-center justify-center group transition-colors ${
              activeView === id
                ? 'text-white border-l-2 border-[#0e639c]'
                : 'text-[#858585] hover:text-[#cccccc] border-l-2 border-transparent'
            }`}
          >
            <Icon size={22} strokeWidth={1.5} />
            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-[#252526] border border-[#454545] text-[#cccccc] rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
              {label}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center pb-2">
        <button
          title="Settings"
          className="w-12 h-12 flex items-center justify-center text-[#858585] hover:text-[#cccccc] transition-colors"
        >
          <Settings size={20} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}