import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DEFAULT_EDITOR_CURSOR_BLINKING,
  DEFAULT_EDITOR_BRACKET_PAIR_GUIDES,
  DEFAULT_EDITOR_FONT_FAMILY,
  DEFAULT_EDITOR_FONT_LIGATURES,
  DEFAULT_EDITOR_FONT_SIZE,
  DEFAULT_EDITOR_FOLDING_STRATEGY,
  DEFAULT_EDITOR_GLYPH_MARGIN,
  DEFAULT_EDITOR_INDENT_GUIDES,
  DEFAULT_EDITOR_LINE_NUMBERS,
  DEFAULT_EDITOR_MINIMAP_ENABLED,
  DEFAULT_EDITOR_RENDER_CONTROL_CHARACTERS,
  DEFAULT_EDITOR_RENDER_WHITESPACE,
  DEFAULT_EDITOR_SCROLL_BEYOND_LAST_LINE,
  DEFAULT_EDITOR_SMOOTH_SCROLLING,
  DEFAULT_EDITOR_TAB_SIZE,
  DEFAULT_EDITOR_THEME,
  DEFAULT_EDITOR_WORD_WRAP,
  EDITOR_CURSOR_BLINKING_CONFIG_KEY,
  EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY,
  EDITOR_FONT_FAMILY_CONFIG_KEY,
  EDITOR_FONT_LIGATURES_CONFIG_KEY,
  EDITOR_FONT_SIZE_CONFIG_KEY,
  EDITOR_FOLDING_STRATEGY_CONFIG_KEY,
  EDITOR_GLYPH_MARGIN_CONFIG_KEY,
  EDITOR_INDENT_GUIDES_CONFIG_KEY,
  EDITOR_LINE_NUMBERS_CONFIG_KEY,
  EDITOR_MINIMAP_ENABLED_CONFIG_KEY,
  EDITOR_RENDER_CONTROL_CHARACTERS_CONFIG_KEY,
  EDITOR_RENDER_WHITESPACE_CONFIG_KEY,
  EDITOR_SCROLL_BEYOND_LAST_LINE_CONFIG_KEY,
  EDITOR_SMOOTH_SCROLLING_CONFIG_KEY,
  EDITOR_TAB_SIZE_CONFIG_KEY,
  EDITOR_THEME_CONFIG_KEY,
  EDITOR_WORD_WRAP_CONFIG_KEY,
  type EditorCursorBlinkingMode,
  type EditorFontFamilyId,
  type EditorFoldingStrategy,
  type EditorLineNumbersMode,
  type EditorRenderWhitespaceMode,
  type EditorTabSize,
  type EditorThemeId,
  type EditorWordWrapMode,
  parseEditorCursorBlinking,
  parseEditorBracketPairGuides,
  parseEditorFontFamily,
  parseEditorFontLigatures,
  parseEditorFontSize,
  parseEditorFoldingStrategy,
  parseEditorGlyphMargin,
  parseEditorIndentGuides,
  parseEditorLineNumbers,
  parseEditorMinimapEnabled,
  parseEditorRenderControlCharacters,
  parseEditorRenderWhitespace,
  parseEditorScrollBeyondLastLine,
  parseEditorSmoothScrolling,
  parseEditorTabSize,
  parseEditorTheme,
  parseEditorWordWrap,
} from '../editor/editorSettings'
import { ensureEditorFontFamilyLoaded } from '../editor/fontLoader'

interface EditorSettingsState {
  cursorBlinking: EditorCursorBlinkingMode
  bracketPairGuides: boolean
  fontFamily: EditorFontFamilyId
  fontLigatures: boolean
  fontSize: number
  foldingStrategy: EditorFoldingStrategy
  glyphMargin: boolean
  indentGuides: boolean
  lineNumbers: EditorLineNumbersMode
  minimapEnabled: boolean
  renderControlCharacters: boolean
  renderWhitespace: EditorRenderWhitespaceMode
  scrollBeyondLastLine: boolean
  smoothScrolling: boolean
  tabSize: EditorTabSize
  theme: EditorThemeId
  wordWrap: EditorWordWrapMode
}

