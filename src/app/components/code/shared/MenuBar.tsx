import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  Settings, CircleUser, Minus, Square, X, Code2, Presentation, Workflow,
  Sun, Moon,
  LogIn, LogOut, RefreshCw, UserPlus,
} from 'lucide-react';
import {
  applicationMenus,
  getApplicationMenuItemAction,
  getApplicationMenuItemShortcut,
  isAppMenuItem,
  type MenuCommandEvent,
} from '../../../menu/applicationMenu';
import { canToggleLayoutPanels as canUseLayoutPanels } from '../../../codeViewPanels';
import { useEditorSettings } from '../../../context/EditorSettingsContext';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { useTheme, type Theme } from '../../../context/ThemeContext';
import { useUser } from '../../../context/UserContext';
import {
  DEFAULT_EDITOR_BRACKET_PAIR_GUIDES,
  DEFAULT_EDITOR_FONT_LIGATURES,
  EDITOR_FONT_FAMILY_CONFIG_KEY,
  EDITOR_FONT_SIZE_CONFIG_KEY,
  DEFAULT_EDITOR_SCROLL_BEYOND_LAST_LINE,
  DEFAULT_EDITOR_SMOOTH_SCROLLING,
  DEFAULT_EDITOR_GLYPH_MARGIN,
  DEFAULT_EDITOR_INDENT_GUIDES,
  DEFAULT_EDITOR_MINIMAP_ENABLED,
  EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY,
  EDITOR_CURSOR_BLINKING_CONFIG_KEY,
  EDITOR_FONT_LIGATURES_CONFIG_KEY,
  EDITOR_FOLDING_STRATEGY_CONFIG_KEY,
  EDITOR_THEME_CONFIG_KEY,
  EDITOR_GLYPH_MARGIN_CONFIG_KEY,
  EDITOR_INDENT_GUIDES_CONFIG_KEY,
  EDITOR_LINE_NUMBERS_CONFIG_KEY,
  EDITOR_MINIMAP_ENABLED_CONFIG_KEY,
  EDITOR_RENDER_CONTROL_CHARACTERS_CONFIG_KEY,
  EDITOR_RENDER_WHITESPACE_CONFIG_KEY,
  EDITOR_SCROLL_BEYOND_LAST_LINE_CONFIG_KEY,
  EDITOR_SMOOTH_SCROLLING_CONFIG_KEY,
  EDITOR_TAB_SIZE_CONFIG_KEY,
  EDITOR_WORD_WRAP_CONFIG_KEY,
  editorCursorBlinkingOptions,
  editorFontFamilyOptions,
  editorFoldingStrategyOptions,
  editorLineNumbersOptions,
  editorRenderWhitespaceOptions,
  editorTabSizeOptions,
  editorThemeOptions,
  editorWordWrapOptions,
  parseEditorCursorBlinking,
  parseEditorFontFamily,
  parseEditorFoldingStrategy,
  parseEditorLineNumbers,
  parseEditorRenderControlCharacters,
  parseEditorRenderWhitespace,
  parseEditorTabSize,
  parseEditorWordWrap,
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
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Combobox, type ComboboxOption } from '../../ui/combobox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { ScrollArea } from '../../ui/scroll-area';
import { Slider } from '../../ui/slider';
import { Switch } from '../../ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { useSidebar } from '../../ui/sidebar';
import { AboutDialog } from './AboutDialog';
import { EditorFontAdvancedDialog } from './EditorFontAdvancedDialog';
import { centerViewSwitchItemClassName } from './viewSwitcherStyles';

const noDrag = { WebkitAppRegion: 'no-drag' as const };
const noDragInteractive = {
  WebkitAppRegion: 'no-drag' as const,
  pointerEvents: 'auto' as const,
};
const CLOSE_ACTION_CONFIG_KEY = 'window.closeActionPreference';
const FLOATING_INFO_VISIBLE_CONFIG_KEY = 'ui.floatingInfoWindow.visible';
const THEME_CONFIG_KEY = 'ui.theme';
const settingsSectionClassName = 'rounded-md border border-border/85 bg-muted/55 px-3 py-2.5';
const settingsSectionTitleClassName = 'text-[13px] font-medium';
const settingsSectionDescriptionClassName = 'text-[12px] text-muted-foreground';
const userPopoverActionsClassName = 'grid grid-cols-2 gap-1.5';
const userPopoverActionButtonClassName = 'h-8 w-full justify-center gap-1 whitespace-nowrap px-2.5 text-[11px] hover:cursor-pointer [&_svg]:size-3.5 disabled:cursor-not-allowed';

function isMacOSPlatform(): boolean {
  return typeof window !== 'undefined' && window.electronAPI?.platform === 'darwin';
}

