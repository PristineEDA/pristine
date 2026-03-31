import { useState, useRef, useEffect } from 'react';
import {
  PanelLeft, PanelBottom, Columns2,
  Settings, CircleUser, Minus, Square, X, Code2, Presentation, Workflow,
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
  const [activeView, setActiveView] = useState<'code' | 'whiteboard' | 'workflow'>('code');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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


      {/* Center view switcher — absolutely centered */}
      <div
        data-testid="center-view-switcher"
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-[#2d2d2d] rounded p-0.5"
        style={noDragInteractive as React.CSSProperties}
      >
        <button
          title="Code"
          onClick={() => setActiveView('code')}
          className={`w-7 h-6 flex cursor-pointer items-center justify-center rounded transition-colors ${
            activeView === 'code'
              ? 'bg-[#505050] text-[#cccccc]'
              : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#404040]'
          }`}
        >
          <Code2 size={13} />
        </button>
        <button
          title="Whiteboard"
          onClick={() => setActiveView('whiteboard')}
          className={`w-7 h-6 flex cursor-pointer items-center justify-center rounded transition-colors ${
            activeView === 'whiteboard'
              ? 'bg-[#505050] text-[#cccccc]'
              : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#404040]'
          }`}
        >
          <Presentation size={13} />
        </button>
        <button
          title="Workflow"
          onClick={() => setActiveView('workflow')}
          className={`w-7 h-6 flex cursor-pointer items-center justify-center rounded transition-colors ${
            activeView === 'workflow'
              ? 'bg-[#505050] text-[#cccccc]'
              : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#404040]'
          }`}
        >
          <Workflow size={13} />
        </button>
      </div>

      {/* Right side controls */}
      <div className="ml-auto flex items-center h-full" style={noDrag as React.CSSProperties}>

        {/* Layout icons */}
        <button
          type="button"
          aria-label="Toggle left sidebar"
          aria-pressed={showLeftPanel}
          data-testid="toggle-left-panel"
          className={`${getLayoutButtonClass(showLeftPanel)} cursor-pointer`}
          onClick={onToggleLeftPanel}
        >
          <PanelLeft size={15} />
        </button>
        <button
          type="button"
          aria-label="Toggle bottom panel"
          aria-pressed={showBottomPanel}
          data-testid="toggle-bottom-panel"
          className={`${getLayoutButtonClass(showBottomPanel)} cursor-pointer`}
          onClick={onToggleBottomPanel}
        >
          <PanelBottom size={15} />
        </button>
        <button
          type="button"
          aria-label="Toggle right sidebar"
          aria-pressed={showRightPanel}
          data-testid="toggle-right-panel"
          className={`${getLayoutButtonClass(showRightPanel)} cursor-pointer`}
          onClick={onToggleRightPanel}
        >
          <Columns2 size={15} />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-ide-text-dim mx-1" />

        {/* Settings */}
        <button className="w-8 h-full flex cursor-pointer items-center justify-center text-ide-text-muted hover:text-ide-text hover:bg-ide-btn-hover transition-colors">
          <Settings size={15} />
        </button>

        {/* User avatar */}
        <button className="w-8 h-full flex cursor-pointer items-center justify-center hover:bg-ide-btn-hover transition-colors relative">
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