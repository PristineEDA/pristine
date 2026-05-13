import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getAppliedColorThemeVariables } from '../theme/colorThemeCss'
import { getColorThemePreview } from '../theme/colorThemePreview'
import {
  buildAvailableColorThemeOptions,
  buildResolvedThemeLookup,
  BUILT_IN_DARK_COLOR_THEME_ID,
  BUILT_IN_LIGHT_COLOR_THEME_ID,
  createImportedColorThemeRecord,
  DEFAULT_COLOR_THEME_ID,
  getBuiltInColorTheme,
  getDefaultColorThemeId,
  parseConfiguredColorThemeId,
  parseImportedColorThemeRecords,
  resolveImportedColorTheme,
  WORKBENCH_COLOR_THEME_CONFIG_KEY,
  WORKBENCH_COLOR_THEME_KIND_CONFIG_KEY,
  WORKBENCH_FLOATING_INFO_BACKGROUND_COLOR_CONFIG_KEY,
  WORKBENCH_IMPORTED_THEMES_CONFIG_KEY,
  WORKBENCH_SPLASH_BACKGROUND_COLOR_CONFIG_KEY,
  WORKBENCH_STARTUP_BACKGROUND_COLOR_CONFIG_KEY,
} from '../theme/colorThemeRegistry'
import type {
  ColorThemeOption,
  ColorThemePreviewPalette,
  ImportedColorThemeRecord,
  ResolvedColorTheme,
  ThemeKind,
} from '../theme/colorThemeTypes'

export type Theme = ThemeKind