interface EditorSettingsContextValue extends EditorSettingsState {
  setCursorBlinking: (cursorBlinking: EditorCursorBlinkingMode) => void
  setBracketPairGuides: (enabled: boolean) => void
  setFontFamily: (fontFamily: EditorFontFamilyId) => void
  setFontLigatures: (enabled: boolean) => void
  setFontSize: (fontSize: number) => void
  setFoldingStrategy: (foldingStrategy: EditorFoldingStrategy) => void
  setGlyphMargin: (enabled: boolean) => void
  setIndentGuides: (enabled: boolean) => void
  setLineNumbers: (lineNumbers: EditorLineNumbersMode) => void
  setMinimapEnabled: (enabled: boolean) => void
  setRenderControlCharacters: (enabled: boolean) => void
  setRenderWhitespace: (renderWhitespace: EditorRenderWhitespaceMode) => void
  setScrollBeyondLastLine: (enabled: boolean) => void
  setSmoothScrolling: (enabled: boolean) => void
  setTabSize: (tabSize: EditorTabSize) => void
  setTheme: (theme: EditorThemeId) => void
  setWordWrap: (wordWrap: EditorWordWrapMode) => void
}

type EditorSettingDefinition<T> = {
  configKey: string
  fallback: T
  parseValue: (value: unknown) => T
}

type EditorSettingDefinitions = {
  [K in keyof EditorSettingsState]: EditorSettingDefinition<EditorSettingsState[K]>
}

const EditorSettingsContext = createContext<EditorSettingsContextValue | null>(null)

const EDITOR_SETTING_DEFINITIONS: EditorSettingDefinitions = {
  cursorBlinking: {
    configKey: EDITOR_CURSOR_BLINKING_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_CURSOR_BLINKING,
    parseValue: parseEditorCursorBlinking,
  },
  bracketPairGuides: {
    configKey: EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_BRACKET_PAIR_GUIDES,
    parseValue: parseEditorBracketPairGuides,
  },
  fontFamily: {
    configKey: EDITOR_FONT_FAMILY_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_FONT_FAMILY,
    parseValue: parseEditorFontFamily,
  },
  fontLigatures: {
    configKey: EDITOR_FONT_LIGATURES_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_FONT_LIGATURES,
    parseValue: parseEditorFontLigatures,
  },
  fontSize: {
    configKey: EDITOR_FONT_SIZE_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_FONT_SIZE,
    parseValue: parseEditorFontSize,
  },
  foldingStrategy: {
    configKey: EDITOR_FOLDING_STRATEGY_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_FOLDING_STRATEGY,
    parseValue: parseEditorFoldingStrategy,
  },
  glyphMargin: {
    configKey: EDITOR_GLYPH_MARGIN_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_GLYPH_MARGIN,
    parseValue: parseEditorGlyphMargin,
  },
  indentGuides: {
    configKey: EDITOR_INDENT_GUIDES_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_INDENT_GUIDES,
    parseValue: parseEditorIndentGuides,
  },
  lineNumbers: {
    configKey: EDITOR_LINE_NUMBERS_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_LINE_NUMBERS,
    parseValue: parseEditorLineNumbers,
  },
  minimapEnabled: {
    configKey: EDITOR_MINIMAP_ENABLED_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_MINIMAP_ENABLED,
    parseValue: parseEditorMinimapEnabled,
  },
  renderControlCharacters: {
    configKey: EDITOR_RENDER_CONTROL_CHARACTERS_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_RENDER_CONTROL_CHARACTERS,
    parseValue: parseEditorRenderControlCharacters,
  },
  renderWhitespace: {
    configKey: EDITOR_RENDER_WHITESPACE_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_RENDER_WHITESPACE,
    parseValue: parseEditorRenderWhitespace,
  },
  scrollBeyondLastLine: {
    configKey: EDITOR_SCROLL_BEYOND_LAST_LINE_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_SCROLL_BEYOND_LAST_LINE,
    parseValue: parseEditorScrollBeyondLastLine,
  },
  smoothScrolling: {
    configKey: EDITOR_SMOOTH_SCROLLING_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_SMOOTH_SCROLLING,
    parseValue: parseEditorSmoothScrolling,
  },
  tabSize: {
    configKey: EDITOR_TAB_SIZE_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_TAB_SIZE,
    parseValue: parseEditorTabSize,
  },
  theme: {
    configKey: EDITOR_THEME_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_THEME,
    parseValue: parseEditorTheme,
  },
  wordWrap: {
    configKey: EDITOR_WORD_WRAP_CONFIG_KEY,
    fallback: DEFAULT_EDITOR_WORD_WRAP,
    parseValue: parseEditorWordWrap,
  },
}

