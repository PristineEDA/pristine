import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  DEFAULT_EDITOR_FONT_FAMILY,
  DEFAULT_EDITOR_THEME,
  DEFAULT_EDITOR_FONT_SIZE,
  EDITOR_FONT_FAMILY_CONFIG_KEY,
  EDITOR_FONT_SIZE_CONFIG_KEY,
  EDITOR_THEME_CONFIG_KEY,
  type EditorFontFamilyId,
  type EditorThemeId,
  parseEditorFontFamily,
  parseEditorFontSize,
  parseEditorTheme,
} from '../editor/editorSettings'
import { ensureEditorFontFamilyLoaded } from '../editor/fontLoader'

interface EditorSettingsContextValue {
  fontFamily: EditorFontFamilyId
  fontSize: number
  setFontFamily: (fontFamily: EditorFontFamilyId) => void
  setFontSize: (fontSize: number) => void
  setTheme: (theme: EditorThemeId) => void
  theme: EditorThemeId
}

const EditorSettingsContext = createContext<EditorSettingsContextValue | null>(null)

function getConfiguredEditorFontSize(): number {
  try {
    return parseEditorFontSize(window.electronAPI?.config.get(EDITOR_FONT_SIZE_CONFIG_KEY))
  } catch {
    return DEFAULT_EDITOR_FONT_SIZE
  }
}

function getConfiguredEditorFontFamily(): EditorFontFamilyId {
  try {
    return parseEditorFontFamily(window.electronAPI?.config.get(EDITOR_FONT_FAMILY_CONFIG_KEY))
  } catch {
    return DEFAULT_EDITOR_FONT_FAMILY
  }
}

function getConfiguredEditorTheme(): EditorThemeId {
  try {
    return parseEditorTheme(window.electronAPI?.config.get(EDITOR_THEME_CONFIG_KEY))
  } catch {
    return DEFAULT_EDITOR_THEME
  }
}

export function EditorSettingsProvider({ children }: { children: ReactNode }) {
  const [fontFamily, setFontFamilyState] = useState<EditorFontFamilyId>(getConfiguredEditorFontFamily)
  const [fontSize, setFontSizeState] = useState<number>(getConfiguredEditorFontSize)
  const [theme, setThemeState] = useState<EditorThemeId>(getConfiguredEditorTheme)

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

  useEffect(() => {
    if (parseEditorFontFamily(window.electronAPI?.config.get(EDITOR_FONT_FAMILY_CONFIG_KEY)) !== fontFamily) {
      persistFontFamily(fontFamily)
    }

    if (parseEditorFontSize(window.electronAPI?.config.get(EDITOR_FONT_SIZE_CONFIG_KEY)) !== fontSize) {
      persistFontSize(fontSize)
    }

    if (parseEditorTheme(window.electronAPI?.config.get(EDITOR_THEME_CONFIG_KEY)) !== theme) {
      persistTheme(theme)
    }
  }, [fontFamily, fontSize, persistFontFamily, persistFontSize, persistTheme, theme])

  useEffect(() => {
    void ensureEditorFontFamilyLoaded(fontFamily)
  }, [fontFamily])

  const value = {
    fontFamily,
    fontSize,
    setFontFamily,
    setFontSize,
    setTheme,
    theme,
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