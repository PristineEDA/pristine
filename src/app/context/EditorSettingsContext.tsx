import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  DEFAULT_EDITOR_BRACKET_PAIR_GUIDES,
  DEFAULT_EDITOR_FONT_FAMILY,
  DEFAULT_EDITOR_FONT_SIZE,
  DEFAULT_EDITOR_GLYPH_MARGIN,
  DEFAULT_EDITOR_INDENT_GUIDES,
  DEFAULT_EDITOR_LINE_NUMBERS,
  DEFAULT_EDITOR_MINIMAP_ENABLED,
  DEFAULT_EDITOR_RENDER_CONTROL_CHARACTERS,
  DEFAULT_EDITOR_RENDER_WHITESPACE,
  DEFAULT_EDITOR_THEME,
  DEFAULT_EDITOR_WORD_WRAP,
  EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY,
  EDITOR_FONT_FAMILY_CONFIG_KEY,
  EDITOR_FONT_SIZE_CONFIG_KEY,
  EDITOR_GLYPH_MARGIN_CONFIG_KEY,
  EDITOR_INDENT_GUIDES_CONFIG_KEY,
  EDITOR_LINE_NUMBERS_CONFIG_KEY,
  EDITOR_MINIMAP_ENABLED_CONFIG_KEY,
  EDITOR_RENDER_CONTROL_CHARACTERS_CONFIG_KEY,
  EDITOR_RENDER_WHITESPACE_CONFIG_KEY,
  EDITOR_THEME_CONFIG_KEY,
  EDITOR_WORD_WRAP_CONFIG_KEY,
  type EditorFontFamilyId,
  type EditorLineNumbersMode,
  type EditorRenderWhitespaceMode,
  type EditorThemeId,
  type EditorWordWrapMode,
  parseEditorBracketPairGuides,
  parseEditorFontFamily,
  parseEditorFontSize,
  parseEditorGlyphMargin,
  parseEditorIndentGuides,
  parseEditorLineNumbers,
  parseEditorMinimapEnabled,
  parseEditorRenderControlCharacters,
  parseEditorRenderWhitespace,
  parseEditorTheme,
  parseEditorWordWrap,
} from '../editor/editorSettings'
import { ensureEditorFontFamilyLoaded } from '../editor/fontLoader'

interface EditorSettingsContextValue {
  bracketPairGuides: boolean
  fontFamily: EditorFontFamilyId
  fontSize: number
  glyphMargin: boolean
  indentGuides: boolean
  lineNumbers: EditorLineNumbersMode
  minimapEnabled: boolean
  renderControlCharacters: boolean
  renderWhitespace: EditorRenderWhitespaceMode
  setBracketPairGuides: (enabled: boolean) => void
  setFontFamily: (fontFamily: EditorFontFamilyId) => void
  setFontSize: (fontSize: number) => void
  setGlyphMargin: (enabled: boolean) => void
  setIndentGuides: (enabled: boolean) => void
  setLineNumbers: (lineNumbers: EditorLineNumbersMode) => void
  setMinimapEnabled: (enabled: boolean) => void
  setRenderControlCharacters: (enabled: boolean) => void
  setRenderWhitespace: (renderWhitespace: EditorRenderWhitespaceMode) => void
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
  const [bracketPairGuides, setBracketPairGuidesState] = useState<boolean>(getConfiguredEditorBracketPairGuides)
  const [fontFamily, setFontFamilyState] = useState<EditorFontFamilyId>(getConfiguredEditorFontFamily)
  const [fontSize, setFontSizeState] = useState<number>(getConfiguredEditorFontSize)
  const [glyphMargin, setGlyphMarginState] = useState<boolean>(getConfiguredEditorGlyphMargin)
  const [indentGuides, setIndentGuidesState] = useState<boolean>(getConfiguredEditorIndentGuides)
  const [lineNumbers, setLineNumbersState] = useState<EditorLineNumbersMode>(getConfiguredEditorLineNumbers)
  const [minimapEnabled, setMinimapEnabledState] = useState<boolean>(getConfiguredEditorMinimapEnabled)
  const [renderControlCharacters, setRenderControlCharactersState] = useState<boolean>(getConfiguredEditorRenderControlCharacters)
  const [renderWhitespace, setRenderWhitespaceState] = useState<EditorRenderWhitespaceMode>(getConfiguredEditorRenderWhitespace)
  const [theme, setThemeState] = useState<EditorThemeId>(getConfiguredEditorTheme)
  const [wordWrap, setWordWrapState] = useState<EditorWordWrapMode>(getConfiguredEditorWordWrap)

