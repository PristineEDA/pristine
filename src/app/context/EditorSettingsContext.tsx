import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
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

interface EditorSettingsContextValue {
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
  theme: EditorThemeId
  wordWrap: EditorWordWrapMode
}

const EditorSettingsContext = createContext<EditorSettingsContextValue | null>(null)

function readConfiguredEditorSetting<T>(configKey: string, parseValue: (value: unknown) => T, fallback: T): T {
  try {
    return parseValue(window.electronAPI?.config.get(configKey))
  } catch {
    return fallback
  }
}

function persistConfiguredEditorSetting<T>(configKey: string, parseValue: (value: unknown) => T, value: T) {
  try {
    void window.electronAPI?.config.set(configKey, parseValue(value))
  } catch {
    /* ignore */
  }
}

function getConfiguredEditorFontSize(): number {
  return readConfiguredEditorSetting(EDITOR_FONT_SIZE_CONFIG_KEY, parseEditorFontSize, DEFAULT_EDITOR_FONT_SIZE)
}

function getConfiguredEditorFontFamily(): EditorFontFamilyId {
  return readConfiguredEditorSetting(EDITOR_FONT_FAMILY_CONFIG_KEY, parseEditorFontFamily, DEFAULT_EDITOR_FONT_FAMILY)
}

function getConfiguredEditorTheme(): EditorThemeId {
  return readConfiguredEditorSetting(EDITOR_THEME_CONFIG_KEY, parseEditorTheme, DEFAULT_EDITOR_THEME)
}

function getConfiguredEditorWordWrap(): EditorWordWrapMode {
  return readConfiguredEditorSetting(EDITOR_WORD_WRAP_CONFIG_KEY, parseEditorWordWrap, DEFAULT_EDITOR_WORD_WRAP)
}

function getConfiguredEditorRenderWhitespace(): EditorRenderWhitespaceMode {
  return readConfiguredEditorSetting(
    EDITOR_RENDER_WHITESPACE_CONFIG_KEY,
    parseEditorRenderWhitespace,
    DEFAULT_EDITOR_RENDER_WHITESPACE,
  )
}

function getConfiguredEditorFontLigatures(): boolean {
  return readConfiguredEditorSetting(
    EDITOR_FONT_LIGATURES_CONFIG_KEY,
    parseEditorFontLigatures,
    DEFAULT_EDITOR_FONT_LIGATURES,
  )
}

function getConfiguredEditorTabSize(): EditorTabSize {
  return readConfiguredEditorSetting(EDITOR_TAB_SIZE_CONFIG_KEY, parseEditorTabSize, DEFAULT_EDITOR_TAB_SIZE)
}

function getConfiguredEditorCursorBlinking(): EditorCursorBlinkingMode {
  return readConfiguredEditorSetting(
    EDITOR_CURSOR_BLINKING_CONFIG_KEY,
    parseEditorCursorBlinking,
    DEFAULT_EDITOR_CURSOR_BLINKING,
  )
}

function getConfiguredEditorRenderControlCharacters(): boolean {
  return readConfiguredEditorSetting(
    EDITOR_RENDER_CONTROL_CHARACTERS_CONFIG_KEY,
    parseEditorRenderControlCharacters,
    DEFAULT_EDITOR_RENDER_CONTROL_CHARACTERS,
  )
}

function getConfiguredEditorLineNumbers(): EditorLineNumbersMode {
  return readConfiguredEditorSetting(EDITOR_LINE_NUMBERS_CONFIG_KEY, parseEditorLineNumbers, DEFAULT_EDITOR_LINE_NUMBERS)
}

function getConfiguredEditorSmoothScrolling(): boolean {
  return readConfiguredEditorSetting(
    EDITOR_SMOOTH_SCROLLING_CONFIG_KEY,
    parseEditorSmoothScrolling,
    DEFAULT_EDITOR_SMOOTH_SCROLLING,
  )
}

function getConfiguredEditorScrollBeyondLastLine(): boolean {
  return readConfiguredEditorSetting(
    EDITOR_SCROLL_BEYOND_LAST_LINE_CONFIG_KEY,
    parseEditorScrollBeyondLastLine,
    DEFAULT_EDITOR_SCROLL_BEYOND_LAST_LINE,
  )
}