function formatShortcutLabel(shortcut?: string): string {
  if (!shortcut) {
    return '';
  }

  const isMacOS = isMacOSPlatform();
  const tokens = shortcut.split('+');
  const keyToken = tokens[tokens.length - 1]?.toUpperCase() ?? '';
  const modifierTokens = tokens.slice(0, -1);

  if (isMacOS) {
    const macModifiers = modifierTokens.map((token) => {
      if (token === 'Mod') {
        return '⌘';
      }

      if (token === 'Shift') {
        return '⇧';
      }

      return token.toUpperCase();
    });

    return [...macModifiers, keyToken].join('');
  }

  const nonMacModifierOrder = ['Mod', 'Shift'];
  const nonMacModifiers = [...modifierTokens]
    .sort((leftToken, rightToken) => nonMacModifierOrder.indexOf(leftToken) - nonMacModifierOrder.indexOf(rightToken))
    .map((token) => {
      if (token === 'Mod') {
        return 'Ctrl';
      }

      if (token === 'Shift') {
        return 'Shift';
      }

      return token.toUpperCase();
    });

  return [...nonMacModifiers, keyToken].join('+');
}

function getMenuItemShortcut(menuLabel: string, itemName: string): string {
  return formatShortcutLabel(getApplicationMenuItemShortcut(menuLabel, itemName));
}

