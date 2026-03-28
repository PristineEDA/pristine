import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown, Folder, GitBranch, Globe, Search,
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
const isMacOS = window.electronAPI?.platform === 'darwin';

export function MenuBar() {
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
      className="flex items-center h-8 bg-[#3c3c3c] select-none shrink-0 z-50"
      style={{ userSelect: 'none', WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* macOS traffic light clearance */}
      {isMacOS && <div className="w-20 shrink-0" />}

      {/* App icon / title */}
      <div className="flex items-center gap-1.5 px-3 pr-4" style={noDrag as React.CSSProperties}>
        <div className="w-4 h-4 rounded-sm bg-[#0e639c] flex items-center justify-center">
          <span className="text-white" style={{ fontSize: '9px', fontWeight: 700 }}>P</span>
        </div>
        <span className="text-[#cccccc]" style={{ fontSize: '12px' }}>Pristine</span>
      </div>

      {/* Menu items */}
      {menus.map((menu, idx) => (
        <div key={menu.label} className="relative" style={noDrag as React.CSSProperties}>
          <button
            className={`px-2.5 h-8 text-[#cccccc] hover:bg-[#505050] transition-colors ${
              openMenu === idx ? 'bg-[#094771] text-white' : ''
            }`}
            style={{ fontSize: '12px' }}
            onClick={() => setOpenMenu(openMenu === idx ? null : idx)}
            onMouseEnter={() => openMenu !== null && setOpenMenu(idx)}
          >
            {menu.label}
          </button>

          {openMenu === idx && (
            <div className="absolute top-full left-0 bg-[#252526] border border-[#454545] shadow-2xl z-50 min-w-48 py-1">
              {menu.items.map((item, i) =>
                item === '---' ? (
                  <div key={i} className="h-px bg-[#454545] my-1" />
                ) : (
                  <button
                    key={i}
                    className="w-full text-left px-4 py-1 text-[#cccccc] hover:bg-[#094771] hover:text-white transition-colors"
                    style={{ fontSize: '12px' }}
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
            className="flex items-center gap-1.5 px-3 h-full text-[#cccccc] hover:bg-[#505050] transition-colors"
            style={{ fontSize: '12px' }}
            onClick={() => setProjectOpen(!projectOpen)}
          >
            <span>{selectedProject}</span>
            <ChevronDown size={12} />
          </button>
          {projectOpen && (
            <div className="absolute top-full left-0 mt-0 bg-[#252526] border border-[#454545] shadow-2xl z-50 min-w-44 py-1">
              {projectOptions.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[#cccccc] hover:bg-[#094771] hover:text-white transition-colors"
                  style={{ fontSize: '12px' }}
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
        <div className="w-px h-4 bg-[#555555] mx-1" />

        {/* Search */}
        <button className="flex items-center gap-1.5 px-10 h-full text-[#858585] hover:text-[#cccccc] hover:bg-[#505050] transition-colors">
          <Search size={13} />
          <span className="text-[#858585]" style={{ fontSize: '12px' }}>Search</span>
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-[#555555] mx-1" />

        {/* Upgrade to Pro */}
        <button className="flex items-center gap-1 px-2.5 h-full text-[#cccccc] hover:bg-[#505050] transition-colors" style={{ fontSize: '12px' }}>
          <Zap size={12} className="text-[#f0c040]" />
          <span>Upgrade to </span>
          <span className="text-[#f0c040]" style={{ fontWeight: 600 }}>Pro</span>
          <ChevronRight size={12} />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-[#555555] mx-1" />

        {/* Navigation arrows */}
        <button className="w-8 h-full flex items-center justify-center text-[#858585] hover:text-[#cccccc] hover:bg-[#505050] transition-colors">
          <ChevronLeft size={16} />
        </button>
        <button className="w-8 h-full flex items-center justify-center text-[#858585] hover:text-[#cccccc] hover:bg-[#505050] transition-colors">
          <ChevronRight size={16} />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-[#555555] mx-1" />

        {/* Layout icons */}
        <button className="w-8 h-full flex items-center justify-center text-[#858585] hover:text-[#cccccc] hover:bg-[#505050] transition-colors">
          <PanelLeft size={15} />
        </button>
        <button className="w-8 h-full flex items-center justify-center text-[#858585] hover:text-[#cccccc] hover:bg-[#505050] transition-colors">
          <PanelBottom size={15} />
        </button>
        <button className="w-8 h-full flex items-center justify-center text-[#858585] hover:text-[#cccccc] hover:bg-[#505050] transition-colors">
          <Columns2 size={15} />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-[#555555] mx-1" />

        {/* Settings */}
        <button className="w-8 h-full flex items-center justify-center text-[#858585] hover:text-[#cccccc] hover:bg-[#505050] transition-colors">
          <Settings size={15} />
        </button>

        {/* User avatar */}
        <button className="w-8 h-full flex items-center justify-center hover:bg-[#505050] transition-colors relative">
          <CircleUser size={16} className="text-[#858585]" />
          <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-[#4caf50] border border-[#3c3c3c]" />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-[#555555] mx-1" />

        {/* Window controls (hidden on macOS — native traffic lights used instead) */}
        {!isMacOS && (
          <>
            <button
              className="w-9 h-full flex items-center justify-center text-[#858585] hover:text-white hover:bg-[#505050] transition-colors"
              onClick={() => window.electronAPI?.minimize()}
            >
              <Minus size={14} />
            </button>
            <button
              className="w-9 h-full flex items-center justify-center text-[#858585] hover:text-white hover:bg-[#505050] transition-colors"
              onClick={() => window.electronAPI?.maximize()}
            >
              <Square size={12} />
            </button>
            <button
              className="w-9 h-full flex items-center justify-center text-[#858585] hover:text-white hover:bg-[#c42b1c] transition-colors"
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