import { useRef, useState } from 'react';
import { useEffect } from 'react';
import {
  Settings, CircleUser, Minus, Square, X, Code2, Presentation, Workflow,
  Sun, Moon,
} from 'lucide-react';
import { canToggleLayoutPanels as canUseLayoutPanels } from '../../../codeViewPanels';
import { useEditorSettings } from '../../../context/EditorSettingsContext';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { useTheme, type Theme } from '../../../context/ThemeContext';
import {
  EDITOR_FONT_FAMILY_CONFIG_KEY,
  EDITOR_FONT_SIZE_CONFIG_KEY,
  EDITOR_THEME_CONFIG_KEY,
  editorFontFamilyOptions,
  getEditorFontFamilyLabel,
  editorThemeOptions,
  parseEditorFontFamily,
  getEditorThemeLabel,
  parseEditorFontSize,
  parseEditorTheme,
} from '../../../editor/editorSettings';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
} from '../../ui/menubar';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';
import { Toggle } from '../../ui/toggle';
import { Separator } from '../../ui/separator';
import { Button } from '../../ui/button';
import { Combobox } from '../../ui/combobox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { ScrollArea } from '../../ui/scroll-area';
import { Slider } from '../../ui/slider';
import { Switch } from '../../ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { useSidebar } from '../../ui/sidebar';
import { centerViewSwitchItemClassName } from './viewSwitcherStyles';

const menus = [
  {
    label: 'File',
    items: [{ name: 'New Project', kdb: '⌘N'}, {name: 'Open Project...', kdb: '⌘O'}, {name: '---', kdb: ''}, {name: 'Save', kdb: '⌘S'}, {name: 'Save As...', kdb: '⇧⌘S'}, {name: '---', kdb: ''}, {name: 'Setting...', kdb: ''}, {name: 'Close', kdb: '⌘Q'}],
  },
  {
    label: 'Edit',
    items: [{name: 'Undo', kdb: '⌘Z'}, {name: 'Redo', kdb: '⌘Y'}, {name: '---', kdb: ''}, {name: 'Cut', kdb: '⌘X'}, {name: 'Copy', kdb: '⌘C'}, {name: 'Paste', kdb: '⌘V'}, {name: '---', kdb: ''}, {name: 'Find', kdb: '⌘F'}, {name: 'Replace', kdb: '⌘H'}],
  },
  {
    label: 'Help',
    items: [{name: 'Documentation', kdb: ''}, {name: 'Check for Update...', kdb: ''}, {name: '---', kdb: ''}, {name: 'About', kdb: ''}],
  },
];

const noDrag = { WebkitAppRegion: 'no-drag' as const };
const noDragInteractive = {
  WebkitAppRegion: 'no-drag' as const,
  pointerEvents: 'auto' as const,
};
const isMacOS = window.electronAPI?.platform === 'darwin';
const closeShortcutLabel = isMacOS ? '⌘Q' : 'Ctrl+Q';
const CLOSE_ACTION_CONFIG_KEY = 'window.closeActionPreference';
const FLOATING_INFO_VISIBLE_CONFIG_KEY = 'ui.floatingInfoWindow.visible';
const THEME_CONFIG_KEY = 'ui.theme';

function getMenuItemAction(menuLabel: string, itemName: string): 'open-settings' | 'close-app' | null {
  if (menuLabel !== 'File') {
    return null;
  }

  if (itemName === 'Setting...') {
    return 'open-settings';
  }

  if (itemName === 'Close') {
    return 'close-app';
  }

  return null;
}

function getMenuItemShortcut(menuLabel: string, itemName: string, shortcutLabel: string): string {
  if (menuLabel === 'File' && itemName === 'Close') {
    return shortcutLabel;
  }

  const menu = menus.find((entry) => entry.label === menuLabel);
  const item = menu?.items.find((entry) => entry.name === itemName);
  return item?.kdb ?? '';
}

function isCloseShortcutPressed(event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== 'q' || event.altKey || event.shiftKey) {
    return false;
  }

  if (isMacOS) {
    return event.metaKey && !event.ctrlKey;
  }

  return event.ctrlKey && !event.metaKey;
}

function getConfiguredCloseAction(): 'quit' | 'tray' {
  const value = window.electronAPI?.config.get(CLOSE_ACTION_CONFIG_KEY);
  return value === 'tray' ? 'tray' : 'quit';
}

function getFloatingInfoWindowVisible(): boolean {
  return window.electronAPI?.config.get(FLOATING_INFO_VISIBLE_CONFIG_KEY) === true;
}

function getConfiguredTheme(): Theme {
  return window.electronAPI?.config.get(THEME_CONFIG_KEY) === 'dark' ? 'dark' : 'light';
}

function getConfiguredEditorFontSize(): number {
  return parseEditorFontSize(window.electronAPI?.config.get(EDITOR_FONT_SIZE_CONFIG_KEY));
}

function getConfiguredEditorFontFamily() {
  return parseEditorFontFamily(window.electronAPI?.config.get(EDITOR_FONT_FAMILY_CONFIG_KEY));
}

