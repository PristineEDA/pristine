import {
  Files, Bug, Hammer, Play,
} from 'lucide-react';

interface ActivityBarProps {
  activeView: string;
  onItemSelect: (view: string) => void;
  isLeftSidebarHidden?: boolean;
}

const topItems = [
  { id: 'explorer', icon: Files, label: 'Explorer' },
  { id: 'debug', icon: Bug, label: 'Run & Debug' },
];

const actionItems = [
  { id: 'compile', icon: Hammer, label: 'Compile' },
  { id: 'run', icon: Play, label: 'Run' },
  { id: 'debug-action', icon: Bug, label: 'Debug' },
] as const;

export function ActivityBar({ activeView, onItemSelect, isLeftSidebarHidden = false }: ActivityBarProps) {
  return (
    <div className="ide-sidebar-scope flex flex-col items-center w-12 bg-ide-activitybar-bg border-r border-ide-sidebar-bg shrink-0 z-10">
      <div className="flex flex-col flex-1">
        {topItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            data-testid={`activity-item-${id}`}
            onClick={() => onItemSelect(id)}
            className={`relative w-12 h-12 flex items-center justify-center group transition-colors ${
              activeView === id && !isLeftSidebarHidden
                ? 'text-white border-l-2 border-ide-accent'
                : 'text-ide-text-muted hover:text-ide-text border-l-2 border-transparent'
            }`}
          >
            <Icon size={20} strokeWidth={1.5} />
            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-ide-sidebar-bg border border-ide-border-light text-ide-text rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
              {label}
            </div>
          </button>
        ))}
      </div>

      <div className="h-px w-8 bg-ide-border-light shrink-0" />

      <div className="flex flex-col items-center gap-1.5 px-1.5 py-2 shrink-0">
        {actionItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            data-testid={`activity-action-${id}`}
            className="relative flex h-9 w-9 items-center justify-center rounded-md text-ide-online transition-all group hover:bg-ide-btn-hover hover:text-white"
          >
            <Icon size={18} strokeWidth={1.7} />
            <div className="absolute left-full ml-2 px-2 py-1 bg-ide-sidebar-bg border border-ide-border-light text-ide-text rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
              {label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}