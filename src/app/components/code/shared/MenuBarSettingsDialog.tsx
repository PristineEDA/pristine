import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useEditorSettings } from '../../../context/EditorSettingsContext';
import {
  WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY,
  parseCodeViewerLayoutMode,
  useCodeViewerLayout,
  type CodeViewerLayoutMode,
} from '../../../context/CodeViewerLayoutContext';
import { useTheme } from '../../../context/ThemeContext';
import {
  DEFAULT_EDITOR_BRACKET_PAIR_GUIDES,
  DEFAULT_EDITOR_FONT_LIGATURES,
  DEFAULT_EDITOR_GLYPH_MARGIN,
  DEFAULT_EDITOR_INLINE_GIT_DIFF_ENABLED,
  DEFAULT_EDITOR_INDENT_GUIDES,
  DEFAULT_EDITOR_MINIMAP_ENABLED,
  DEFAULT_EDITOR_SCROLL_BEYOND_LAST_LINE,
  DEFAULT_EDITOR_SMOOTH_SCROLLING,
  EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY,
  EDITOR_CURSOR_BLINKING_CONFIG_KEY,
  EDITOR_FOLDING_STRATEGY_CONFIG_KEY,
  EDITOR_FONT_FAMILY_CONFIG_KEY,
  EDITOR_FONT_LIGATURES_CONFIG_KEY,
  EDITOR_FONT_SIZE_CONFIG_KEY,
  EDITOR_GLYPH_MARGIN_CONFIG_KEY,
  EDITOR_INLINE_GIT_DIFF_ENABLED_CONFIG_KEY,
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
  editorFoldingStrategyOptions,
  editorFontFamilyOptions,
  editorLineNumbersOptions,
  editorRenderWhitespaceOptions,
  editorTabSizeOptions,
  editorWordWrapOptions,
  parseEditorCursorBlinking,
  parseEditorFoldingStrategy,
  parseEditorFontFamily,
  parseEditorFontSize,
  parseEditorLineNumbers,
  parseEditorRenderControlCharacters,
  parseEditorRenderWhitespace,
  parseEditorTabSize,
  parseEditorWordWrap,
} from '../../../editor/editorSettings';
import {
  parseConfiguredColorThemeId,
  parseImportedColorThemeRecords,
  WORKBENCH_COLOR_THEME_CONFIG_KEY,
  WORKBENCH_IMPORTED_THEMES_CONFIG_KEY,
} from '../../../theme/colorThemeRegistry';
import type { ColorThemeOption } from '../../../theme/colorThemeTypes';
import { Button } from '../../ui/button';
import { Combobox, type ComboboxOption } from '../../ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { ScrollArea } from '../../ui/scroll-area';
import { Separator } from '../../ui/separator';
import { Slider } from '../../ui/slider';
import { Switch } from '../../ui/switch';
import { EditorFontAdvancedDialog } from './EditorFontAdvancedDialog';
import { EditorThemeAdvancedDialog } from './EditorThemeAdvancedDialog';
import { ColorThemePreviewCard, EditorFontPreviewCard } from './PickerPreviewCards';

const CLOSE_ACTION_CONFIG_KEY = 'window.closeActionPreference';
const FLOATING_INFO_VISIBLE_CONFIG_KEY = 'ui.floatingInfoWindow.visible';
const THEME_PICKER_LAYOUT_MODE_CONFIG_KEY = 'workbench.themePickerLayoutMode';
const settingsSectionClassName = 'rounded-md border border-border/85 bg-muted/55 px-3 py-2.5';
const settingsSectionTitleClassName = 'text-[13px] font-medium';
const settingsSectionDescriptionClassName = 'text-[12px] text-muted-foreground';

type ThemePickerLayoutMode = 'grouped' | 'list';

