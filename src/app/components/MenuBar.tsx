import { useRef } from 'react';
import {
  Settings, CircleUser, Minus, Square, X, Code2, Presentation, Workflow,
  Sun, Moon,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useTheme } from '../context/ThemeContext';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from './ui/menubar';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Toggle } from './ui/toggle';
import { Separator } from './ui/separator';
import { Button } from './ui/button';

const menus = [
  {
    label: 'File',
    items: ['New Project', 'Open Project...', '---', 'Save', 'Save As...', '---', 'Setting...', 'Close'],
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
    label: 'Run',
    items: ['Start Simulation', 'Debug Simulation', '---', 'Static Check', 'Synthesis', 'Place & Route', '---', 'Stop'],
  },
  {
    label: 'Terminal',
    items: ['New Terminal', 'Split Terminal', '---', 'Run Task...'],
  },
  {
    label: 'Help',
    items: ['Documentation', 'Check for Update...', '---', 'About'],
  },
];

const noDrag = { WebkitAppRegion: 'no-drag' as const };
const noDragInteractive = {
  WebkitAppRegion: 'no-drag' as const,
  pointerEvents: 'auto' as const,
};
const isMacOS = window.electronAPI?.platform === 'darwin';

/* Custom panel-toggle icons with optional rectangle fill */
const PanelLeftIcon = ({ size = 15, filled = false }: { size?: number; filled?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {filled && <rect x="3" y="3" width="6" height="18" rx="2" fill="currentColor" stroke="none" />}
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
  </svg>
);

const PanelBottomIcon = ({ size = 15, filled = false }: { size?: number; filled?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {filled && <rect x="3" y="15" width="18" height="6" rx="2" fill="currentColor" stroke="none" />}
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 15h18" />
  </svg>
);

const PanelRightIcon = ({ size = 15, filled = false }: { size?: number; filled?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {filled && <rect x="12" y="3" width="9" height="18" rx="2" fill="currentColor" stroke="none" />}
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M12 3v18" />
  </svg>
);

interface MenuBarProps {
  showLeftPanel?: boolean;
  showBottomPanel?: boolean;
  showRightPanel?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleBottomPanel?: () => void;
  onToggleRightPanel?: () => void;
}

export function MenuBar({
  showLeftPanel = false,
  showBottomPanel = false,
  showRightPanel = false,
  onToggleLeftPanel,
  onToggleBottomPanel,
  onToggleRightPanel,
}: MenuBarProps) {
  const { mainContentView, setMainContentView } = useWorkspace();
  const { theme, toggleTheme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="flex items-center h-8 bg-muted/50 border-b border-border select-none shrink-0 z-50"
      style={{ userSelect: 'none', WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* macOS traffic light clearance */}
      {isMacOS && <div className="w-20 shrink-0" />}

      {/* App icon / title */}
      <div className="flex items-center gap-1.5 px-3 pr-2" style={noDrag as React.CSSProperties}>
        <div className="w-4 h-4 rounded-sm bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-[9px] font-bold">P</span>
        </div>
      </div>

      {/* Menu items — shadcn Menubar */}
      <Menubar className="h-8 border-0 rounded-none bg-transparent p-0 shadow-none" style={noDrag as React.CSSProperties}>
        {menus.map((menu) => (
          <MenubarMenu key={menu.label}>
            <MenubarTrigger className="px-2.5 h-7 text-[12px] font-normal rounded-sm">
              {menu.label}
            </MenubarTrigger>
            <MenubarContent align="start" sideOffset={4} className="min-w-48">
              {menu.items.map((item, i) =>
                item === '---' ? (
                  <MenubarSeparator key={i} />
                ) : (
                  <MenubarItem key={i} className="text-[12px]">
                    {item}
                  </MenubarItem>
                )
              )}
            </MenubarContent>
          </MenubarMenu>
        ))}
      </Menubar>


      {/* Center view switcher — absolutely centered */}
      <div
        data-testid="center-view-switcher"
        className="absolute left-1/2 -translate-x-1/2"
        style={noDragInteractive as React.CSSProperties}
      >
        <ToggleGroup
          type="single"
          value={mainContentView}
          onValueChange={(value) => { if (value) setMainContentView(value as 'code' | 'whiteboard' | 'workflow'); }}
          className="bg-muted rounded p-0.5 gap-0.5"
        >
          <ToggleGroupItem value="code" title="Code" className="w-7 h-6 p-0 data-[state=on]:bg-background data-[state=on]:text-foreground text-muted-foreground">
            <Code2 size={13} />
          </ToggleGroupItem>
          <ToggleGroupItem value="whiteboard" title="Whiteboard" className="w-7 h-6 p-0 data-[state=on]:bg-background data-[state=on]:text-foreground text-muted-foreground">
            <Presentation size={13} />
          </ToggleGroupItem>
          <ToggleGroupItem value="workflow" title="Workflow" className="w-7 h-6 p-0 data-[state=on]:bg-background data-[state=on]:text-foreground text-muted-foreground">
            <Workflow size={13} />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Right side controls */}
      <div className="ml-auto flex items-center h-full" style={noDrag as React.CSSProperties}>

        {/* Layout icons */}
        <Toggle
          aria-label="Toggle left sidebar"
          pressed={showLeftPanel}
          data-testid="toggle-left-panel"
          className="w-8 h-full rounded-none border-0 data-[state=on]:text-foreground text-muted-foreground hover:text-foreground hover:bg-accent"
          onPressedChange={() => onToggleLeftPanel?.()}
        >
          <PanelLeftIcon size={15} filled={showLeftPanel} />
        </Toggle>
        <Toggle
          aria-label="Toggle bottom panel"
          pressed={showBottomPanel}
          data-testid="toggle-bottom-panel"
          className="w-8 h-full rounded-none border-0 data-[state=on]:text-foreground text-muted-foreground hover:text-foreground hover:bg-accent"
          onPressedChange={() => onToggleBottomPanel?.()}
        >
          <PanelBottomIcon size={15} filled={showBottomPanel} />
        </Toggle>
        <Toggle
          aria-label="Toggle right sidebar"
          pressed={showRightPanel}
          data-testid="toggle-right-panel"
          className="w-8 h-full rounded-none border-0 data-[state=on]:text-foreground text-muted-foreground hover:text-foreground hover:bg-accent"
          onPressedChange={() => onToggleRightPanel?.()}
        >
          <PanelRightIcon size={15} filled={showRightPanel} />
        </Toggle>

        <Separator orientation="vertical" className="h-4 mx-1" />

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          data-testid="toggle-theme"
          className="w-8 h-full rounded-none text-muted-foreground hover:text-foreground"
          onClick={toggleTheme}
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </Button>

        {/* Settings */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-full rounded-none text-muted-foreground hover:text-foreground"
        >
          <Settings size={15} />
        </Button>

        {/* User avatar */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-full rounded-none relative"
        >
          <CircleUser size={16} className="text-muted-foreground" />
          <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-green-500 border border-background" />
        </Button>

        <Separator orientation="vertical" className="h-4 mx-1" />

        {/* Window controls (hidden on macOS — native traffic lights used instead) */}
        {!isMacOS && (
          <>
            <button
              data-testid="window-control-minimize"
              className="w-9 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              style={noDragInteractive as React.CSSProperties}
              onClick={() => window.electronAPI?.minimize()}
            >
              <Minus size={14} />
            </button>
            <button
              data-testid="window-control-maximize"
              className="w-9 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              style={noDragInteractive as React.CSSProperties}
              onClick={() => window.electronAPI?.maximize()}
            >
              <Square size={12} />
            </button>
            <button
              data-testid="window-control-close"
              className="w-9 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-destructive/80 transition-colors"
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