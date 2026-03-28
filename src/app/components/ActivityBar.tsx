import {
  Files, Search, GitBranch, Bug, Puzzle, Settings,
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
    <div className="flex flex-col items-center w-12 bg-ide-activitybar-bg border-r border-ide-sidebar-bg shrink-0 z-10">
      <div className="flex flex-col flex-1">
        {topItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => onViewChange(id)}
            className={`relative w-12 h-12 flex items-center justify-center group transition-colors ${
              activeView === id
                ? 'text-white border-l-2 border-ide-accent'
                : 'text-ide-text-muted hover:text-ide-text border-l-2 border-transparent'
            }`}
          >
            <Icon size={22} strokeWidth={1.5} />
            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-ide-sidebar-bg border border-ide-border-light text-ide-text rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
              {label}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center pb-2">
        <button
          title="Settings"
          className="w-12 h-12 flex items-center justify-center text-ide-text-muted hover:text-ide-text transition-colors"
        >
          <Settings size={20} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}