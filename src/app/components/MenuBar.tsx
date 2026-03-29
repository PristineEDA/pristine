import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown, Folder, GitBranch, Globe,
  ChevronLeft, ChevronRight, PanelLeft, PanelBottom, Columns2,
  Settings, CircleUser, Minus, Square, X, Zap,
} from 'lucide-react';

const menus = [
  {
    label: 'File',
    items: ['New File', 'New Folder', '---', 'Open Project...', 'Recent', '---', 'Save', 'Save All', '---', 'Close Editor', 'Exit'],
  },
  {
    label: 'Edit',
    items: ['Undo', 'Redo', '---', 'Cut', 'Copy', 'Paste', '---', 'Find', 'Replace', '---', 'Format Document', 'Toggle Comment'],
  },
  {
    label: 'Selection',
    items: ['Select All', 'Expand Selection', '---', 'Select All Occurrences', 'Add Cursor to Line Ends'],
  },
  {
    label: 'View',
    items: ['Command Palette', '---', 'Explorer', 'AI Assistant', '---', 'Terminal', 'Output', 'Problems', '---', 'Split Editor'],
  },
  {
    label: 'Go',
    items: ['Go to File...', 'Go to Symbol...', 'Go to Definition', 'Find All References', '---', 'Go to Line/Column...'],
  },
  {
    label: 'Run',
    items: ['Start Simulation', 'Debug Simulation', '---', 'Static Check', 'Synthesis', 'Place & Route', '---', 'Stop'],
  },
  {
    label: 'Terminal',
    items: ['New Terminal', 'Split Terminal', '---', 'Run Task...', 'Verilator', 'VCS', 'Synopsys DC'],
  },
  {
    label: 'Help',
    items: ['Documentation', 'Keyboard Shortcuts', '---', 'RTL Syntax Reference', 'SystemVerilog LRM', '---', 'About'],
  },
];

const noDrag = { WebkitAppRegion: 'no-drag' as const };
const noDragInteractive = {
  WebkitAppRegion: 'no-drag' as const,
  pointerEvents: 'auto' as const,
};
const isMacOS = window.electronAPI?.platform === 'darwin';

interface MenuBarProps {
  showLeftPanel?: boolean;
  showBottomPanel?: boolean;
  showRightPanel?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleBottomPanel?: () => void;
  onToggleRightPanel?: () => void;
}

function getLayoutButtonClass(isActive: boolean) {
  return `w-8 h-full flex items-center justify-center transition-colors ${
    isActive
      ? 'text-ide-text bg-ide-btn-hover'
      : 'text-ide-text-muted hover:text-ide-text hover:bg-ide-btn-hover'
  }`;
}