function getConfiguredEditorTheme() {
  return parseEditorTheme(window.electronAPI?.config.get(EDITOR_THEME_CONFIG_KEY));
}

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
  const {
    fontFamily: editorFontFamily,
    fontSize: editorFontSize,
    setFontFamily: setEditorFontFamily,
    setFontSize: setEditorFontSize,
    setTheme: setEditorTheme,
    theme: editorTheme,
  } = useEditorSettings();
  const { theme, setTheme, toggleTheme } = useTheme();
  const { state: activityBarState, toggleSidebar } = useSidebar();
  const ref = useRef<HTMLDivElement>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [closeToTrayEnabled, setCloseToTrayEnabled] = useState(() => getConfiguredCloseAction() === 'tray');
  const [floatingInfoWindowVisible, setFloatingInfoWindowVisible] = useState(() => getFloatingInfoWindowVisible());
  const [settingsTheme, setSettingsTheme] = useState<Theme>(() => getConfiguredTheme());
  const [settingsEditorFontFamily, setSettingsEditorFontFamily] = useState(() => getConfiguredEditorFontFamily());
  const [settingsEditorFontSize, setSettingsEditorFontSize] = useState(() => getConfiguredEditorFontSize());
  const [settingsEditorTheme, setSettingsEditorTheme] = useState(() => getConfiguredEditorTheme());
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

  const syncPersistedSettingsState = () => {
    setCloseToTrayEnabled(getConfiguredCloseAction() === 'tray');
    setFloatingInfoWindowVisible(getFloatingInfoWindowVisible());
    setSettingsTheme(getConfiguredTheme());
    setSettingsEditorFontFamily(getConfiguredEditorFontFamily());
    setSettingsEditorFontSize(getConfiguredEditorFontSize());
    setSettingsEditorTheme(getConfiguredEditorTheme());
  };

  useEffect(() => {
    setSettingsTheme(theme);
  }, [theme]);

  useEffect(() => {
    setSettingsEditorFontFamily(editorFontFamily);
  }, [editorFontFamily]);

  useEffect(() => {
    setSettingsEditorFontSize(editorFontSize);
  }, [editorFontSize]);

  useEffect(() => {
    setSettingsEditorTheme(editorTheme);
  }, [editorTheme]);

  useEffect(() => {
    if (!settingsDialogOpen) {
      return;
    }

    syncPersistedSettingsState();
  }, [settingsDialogOpen]);

  const handleCloseToTrayChange = (checked: boolean) => {
    setCloseToTrayEnabled(checked);
    void window.electronAPI?.config.set(CLOSE_ACTION_CONFIG_KEY, checked ? 'tray' : 'quit');
  };

  const handleFloatingInfoWindowVisibleChange = (checked: boolean) => {
    setFloatingInfoWindowVisible(checked);
    void window.electronAPI?.config.set(FLOATING_INFO_VISIBLE_CONFIG_KEY, checked);
    void window.electronAPI?.setFloatingInfoWindowVisible(checked);
  };

  const handleThemeModeChange = (checked: boolean) => {
    const nextTheme = checked ? 'dark' : 'light';
    setSettingsTheme(nextTheme);
    setTheme(nextTheme);
  };

  const handleEditorFontSizeChange = (value: number[]) => {
    const nextValue = value[0] ?? settingsEditorFontSize;
    setSettingsEditorFontSize(nextValue);
  };

  const handleEditorFontSizeCommit = (value: number[]) => {
    const nextValue = value[0] ?? settingsEditorFontSize;
    setSettingsEditorFontSize(nextValue);
    setEditorFontSize(nextValue);
  };

  const handleEditorFontFamilyChange = (value: string) => {
    const nextFontFamily = parseEditorFontFamily(value);
    setSettingsEditorFontFamily(nextFontFamily);
    setEditorFontFamily(nextFontFamily);
  };

  const handleEditorThemeChange = (value: string) => {
    const nextTheme = parseEditorTheme(value);
    setSettingsEditorTheme(nextTheme);
    setEditorTheme(nextTheme);
  };

  const openSettingsDialog = () => {
    syncPersistedSettingsState();
    setSettingsDialogOpen(true);
  };

  const requestAppClose = () => {
    void window.electronAPI?.close();
  };

  const handleMenuItemSelect = (action: 'open-settings' | 'close-app' | null) => {
    if (action === 'open-settings') {
      openSettingsDialog();
      return;
    }

    if (action === 'close-app') {
      requestAppClose();
    }
  };

  const settingsSectionClassName = 'rounded-md border border-border/85 bg-muted/55 px-3 py-2.5';
  const settingsSectionTitleClassName = 'text-[13px] font-medium';
  const settingsSectionDescriptionClassName = 'text-[12px] text-muted-foreground';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isCloseShortcutPressed(event)) {
        return;
      }

      event.preventDefault();
      requestAppClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
                <MenubarTrigger className="px-2.5 h-6 text-[12px] font-normal rounded-sm">
                  {menu.label}
                </MenubarTrigger>
                <MenubarContent align="start" sideOffset={4} className="min-w-36 p-0.5">
                  {menu.items.map((item, i) => {
                    if (item.name === '---') {
                      return <MenubarSeparator key={i} className="my-0.5" />;
                    }

                    const action = getMenuItemAction(menu.label, item.name);
                    const shortcut = getMenuItemShortcut(menu.label, item.name, closeShortcutLabel);

                    return (
                      <MenubarItem
                        key={i}
                        className="px-2 py-1 text-[12px]"
                        onSelect={() => handleMenuItemSelect(action)}
                      >
                        {item.name} <MenubarShortcut>{shortcut}</MenubarShortcut>
                      </MenubarItem>
                    );
                  })}
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
              onClick={openSettingsDialog}
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
                onClick={requestAppClose}
              >
                <X size={14} />
              </button>
            </>
          )}

          </div>
        </div>

        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogContent
            data-testid="settings-dialog"
            className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-xl"
            style={noDragInteractive as React.CSSProperties}
          >
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>
                Manage appearance and window behavior preferences.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="min-h-0">
              <div className="space-y-2.5 pr-4">
              <div className={settingsSectionClassName}>
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <p className={settingsSectionTitleClassName}>Code editor font size</p>
                    <p className={settingsSectionDescriptionClassName} data-testid="editor-font-size-description">
                      Adjust the Monaco editor font size used in code tabs.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      aria-label="Code editor font size"
                      data-testid="settings-editor-font-size-slider"
                      min={10}
                      max={24}
                      step={1}
                      value={[settingsEditorFontSize]}
                      onValueChange={handleEditorFontSizeChange}
                      onValueCommit={handleEditorFontSizeCommit}
                    />
                    <span
                      className="min-w-10 text-right text-[13px] font-medium text-foreground"
                      data-testid="settings-editor-font-size-value"
                    >
                      {settingsEditorFontSize}px
                    </span>
                  </div>
                </div>
              </div>
              <div className={settingsSectionClassName}>
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <p className={settingsSectionTitleClassName}>Code editor font</p>
                    <p className={settingsSectionDescriptionClassName} data-testid="editor-font-family-description">
                      Choose the bundled monospace font used in Monaco editor tabs.
                    </p>
                  </div>
                  <Combobox
                    value={settingsEditorFontFamily}
                    onValueChange={handleEditorFontFamilyChange}
                    options={editorFontFamilyOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                      description: option.description,
                    }))}
                    placeholder={getEditorFontFamilyLabel(settingsEditorFontFamily)}
                    searchPlaceholder="Search editor fonts..."
                    emptyText="No editor font found."
                    triggerTestId="settings-editor-font-family-combobox"
                    getOptionTestId={(value) => `settings-editor-font-family-option-${value}`}
                  />
                </div>
              </div>
              <div className={settingsSectionClassName}>
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <p className={settingsSectionTitleClassName}>Code editor theme</p>
                    <p className={settingsSectionDescriptionClassName} data-testid="editor-theme-description">
                      Choose the Monaco color theme used for source files.
                    </p>
                  </div>
                  <Combobox
                    value={settingsEditorTheme}
                    onValueChange={handleEditorThemeChange}
                    options={editorThemeOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                      description: option.description,
                    }))}
                    placeholder={getEditorThemeLabel(settingsEditorTheme)}
                    searchPlaceholder="Search editor themes..."
                    emptyText="No editor theme found."
                    triggerTestId="settings-editor-theme-combobox"
                    getOptionTestId={(value) => `settings-editor-theme-option-${value}`}
                  />
                </div>
              </div>
              <div className={settingsSectionClassName}>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className={settingsSectionTitleClassName}>Dark mode</p>
                    <p className={settingsSectionDescriptionClassName} data-testid="theme-mode-description">
                      Switch between the default light theme and the dark theme.
                    </p>
                  </div>
                  <Switch
                    checked={settingsTheme === 'dark'}
                    data-testid="settings-theme-switch"
                    onCheckedChange={handleThemeModeChange}
                  />
                </div>
              </div>
              <div className={settingsSectionClassName}>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className={settingsSectionTitleClassName}>Close to tray</p>
                    <p className={settingsSectionDescriptionClassName} data-testid="close-behavior-description">
                      Keep Pristine running in the tray when the window is closed.
                    </p>
                  </div>
                  <Switch
                    checked={closeToTrayEnabled}
                    data-testid="settings-close-to-tray-switch"
                    onCheckedChange={handleCloseToTrayChange}
                  />
                </div>
              </div>
              <div className={settingsSectionClassName}>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className={settingsSectionTitleClassName}>Show floating info window</p>
                    <p className={settingsSectionDescriptionClassName} data-testid="floating-info-window-description">
                      Display a detached always-on-top info window even while Pristine is hidden to tray.
                    </p>
                  </div>
                  <Switch
                    checked={floatingInfoWindowVisible}
                    data-testid="settings-floating-info-window-switch"
                    onCheckedChange={handleFloatingInfoWindowVisibleChange}
                  />
                </div>
              </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                data-testid="settings-close-button"
                onClick={() => setSettingsDialogOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </TooltipProvider>
  );
}