const codeViewerLayoutModeOptions: Array<{
  value: CodeViewerLayoutMode;
  label: string;
  description: string;
}> = [
  {
    value: 'compact',
    label: 'Compact',
    description: 'Use the current dense code viewer layout.',
  },
  {
    value: 'minimal',
    label: 'Minimal',
    description: 'Use rounded, separated code viewer regions with lighter chrome.',
  },
];

export interface MenuBarSettingsState {
  codeViewerLayoutMode: CodeViewerLayoutMode;
  closeToTrayEnabled: boolean;
  floatingInfoWindowVisible: boolean;
  themeId: string;
  themePickerLayoutMode: ThemePickerLayoutMode;
  editorCursorBlinking: ReturnType<typeof getConfiguredEditorCursorBlinking>;
  editorBracketPairGuides: ReturnType<typeof getConfiguredEditorBracketPairGuides>;
  editorFontFamily: ReturnType<typeof getConfiguredEditorFontFamily>;
  editorFontLigatures: ReturnType<typeof getConfiguredEditorFontLigatures>;
  editorFontSize: ReturnType<typeof getConfiguredEditorFontSize>;
  editorFoldingStrategy: ReturnType<typeof getConfiguredEditorFoldingStrategy>;
  editorGlyphMargin: ReturnType<typeof getConfiguredEditorGlyphMargin>;
  editorInlineGitDiffEnabled: ReturnType<typeof getConfiguredEditorInlineGitDiffEnabled>;
  editorIndentGuides: ReturnType<typeof getConfiguredEditorIndentGuides>;
  editorLineNumbers: ReturnType<typeof getConfiguredEditorLineNumbers>;
  editorMinimapEnabled: ReturnType<typeof getConfiguredEditorMinimapEnabled>;
  editorRenderControlCharacters: ReturnType<typeof getConfiguredEditorRenderControlCharacters>;
  editorRenderWhitespace: ReturnType<typeof getConfiguredEditorRenderWhitespace>;
  editorScrollBeyondLastLine: ReturnType<typeof getConfiguredEditorScrollBeyondLastLine>;
  editorSmoothScrolling: ReturnType<typeof getConfiguredEditorSmoothScrolling>;
  editorTabSize: ReturnType<typeof getConfiguredEditorTabSize>;
  editorWordWrap: ReturnType<typeof getConfiguredEditorWordWrap>;
}

function getConfiguredCloseAction(): 'quit' | 'tray' {
  const value = window.electronAPI?.config.get(CLOSE_ACTION_CONFIG_KEY);
  return value === 'tray' ? 'tray' : 'quit';
}

function getFloatingInfoWindowVisible(): boolean {
  return window.electronAPI?.config.get(FLOATING_INFO_VISIBLE_CONFIG_KEY) === true;
}

function getConfiguredThemeId(): string {
  return parseConfiguredColorThemeId(
    window.electronAPI?.config.get(WORKBENCH_COLOR_THEME_CONFIG_KEY),
    parseImportedColorThemeRecords(window.electronAPI?.config.get(WORKBENCH_IMPORTED_THEMES_CONFIG_KEY)),
  );
}

function parseThemePickerLayoutMode(value: unknown): ThemePickerLayoutMode {
  return value === 'grouped' ? 'grouped' : 'list';
}

function getConfiguredThemePickerLayoutMode(): ThemePickerLayoutMode {
  return parseThemePickerLayoutMode(window.electronAPI?.config.get(THEME_PICKER_LAYOUT_MODE_CONFIG_KEY));
}

function getConfiguredCodeViewerLayoutMode(): CodeViewerLayoutMode {
  return parseCodeViewerLayoutMode(window.electronAPI?.config.get(WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY));
}

function getConfiguredEditorFontSize(): number {
  return parseEditorFontSize(window.electronAPI?.config.get(EDITOR_FONT_SIZE_CONFIG_KEY));
}