interface ThemeContextValue {
  theme: Theme
  themeId: string
  activeTheme: ResolvedColorTheme
  availableThemes: ColorThemeOption[]
  importedThemes: ImportedColorThemeRecord[]
  isImportingTheme: boolean
  getThemePreview: (themeId: string) => ColorThemePreviewPalette
  importTheme: () => Promise<ColorThemeOption | null>
  setTheme: (theme: Theme | string) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

interface ThemeProviderInitialConfig {
  importedThemes: ImportedColorThemeRecord[]
  themeId: string
}

function areImportedThemeRecordsEqual(
  left: readonly ImportedColorThemeRecord[],
  right: readonly ImportedColorThemeRecord[],
): boolean {
  if (left === right) {
    return true
  }

  if (left.length !== right.length) {
    return false
  }

  return left.every((theme, index) => {
    const nextTheme = right[index]

    if (!nextTheme) {
      return false
    }

    return theme.id === nextTheme.id
      && theme.label === nextTheme.label
      && theme.path === nextTheme.path
      && theme.description === nextTheme.description
      && theme.author === nextTheme.author
      && theme.kind === nextTheme.kind
  })
}

function getConfiguredImportedThemes(): ImportedColorThemeRecord[] {
  try {
    return parseImportedColorThemeRecords(window.electronAPI?.config.get(WORKBENCH_IMPORTED_THEMES_CONFIG_KEY))
  } catch {
    return []
  }
}

function getConfiguredThemeId(importedThemes: readonly ImportedColorThemeRecord[]): string {
  try {
    return parseConfiguredColorThemeId(window.electronAPI?.config.get(WORKBENCH_COLOR_THEME_CONFIG_KEY), importedThemes)
  } catch {
    return DEFAULT_COLOR_THEME_ID
  }
}

function getInitialThemeProviderConfig(): ThemeProviderInitialConfig {
  const importedThemes = getConfiguredImportedThemes()

  return {
    importedThemes,
    themeId: getConfiguredThemeId(importedThemes),
  }
}

function resolveThemeIdSelection(value: Theme | string, importedThemes: readonly ImportedColorThemeRecord[]): string {
  if (value === 'light' || value === BUILT_IN_LIGHT_COLOR_THEME_ID) {
    return BUILT_IN_LIGHT_COLOR_THEME_ID
  }

  if (value === 'dark' || value === BUILT_IN_DARK_COLOR_THEME_ID) {
    return BUILT_IN_DARK_COLOR_THEME_ID
  }

  return parseConfiguredColorThemeId(value, importedThemes)
}

function getFallbackTheme(themeId: string, importedThemes: readonly ImportedColorThemeRecord[]): ResolvedColorTheme {
  const builtInTheme = getBuiltInColorTheme(themeId)

  if (builtInTheme) {
    return builtInTheme
  }

  const importedTheme = importedThemes.find((theme) => theme.id === themeId)

  if (importedTheme) {
    return getBuiltInColorTheme(getDefaultColorThemeId(importedTheme.kind)) ?? getBuiltInColorTheme(DEFAULT_COLOR_THEME_ID)!
  }

  return getBuiltInColorTheme(DEFAULT_COLOR_THEME_ID)!
}

async function readThemeFileAbsolute(filePath: string): Promise<string> {
  const contents = await window.electronAPI?.fs.readFileAbsolute(filePath, 'utf-8')

  if (typeof contents !== 'string') {
    throw new Error(`Unable to read color theme file '${filePath}'.`)
  }

  return contents
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initialConfigRef = useRef<ThemeProviderInitialConfig | null>(null)
  if (!initialConfigRef.current) {
    initialConfigRef.current = getInitialThemeProviderConfig()
  }

  const [importedThemes, setImportedThemesState] = useState<ImportedColorThemeRecord[]>(
    () => initialConfigRef.current!.importedThemes,
  )
  const [themeId, setThemeIdState] = useState(() => initialConfigRef.current!.themeId)
  const [resolvedImportedThemes, setResolvedImportedThemes] = useState<Record<string, ResolvedColorTheme>>({})
  const [isImportingTheme, setIsImportingTheme] = useState(false)
  const importedThemesRef = useRef(importedThemes)

  const setImportedThemes = useCallback((nextValue: ImportedColorThemeRecord[] | ((currentThemes: ImportedColorThemeRecord[]) => ImportedColorThemeRecord[])) => {
    setImportedThemesState((currentThemes) => {
      const nextThemes = typeof nextValue === 'function' ? nextValue(currentThemes) : nextValue

      if (areImportedThemeRecordsEqual(currentThemes, nextThemes)) {
        importedThemesRef.current = currentThemes
        return currentThemes
      }

      importedThemesRef.current = nextThemes
      return nextThemes
    })
  }, [])

  const setThemeId = useCallback((nextValue: string | ((currentThemeId: string) => string)) => {
    setThemeIdState((currentThemeId) => {
      const nextThemeId = typeof nextValue === 'function' ? nextValue(currentThemeId) : nextValue

      if (Object.is(currentThemeId, nextThemeId)) {
        return currentThemeId
      }

      return nextThemeId
    })
  }, [])

  const resolvedThemes = useMemo(
    () => buildResolvedThemeLookup(importedThemes, resolvedImportedThemes),
    [importedThemes, resolvedImportedThemes],
  )
  const activeTheme = useMemo(
    () => resolvedThemes[themeId] ?? getFallbackTheme(themeId, importedThemes),
    [importedThemes, resolvedThemes, themeId],
  )
  const activeThemeVariables = useMemo(() => getAppliedColorThemeVariables(activeTheme), [activeTheme])
  const availableThemes = useMemo(() => buildAvailableColorThemeOptions(importedThemes), [importedThemes])

  const persistConfiguredThemeId = useCallback((nextThemeId: string) => {
    try {
      void window.electronAPI?.config.set(WORKBENCH_COLOR_THEME_CONFIG_KEY, nextThemeId)
    } catch {
      /* ignore */
    }
  }, [])

  const persistImportedThemes = useCallback((nextImportedThemes: ImportedColorThemeRecord[]) => {
    try {
      void window.electronAPI?.config.set(WORKBENCH_IMPORTED_THEMES_CONFIG_KEY, nextImportedThemes)
    } catch {
      /* ignore */
    }
  }, [])

  const applyTheme = useCallback((nextTheme: ResolvedColorTheme, variables: Record<string, string>) => {
    const root = document.documentElement

    root.classList.toggle('dark', nextTheme.kind === 'dark')
    if (root.style.colorScheme !== nextTheme.kind) {
      root.style.colorScheme = nextTheme.kind
    }
    if (root.dataset['colorThemeId'] !== nextTheme.id) {
      root.dataset['colorThemeId'] = nextTheme.id
    }

    for (const [name, value] of Object.entries(variables)) {
      if (root.style.getPropertyValue(name) !== value) {
        root.style.setProperty(name, value)
      }
    }

    try {
      void window.electronAPI?.config.set(WORKBENCH_COLOR_THEME_KIND_CONFIG_KEY, nextTheme.kind)
      void window.electronAPI?.config.set(WORKBENCH_STARTUP_BACKGROUND_COLOR_CONFIG_KEY, variables['--background'] ?? nextTheme.colors['editor.background'] ?? '#121314')
      void window.electronAPI?.config.set(WORKBENCH_SPLASH_BACKGROUND_COLOR_CONFIG_KEY, variables['--ide-bg'] ?? variables['--background'] ?? '#121314')
      void window.electronAPI?.config.set(WORKBENCH_FLOATING_INFO_BACKGROUND_COLOR_CONFIG_KEY, variables['--background'] ?? nextTheme.colors['editor.background'] ?? '#121314')
    } catch {
      /* ignore */
    }
  }, [])

  const setTheme = useCallback((nextTheme: Theme | string) => {
    setThemeId(resolveThemeIdSelection(nextTheme, importedThemes))
  }, [importedThemes, setThemeId])

  const toggleTheme = useCallback(() => {
    setThemeId(activeTheme.kind === 'dark' ? BUILT_IN_LIGHT_COLOR_THEME_ID : BUILT_IN_DARK_COLOR_THEME_ID)
  }, [activeTheme.kind, setThemeId])

  const importTheme = useCallback(async (): Promise<ColorThemeOption | null> => {
    if (!window.electronAPI?.dialog.showOpenThemeDialog) {
      return null
    }

    setIsImportingTheme(true)

    try {
      const result = await window.electronAPI.dialog.showOpenThemeDialog()
      if (result.canceled || !result.filePath) {
        return null
      }

      const { theme: importedTheme, resolvedTheme } = await createImportedColorThemeRecord(result.filePath, readThemeFileAbsolute)
      const nextImportedThemes = [
        ...importedThemes.filter((theme) => theme.id !== importedTheme.id && theme.path !== importedTheme.path),
        importedTheme,
      ]

      setImportedThemes(nextImportedThemes)
      if (!areImportedThemeRecordsEqual(importedThemes, nextImportedThemes)) {
        persistImportedThemes(nextImportedThemes)
      }
      setResolvedImportedThemes((currentThemes) => ({
        ...currentThemes,
        [resolvedTheme.id]: resolvedTheme,
      }))
      setThemeId(importedTheme.id)

      return {
        value: importedTheme.id,
        label: importedTheme.label,
        description: importedTheme.description,
        author: importedTheme.author,
        kind: importedTheme.kind,
        source: 'imported',
      }
    } catch {
      return null
    } finally {
      setIsImportingTheme(false)
    }
  }, [importedThemes, persistImportedThemes, setImportedThemes, setThemeId])

  const getThemePreview = useCallback((requestedThemeId: string): ColorThemePreviewPalette => {
    const requestedTheme = resolvedThemes[requestedThemeId] ?? getFallbackTheme(requestedThemeId, importedThemes)
    return getColorThemePreview(requestedTheme)
  }, [importedThemes, resolvedThemes])

  useEffect(() => {
    importedThemesRef.current = importedThemes
  }, [importedThemes])

  useEffect(() => {
    applyTheme(activeTheme, activeThemeVariables)
    persistConfiguredThemeId(themeId)
  }, [activeTheme, activeThemeVariables, applyTheme, persistConfiguredThemeId, themeId])

  useEffect(() => {
    let cancelled = false

    if (importedThemes.length === 0) {
      setResolvedImportedThemes((currentThemes) => (
        Object.keys(currentThemes).length === 0 ? currentThemes : {}
      ))
      return () => {
        cancelled = true
      }
    }

    void Promise.all(importedThemes.map(async (theme) => {
      try {
        return {
          theme,
          resolvedTheme: await resolveImportedColorTheme(theme, readThemeFileAbsolute),
        }
      } catch {
        return null
      }
    })).then((resolvedThemesSnapshot) => {
      if (cancelled) {
        return
      }

      const validThemes = resolvedThemesSnapshot.flatMap((entry) => entry ? [entry] : [])
      const nextResolvedThemes = Object.fromEntries(
        validThemes.map((entry) => [entry.theme.id, entry.resolvedTheme]),
      ) as Record<string, ResolvedColorTheme>

      setResolvedImportedThemes((currentThemes) => {
        const currentKeys = Object.keys(currentThemes)
        const nextKeys = Object.keys(nextResolvedThemes)

        if (
          currentKeys.length === nextKeys.length
          && nextKeys.every((key) => currentThemes[key] === nextResolvedThemes[key])
        ) {
          return currentThemes
        }

        return nextResolvedThemes
      })

      if (validThemes.length !== importedThemes.length) {
        const nextImportedThemes = validThemes.map((entry) => entry.theme)
        setImportedThemes(nextImportedThemes)
        persistImportedThemes(nextImportedThemes)
      }

      setThemeId((currentThemeId) => parseConfiguredColorThemeId(currentThemeId, validThemes.map((entry) => entry.theme)))
    })

    return () => {
      cancelled = true
    }
  }, [importedThemes, persistImportedThemes, setImportedThemes, setThemeId])

  useEffect(() => {
    const dispose = window.electronAPI?.config.onDidChange?.((key, value) => {
      if (key === WORKBENCH_IMPORTED_THEMES_CONFIG_KEY) {
        const nextImportedThemes = parseImportedColorThemeRecords(value)
        setImportedThemes(nextImportedThemes)
        setThemeId((currentThemeId) => parseConfiguredColorThemeId(currentThemeId, nextImportedThemes))
        return
      }

      if (key !== WORKBENCH_COLOR_THEME_CONFIG_KEY) {
        return
      }

      setThemeId(parseConfiguredColorThemeId(value, importedThemesRef.current))
    })

    return () => {
      dispose?.()
    }
  }, [setImportedThemes, setThemeId])

  const contextValue = useMemo<ThemeContextValue>(() => ({
    theme: activeTheme.kind,
    themeId,
    activeTheme,
    availableThemes,
    importedThemes,
    isImportingTheme,
    getThemePreview,
    importTheme,
    setTheme,
    toggleTheme,
  }), [
    activeTheme,
    availableThemes,
    getThemePreview,
    importTheme,
    importedThemes,
    isImportingTheme,
    setTheme,
    themeId,
    toggleTheme,
  ])

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