function getConfiguredEditorFoldingStrategy(): EditorFoldingStrategy {
  return readConfiguredEditorSetting(
    EDITOR_FOLDING_STRATEGY_CONFIG_KEY,
    parseEditorFoldingStrategy,
    DEFAULT_EDITOR_FOLDING_STRATEGY,
  )
}

function getConfiguredEditorMinimapEnabled(): boolean {
  return readConfiguredEditorSetting(EDITOR_MINIMAP_ENABLED_CONFIG_KEY, parseEditorMinimapEnabled, DEFAULT_EDITOR_MINIMAP_ENABLED)
}

function getConfiguredEditorGlyphMargin(): boolean {
  return readConfiguredEditorSetting(EDITOR_GLYPH_MARGIN_CONFIG_KEY, parseEditorGlyphMargin, DEFAULT_EDITOR_GLYPH_MARGIN)
}

function getConfiguredEditorBracketPairGuides(): boolean {
  return readConfiguredEditorSetting(
    EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY,
    parseEditorBracketPairGuides,
    DEFAULT_EDITOR_BRACKET_PAIR_GUIDES,
  )
}

function getConfiguredEditorIndentGuides(): boolean {
  return readConfiguredEditorSetting(EDITOR_INDENT_GUIDES_CONFIG_KEY, parseEditorIndentGuides, DEFAULT_EDITOR_INDENT_GUIDES)
}