function isCloseShortcutPressed(event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== 'q' || event.altKey || event.shiftKey) {
    return false;
  }

  if (isMacOSPlatform()) {
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

function getConfiguredEditorWordWrap() {
  return parseEditorWordWrap(window.electronAPI?.config.get(EDITOR_WORD_WRAP_CONFIG_KEY));
}

function getConfiguredEditorRenderWhitespace() {
  return parseEditorRenderWhitespace(window.electronAPI?.config.get(EDITOR_RENDER_WHITESPACE_CONFIG_KEY));
}

function getConfiguredEditorFontLigatures() {
  return getConfiguredEditorBooleanSetting(EDITOR_FONT_LIGATURES_CONFIG_KEY, DEFAULT_EDITOR_FONT_LIGATURES);
}

function getConfiguredEditorTabSize() {
  return parseEditorTabSize(window.electronAPI?.config.get(EDITOR_TAB_SIZE_CONFIG_KEY));
}

function getConfiguredEditorCursorBlinking() {
  return parseEditorCursorBlinking(window.electronAPI?.config.get(EDITOR_CURSOR_BLINKING_CONFIG_KEY));
}

function getConfiguredEditorRenderControlCharacters() {
  return parseEditorRenderControlCharacters(window.electronAPI?.config.get(EDITOR_RENDER_CONTROL_CHARACTERS_CONFIG_KEY));
}

function getConfiguredEditorLineNumbers() {
  return parseEditorLineNumbers(window.electronAPI?.config.get(EDITOR_LINE_NUMBERS_CONFIG_KEY));
}

function getConfiguredEditorSmoothScrolling() {
  return getConfiguredEditorBooleanSetting(EDITOR_SMOOTH_SCROLLING_CONFIG_KEY, DEFAULT_EDITOR_SMOOTH_SCROLLING);
}

function getConfiguredEditorScrollBeyondLastLine() {
  return getConfiguredEditorBooleanSetting(
    EDITOR_SCROLL_BEYOND_LAST_LINE_CONFIG_KEY,
    DEFAULT_EDITOR_SCROLL_BEYOND_LAST_LINE,
  );
}

function getConfiguredEditorFoldingStrategy() {
  return parseEditorFoldingStrategy(window.electronAPI?.config.get(EDITOR_FOLDING_STRATEGY_CONFIG_KEY));
}

function getConfiguredEditorBooleanSetting(configKey: string, defaultValue: boolean) {
  const value = window.electronAPI?.config.get(configKey);
  return typeof value === 'boolean' ? value : defaultValue;
}

function getConfiguredEditorMinimapEnabled() {
  return getConfiguredEditorBooleanSetting(EDITOR_MINIMAP_ENABLED_CONFIG_KEY, DEFAULT_EDITOR_MINIMAP_ENABLED);
}

function getConfiguredEditorGlyphMargin() {
  return getConfiguredEditorBooleanSetting(EDITOR_GLYPH_MARGIN_CONFIG_KEY, DEFAULT_EDITOR_GLYPH_MARGIN);
}

function getConfiguredEditorBracketPairGuides() {
  return getConfiguredEditorBooleanSetting(EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY, DEFAULT_EDITOR_BRACKET_PAIR_GUIDES);
}

function getConfiguredEditorIndentGuides() {
  return getConfiguredEditorBooleanSetting(EDITOR_INDENT_GUIDES_CONFIG_KEY, DEFAULT_EDITOR_INDENT_GUIDES);
}

function getUserInitials(username: string): string {
  const initials = username
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('');

  return initials || 'PR';
}

function formatSyncTimestamp(value: string | null): string {
  if (!value) {
    return 'Not synced yet';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not synced yet';
  }

  return `Synced ${date.toLocaleString()}`;
}

function SettingsSwitchRow({
  checked,
  description,
  onCheckedChange,
  testId,
  title,
}: {
  checked: boolean;
  description: string;
  onCheckedChange: (checked: boolean) => void;
  testId: string;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-1">
        <p className={settingsSectionTitleClassName}>{title}</p>
        <p className={settingsSectionDescriptionClassName} data-testid={`${testId}-description`}>
          {description}
        </p>
      </div>
      <Switch checked={checked} data-testid={testId} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SettingsComboboxSection({
  action,
  description,
  emptyText,
  onValueChange,
  options,
  searchPlaceholder,
  testId,
  title,
  value,
}: {
  action?: React.ReactNode;
  description: string;
  emptyText: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  searchPlaceholder: string;
  testId: string;
  title: string;
  value: string;
}) {
  return (
    <div className={settingsSectionClassName}>
      <div className="space-y-2.5">
        <div className="space-y-1">
          <p className={settingsSectionTitleClassName}>{title}</p>
          <p className={settingsSectionDescriptionClassName} data-testid={`${testId}-description`}>
            {description}
          </p>
        </div>
        <div className={action ? 'flex items-center gap-2' : undefined}>
          <div className={action ? 'min-w-0 flex-1' : undefined}>
            <Combobox
              value={value}
              onValueChange={onValueChange}
              options={options}
              placeholder={options.find((option) => option.value === value)?.label ?? options[0]?.label ?? ''}
              searchPlaceholder={searchPlaceholder}
              emptyText={emptyText}
              triggerTestId={testId}
              getOptionTestId={(optionValue) => `${testId.replace('-combobox', '-option')}-${optionValue}`}
            />
          </div>
          {action}
        </div>
      </div>
    </div>
  );
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

interface MenuBarSettingsState {
  closeToTrayEnabled: boolean;
  floatingInfoWindowVisible: boolean;
  theme: Theme;
  editorCursorBlinking: ReturnType<typeof getConfiguredEditorCursorBlinking>;
  editorBracketPairGuides: ReturnType<typeof getConfiguredEditorBracketPairGuides>;
  editorFontFamily: ReturnType<typeof getConfiguredEditorFontFamily>;
  editorFontLigatures: ReturnType<typeof getConfiguredEditorFontLigatures>;
  editorFontSize: ReturnType<typeof getConfiguredEditorFontSize>;
  editorFoldingStrategy: ReturnType<typeof getConfiguredEditorFoldingStrategy>;
  editorGlyphMargin: ReturnType<typeof getConfiguredEditorGlyphMargin>;
  editorIndentGuides: ReturnType<typeof getConfiguredEditorIndentGuides>;
  editorLineNumbers: ReturnType<typeof getConfiguredEditorLineNumbers>;
  editorMinimapEnabled: ReturnType<typeof getConfiguredEditorMinimapEnabled>;
  editorRenderControlCharacters: ReturnType<typeof getConfiguredEditorRenderControlCharacters>;
  editorRenderWhitespace: ReturnType<typeof getConfiguredEditorRenderWhitespace>;
  editorScrollBeyondLastLine: ReturnType<typeof getConfiguredEditorScrollBeyondLastLine>;
  editorSmoothScrolling: ReturnType<typeof getConfiguredEditorSmoothScrolling>;
  editorTabSize: ReturnType<typeof getConfiguredEditorTabSize>;
  editorTheme: ReturnType<typeof getConfiguredEditorTheme>;
  editorWordWrap: ReturnType<typeof getConfiguredEditorWordWrap>;
}

function getPersistedSettingsState(): MenuBarSettingsState {
  return {
    closeToTrayEnabled: getConfiguredCloseAction() === 'tray',
    floatingInfoWindowVisible: getFloatingInfoWindowVisible(),
    theme: getConfiguredTheme(),
    editorCursorBlinking: getConfiguredEditorCursorBlinking(),
    editorBracketPairGuides: getConfiguredEditorBracketPairGuides(),
    editorFontFamily: getConfiguredEditorFontFamily(),
    editorFontLigatures: getConfiguredEditorFontLigatures(),
    editorFontSize: getConfiguredEditorFontSize(),
    editorFoldingStrategy: getConfiguredEditorFoldingStrategy(),
    editorGlyphMargin: getConfiguredEditorGlyphMargin(),
    editorIndentGuides: getConfiguredEditorIndentGuides(),
    editorLineNumbers: getConfiguredEditorLineNumbers(),
    editorMinimapEnabled: getConfiguredEditorMinimapEnabled(),
    editorRenderControlCharacters: getConfiguredEditorRenderControlCharacters(),
    editorRenderWhitespace: getConfiguredEditorRenderWhitespace(),
    editorScrollBeyondLastLine: getConfiguredEditorScrollBeyondLastLine(),
    editorSmoothScrolling: getConfiguredEditorSmoothScrolling(),
    editorTabSize: getConfiguredEditorTabSize(),
    editorTheme: getConfiguredEditorTheme(),
    editorWordWrap: getConfiguredEditorWordWrap(),
  };
}

interface MenuBarProps {
  showLeftPanel?: boolean;
  showBottomPanel?: boolean;
  showRightPanel?: boolean;
  onShowLeftPanelChange?: (show: boolean) => void;
  onShowBottomPanelChange?: (show: boolean) => void;
  onShowRightPanelChange?: (show: boolean) => void;
}

export function MenuBar({
  showLeftPanel = false,
  showBottomPanel = false,
  showRightPanel = false,
  onShowLeftPanelChange,
  onShowBottomPanelChange,
  onShowRightPanelChange,
}: MenuBarProps) {
  const isMacOS = isMacOSPlatform();
  const [windowFullScreen, setWindowFullScreen] = useState(() => window.electronAPI?.isFullScreen() === true);
  const showWindowMenu = !isMacOS;
  const showMacOSLeadingSpace = isMacOS && !windowFullScreen;
  const {
    activeView,
    mainContentView,
    redoActiveEditor,
    saveActiveFile,
    saveAllFiles,
    setMainContentView,
    undoActiveEditor,
  } = useWorkspace();
  const {
    setCursorBlinking: setEditorCursorBlinking,
    setBracketPairGuides: setEditorBracketPairGuides,
    setFontFamily: setEditorFontFamily,
    setFontLigatures: setEditorFontLigatures,
    setFontSize: setEditorFontSize,
    setFoldingStrategy: setEditorFoldingStrategy,
    setGlyphMargin: setEditorGlyphMargin,
    setIndentGuides: setEditorIndentGuides,
    setLineNumbers: setEditorLineNumbers,
    setMinimapEnabled: setEditorMinimapEnabled,
    setRenderControlCharacters: setEditorRenderControlCharacters,
    setRenderWhitespace: setEditorRenderWhitespace,
    setScrollBeyondLastLine: setEditorScrollBeyondLastLine,
    setSmoothScrolling: setEditorSmoothScrolling,
    setTabSize: setEditorTabSize,
    setTheme: setEditorTheme,
    setWordWrap: setEditorWordWrap,
  } = useEditorSettings();
  const { theme, setTheme, toggleTheme } = useTheme();
  const {
    clearError,
    errorMessage,
    isSyncing,
    openAccountPage,
    session,
    signOut,
    status,
    syncCloudConfig,
  } = useUser();
  const { state: activityBarState, toggleSidebar } = useSidebar();
  const ref = useRef<HTMLDivElement>(null);
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [editorFontAdvancedDialogOpen, setEditorFontAdvancedDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsState, setSettingsState] = useState<MenuBarSettingsState>(getPersistedSettingsState);
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
    `${isMacOS ? (windowFullScreen ? 'ml-2 ' : 'ml-1 ') : 'ml-1 '}w-8 h-full rounded-none border-0 text-muted-foreground`,
    'data-[state=on]:text-foreground',
    activityBarToggleEnabled
      ? 'hover:cursor-pointer hover:text-foreground hover:bg-accent'
      : 'opacity-40',
  ].join(' ');
  const userAvatarFallback = getUserInitials(session?.username ?? 'Pristine User');
  const userSyncLabel = formatSyncTimestamp(session?.syncedAt ?? null);
  const isSignedIn = status === 'signed-in' && session !== null;
  const isUserActionsDisabled = status === 'loading';

  const patchSettingsState = useCallback((partialState: Partial<MenuBarSettingsState>) => {
    setSettingsState((current) => ({ ...current, ...partialState }));
  }, []);

  const handleSettingsDialogOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setSettingsState(getPersistedSettingsState());
    } else {
      setEditorFontAdvancedDialogOpen(false);
    }

    setSettingsDialogOpen(nextOpen);
  }, []);

  const handleEditorFontAdvancedDialogOpenChange = useCallback((nextOpen: boolean) => {
    setEditorFontAdvancedDialogOpen(nextOpen);
  }, []);

  const handleCloseToTrayChange = (checked: boolean) => {
    patchSettingsState({ closeToTrayEnabled: checked });
    void window.electronAPI?.config.set(CLOSE_ACTION_CONFIG_KEY, checked ? 'tray' : 'quit');
  };

  const handleFloatingInfoWindowVisibleChange = (checked: boolean) => {
    patchSettingsState({ floatingInfoWindowVisible: checked });
    void window.electronAPI?.config.set(FLOATING_INFO_VISIBLE_CONFIG_KEY, checked);
    void window.electronAPI?.setFloatingInfoWindowVisible(checked);
  };

  const handleThemeModeChange = (checked: boolean) => {
    const nextTheme = checked ? 'dark' : 'light';
    patchSettingsState({ theme: nextTheme });
    setTheme(nextTheme);
  };

  const handleEditorFontSizeChange = (value: number[]) => {
    const nextValue = value[0] ?? settingsState.editorFontSize;
    patchSettingsState({ editorFontSize: nextValue });
  };

  const handleEditorFontSizeCommit = (value: number[]) => {
    const nextValue = value[0] ?? settingsState.editorFontSize;
    patchSettingsState({ editorFontSize: nextValue });
    setEditorFontSize(nextValue);
  };

  const handleEditorFontFamilyChange = (value: string) => {
    const nextFontFamily = parseEditorFontFamily(value);
    patchSettingsState({ editorFontFamily: nextFontFamily });
    setEditorFontFamily(nextFontFamily);
  };

  const handleEditorFontAdvancedSelect = useCallback((value: string) => {
    handleEditorFontFamilyChange(value);
    setEditorFontAdvancedDialogOpen(false);
  }, [handleEditorFontFamilyChange]);

  const handleEditorFontLigaturesChange = (checked: boolean) => {
    patchSettingsState({ editorFontLigatures: checked });
    setEditorFontLigatures(checked);
  };

  const handleEditorTabSizeChange = (value: string) => {
    const nextTabSize = parseEditorTabSize(value);
    patchSettingsState({ editorTabSize: nextTabSize });
    setEditorTabSize(nextTabSize);
  };

  const handleEditorCursorBlinkingChange = (value: string) => {
    const nextCursorBlinking = parseEditorCursorBlinking(value);
    patchSettingsState({ editorCursorBlinking: nextCursorBlinking });
    setEditorCursorBlinking(nextCursorBlinking);
  };

  const handleEditorThemeChange = (value: string) => {
    const nextTheme = parseEditorTheme(value);
    patchSettingsState({ editorTheme: nextTheme });
    setEditorTheme(nextTheme);
  };

  const handleEditorWordWrapChange = (value: string) => {
    const nextWordWrap = parseEditorWordWrap(value);
    patchSettingsState({ editorWordWrap: nextWordWrap });
    setEditorWordWrap(nextWordWrap);
  };

  const handleEditorRenderWhitespaceChange = (value: string) => {
    const nextRenderWhitespace = parseEditorRenderWhitespace(value);
    patchSettingsState({ editorRenderWhitespace: nextRenderWhitespace });
    setEditorRenderWhitespace(nextRenderWhitespace);
  };

  const handleEditorLineNumbersChange = (value: string) => {
    const nextLineNumbers = parseEditorLineNumbers(value);
    patchSettingsState({ editorLineNumbers: nextLineNumbers });
    setEditorLineNumbers(nextLineNumbers);
  };

  const handleEditorSmoothScrollingChange = (checked: boolean) => {
    patchSettingsState({ editorSmoothScrolling: checked });
    setEditorSmoothScrolling(checked);
  };

  const handleEditorScrollBeyondLastLineChange = (checked: boolean) => {
    patchSettingsState({ editorScrollBeyondLastLine: checked });
    setEditorScrollBeyondLastLine(checked);
  };

  const handleEditorFoldingStrategyChange = (value: string) => {
    const nextFoldingStrategy = parseEditorFoldingStrategy(value);
    patchSettingsState({ editorFoldingStrategy: nextFoldingStrategy });
    setEditorFoldingStrategy(nextFoldingStrategy);
  };

  const handleEditorRenderControlCharactersChange = (checked: boolean) => {
    patchSettingsState({ editorRenderControlCharacters: checked });
    setEditorRenderControlCharacters(checked);
  };

  const handleEditorMinimapEnabledChange = (checked: boolean) => {
    patchSettingsState({ editorMinimapEnabled: checked });
    setEditorMinimapEnabled(checked);
  };

  const handleEditorGlyphMarginChange = (checked: boolean) => {
    patchSettingsState({ editorGlyphMargin: checked });
    setEditorGlyphMargin(checked);
  };

  const handleEditorBracketPairGuidesChange = (checked: boolean) => {
    patchSettingsState({ editorBracketPairGuides: checked });
    setEditorBracketPairGuides(checked);
  };

  const handleEditorIndentGuidesChange = (checked: boolean) => {
    patchSettingsState({ editorIndentGuides: checked });
    setEditorIndentGuides(checked);
  };

  const openSettingsDialog = useCallback(() => {
    handleSettingsDialogOpenChange(true);
  }, [handleSettingsDialogOpenChange]);

  const openAboutDialog = () => {
    setAboutDialogOpen(true);
  };

  const requestAppClose = () => {
    void window.electronAPI?.close();
  };

  const handleMenuItemSelect = (action: ReturnType<typeof getApplicationMenuItemAction>) => {
    if (action === 'open-settings') {
      openSettingsDialog();
      return;
    }

    if (action === 'open-about') {
      openAboutDialog();
      return;
    }

    if (action === 'save-file') {
      void saveActiveFile();
      return;
    }

    if (action === 'save-all-files') {
      void saveAllFiles();
      return;
    }

    if (action === 'undo-editor') {
      void undoActiveEditor();
      return;
    }

    if (action === 'redo-editor') {
      void redoActiveEditor();
      return;
    }

    if (action === 'close-app') {
      requestAppClose();
    }
  };

  const handleNativeMenuCommand = useEffectEvent((payload: MenuCommandEvent) => {
    if (payload.action === 'open-settings') {
      openSettingsDialog();
      return;
    }

    if (payload.action === 'open-about') {
      openAboutDialog();
      return;
    }

    if (payload.action === 'save-file') {
      void saveActiveFile();
      return;
    }

    if (payload.action === 'save-all-files') {
      void saveAllFiles();
      return;
    }

    if (payload.action === 'undo-editor') {
      void undoActiveEditor();
      return;
    }

    if (payload.action === 'redo-editor') {
      void redoActiveEditor();
    }
  });

  useEffect(() => {
    if (!isMacOS) {
      return;
    }

    setWindowFullScreen(window.electronAPI?.isFullScreen() === true);

    const dispose = window.electronAPI?.onFullScreenChange((fullScreen) => {
      setWindowFullScreen(fullScreen);
    });

    return () => {
      dispose?.();
    };
  }, [isMacOS]);

  useEffect(() => {
    const dispose = window.electronAPI?.menu.onCommand((payload) => {
      handleNativeMenuCommand(payload);
    });

    return () => {
      dispose?.();
    };
  }, []);

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
          {showMacOSLeadingSpace && <div data-testid="macos-traffic-light-clearance" className="w-20 shrink-0" />}

          {/* App icon / title */}
          {showWindowMenu && (
            <div className="flex items-center gap-1.5 px-3 pr-2" data-testid="menu-app-icon" style={noDrag as React.CSSProperties}>
              <div className="w-4 h-4 rounded-sm bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-[9px] font-bold">P</span>
              </div>
            </div>
          )}

          {/* Menu items — shadcn Menubar */}
          {showWindowMenu && (
            <Menubar className="h-8 border-0 rounded-none bg-transparent p-0 shadow-none" data-testid="menu-menubar" style={noDrag as React.CSSProperties}>
              {applicationMenus.map((menu) => (
                <MenubarMenu key={menu.label}>
                  <MenubarTrigger className="px-2.5 h-6 text-[12px] font-normal rounded-sm">
                    {menu.label}
                  </MenubarTrigger>
                  <MenubarContent align="start" sideOffset={4} className="min-w-36 p-0.5">
                    {menu.items.map((item, index) => {
                      if (!isAppMenuItem(item)) {
                        return <MenubarSeparator key={`${menu.label}-separator-${index}`} className="my-0.5" />;
                      }

                      const action = getApplicationMenuItemAction(menu.label, item.name);
                      const shortcut = getMenuItemShortcut(menu.label, item.name);

                      return (
                        <MenubarItem
                          key={`${menu.label}-${item.name}`}
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
          )}


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
              onPressedChange={(nextPressed) => {
                if (!layoutIconsEnabled) {
                  return;
                }

                onShowLeftPanelChange?.(nextPressed);
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
              onPressedChange={(nextPressed) => {
                if (!layoutIconsEnabled) {
                  return;
                }

                onShowBottomPanelChange?.(nextPressed);
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
              onPressedChange={(nextPressed) => {
                if (!layoutIconsEnabled) {
                  return;
                }

                onShowRightPanelChange?.(nextPressed);
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
          <Popover onOpenChange={(open) => {
            if (open) {
              clearError();
            }
          }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex h-full" style={noDragInteractive as React.CSSProperties}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="User profile"
                      data-testid="user-avatar-button"
                      className="relative h-full w-8 rounded-none px-0 hover:cursor-pointer"
                    >
                      <Avatar className="size-6 border border-border/70 bg-muted/70">
                        {isSignedIn && session?.avatarUrl ? <AvatarImage alt={session.username} src={session.avatarUrl} /> : null}
                        <AvatarFallback className="bg-transparent text-[10px] font-semibold text-foreground">
                          {isSignedIn ? userAvatarFallback : <CircleUser size={14} className="text-muted-foreground" />}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={[
                          'absolute bottom-1.5 right-1 rounded-full border border-background',
                          status === 'loading' ? 'h-1.5 w-1.5 bg-muted-foreground/80' : '',
                          isSignedIn ? 'h-2 w-2 bg-emerald-500' : '',
                          status === 'signed-out' ? 'h-2 w-2 bg-amber-400' : '',
                        ].join(' ')}
                      />
                    </Button>
                  </PopoverTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                User profile
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              align="end"
              className="w-72 p-0"
              data-testid="user-account-popover"
              style={noDragInteractive as React.CSSProperties}
            >
              <div className="space-y-3 px-4 py-3">
                {isSignedIn && session ? (
                  <>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-11 border border-border/80 bg-muted/70">
                        {session.avatarUrl ? <AvatarImage alt={session.username} src={session.avatarUrl} /> : null}
                        <AvatarFallback className="text-sm font-semibold">{userAvatarFallback}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-foreground" data-testid="user-account-name">
                          {session.username}
                        </p>
                        <p className="truncate text-xs text-muted-foreground" data-testid="user-account-email">
                          {session.email}
                        </p>
                        <p className="text-[11px] text-muted-foreground" data-testid="user-account-sync-status">
                          {userSyncLabel}
                        </p>
                      </div>
                    </div>
                    <div className={userPopoverActionsClassName}>
                      <Button
                        variant="outline"
                        className={userPopoverActionButtonClassName}
                        data-testid="user-sync-config-button"
                        disabled={isSyncing}
                        onClick={() => {
                          void syncCloudConfig();
                        }}
                      >
                        <RefreshCw className={isSyncing ? 'animate-spin' : ''} />
                        {isSyncing ? 'Syncing settings...' : 'Sync desktop settings'}
                      </Button>
                      <Button
                        variant="ghost"
                        className={userPopoverActionButtonClassName}
                        data-testid="user-sign-out-button"
                        onClick={() => {
                          void signOut();
                        }}
                      >
                        <LogOut />
                        Sign out
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-2">
                    <div className="rounded-md border border-dashed border-border/80 bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                      {status === 'loading'
                        ? 'Checking the local desktop session...'
                        : 'No account is linked to this desktop session yet.'}
                    </div>
                    <div className={userPopoverActionsClassName}>
                      <Button
                        className={userPopoverActionButtonClassName}
                        data-testid="user-sign-in-button"
                        disabled={isUserActionsDisabled}
                        onClick={() => {
                          void openAccountPage('login');
                        }}
                      >
                        <LogIn />
                        Sign in
                      </Button>
                      <Button
                        variant="outline"
                        className={userPopoverActionButtonClassName}
                        data-testid="user-sign-up-button"
                        disabled={isUserActionsDisabled}
                        onClick={() => {
                          void openAccountPage('signup');
                        }}
                      >
                        <UserPlus />
                        Create account
                      </Button>
                    </div>
                  </div>
                )}

                {errorMessage ? (
                  <div
                    className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                    data-testid="user-account-error"
                  >
                    {errorMessage}
                  </div>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>

          {showWindowMenu && <Separator data-testid="menu-avatar-separator" orientation="vertical" className="h-4 mx-1" />}

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

        <AboutDialog
          open={aboutDialogOpen}
          onOpenChange={setAboutDialogOpen}
          dialogStyle={noDragInteractive as React.CSSProperties}
        />

        <Dialog open={settingsDialogOpen} onOpenChange={handleSettingsDialogOpenChange}>
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
                      value={[settingsState.editorFontSize]}
                      onValueChange={handleEditorFontSizeChange}
                      onValueCommit={handleEditorFontSizeCommit}
                    />
                    <span
                      className="min-w-10 text-right text-[13px] font-medium text-foreground"
                      data-testid="settings-editor-font-size-value"
                    >
                      {settingsState.editorFontSize}px
                    </span>
                  </div>
                </div>
              </div>
              <SettingsComboboxSection
                value={settingsState.editorFontFamily}
                onValueChange={handleEditorFontFamilyChange}
                options={editorFontFamilyOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                  description: option.description,
                }))}
                title="Code editor font"
                description="Choose the bundled monospace font used in Monaco editor tabs."
                searchPlaceholder="Search editor fonts..."
                emptyText="No editor font found."
                testId="settings-editor-font-family-combobox"
                action={(
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="settings-editor-font-family-advanced-button"
                    className="shrink-0 hover:cursor-pointer"
                    onClick={() => setEditorFontAdvancedDialogOpen(true)}
                  >
                    Advanced
                  </Button>
                )}
              />
              <SettingsComboboxSection
                value={settingsState.editorTheme}
                onValueChange={handleEditorThemeChange}
                options={editorThemeOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                  description: option.description,
                }))}
                title="Code editor theme"
                description="Choose the Monaco color theme used for source files."
                searchPlaceholder="Search editor themes..."
                emptyText="No editor theme found."
                testId="settings-editor-theme-combobox"
              />
              <div className={settingsSectionClassName}>
                <div className="space-y-1">
                  <p className={settingsSectionTitleClassName}>Editor behavior &amp; display</p>
                  <p className={settingsSectionDescriptionClassName} data-testid="editor-display-description">
                    Configure Monaco behavior and display aids such as indentation, caret motion, wrapping, gutters, and guides.
                  </p>
                </div>
              </div>
              <SettingsComboboxSection
                value={settingsState.editorWordWrap}
                onValueChange={handleEditorWordWrapChange}
                options={editorWordWrapOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                  description: option.description,
                }))}
                title="Word wrap"
                description="Control how Monaco wraps long lines inside the current editor viewport."
                searchPlaceholder="Search word wrap modes..."
                emptyText="No word wrap mode found."
                testId="settings-editor-word-wrap-combobox"
              />
              <SettingsComboboxSection
                value={String(settingsState.editorTabSize)}
                onValueChange={handleEditorTabSizeChange}
                options={editorTabSizeOptions.map((option) => ({
                  value: String(option.value),
                  label: option.label,
                  description: option.description,
                }))}
                title="Tab size"
                description="Choose how many spaces Monaco inserts and aligns when indentation uses tabs as spaces."
                searchPlaceholder="Search tab sizes..."
                emptyText="No tab size found."
                testId="settings-editor-tab-size-combobox"
              />
              <SettingsComboboxSection
                value={settingsState.editorCursorBlinking}
                onValueChange={handleEditorCursorBlinkingChange}
                options={editorCursorBlinkingOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                  description: option.description,
                }))}
                title="Cursor blinking"
                description="Control the caret animation Monaco uses while the editor has focus."
                searchPlaceholder="Search cursor blinking modes..."
                emptyText="No cursor blinking mode found."
                testId="settings-editor-cursor-blinking-combobox"
              />
              <SettingsComboboxSection
                value={settingsState.editorRenderWhitespace}
                onValueChange={handleEditorRenderWhitespaceChange}
                options={editorRenderWhitespaceOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                  description: option.description,
                }))}
                title="Whitespace rendering"
                description="Choose when visible whitespace markers should appear in the editor."
                searchPlaceholder="Search whitespace modes..."
                emptyText="No whitespace mode found."
                testId="settings-editor-render-whitespace-combobox"
              />
              <SettingsComboboxSection
                value={settingsState.editorLineNumbers}
                onValueChange={handleEditorLineNumbersChange}
                options={editorLineNumbersOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                  description: option.description,
                }))}
                title="Line numbers"
                description="Choose whether the editor gutter shows absolute, relative, or interval line numbers."
                searchPlaceholder="Search line number modes..."
                emptyText="No line number mode found."
                testId="settings-editor-line-numbers-combobox"
              />
              <SettingsComboboxSection
                value={settingsState.editorFoldingStrategy}
                onValueChange={handleEditorFoldingStrategyChange}
                options={editorFoldingStrategyOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                  description: option.description,
                }))}
                title="Folding strategy"
                description="Choose whether Monaco folds from indentation only or uses language-aware providers when possible."
                searchPlaceholder="Search folding strategies..."
                emptyText="No folding strategy found."
                testId="settings-editor-folding-strategy-combobox"
              />
              <div className={settingsSectionClassName}>
                <div className="space-y-3">
                  <SettingsSwitchRow
                    checked={settingsState.editorFontLigatures}
                    description="Enable Monaco font ligatures when the selected code font supports them."
                    onCheckedChange={handleEditorFontLigaturesChange}
                    testId="settings-editor-font-ligatures-switch"
                    title="Font ligatures"
                  />
                  <Separator />
                  <SettingsSwitchRow
                    checked={settingsState.editorSmoothScrolling}
                    description="Animate editor scrolling with Monaco's smooth scrolling behavior."
                    onCheckedChange={handleEditorSmoothScrollingChange}
                    testId="settings-editor-smooth-scrolling-switch"
                    title="Smooth scrolling"
                  />
                  <Separator />
                  <SettingsSwitchRow
                    checked={settingsState.editorScrollBeyondLastLine}
                    description="Keep extra blank space after the final line so the cursor can scroll below the file end."
                    onCheckedChange={handleEditorScrollBeyondLastLineChange}
                    testId="settings-editor-scroll-beyond-last-line-switch"
                    title="Scroll beyond last line"
                  />
                  <Separator />
                  <SettingsSwitchRow
                    checked={settingsState.editorRenderControlCharacters}
                    description="Render control characters such as tabs and other non-printable glyphs using Monaco's built-in markers."
                    onCheckedChange={handleEditorRenderControlCharactersChange}
                    testId="settings-editor-render-control-characters-switch"
                    title="Render control characters"
                  />
                  <Separator />
                  <SettingsSwitchRow
                    checked={settingsState.editorMinimapEnabled}
                    description="Show Monaco's minimap overview on the right side of the editor."
                    onCheckedChange={handleEditorMinimapEnabledChange}
                    testId="settings-editor-minimap-switch"
                    title="Show minimap"
                  />
                  <Separator />
                  <SettingsSwitchRow
                    checked={settingsState.editorGlyphMargin}
                    description="Keep the glyph margin visible for breakpoints, decorations, and code markers."
                    onCheckedChange={handleEditorGlyphMarginChange}
                    testId="settings-editor-glyph-margin-switch"
                    title="Show glyph margin"
                  />
                  <Separator />
                  <SettingsSwitchRow
                    checked={settingsState.editorBracketPairGuides}
                    description="Render Monaco's bracket pair guide lines to make nested scopes easier to scan."
                    onCheckedChange={handleEditorBracketPairGuidesChange}
                    testId="settings-editor-bracket-pair-guides-switch"
                    title="Bracket pair guides"
                  />
                  <Separator />
                  <SettingsSwitchRow
                    checked={settingsState.editorIndentGuides}
                    description="Render indentation guide lines that follow the current block structure."
                    onCheckedChange={handleEditorIndentGuidesChange}
                    testId="settings-editor-indent-guides-switch"
                    title="Indent guides"
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
                    checked={settingsState.theme === 'dark'}
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
                    checked={settingsState.closeToTrayEnabled}
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
                    checked={settingsState.floatingInfoWindowVisible}
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
                onClick={() => handleSettingsDialogOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <EditorFontAdvancedDialog
          open={editorFontAdvancedDialogOpen}
          onOpenChange={handleEditorFontAdvancedDialogOpenChange}
          onSelectFontFamily={handleEditorFontAdvancedSelect}
          selectedFontFamily={settingsState.editorFontFamily}
          dialogStyle={noDragInteractive as React.CSSProperties}
        />
      </>
    </TooltipProvider>
  );
}