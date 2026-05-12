import theme2026DarkRaw from './vscode-defaults/2026-dark.json?raw'
import theme2026LightRaw from './vscode-defaults/2026-light.json?raw'
import darkModernRaw from './vscode-defaults/dark_modern.json?raw'
import lightModernRaw from './vscode-defaults/light_modern.json?raw'
import darkPlusRaw from './vscode-defaults/dark_plus.json?raw'
import lightPlusRaw from './vscode-defaults/light_plus.json?raw'
import darkVsRaw from './vscode-defaults/dark_vs.json?raw'
import lightVsRaw from './vscode-defaults/light_vs.json?raw'
import {
  getThemeBaseName,
  getThemeBaseNameWithoutExtension,
  mergeResolvedColorThemeData,
  resolveColorThemeData,
  resolveColorThemeDataSync,
} from './colorThemeLoader'
import type {
  ColorThemeOption,
  ImportedColorThemeRecord,
  ResolvedColorTheme,
  ThemeKind,
} from './colorThemeTypes'

export const WORKBENCH_COLOR_THEME_CONFIG_KEY = 'workbench.colorTheme'
export const WORKBENCH_IMPORTED_THEMES_CONFIG_KEY = 'workbench.importedColorThemes'
export const WORKBENCH_COLOR_THEME_KIND_CONFIG_KEY = 'workbench.colorThemeKind'
export const WORKBENCH_STARTUP_BACKGROUND_COLOR_CONFIG_KEY = 'workbench.startupBackgroundColor'
export const WORKBENCH_SPLASH_BACKGROUND_COLOR_CONFIG_KEY = 'workbench.splashBackgroundColor'
export const WORKBENCH_FLOATING_INFO_BACKGROUND_COLOR_CONFIG_KEY = 'workbench.floatingInfoBackgroundColor'

export const BUILT_IN_DARK_COLOR_THEME_ID = 'vscode-2026-dark'
export const BUILT_IN_LIGHT_COLOR_THEME_ID = 'vscode-2026-light'
export const DEFAULT_COLOR_THEME_ID = BUILT_IN_DARK_COLOR_THEME_ID

type BuiltInThemeDefinition = {
  id: string
  label: string
  description: string
  author: string
  entryPath: string
  kind: ThemeKind
}

const builtInThemeDefinitions: readonly BuiltInThemeDefinition[] = [
  {
    id: BUILT_IN_DARK_COLOR_THEME_ID,
    label: 'Dark 2026',
    description: 'Built-in VS Code 2026 dark color theme.',
    author: 'Microsoft',
    entryPath: '2026-dark.json',
    kind: 'dark',
  },
  {
    id: BUILT_IN_LIGHT_COLOR_THEME_ID,
    label: 'Light 2026',
    description: 'Built-in VS Code 2026 light color theme.',
    author: 'Microsoft',
    entryPath: '2026-light.json',
    kind: 'light',
  },
] as const

const builtInThemeFiles = new Map<string, string>([
  ['2026-dark.json', theme2026DarkRaw],
  ['2026-light.json', theme2026LightRaw],
  ['dark_modern.json', darkModernRaw],
  ['light_modern.json', lightModernRaw],
  ['dark_plus.json', darkPlusRaw],
  ['light_plus.json', lightPlusRaw],
  ['dark_vs.json', darkVsRaw],
  ['light_vs.json', lightVsRaw],
])

function hashString(value: string): string {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash.toString(16).padStart(8, '0')
}

function slugifyThemeLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'theme'
}

function loadBuiltInThemeFile(filePath: string): string {
  const fileContents = builtInThemeFiles.get(filePath)

  if (!fileContents) {
    throw new Error(`Missing built-in VS Code color theme asset '${filePath}'.`)
  }

  return fileContents
}

function createResolvedTheme(
  metadata: Omit<ResolvedColorTheme, 'colors' | 'tokenColors' | 'semanticHighlighting' | 'semanticTokenColors'>,
  colors: ResolvedColorTheme['colors'],
  tokenColors: ResolvedColorTheme['tokenColors'],
  semanticHighlighting: boolean,
  semanticTokenColors: ResolvedColorTheme['semanticTokenColors'],
): ResolvedColorTheme {
  return {
    ...metadata,
    colors,
    tokenColors,
    semanticHighlighting,
    semanticTokenColors,
  }
}

const builtInResolvedThemes = builtInThemeDefinitions.map((definition) => {
  const resolvedData = resolveColorThemeDataSync(definition.entryPath, loadBuiltInThemeFile)

  return createResolvedTheme(
    {
      id: definition.id,
      label: definition.label,
      description: definition.description,
      author: definition.author,
      kind: resolvedData.kind,
      source: 'builtin',
    },
    resolvedData.colors,
    resolvedData.tokenColors,
    resolvedData.semanticHighlighting,
    resolvedData.semanticTokenColors,
  )
})

const builtInResolvedThemesById = new Map<string, ResolvedColorTheme>(
  builtInResolvedThemes.map((theme) => [theme.id, theme]),
)

const builtInThemeOptions = builtInResolvedThemes.map<ColorThemeOption>((theme) => ({
  value: theme.id,
  label: theme.label,
  description: theme.description,
  author: theme.author,
  kind: theme.kind,
  source: 'builtin',
}))

export function getBuiltInColorTheme(themeId: string): ResolvedColorTheme | null {
  return builtInResolvedThemesById.get(themeId) ?? null
}