export function EditorSettingsProvider({ children }: { children: ReactNode }) {
  const [cursorBlinking, setCursorBlinkingState] = useState<EditorCursorBlinkingMode>(getConfiguredEditorCursorBlinking)
  const [bracketPairGuides, setBracketPairGuidesState] = useState<boolean>(getConfiguredEditorBracketPairGuides)
  const [fontFamily, setFontFamilyState] = useState<EditorFontFamilyId>(getConfiguredEditorFontFamily)
  const [fontLigatures, setFontLigaturesState] = useState<boolean>(getConfiguredEditorFontLigatures)
  const [fontSize, setFontSizeState] = useState<number>(getConfiguredEditorFontSize)
  const [foldingStrategy, setFoldingStrategyState] = useState<EditorFoldingStrategy>(getConfiguredEditorFoldingStrategy)
  const [glyphMargin, setGlyphMarginState] = useState<boolean>(getConfiguredEditorGlyphMargin)
  const [indentGuides, setIndentGuidesState] = useState<boolean>(getConfiguredEditorIndentGuides)
  const [lineNumbers, setLineNumbersState] = useState<EditorLineNumbersMode>(getConfiguredEditorLineNumbers)
  const [minimapEnabled, setMinimapEnabledState] = useState<boolean>(getConfiguredEditorMinimapEnabled)
  const [renderControlCharacters, setRenderControlCharactersState] = useState<boolean>(getConfiguredEditorRenderControlCharacters)
  const [renderWhitespace, setRenderWhitespaceState] = useState<EditorRenderWhitespaceMode>(getConfiguredEditorRenderWhitespace)
  const [scrollBeyondLastLine, setScrollBeyondLastLineState] = useState<boolean>(getConfiguredEditorScrollBeyondLastLine)
  const [smoothScrolling, setSmoothScrollingState] = useState<boolean>(getConfiguredEditorSmoothScrolling)
  const [tabSize, setTabSizeState] = useState<EditorTabSize>(getConfiguredEditorTabSize)
  const [theme, setThemeState] = useState<EditorThemeId>(getConfiguredEditorTheme)
  const [wordWrap, setWordWrapState] = useState<EditorWordWrapMode>(getConfiguredEditorWordWrap)

  const setFontSize = useCallback((value: number) => {
    const nextValue = parseEditorFontSize(value)
    setFontSizeState(nextValue)
    persistConfiguredEditorSetting(EDITOR_FONT_SIZE_CONFIG_KEY, parseEditorFontSize, nextValue)
  }, [])

  const setFontFamily = useCallback((value: EditorFontFamilyId) => {
    const nextValue = parseEditorFontFamily(value)
    setFontFamilyState(nextValue)
    persistConfiguredEditorSetting(EDITOR_FONT_FAMILY_CONFIG_KEY, parseEditorFontFamily, nextValue)
  }, [])

  const setFontLigatures = useCallback((value: boolean) => {
    const nextValue = parseEditorFontLigatures(value)
    setFontLigaturesState(nextValue)
    persistConfiguredEditorSetting(EDITOR_FONT_LIGATURES_CONFIG_KEY, parseEditorFontLigatures, nextValue)
  }, [])

  const setTabSize = useCallback((value: EditorTabSize) => {
    const nextValue = parseEditorTabSize(value)
    setTabSizeState(nextValue)
    persistConfiguredEditorSetting(EDITOR_TAB_SIZE_CONFIG_KEY, parseEditorTabSize, nextValue)
  }, [])

  const setCursorBlinking = useCallback((value: EditorCursorBlinkingMode) => {
    const nextValue = parseEditorCursorBlinking(value)
    setCursorBlinkingState(nextValue)
    persistConfiguredEditorSetting(EDITOR_CURSOR_BLINKING_CONFIG_KEY, parseEditorCursorBlinking, nextValue)
  }, [])

  const setTheme = useCallback((value: EditorThemeId) => {
    const nextValue = parseEditorTheme(value)
    setThemeState(nextValue)
    persistConfiguredEditorSetting(EDITOR_THEME_CONFIG_KEY, parseEditorTheme, nextValue)
  }, [])

  const setWordWrap = useCallback((value: EditorWordWrapMode) => {
    const nextValue = parseEditorWordWrap(value)
    setWordWrapState(nextValue)
    persistConfiguredEditorSetting(EDITOR_WORD_WRAP_CONFIG_KEY, parseEditorWordWrap, nextValue)
  }, [])

  const setRenderWhitespace = useCallback((value: EditorRenderWhitespaceMode) => {
    const nextValue = parseEditorRenderWhitespace(value)
    setRenderWhitespaceState(nextValue)
    persistConfiguredEditorSetting(EDITOR_RENDER_WHITESPACE_CONFIG_KEY, parseEditorRenderWhitespace, nextValue)
  }, [])

  const setRenderControlCharacters = useCallback((value: boolean) => {
    const nextValue = parseEditorRenderControlCharacters(value)
    setRenderControlCharactersState(nextValue)
    persistConfiguredEditorSetting(
      EDITOR_RENDER_CONTROL_CHARACTERS_CONFIG_KEY,
      parseEditorRenderControlCharacters,
      nextValue,
    )
  }, [])

  const setLineNumbers = useCallback((value: EditorLineNumbersMode) => {
    const nextValue = parseEditorLineNumbers(value)
    setLineNumbersState(nextValue)
    persistConfiguredEditorSetting(EDITOR_LINE_NUMBERS_CONFIG_KEY, parseEditorLineNumbers, nextValue)
  }, [])

  const setSmoothScrolling = useCallback((value: boolean) => {
    const nextValue = parseEditorSmoothScrolling(value)
    setSmoothScrollingState(nextValue)
    persistConfiguredEditorSetting(EDITOR_SMOOTH_SCROLLING_CONFIG_KEY, parseEditorSmoothScrolling, nextValue)
  }, [])

  const setScrollBeyondLastLine = useCallback((value: boolean) => {
    const nextValue = parseEditorScrollBeyondLastLine(value)
    setScrollBeyondLastLineState(nextValue)
    persistConfiguredEditorSetting(
      EDITOR_SCROLL_BEYOND_LAST_LINE_CONFIG_KEY,
      parseEditorScrollBeyondLastLine,
      nextValue,
    )
  }, [])

  const setFoldingStrategy = useCallback((value: EditorFoldingStrategy) => {
    const nextValue = parseEditorFoldingStrategy(value)
    setFoldingStrategyState(nextValue)
    persistConfiguredEditorSetting(EDITOR_FOLDING_STRATEGY_CONFIG_KEY, parseEditorFoldingStrategy, nextValue)
  }, [])

  const setMinimapEnabled = useCallback((value: boolean) => {
    const nextValue = parseEditorMinimapEnabled(value)
    setMinimapEnabledState(nextValue)
    persistConfiguredEditorSetting(EDITOR_MINIMAP_ENABLED_CONFIG_KEY, parseEditorMinimapEnabled, nextValue)
  }, [])

  const setGlyphMargin = useCallback((value: boolean) => {
    const nextValue = parseEditorGlyphMargin(value)
    setGlyphMarginState(nextValue)
    persistConfiguredEditorSetting(EDITOR_GLYPH_MARGIN_CONFIG_KEY, parseEditorGlyphMargin, nextValue)
  }, [])

  const setBracketPairGuides = useCallback((value: boolean) => {
    const nextValue = parseEditorBracketPairGuides(value)
    setBracketPairGuidesState(nextValue)
    persistConfiguredEditorSetting(EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY, parseEditorBracketPairGuides, nextValue)
  }, [])

  const setIndentGuides = useCallback((value: boolean) => {
    const nextValue = parseEditorIndentGuides(value)
    setIndentGuidesState(nextValue)
    persistConfiguredEditorSetting(EDITOR_INDENT_GUIDES_CONFIG_KEY, parseEditorIndentGuides, nextValue)
  }, [])

  useEffect(() => {
    if (parseEditorCursorBlinking(window.electronAPI?.config.get(EDITOR_CURSOR_BLINKING_CONFIG_KEY)) !== cursorBlinking) {
      persistConfiguredEditorSetting(EDITOR_CURSOR_BLINKING_CONFIG_KEY, parseEditorCursorBlinking, cursorBlinking)
    }

    if (parseEditorBracketPairGuides(window.electronAPI?.config.get(EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY)) !== bracketPairGuides) {
      persistConfiguredEditorSetting(EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY, parseEditorBracketPairGuides, bracketPairGuides)
    }

    if (parseEditorFontFamily(window.electronAPI?.config.get(EDITOR_FONT_FAMILY_CONFIG_KEY)) !== fontFamily) {
      persistConfiguredEditorSetting(EDITOR_FONT_FAMILY_CONFIG_KEY, parseEditorFontFamily, fontFamily)
    }

    if (parseEditorFontLigatures(window.electronAPI?.config.get(EDITOR_FONT_LIGATURES_CONFIG_KEY)) !== fontLigatures) {
      persistConfiguredEditorSetting(EDITOR_FONT_LIGATURES_CONFIG_KEY, parseEditorFontLigatures, fontLigatures)
    }

    if (parseEditorFontSize(window.electronAPI?.config.get(EDITOR_FONT_SIZE_CONFIG_KEY)) !== fontSize) {
      persistConfiguredEditorSetting(EDITOR_FONT_SIZE_CONFIG_KEY, parseEditorFontSize, fontSize)
    }

    if (parseEditorFoldingStrategy(window.electronAPI?.config.get(EDITOR_FOLDING_STRATEGY_CONFIG_KEY)) !== foldingStrategy) {
      persistConfiguredEditorSetting(EDITOR_FOLDING_STRATEGY_CONFIG_KEY, parseEditorFoldingStrategy, foldingStrategy)
    }

    if (parseEditorGlyphMargin(window.electronAPI?.config.get(EDITOR_GLYPH_MARGIN_CONFIG_KEY)) !== glyphMargin) {
      persistConfiguredEditorSetting(EDITOR_GLYPH_MARGIN_CONFIG_KEY, parseEditorGlyphMargin, glyphMargin)
    }

    if (parseEditorIndentGuides(window.electronAPI?.config.get(EDITOR_INDENT_GUIDES_CONFIG_KEY)) !== indentGuides) {
      persistConfiguredEditorSetting(EDITOR_INDENT_GUIDES_CONFIG_KEY, parseEditorIndentGuides, indentGuides)
    }

    if (parseEditorLineNumbers(window.electronAPI?.config.get(EDITOR_LINE_NUMBERS_CONFIG_KEY)) !== lineNumbers) {
      persistConfiguredEditorSetting(EDITOR_LINE_NUMBERS_CONFIG_KEY, parseEditorLineNumbers, lineNumbers)
    }

    if (parseEditorMinimapEnabled(window.electronAPI?.config.get(EDITOR_MINIMAP_ENABLED_CONFIG_KEY)) !== minimapEnabled) {
      persistConfiguredEditorSetting(EDITOR_MINIMAP_ENABLED_CONFIG_KEY, parseEditorMinimapEnabled, minimapEnabled)
    }

    if (
      parseEditorRenderControlCharacters(window.electronAPI?.config.get(EDITOR_RENDER_CONTROL_CHARACTERS_CONFIG_KEY))
      !== renderControlCharacters
    ) {
      persistConfiguredEditorSetting(
        EDITOR_RENDER_CONTROL_CHARACTERS_CONFIG_KEY,
        parseEditorRenderControlCharacters,
        renderControlCharacters,
      )
    }

    if (parseEditorRenderWhitespace(window.electronAPI?.config.get(EDITOR_RENDER_WHITESPACE_CONFIG_KEY)) !== renderWhitespace) {
      persistConfiguredEditorSetting(EDITOR_RENDER_WHITESPACE_CONFIG_KEY, parseEditorRenderWhitespace, renderWhitespace)
    }

    if (
      parseEditorScrollBeyondLastLine(window.electronAPI?.config.get(EDITOR_SCROLL_BEYOND_LAST_LINE_CONFIG_KEY))
      !== scrollBeyondLastLine
    ) {
      persistConfiguredEditorSetting(
        EDITOR_SCROLL_BEYOND_LAST_LINE_CONFIG_KEY,
        parseEditorScrollBeyondLastLine,
        scrollBeyondLastLine,
      )
    }

    if (parseEditorSmoothScrolling(window.electronAPI?.config.get(EDITOR_SMOOTH_SCROLLING_CONFIG_KEY)) !== smoothScrolling) {
      persistConfiguredEditorSetting(EDITOR_SMOOTH_SCROLLING_CONFIG_KEY, parseEditorSmoothScrolling, smoothScrolling)
    }

    if (parseEditorTabSize(window.electronAPI?.config.get(EDITOR_TAB_SIZE_CONFIG_KEY)) !== tabSize) {
      persistConfiguredEditorSetting(EDITOR_TAB_SIZE_CONFIG_KEY, parseEditorTabSize, tabSize)
    }

    if (parseEditorTheme(window.electronAPI?.config.get(EDITOR_THEME_CONFIG_KEY)) !== theme) {
      persistConfiguredEditorSetting(EDITOR_THEME_CONFIG_KEY, parseEditorTheme, theme)
    }

    if (parseEditorWordWrap(window.electronAPI?.config.get(EDITOR_WORD_WRAP_CONFIG_KEY)) !== wordWrap) {
      persistConfiguredEditorSetting(EDITOR_WORD_WRAP_CONFIG_KEY, parseEditorWordWrap, wordWrap)
    }
  }, [
    cursorBlinking,
    bracketPairGuides,
    fontFamily,
    fontLigatures,
    fontSize,
    foldingStrategy,
    glyphMargin,
    indentGuides,
    lineNumbers,
    minimapEnabled,
    renderControlCharacters,
    renderWhitespace,
    scrollBeyondLastLine,
    smoothScrolling,
    tabSize,
    theme,
    wordWrap,
  ])

  useEffect(() => {
    void ensureEditorFontFamilyLoaded(fontFamily)
  }, [fontFamily])

  const value: EditorSettingsContextValue = {
    cursorBlinking,
    bracketPairGuides,
    fontFamily,
    fontLigatures,
    fontSize,
    foldingStrategy,
    glyphMargin,
    indentGuides,
    lineNumbers,
    minimapEnabled,
    renderControlCharacters,
    renderWhitespace,
    scrollBeyondLastLine,
    smoothScrolling,
    tabSize,
    setCursorBlinking,
    setBracketPairGuides,
    setFontFamily,
    setFontLigatures,
    setFontSize,
    setFoldingStrategy,
    setGlyphMargin,
    setIndentGuides,
    setLineNumbers,
    setMinimapEnabled,
    setRenderControlCharacters,
    setRenderWhitespace,
    setScrollBeyondLastLine,
    setSmoothScrolling,
    setTabSize,
    setTheme,
    setWordWrap,
    theme,
    wordWrap,
  }

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