import { useRef, useState } from 'react';
import {
  Settings, CircleUser, Minus, Square, X, Code2, Presentation, Workflow,
  Sun, Moon,
} from 'lucide-react';
import { canToggleLayoutPanels as canUseLayoutPanels } from '../codeViewPanels';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useSidebar } from './ui/sidebar';
import { centerViewSwitchItemClassName } from './viewSwitcherStyles';

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

function TooltipIconButton({
  content,
  children,
  side = 'bottom',
  wrapTrigger = true,
}: {
  content: string;
  children: React.ReactNode;
  side?: React.ComponentProps<typeof TooltipContent>['side'];
  wrapTrigger?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {wrapTrigger ? <span className="inline-flex h-full">{children}</span> : children}
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

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
  const { activeView, mainContentView, setMainContentView } = useWorkspace();
  const { theme, toggleTheme } = useTheme();
  const { state: activityBarState, toggleSidebar } = useSidebar();
  const ref = useRef<HTMLDivElement>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const layoutIconsEnabled = canUseLayoutPanels(mainContentView, activeView);
  const activityBarToggleEnabled = mainContentView === 'code';
  const layoutIconClassName = [
    'w-8 h-full rounded-none border-0 text-muted-foreground',
    'data-[state=on]:text-foreground',
    layoutIconsEnabled
      ? 'hover:cursor-pointer hover:text-foreground hover:bg-accent'
      : 'cursor-not-allowed opacity-40',
  ].join(' ');
  const activityBarTriggerClassName = [
    'ml-1 w-8 h-full rounded-none border-0 text-muted-foreground',
    'data-[state=on]:text-foreground',
    activityBarToggleEnabled
      ? 'hover:cursor-pointer hover:text-foreground hover:bg-accent'
      : 'opacity-40',
  ].join(' ');

  const handleMinimizeToTray = () => {
    setCloseDialogOpen(false);
    void window.electronAPI?.hide();
  };

  const handleQuitPristine = () => {
    setCloseDialogOpen(false);
    void window.electronAPI?.close();
  };

  return (
    <TooltipProvider delayDuration={0}>
      <>
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


          <TooltipIconButton content="Toggle activity bar" wrapTrigger={false}>
            <Toggle
              aria-label="Toggle activity bar"
              aria-disabled={!activityBarToggleEnabled}
              data-testid="toggle-activity-bar"
              disabled={!activityBarToggleEnabled}
              pressed={activityBarToggleEnabled ? activityBarState === 'expanded' : false}
              className={activityBarTriggerClassName}
              onPressedChange={() => {
                if (!activityBarToggleEnabled) {
                  return;
                }

                toggleSidebar();
              }}
              style={noDragInteractive as React.CSSProperties}
            >
              <PanelLeftIcon size={15} filled={activityBarState === 'expanded'} />
            </Toggle>
          </TooltipIconButton>

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
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <ToggleGroupItem aria-label="Code" data-testid="center-view-code" value="code" className={centerViewSwitchItemClassName}>
                    <Code2 size={13} />
                  </ToggleGroupItem>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>Code</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <ToggleGroupItem aria-label="Whiteboard" data-testid="center-view-whiteboard" value="whiteboard" className={centerViewSwitchItemClassName}>
                    <Presentation size={13} />
                  </ToggleGroupItem>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>Whiteboard</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <ToggleGroupItem aria-label="Workflow" data-testid="center-view-workflow" value="workflow" className={centerViewSwitchItemClassName}>
                    <Workflow size={13} />
                  </ToggleGroupItem>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>Workflow</TooltipContent>
            </Tooltip>
          </ToggleGroup>
          </div>

          {/* Right side controls */}
          <div
            data-testid="right-side-controls"
            className="ml-auto flex items-center h-full"
            style={noDrag as React.CSSProperties}
          >

          {/* Layout icons */}
          <TooltipIconButton content="Toggle left sidebar">
            <Toggle
              aria-label="Toggle left sidebar"
              aria-disabled={!layoutIconsEnabled}
              pressed={layoutIconsEnabled ? showLeftPanel : false}
              data-testid="toggle-left-panel"
              disabled={!layoutIconsEnabled}
              className={layoutIconClassName}
              onPressedChange={() => {
                if (!layoutIconsEnabled) {
                  return;
                }

                onToggleLeftPanel?.();
              }}
            >
              <PanelLeftIcon size={15} filled={showLeftPanel} />
            </Toggle>
          </TooltipIconButton>
          <TooltipIconButton content="Toggle bottom panel">
            <Toggle
              aria-label="Toggle bottom panel"
              aria-disabled={!layoutIconsEnabled}
              pressed={layoutIconsEnabled ? showBottomPanel : false}
              data-testid="toggle-bottom-panel"
              disabled={!layoutIconsEnabled}
              className={layoutIconClassName}
              onPressedChange={() => {
                if (!layoutIconsEnabled) {
                  return;
                }

                onToggleBottomPanel?.();
              }}
            >
              <PanelBottomIcon size={15} filled={showBottomPanel} />
            </Toggle>
          </TooltipIconButton>
          <TooltipIconButton content="Toggle right sidebar">
            <Toggle
              aria-label="Toggle right sidebar"
              aria-disabled={!layoutIconsEnabled}
              pressed={layoutIconsEnabled ? showRightPanel : false}
              data-testid="toggle-right-panel"
              disabled={!layoutIconsEnabled}
              className={layoutIconClassName}
              onPressedChange={() => {
                if (!layoutIconsEnabled) {
                  return;
                }

                onToggleRightPanel?.();
              }}
            >
              <PanelRightIcon size={15} filled={showRightPanel} />
            </Toggle>
          </TooltipIconButton>

          <Separator orientation="vertical" className="h-4 mx-1" />

          {/* Theme toggle */}
          <TooltipIconButton content="Toggle theme" wrapTrigger={false}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              data-testid="toggle-theme"
              className="w-8 h-full rounded-none text-muted-foreground hover:cursor-pointer hover:text-foreground"
              onClick={toggleTheme}
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </Button>
          </TooltipIconButton>

          {/* Settings */}
          <TooltipIconButton content="Settings" wrapTrigger={false}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Settings"
              data-testid="menu-settings-button"
              className="w-8 h-full rounded-none text-muted-foreground hover:cursor-pointer hover:text-foreground"
            >
              <Settings size={15} />
            </Button>
          </TooltipIconButton>

          {/* User avatar */}
          <TooltipIconButton content="User profile" wrapTrigger={false}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="User profile"
              data-testid="user-avatar-button"
              className="relative h-full w-8 rounded-none hover:cursor-pointer"
            >
              <CircleUser size={16} className="text-muted-foreground" />
              <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-green-500 border border-background" />
            </Button>
          </TooltipIconButton>

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
                onClick={() => setCloseDialogOpen(true)}
              >
                <X size={14} />
              </button>
            </>
          )}

          </div>
        </div>

        <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
          <DialogContent data-testid="close-confirmation-dialog" style={noDragInteractive as React.CSSProperties}>
            <DialogHeader>
              <DialogTitle>Close Pristine?</DialogTitle>
              <DialogDescription>
                You can quit the app now or keep it running in the system tray and reopen it later.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                data-testid="close-action-cancel"
                onClick={() => setCloseDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                data-testid="close-action-minimize-to-tray"
                onClick={handleMinimizeToTray}
              >
                Minimize to Tray
              </Button>
              <Button
                type="button"
                variant="destructive"
                data-testid="close-action-quit"
                onClick={handleQuitPristine}
              >
                Quit Pristine
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </TooltipProvider>
  );
}