function getConfiguredEditorFontFamily() {
  return parseEditorFontFamily(window.electronAPI?.config.get(EDITOR_FONT_FAMILY_CONFIG_KEY));
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

function getConfiguredEditorInlineGitDiffEnabled() {
  return getConfiguredEditorBooleanSetting(
    EDITOR_INLINE_GIT_DIFF_ENABLED_CONFIG_KEY,
    DEFAULT_EDITOR_INLINE_GIT_DIFF_ENABLED,
  );
}

function getConfiguredEditorBracketPairGuides() {
  return getConfiguredEditorBooleanSetting(EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY, DEFAULT_EDITOR_BRACKET_PAIR_GUIDES);
}

function getConfiguredEditorIndentGuides() {
  return getConfiguredEditorBooleanSetting(EDITOR_INDENT_GUIDES_CONFIG_KEY, DEFAULT_EDITOR_INDENT_GUIDES);
}

function getPersistedSettingsState(): MenuBarSettingsState {
  return {
    codeViewerLayoutMode: getConfiguredCodeViewerLayoutMode(),
    closeToTrayEnabled: getConfiguredCloseAction() === 'tray',
    floatingInfoWindowVisible: getFloatingInfoWindowVisible(),
    themeId: getConfiguredThemeId(),
    themePickerLayoutMode: getConfiguredThemePickerLayoutMode(),
    editorCursorBlinking: getConfiguredEditorCursorBlinking(),
    editorBracketPairGuides: getConfiguredEditorBracketPairGuides(),
    editorFontFamily: getConfiguredEditorFontFamily(),
    editorFontLigatures: getConfiguredEditorFontLigatures(),
    editorFontSize: getConfiguredEditorFontSize(),
    editorFoldingStrategy: getConfiguredEditorFoldingStrategy(),
    editorGlyphMargin: getConfiguredEditorGlyphMargin(),
    editorInlineGitDiffEnabled: getConfiguredEditorInlineGitDiffEnabled(),
    editorIndentGuides: getConfiguredEditorIndentGuides(),
    editorLineNumbers: getConfiguredEditorLineNumbers(),
    editorMinimapEnabled: getConfiguredEditorMinimapEnabled(),
    editorRenderControlCharacters: getConfiguredEditorRenderControlCharacters(),
    editorRenderWhitespace: getConfiguredEditorRenderWhitespace(),
    editorScrollBeyondLastLine: getConfiguredEditorScrollBeyondLastLine(),
    editorSmoothScrolling: getConfiguredEditorSmoothScrolling(),
    editorTabSize: getConfiguredEditorTabSize(),
    editorWordWrap: getConfiguredEditorWordWrap(),
  };
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
  previewPaneTestId,
  renderOptionPreview,
  searchPlaceholder,
  testId,
  title,
  value,
}: {
  action?: ReactNode;
  description: string;
  emptyText: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  previewPaneTestId?: string;
  renderOptionPreview?: (option: ComboboxOption) => ReactNode;
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
        <div className={action ? 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2' : undefined}>
          <div className={action ? 'min-w-0 flex-1' : undefined}>
            <Combobox
              value={value}
              onValueChange={onValueChange}
              options={options}
              placeholder={options.find((option) => option.value === value)?.label ?? options[0]?.label ?? ''}
              previewPaneTestId={previewPaneTestId}
              renderOptionPreview={renderOptionPreview}
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

export function useMenuBarSettingsController() {
  const { setLayoutMode: setCodeViewerLayoutMode } = useCodeViewerLayout();
  const {
    setCursorBlinking: setEditorCursorBlinking,
    setBracketPairGuides: setEditorBracketPairGuides,
    setFontFamily: setEditorFontFamily,
    setFontLigatures: setEditorFontLigatures,
    setFontSize: setEditorFontSize,
    setFoldingStrategy: setEditorFoldingStrategy,
    setGlyphMargin: setEditorGlyphMargin,
    setInlineGitDiffEnabled: setEditorInlineGitDiffEnabled,
    setIndentGuides: setEditorIndentGuides,
    setLineNumbers: setEditorLineNumbers,
    setMinimapEnabled: setEditorMinimapEnabled,
    setRenderControlCharacters: setEditorRenderControlCharacters,
    setRenderWhitespace: setEditorRenderWhitespace,
    setScrollBeyondLastLine: setEditorScrollBeyondLastLine,
    setSmoothScrolling: setEditorSmoothScrolling,
    setTabSize: setEditorTabSize,
    setWordWrap: setEditorWordWrap,
  } = useEditorSettings();
  const {
    availableThemes,
    getThemePreview,
    importTheme,
    isImportingTheme,
    setTheme,
  } = useTheme();
  const [editorFontAdvancedDialogOpen, setEditorFontAdvancedDialogOpen] = useState(false);
  const [themeAdvancedDialogOpen, setThemeAdvancedDialogOpen] = useState(false);
  const [importedThemeOptionOverride, setImportedThemeOptionOverride] = useState<ColorThemeOption | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsState, setSettingsState] = useState<MenuBarSettingsState>(getPersistedSettingsState);

  const availableThemeOptions = useMemo(() => {
    if (!importedThemeOptionOverride) {
      return availableThemes;
    }

    if (availableThemes.some((option) => option.value === importedThemeOptionOverride.value)) {
      return availableThemes;
    }

    return [...availableThemes, importedThemeOptionOverride];
  }, [availableThemes, importedThemeOptionOverride]);

  const patchSettingsState = useCallback((partialState: Partial<MenuBarSettingsState>) => {
    setSettingsState((current) => ({ ...current, ...partialState }));
  }, []);

  const handleSettingsDialogOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setSettingsState(getPersistedSettingsState());
      setImportedThemeOptionOverride(null);
    } else {
      setEditorFontAdvancedDialogOpen(false);
      setThemeAdvancedDialogOpen(false);
    }

    setSettingsDialogOpen(nextOpen);
  }, []);

  const handleEditorFontAdvancedDialogOpenChange = useCallback((nextOpen: boolean) => {
    setEditorFontAdvancedDialogOpen(nextOpen);
  }, []);

  const handleThemeAdvancedDialogOpenChange = useCallback((nextOpen: boolean) => {
    setThemeAdvancedDialogOpen(nextOpen);
  }, []);

  const handleThemePickerLayoutModeChange = useCallback((layoutMode: ThemePickerLayoutMode) => {
    patchSettingsState({ themePickerLayoutMode: layoutMode });
    void window.electronAPI?.config.set(THEME_PICKER_LAYOUT_MODE_CONFIG_KEY, layoutMode);
  }, [patchSettingsState]);

  const handleCodeViewerLayoutModeChange = useCallback((value: string) => {
    const nextLayoutMode = parseCodeViewerLayoutMode(value);

    patchSettingsState({ codeViewerLayoutMode: nextLayoutMode });
    setCodeViewerLayoutMode(nextLayoutMode);
  }, [patchSettingsState, setCodeViewerLayoutMode]);

  const handleCloseToTrayChange = (checked: boolean) => {
    patchSettingsState({ closeToTrayEnabled: checked });
    void window.electronAPI?.config.set(CLOSE_ACTION_CONFIG_KEY, checked ? 'tray' : 'quit');
  };

  const handleFloatingInfoWindowVisibleChange = (checked: boolean) => {
    patchSettingsState({ floatingInfoWindowVisible: checked });
    void window.electronAPI?.config.set(FLOATING_INFO_VISIBLE_CONFIG_KEY, checked);
    void window.electronAPI?.setFloatingInfoWindowVisible(checked);
  };

  const handleThemeChange = useCallback((value: string) => {
    patchSettingsState({ themeId: value });
    setTheme(value);
  }, [patchSettingsState, setTheme]);

  const handleThemeImport = useCallback(async () => {
    const importedTheme = await importTheme();

    if (!importedTheme) {
      return;
    }

    setImportedThemeOptionOverride(importedTheme);
    patchSettingsState({ themeId: importedTheme.value });
  }, [importTheme, patchSettingsState]);

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

  const handleThemeAdvancedSelect = useCallback((value: string) => {
    handleThemeChange(value);
    setThemeAdvancedDialogOpen(false);
  }, [handleThemeChange]);

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

  const handleEditorInlineGitDiffEnabledChange = (checked: boolean) => {
    patchSettingsState({ editorInlineGitDiffEnabled: checked });
    setEditorInlineGitDiffEnabled(checked);
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

  return {
    editorFontAdvancedDialogOpen,
    availableThemeOptions,
    getThemePreview,
    handleCodeViewerLayoutModeChange,
    handleCloseToTrayChange,
    handleEditorBracketPairGuidesChange,
    handleEditorCursorBlinkingChange,
    handleEditorFoldingStrategyChange,
    handleEditorFontAdvancedDialogOpenChange,
    handleEditorFontAdvancedSelect,
    handleEditorFontFamilyChange,
    handleEditorFontLigaturesChange,
    handleEditorFontSizeChange,
    handleEditorFontSizeCommit,
    handleEditorGlyphMarginChange,
    handleEditorInlineGitDiffEnabledChange,
    handleEditorIndentGuidesChange,
    handleEditorLineNumbersChange,
    handleEditorMinimapEnabledChange,
    handleEditorRenderControlCharactersChange,
    handleEditorRenderWhitespaceChange,
    handleEditorScrollBeyondLastLineChange,
    handleEditorSmoothScrollingChange,
    handleEditorTabSizeChange,
    handleThemeAdvancedDialogOpenChange,
    handleThemePickerLayoutModeChange,
    handleThemeAdvancedSelect,
    handleThemeChange,
    handleThemeImport,
    handleEditorWordWrapChange,
    handleFloatingInfoWindowVisibleChange,
    handleSettingsDialogOpenChange,
    isImportingTheme,
    openSettingsDialog,
    settingsDialogOpen,
    settingsState,
    themeAdvancedDialogOpen,
  };
}