  const persistFontFamily = useCallback((value: EditorFontFamilyId) => {
    try {
      void window.electronAPI?.config.set(EDITOR_FONT_FAMILY_CONFIG_KEY, parseEditorFontFamily(value))
    } catch {
      /* ignore */
    }
  }, [])

  const persistFontSize = useCallback((value: number) => {
    try {
      void window.electronAPI?.config.set(EDITOR_FONT_SIZE_CONFIG_KEY, parseEditorFontSize(value))
    } catch {
      /* ignore */
    }
  }, [])

  const persistTheme = useCallback((value: EditorThemeId) => {
    try {
      void window.electronAPI?.config.set(EDITOR_THEME_CONFIG_KEY, parseEditorTheme(value))
    } catch {
      /* ignore */
    }
  }, [])

  const persistWordWrap = useCallback((value: EditorWordWrapMode) => {
    try {
      void window.electronAPI?.config.set(EDITOR_WORD_WRAP_CONFIG_KEY, parseEditorWordWrap(value))
    } catch {
      /* ignore */
    }
  }, [])

  const persistRenderWhitespace = useCallback((value: EditorRenderWhitespaceMode) => {
    try {
      void window.electronAPI?.config.set(EDITOR_RENDER_WHITESPACE_CONFIG_KEY, parseEditorRenderWhitespace(value))
    } catch {
      /* ignore */
    }
  }, [])

  const persistRenderControlCharacters = useCallback((value: boolean) => {
    try {
      void window.electronAPI?.config.set(
        EDITOR_RENDER_CONTROL_CHARACTERS_CONFIG_KEY,
        parseEditorRenderControlCharacters(value),
      )
    } catch {
      /* ignore */
    }
  }, [])

  const persistLineNumbers = useCallback((value: EditorLineNumbersMode) => {
    try {
      void window.electronAPI?.config.set(EDITOR_LINE_NUMBERS_CONFIG_KEY, parseEditorLineNumbers(value))
    } catch {
      /* ignore */
    }
  }, [])

  const persistMinimapEnabled = useCallback((value: boolean) => {
    try {
      void window.electronAPI?.config.set(EDITOR_MINIMAP_ENABLED_CONFIG_KEY, parseEditorMinimapEnabled(value))
    } catch {
      /* ignore */
    }
  }, [])

  const persistGlyphMargin = useCallback((value: boolean) => {
    try {
      void window.electronAPI?.config.set(EDITOR_GLYPH_MARGIN_CONFIG_KEY, parseEditorGlyphMargin(value))
    } catch {
      /* ignore */
    }
  }, [])

  const persistBracketPairGuides = useCallback((value: boolean) => {
    try {
      void window.electronAPI?.config.set(EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY, parseEditorBracketPairGuides(value))
    } catch {
      /* ignore */
    }
  }, [])

  const persistIndentGuides = useCallback((value: boolean) => {
    try {
      void window.electronAPI?.config.set(EDITOR_INDENT_GUIDES_CONFIG_KEY, parseEditorIndentGuides(value))
    } catch {
      /* ignore */
    }
  }, [])

  const setFontSize = useCallback((value: number) => {
    const nextValue = parseEditorFontSize(value)
    setFontSizeState(nextValue)
    persistFontSize(nextValue)
  }, [persistFontSize])

  const setFontFamily = useCallback((value: EditorFontFamilyId) => {
    const nextValue = parseEditorFontFamily(value)
    setFontFamilyState(nextValue)
    persistFontFamily(nextValue)
  }, [persistFontFamily])

  const setTheme = useCallback((value: EditorThemeId) => {
    const nextValue = parseEditorTheme(value)
    setThemeState(nextValue)
    persistTheme(nextValue)
  }, [persistTheme])

  const setWordWrap = useCallback((value: EditorWordWrapMode) => {
    const nextValue = parseEditorWordWrap(value)
    setWordWrapState(nextValue)
    persistWordWrap(nextValue)
  }, [persistWordWrap])

  const setRenderWhitespace = useCallback((value: EditorRenderWhitespaceMode) => {
    const nextValue = parseEditorRenderWhitespace(value)
    setRenderWhitespaceState(nextValue)
    persistRenderWhitespace(nextValue)
  }, [persistRenderWhitespace])

  const setRenderControlCharacters = useCallback((value: boolean) => {
    const nextValue = parseEditorRenderControlCharacters(value)
    setRenderControlCharactersState(nextValue)
    persistRenderControlCharacters(nextValue)
  }, [persistRenderControlCharacters])

  const setLineNumbers = useCallback((value: EditorLineNumbersMode) => {
    const nextValue = parseEditorLineNumbers(value)
    setLineNumbersState(nextValue)
    persistLineNumbers(nextValue)
  }, [persistLineNumbers])