export function MenuBar({
  showLeftPanel = false,
  showBottomPanel = false,
  showRightPanel = false,
  onToggleLeftPanel,
  onToggleBottomPanel,
  onToggleRightPanel,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [projectOpen, setProjectOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState('Select Project');
  const ref = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
        setProjectOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const projectOptions = [
    { id: 'folder', label: 'Folder', icon: Folder },
    { id: 'git', label: 'Git Repo', icon: GitBranch },
    { id: 'remote', label: 'Remote Host', icon: Globe },
  ];

  return (
    <div
      ref={ref}
      className="flex items-center h-8 bg-ide-menubar-bg select-none shrink-0 z-50"
      style={{ userSelect: 'none', WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* macOS traffic light clearance */}
      {isMacOS && <div className="w-20 shrink-0" />}

      {/* App icon / title */}
      <div className="flex items-center gap-1.5 px-3 pr-2" style={noDrag as React.CSSProperties}>
        <div className="w-4 h-4 rounded-sm bg-ide-accent flex items-center justify-center">
          <span className="text-white text-[9px] font-bold">P</span>
        </div>
        {/* <span className="text-ide-text text-[12px]">Pristine</span> */}
      </div>

      {/* Menu items */}
      {menus.map((menu, idx) => (
        <div key={menu.label} className="relative" style={noDrag as React.CSSProperties}>
          <button
            className={`px-2.5 h-8 text-ide-text hover:bg-ide-btn-hover transition-colors ${
              openMenu === idx ? 'bg-ide-accent-dark text-white' : ''
            } text-[12px]`}
            onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
            onMouseEnter={() => openMenu !== null && setOpenMenu(idx)}
          >
            {menu.label}
          </button>

          {openMenu === idx && (
            <div className="absolute top-full left-0 bg-ide-sidebar-bg border border-ide-border-light shadow-2xl z-50 min-w-48 py-1">
              {menu.items.map((item, i) =>
                item === '---' ? (
                  <div key={i} className="h-px bg-ide-border-light my-1" />
                ) : (
                  <button
                    key={i}
                    className="w-full text-left px-4 py-1 text-ide-text hover:bg-ide-accent-dark hover:text-white transition-colors text-[12px]"
                    onClick={() => setOpenMenu(null)}
                  >
                    {item}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}

      {/* Right side controls */}
      <div className="ml-auto flex items-center h-full" style={noDrag as React.CSSProperties}>

        {/* Select Project dropdown */}
        <div ref={projectRef} className="relative flex items-center h-full">
          <button
            className="flex items-center gap-1.5 px-3 h-full text-ide-text hover:bg-ide-btn-hover transition-colors text-[12px]"
            onClick={() => setProjectOpen(!projectOpen)}
          >
            <span>{selectedProject}</span>
            <ChevronDown size={12} />
          </button>
          {projectOpen && (
            <div className="absolute top-full left-0 mt-0 bg-ide-sidebar-bg border border-ide-border-light shadow-2xl z-50 min-w-44 py-1">
              {projectOptions.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-ide-text hover:bg-ide-accent-dark hover:text-white transition-colors text-[12px]"
                  onClick={() => { setSelectedProject(label); setProjectOpen(false); }}
                >
                  <Icon size={14} className="shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-ide-text-dim mx-1" />

        {/* Upgrade to Pro */}
        <button className="flex items-center gap-1 px-2.5 h-full text-ide-text hover:bg-ide-btn-hover transition-colors text-[12px]">
          <Zap size={12} className="text-ide-pro" />
          <span>Upgrade to </span>
          <span className="text-ide-pro font-[600]">Pro</span>
          <ChevronRight size={12} />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-ide-text-dim mx-1" />

        {/* Navigation arrows */}
        <button className="w-8 h-full flex items-center justify-center text-ide-text-muted hover:text-ide-text hover:bg-ide-btn-hover transition-colors">
          <ChevronLeft size={16} />
        </button>
        <button className="w-8 h-full flex items-center justify-center text-ide-text-muted hover:text-ide-text hover:bg-ide-btn-hover transition-colors">
          <ChevronRight size={16} />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-ide-text-dim mx-1" />

        {/* Layout icons */}
        <button
          type="button"
          aria-label="Toggle left sidebar"
          aria-pressed={showLeftPanel}
          data-testid="toggle-left-panel"
          className={getLayoutButtonClass(showLeftPanel)}
          onClick={onToggleLeftPanel}
        >
          <PanelLeft size={15} />
        </button>
        <button
          type="button"
          aria-label="Toggle bottom panel"
          aria-pressed={showBottomPanel}
          data-testid="toggle-bottom-panel"
          className={getLayoutButtonClass(showBottomPanel)}
          onClick={onToggleBottomPanel}
        >
          <PanelBottom size={15} />
        </button>
        <button
          type="button"
          aria-label="Toggle right sidebar"
          aria-pressed={showRightPanel}
          data-testid="toggle-right-panel"
          className={getLayoutButtonClass(showRightPanel)}
          onClick={onToggleRightPanel}
        >
          <Columns2 size={15} />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-ide-text-dim mx-1" />

        {/* Settings */}
        <button className="w-8 h-full flex items-center justify-center text-ide-text-muted hover:text-ide-text hover:bg-ide-btn-hover transition-colors">
          <Settings size={15} />
        </button>

        {/* User avatar */}
        <button className="w-8 h-full flex items-center justify-center hover:bg-ide-btn-hover transition-colors relative">
          <CircleUser size={16} className="text-ide-text-muted" />
          <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-ide-online border border-ide-menubar-bg" />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-ide-text-dim mx-1" />

        {/* Window controls (hidden on macOS — native traffic lights used instead) */}
        {!isMacOS && (
          <>
            <button
              data-testid="window-control-minimize"
              className="w-9 h-full flex items-center justify-center text-ide-text-muted hover:text-white hover:bg-ide-btn-hover transition-colors"
              style={noDragInteractive as React.CSSProperties}
              onClick={() => window.electronAPI?.minimize()}
            >
              <Minus size={14} />
            </button>
            <button
              data-testid="window-control-maximize"
              className="w-9 h-full flex items-center justify-center text-ide-text-muted hover:text-white hover:bg-ide-btn-hover transition-colors"
              style={noDragInteractive as React.CSSProperties}
              onClick={() => window.electronAPI?.maximize()}
            >
              <Square size={12} />
            </button>
            <button
              data-testid="window-control-close"
              className="w-9 h-full flex items-center justify-center text-ide-text-muted hover:text-white hover:bg-ide-close transition-colors"
              style={noDragInteractive as React.CSSProperties}
              onClick={() => window.electronAPI?.close()}
            >
              <X size={14} />
            </button>
          </>
        )}

      </div>
    </div>
  );
}