export type MenuBarSettingsController = ReturnType<typeof useMenuBarSettingsController>;

export function MenuBarSettingsDialogs({
  controller,
  dialogStyle,
}: {
  controller: MenuBarSettingsController;
  dialogStyle?: CSSProperties;
}) {
  const {
    editorFontAdvancedDialogOpen,
    availableThemeOptions,
    getThemePreview,
    handleCodeViewerLayoutModeChange,
    handleCloseToTrayChange,
    handleEditorBracketPairGuidesChange,
    handleEditorCursorBlinkingChange,
    handleEditorFoldingStrategyChange,
    handleEditorFontAdvancedDialogOpenChange,
    handleEditorFontAdvancedSelect,
    handleEditorFontFamilyChange,
    handleEditorFontLigaturesChange,
    handleEditorFontSizeChange,
    handleEditorFontSizeCommit,
    handleEditorGlyphMarginChange,
    handleEditorInlineGitDiffEnabledChange,
    handleEditorIndentGuidesChange,
    handleEditorLineNumbersChange,
    handleEditorMinimapEnabledChange,
    handleEditorRenderControlCharactersChange,
    handleEditorRenderWhitespaceChange,
    handleEditorScrollBeyondLastLineChange,
    handleEditorSmoothScrollingChange,
    handleEditorTabSizeChange,
    handleThemeAdvancedDialogOpenChange,
    handleThemePickerLayoutModeChange,
    handleThemeAdvancedSelect,
    handleThemeChange,
    handleThemeImport,
    handleEditorWordWrapChange,
    handleFloatingInfoWindowVisibleChange,
    handleSettingsDialogOpenChange,
    isImportingTheme,
    settingsDialogOpen,
    settingsState,
    themeAdvancedDialogOpen,
  } = controller;

  const availableThemeOptionsById = useMemo(
    () => new Map(availableThemeOptions.map((option) => [option.value, option])),
    [availableThemeOptions],
  );

  return (
    <>
      <Dialog open={settingsDialogOpen} onOpenChange={handleSettingsDialogOpenChange}>
        <DialogContent
          data-testid="settings-dialog"
          className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-xl"
          style={dialogStyle}
        >
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage workbench appearance, editor behavior, and window preferences.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="min-h-0">
            <div className="space-y-2.5 pr-4">
              <SettingsComboboxSection
                value={settingsState.themeId}
                onValueChange={handleThemeChange}
                options={availableThemeOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                  description: option.description,
                }))}
                title="UI theme"
                description="Choose the VS Code color theme used across Pristine UI, Monaco, and the terminal. Imported themes fall back to the matching built-in 2026 base theme for missing tokens."
                searchPlaceholder="Search UI themes..."
                emptyText="No UI theme found."
                previewPaneTestId="settings-theme-combobox-preview-pane"
                renderOptionPreview={(option) => {
                  const themeOption = availableThemeOptionsById.get(option.value);

                  if (!themeOption) {
                    return null;
                  }

                  return (
                    <ColorThemePreviewCard
                      isSelected={themeOption.value === settingsState.themeId}
                      option={themeOption}
                      preview={getThemePreview(themeOption.value)}
                      testIdPrefix="settings-theme-combobox-preview"
                    />
                  );
                }}
                testId="settings-theme-combobox"
                action={(
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="settings-theme-advanced-button"
                      className="hover:cursor-pointer"
                      onClick={() => controller.handleThemeAdvancedDialogOpenChange(true)}
                    >
                      Advanced
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="settings-theme-import-button"
                      className="hover:cursor-pointer"
                      disabled={isImportingTheme}
                      onClick={() => {
                        void handleThemeImport();
                      }}
                    >
                      {isImportingTheme ? 'Importing...' : 'Import'}
                    </Button>
                  </div>
                )}
              />
              <SettingsComboboxSection
                value={settingsState.codeViewerLayoutMode}
                onValueChange={handleCodeViewerLayoutModeChange}
                options={codeViewerLayoutModeOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                  description: option.description,
                }))}
                title="Code viewer layout"
                description="Choose how the code viewer arranges side panels, editor regions, bottom panels, and tabs."
                searchPlaceholder="Search code viewer layouts..."
                emptyText="No code viewer layout found."
                testId="settings-code-viewer-layout-combobox"
              />
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
                previewPaneTestId="settings-editor-font-family-combobox-preview-pane"
                renderOptionPreview={(option) => {
                  const fontFamily = parseEditorFontFamily(option.value);

                  return (
                    <EditorFontPreviewCard
                      fontFamily={fontFamily}
                      isSelected={fontFamily === settingsState.editorFontFamily}
                      testIdPrefix="settings-editor-font-family-combobox-preview"
                    />
                  );
                }}
                testId="settings-editor-font-family-combobox"
                action={(
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="settings-editor-font-family-advanced-button"
                    className="shrink-0 hover:cursor-pointer"
                    onClick={() => controller.handleEditorFontAdvancedDialogOpenChange(true)}
                  >
                    Advanced
                  </Button>
                )}
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
                    checked={settingsState.editorInlineGitDiffEnabled}
                    description="Show HEAD versus workspace changes inline inside opened modified files."
                    onCheckedChange={handleEditorInlineGitDiffEnabledChange}
                    testId="settings-editor-inline-git-diff-switch"
                    title="Inline Git Diff"
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
        dialogStyle={dialogStyle}
      />

      <EditorThemeAdvancedDialog
        availableThemes={availableThemeOptions}
        dialogStyle={dialogStyle}
        getThemePreview={getThemePreview}
        layoutMode={settingsState.themePickerLayoutMode}
        open={themeAdvancedDialogOpen}
        onOpenChange={handleThemeAdvancedDialogOpenChange}
        onLayoutModeChange={handleThemePickerLayoutModeChange}
        onSelectTheme={handleThemeAdvancedSelect}
        selectedTheme={settingsState.themeId}
      />
    </>
  );
}