function readConfiguredEditorSetting<T>(definition: EditorSettingDefinition<T>): T {
  try {
    return definition.parseValue(window.electronAPI?.config.get(definition.configKey))
  } catch {
    return definition.fallback
  }
}

function persistConfiguredEditorSetting<T>(definition: EditorSettingDefinition<T>, value: T) {
  try {
    void window.electronAPI?.config.set(definition.configKey, definition.parseValue(value))
  } catch {
    /* ignore */
  }
}

function getInitialEditorSettingsState(): EditorSettingsState {
  return {
    cursorBlinking: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.cursorBlinking),
    bracketPairGuides: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.bracketPairGuides),
    fontFamily: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.fontFamily),
    fontLigatures: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.fontLigatures),
    fontSize: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.fontSize),
    foldingStrategy: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.foldingStrategy),
    glyphMargin: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.glyphMargin),
    indentGuides: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.indentGuides),
    lineNumbers: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.lineNumbers),
    minimapEnabled: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.minimapEnabled),
    renderControlCharacters: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.renderControlCharacters),
    renderWhitespace: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.renderWhitespace),
    scrollBeyondLastLine: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.scrollBeyondLastLine),
    smoothScrolling: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.smoothScrolling),
    tabSize: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.tabSize),
    theme: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.theme),
    wordWrap: readConfiguredEditorSetting(EDITOR_SETTING_DEFINITIONS.wordWrap),
  }
}

export function EditorSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<EditorSettingsState>(getInitialEditorSettingsState)

  const updateSetting = useCallback(function updateSetting<K extends keyof EditorSettingsState>(
    key: K,
    value: EditorSettingsState[K],
  ) {
    const definition = EDITOR_SETTING_DEFINITIONS[key]
    const nextValue = definition.parseValue(value)

    setSettings((currentSettings) => {
      if (Object.is(currentSettings[key], nextValue)) {
        return currentSettings
      }

      return {
        ...currentSettings,
        [key]: nextValue,
      } as EditorSettingsState
    })

    persistConfiguredEditorSetting(definition, nextValue)
  }, [])

  const settingActions = useMemo(() => ({
    setCursorBlinking: (value: EditorCursorBlinkingMode) => updateSetting('cursorBlinking', value),
    setBracketPairGuides: (value: boolean) => updateSetting('bracketPairGuides', value),
    setFontFamily: (value: EditorFontFamilyId) => updateSetting('fontFamily', value),
    setFontLigatures: (value: boolean) => updateSetting('fontLigatures', value),
    setFontSize: (value: number) => updateSetting('fontSize', value),
    setFoldingStrategy: (value: EditorFoldingStrategy) => updateSetting('foldingStrategy', value),
    setGlyphMargin: (value: boolean) => updateSetting('glyphMargin', value),
    setIndentGuides: (value: boolean) => updateSetting('indentGuides', value),
    setLineNumbers: (value: EditorLineNumbersMode) => updateSetting('lineNumbers', value),
    setMinimapEnabled: (value: boolean) => updateSetting('minimapEnabled', value),
    setRenderControlCharacters: (value: boolean) => updateSetting('renderControlCharacters', value),
    setRenderWhitespace: (value: EditorRenderWhitespaceMode) => updateSetting('renderWhitespace', value),
    setScrollBeyondLastLine: (value: boolean) => updateSetting('scrollBeyondLastLine', value),
    setSmoothScrolling: (value: boolean) => updateSetting('smoothScrolling', value),
    setTabSize: (value: EditorTabSize) => updateSetting('tabSize', value),
    setTheme: (value: EditorThemeId) => updateSetting('theme', value),
    setWordWrap: (value: EditorWordWrapMode) => updateSetting('wordWrap', value),
  }), [updateSetting])

  useEffect(() => {
    void ensureEditorFontFamilyLoaded(settings.fontFamily)
  }, [settings.fontFamily])

  const value = useMemo<EditorSettingsContextValue>(() => ({
    ...settings,
    ...settingActions,
  }), [settingActions, settings])

  return (
    <EditorSettingsContext.Provider value={value}>
      {children}
    </EditorSettingsContext.Provider>
  )
}

export function useEditorSettings(): EditorSettingsContextValue {
  const ctx = useContext(EditorSettingsContext)

  if (!ctx) {
    throw new Error('useEditorSettings must be used within EditorSettingsProvider')
  }

  return ctx
}