  const setMinimapEnabled = useCallback((value: boolean) => {
    const nextValue = parseEditorMinimapEnabled(value)
    setMinimapEnabledState(nextValue)
    persistMinimapEnabled(nextValue)
  }, [persistMinimapEnabled])

  const setGlyphMargin = useCallback((value: boolean) => {
    const nextValue = parseEditorGlyphMargin(value)
    setGlyphMarginState(nextValue)
    persistGlyphMargin(nextValue)
  }, [persistGlyphMargin])

  const setBracketPairGuides = useCallback((value: boolean) => {
    const nextValue = parseEditorBracketPairGuides(value)
    setBracketPairGuidesState(nextValue)
    persistBracketPairGuides(nextValue)
  }, [persistBracketPairGuides])

  const setIndentGuides = useCallback((value: boolean) => {
    const nextValue = parseEditorIndentGuides(value)
    setIndentGuidesState(nextValue)
    persistIndentGuides(nextValue)
  }, [persistIndentGuides])

  useEffect(() => {
    if (parseEditorBracketPairGuides(window.electronAPI?.config.get(EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY)) !== bracketPairGuides) {
      persistBracketPairGuides(bracketPairGuides)
    }

    if (parseEditorFontFamily(window.electronAPI?.config.get(EDITOR_FONT_FAMILY_CONFIG_KEY)) !== fontFamily) {
      persistFontFamily(fontFamily)
    }

    if (parseEditorFontSize(window.electronAPI?.config.get(EDITOR_FONT_SIZE_CONFIG_KEY)) !== fontSize) {
      persistFontSize(fontSize)
    }

    if (parseEditorGlyphMargin(window.electronAPI?.config.get(EDITOR_GLYPH_MARGIN_CONFIG_KEY)) !== glyphMargin) {
      persistGlyphMargin(glyphMargin)
    }

    if (parseEditorIndentGuides(window.electronAPI?.config.get(EDITOR_INDENT_GUIDES_CONFIG_KEY)) !== indentGuides) {
      persistIndentGuides(indentGuides)
    }

    if (parseEditorLineNumbers(window.electronAPI?.config.get(EDITOR_LINE_NUMBERS_CONFIG_KEY)) !== lineNumbers) {
      persistLineNumbers(lineNumbers)
    }

    if (parseEditorMinimapEnabled(window.electronAPI?.config.get(EDITOR_MINIMAP_ENABLED_CONFIG_KEY)) !== minimapEnabled) {
      persistMinimapEnabled(minimapEnabled)
    }

    if (
      parseEditorRenderControlCharacters(window.electronAPI?.config.get(EDITOR_RENDER_CONTROL_CHARACTERS_CONFIG_KEY))
      !== renderControlCharacters
    ) {
      persistRenderControlCharacters(renderControlCharacters)
    }

    if (parseEditorRenderWhitespace(window.electronAPI?.config.get(EDITOR_RENDER_WHITESPACE_CONFIG_KEY)) !== renderWhitespace) {
      persistRenderWhitespace(renderWhitespace)
    }

    if (parseEditorTheme(window.electronAPI?.config.get(EDITOR_THEME_CONFIG_KEY)) !== theme) {
      persistTheme(theme)
    }

    if (parseEditorWordWrap(window.electronAPI?.config.get(EDITOR_WORD_WRAP_CONFIG_KEY)) !== wordWrap) {
      persistWordWrap(wordWrap)
    }
  }, [
    bracketPairGuides,
    fontFamily,
    fontSize,
    glyphMargin,
    indentGuides,
    lineNumbers,
    minimapEnabled,
    persistBracketPairGuides,
    persistFontFamily,
    persistFontSize,
    persistGlyphMargin,
    persistIndentGuides,
    persistLineNumbers,
    persistMinimapEnabled,
    persistRenderControlCharacters,
    persistRenderWhitespace,
    persistTheme,
    persistWordWrap,
    renderControlCharacters,
    renderWhitespace,
    theme,
    wordWrap,
  ])

  useEffect(() => {
    void ensureEditorFontFamilyLoaded(fontFamily)
  }, [fontFamily])

  const value = {
    bracketPairGuides,
    fontFamily,
    fontSize,
    glyphMargin,
    indentGuides,
    lineNumbers,
    minimapEnabled,
    renderControlCharacters,
    renderWhitespace,
    setBracketPairGuides,
    setFontFamily,
    setFontSize,
    setGlyphMargin,
    setIndentGuides,
    setLineNumbers,
    setMinimapEnabled,
    setRenderControlCharacters,
    setRenderWhitespace,
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