export function getBuiltInColorThemes(): readonly ResolvedColorTheme[] {
  return builtInResolvedThemes
}

export function getBuiltInColorThemeOptions(): readonly ColorThemeOption[] {
  return builtInThemeOptions
}

export function getDefaultColorThemeId(kind: ThemeKind): string {
  return kind === 'light' ? BUILT_IN_LIGHT_COLOR_THEME_ID : BUILT_IN_DARK_COLOR_THEME_ID
}

export function parseImportedColorThemeRecords(value: unknown): ImportedColorThemeRecord[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((entry): entry is ImportedColorThemeRecord => {
      return Boolean(entry)
        && typeof entry === 'object'
        && typeof entry.id === 'string'
        && typeof entry.label === 'string'
        && typeof entry.path === 'string'
        && typeof entry.description === 'string'
        && typeof entry.author === 'string'
        && (entry.kind === 'light' || entry.kind === 'dark')
    })
    .map((entry) => ({
      ...entry,
      path: entry.path.replace(/\\/g, '/'),
    }))
}

export function buildAvailableColorThemeOptions(importedThemes: readonly ImportedColorThemeRecord[]): ColorThemeOption[] {
  return [
    ...builtInThemeOptions,
    ...importedThemes.map<ColorThemeOption>((theme) => ({
      value: theme.id,
      label: theme.label,
      description: theme.description,
      author: theme.author,
      kind: theme.kind,
      source: 'imported',
    })),
  ]
}

export function parseConfiguredColorThemeId(
  value: unknown,
  importedThemes: readonly ImportedColorThemeRecord[],
): string {
  if (typeof value !== 'string') {
    return DEFAULT_COLOR_THEME_ID
  }

  if (builtInResolvedThemesById.has(value)) {
    return value
  }

  if (importedThemes.some((theme) => theme.id === value)) {
    return value
  }

  return DEFAULT_COLOR_THEME_ID
}

function getFallbackThemeForImportedTheme(theme: ImportedColorThemeRecord): ResolvedColorTheme {
  return getBuiltInColorTheme(getDefaultColorThemeId(theme.kind)) ?? builtInResolvedThemes[0]!
}

function mergeResolvedThemeWithBuiltInBase(theme: ResolvedColorTheme): ResolvedColorTheme {
  const baseTheme = getBuiltInColorTheme(getDefaultColorThemeId(theme.kind)) ?? builtInResolvedThemes[0]!
  const mergedTheme = mergeResolvedColorThemeData(baseTheme, theme)

  return createResolvedTheme(
    {
      id: theme.id,
      label: theme.label,
      description: theme.description,
      author: theme.author,
      kind: theme.kind,
      source: theme.source,
      path: theme.path,
    },
    mergedTheme.colors,
    mergedTheme.tokenColors,
    mergedTheme.semanticHighlighting,
    mergedTheme.semanticTokenColors,
  )
}

export async function resolveImportedColorTheme(
  theme: ImportedColorThemeRecord,
  readFileAbsolute: (filePath: string) => Promise<string>,
): Promise<ResolvedColorTheme> {
  const resolvedData = await resolveColorThemeData(theme.path, readFileAbsolute)

  return mergeResolvedThemeWithBuiltInBase(createResolvedTheme(
    {
      id: theme.id,
      label: theme.label,
      description: theme.description,
      author: theme.author,
      kind: resolvedData.kind,
      source: 'imported',
      path: theme.path,
    },
    resolvedData.colors,
    resolvedData.tokenColors,
    resolvedData.semanticHighlighting,
    resolvedData.semanticTokenColors,
  ))
}

export async function createImportedColorThemeRecord(
  filePath: string,
  readFileAbsolute: (filePath: string) => Promise<string>,
): Promise<{ theme: ImportedColorThemeRecord; resolvedTheme: ResolvedColorTheme }> {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const resolvedData = await resolveColorThemeData(normalizedPath, readFileAbsolute)
  const label = getThemeBaseNameWithoutExtension(normalizedPath)
  const theme: ImportedColorThemeRecord = {
    id: `imported-${slugifyThemeLabel(label)}-${hashString(normalizedPath)}`,
    label,
    path: normalizedPath,
    description: `Imported from ${getThemeBaseName(normalizedPath)}.`,
    author: 'Imported theme',
    kind: resolvedData.kind,
  }

  return {
    theme,
    resolvedTheme: mergeResolvedThemeWithBuiltInBase(createResolvedTheme(
      {
        id: theme.id,
        label: theme.label,
        description: theme.description,
        author: theme.author,
        kind: resolvedData.kind,
        source: 'imported',
        path: theme.path,
      },
      resolvedData.colors,
      resolvedData.tokenColors,
      resolvedData.semanticHighlighting,
      resolvedData.semanticTokenColors,
    )),
  }
}

export function buildResolvedThemeLookup(
  importedThemes: readonly ImportedColorThemeRecord[],
  resolvedImportedThemes: Readonly<Record<string, ResolvedColorTheme>> = {},
): Record<string, ResolvedColorTheme> {
  const lookup: Record<string, ResolvedColorTheme> = Object.fromEntries(
    builtInResolvedThemes.map((theme) => [theme.id, theme]),
  )

  for (const theme of importedThemes) {
    lookup[theme.id] = resolvedImportedThemes[theme.id] ?? getFallbackThemeForImportedTheme(theme)
  }

  return lookup
}