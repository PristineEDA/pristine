import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  DEFAULT_EDITOR_FONT_SIZE,
  EDITOR_FONT_SIZE_CONFIG_KEY,
  EDITOR_THEME_CONFIG_KEY,
  type EditorThemeId,
  editorThemeOptions,
  parseEditorFontSize,
  parseEditorTheme,
} from '../editor/editorSettings'

interface EditorSettingsContextValue {
  fontSize: number
  setFontSize: (fontSize: number) => void
  setTheme: (theme: EditorThemeId) => void
  theme: EditorThemeId
  themes: typeof editorThemeOptions
}

const EditorSettingsContext = createContext<EditorSettingsContextValue | null>(null)

function getConfiguredEditorFontSize(): number {
  try {
    return parseEditorFontSize(window.electronAPI?.config.get(EDITOR_FONT_SIZE_CONFIG_KEY))
  } catch {
    return DEFAULT_EDITOR_FONT_SIZE
  }
}

function getConfiguredEditorTheme(): EditorThemeId {
  try {
    return parseEditorTheme(window.electronAPI?.config.get(EDITOR_THEME_CONFIG_KEY))
  } catch {
    return 'dracula'
  }
}

export function EditorSettingsProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<number>(getConfiguredEditorFontSize)
  const [theme, setThemeState] = useState<EditorThemeId>(getConfiguredEditorTheme)

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

  const setTheme = useCallback((value: EditorThemeId) => {
    const nextValue = parseEditorTheme(value)
    setThemeState(nextValue)
    persistTheme(nextValue)
  }, [persistTheme])

  useEffect(() => {
    if (parseEditorFontSize(window.electronAPI?.config.get(EDITOR_FONT_SIZE_CONFIG_KEY)) !== fontSize) {
      persistFontSize(fontSize)
    }

    if (parseEditorTheme(window.electronAPI?.config.get(EDITOR_THEME_CONFIG_KEY)) !== theme) {
      persistTheme(theme)
    }
  }, [fontSize, persistFontSize, persistTheme, theme])

  return (
    <EditorSettingsContext.Provider value={{ fontSize, setFontSize, setTheme, theme, themes: editorThemeOptions }}>
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