import theme2026DarkRaw from './vscode-defaults/2026-dark.json?raw'
import theme2026LightRaw from './vscode-defaults/2026-light.json?raw'
import darkModernRaw from './vscode-defaults/dark_modern.json?raw'
import lightModernRaw from './vscode-defaults/light_modern.json?raw'
import darkPlusRaw from './vscode-defaults/dark_plus.json?raw'
import lightPlusRaw from './vscode-defaults/light_plus.json?raw'
import darkVsRaw from './vscode-defaults/dark_vs.json?raw'
import lightVsRaw from './vscode-defaults/light_vs.json?raw'
import bundledUpstreamThemeManifestRaw from './bundledUpstreamThemeManifest.json'
import {
  editorThemeCatalog,
  isStaticEditorThemeCatalogEntry,
  type MonacoBaseTheme,
} from '../editor/themeCatalog'
import { resolveDraculaPalette, type DraculaPalette } from '../editor/themeSource'
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
  VSCodeTokenColorRule,
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

type BundledThemeDefinition = {
  id: string
  label: string
  description: string
  author: string
  kind: ThemeKind
  base: MonacoBaseTheme
  palette: DraculaPalette
  entryPath?: string
}

type BundledUpstreamThemeManifestEntry = {
  id: string
  publisher: string
  extensionName: string
  version: string
  assetDirectory: string
  themePath: string
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

const bundledUpstreamThemeManifest = bundledUpstreamThemeManifestRaw as BundledUpstreamThemeManifestEntry[]

const bundledUpstreamThemeEntryPathById = new Map<string, string>(
  bundledUpstreamThemeManifest.map((entry) => [entry.id, `./bundled-upstream/${entry.assetDirectory}/${entry.themePath}`]),
)

const bundledUpstreamThemeFiles = import.meta.glob('./bundled-upstream/**/*.json', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

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

function loadBundledUpstreamThemeFile(filePath: string): string {
  const fileContents = bundledUpstreamThemeFiles[filePath] ?? bundledUpstreamThemeFiles[`./${filePath}`]

  if (!fileContents) {
    throw new Error(`Missing bundled upstream color theme asset '${filePath}'.`)
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

function getThemeKindFromMonacoBase(base: MonacoBaseTheme): ThemeKind {
  return base === 'vs' ? 'light' : 'dark'
}

function createBundledThemeTokenColors(palette: DraculaPalette): VSCodeTokenColorRule[] {
  return [
    {
      scope: 'comment, punctuation.definition.comment',
      settings: {
        foreground: palette.comment,
        fontStyle: 'italic',
      },
    },
    {
      scope: 'keyword, keyword.control, storage, storage.type',
      settings: {
        foreground: palette.pink,
        fontStyle: 'bold',
      },
    },
    {
      scope: 'entity.name.function, support.function, support.function.shell',
      settings: {
        foreground: palette.purple,
      },
    },
    {
      scope: 'support.class, support.type, entity.name.type, meta.property-name',
      settings: {
        foreground: palette.cyan,
        fontStyle: 'italic',
      },
    },
    {
      scope: 'entity.name.tag, support.constant.property-value, support.constant.color',
      settings: {
        foreground: palette.green,
      },
    },
    {
      scope: 'string, markup.inline.raw',
      settings: {
        foreground: palette.yellow,
      },
    },
    {
      scope: 'constant.numeric, constant.language, constant.character, number',
      settings: {
        foreground: palette.purple,
      },
    },
    {
      scope: 'variable, meta.definition.variable.name, entity.name, markup.heading',
      settings: {
        foreground: palette.orange,
      },
    },
    {
      scope: 'invalid, string.invalid',
      settings: {
        foreground: palette.red,
      },
    },
  ]
}

function createBundledThemeColors(palette: DraculaPalette, kind: ThemeKind): Record<string, string> {
  const buttonForeground = kind === 'dark' ? '#111111' : '#ffffff'

  return {
    foreground: palette.foreground,
    'editor.background': palette.background,
    'editor.foreground': palette.foreground,
    'editor.lineHighlightBackground': palette.surface,
    'editor.selectionBackground': palette.selection,
    'editorCursor.foreground': palette.brightForeground,
    'editorLineNumber.foreground': palette.comment,
    'editorLineNumber.activeForeground': palette.foreground,
    'editorWidget.background': palette.input,
    'editorWidget.border': palette.comment,
    'panel.background': palette.surface,
    'panel.border': palette.comment,
    'sideBar.background': palette.surface,
    'sideBar.foreground': palette.foreground,
    'sideBar.border': palette.comment,
    'sideBarTitle.foreground': palette.foreground,
    'activityBar.background': palette.surface,
    'activityBar.foreground': palette.brightForeground,
    'activityBar.border': palette.comment,
    'titleBar.activeBackground': palette.surface,
    'titleBar.activeForeground': palette.foreground,
    'menu.background': palette.surface,
    'menu.foreground': palette.foreground,
    'menu.border': palette.comment,
    'input.background': palette.input,
    'input.border': palette.comment,
    'input.placeholderForeground': palette.comment,
    'quickInput.background': palette.input,
    'quickInput.foreground': palette.foreground,
    'list.activeSelectionBackground': palette.selection,
    'list.activeSelectionForeground': palette.foreground,
    'list.inactiveSelectionBackground': palette.surface,
    'list.highlightForeground': palette.cyan,
    'list.hoverBackground': palette.selection,
    'focusBorder': palette.cyan,
    'button.background': palette.cyan,
    'button.foreground': buttonForeground,
    'button.hoverBackground': palette.purple,
    'badge.foreground': buttonForeground,
    'descriptionForeground': palette.comment,
    'disabledForeground': palette.comment,
    'errorForeground': palette.red,
    'editorError.foreground': palette.red,
    'editorWarning.foreground': palette.orange,
    'tab.activeBackground': palette.background,
    'tab.activeForeground': palette.foreground,
    'tab.hoverBackground': palette.selection,
    'tab.inactiveBackground': palette.surface,
    'terminal.background': palette.background,
    'terminal.foreground': palette.foreground,
    'terminalCursor.foreground': palette.brightForeground,
    'terminal.ansiBlack': palette.surface,
    'terminal.ansiRed': palette.red,
    'terminal.ansiGreen': palette.green,
    'terminal.ansiYellow': palette.yellow,
    'terminal.ansiBlue': palette.cyan,
    'terminal.ansiMagenta': palette.purple,
    'terminal.ansiCyan': palette.cyan,
    'terminal.ansiWhite': palette.foreground,
    'terminal.ansiBrightBlack': palette.comment,
    'terminal.ansiBrightRed': palette.red,
    'terminal.ansiBrightGreen': palette.green,
    'terminal.ansiBrightYellow': palette.yellow,
    'terminal.ansiBrightBlue': palette.cyan,
    'terminal.ansiBrightMagenta': palette.purple,
    'terminal.ansiBrightCyan': palette.cyan,
    'terminal.ansiBrightWhite': palette.brightForeground,
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

const bundledThemeDefinitions: readonly BundledThemeDefinition[] = editorThemeCatalog.map((theme) => ({
  id: theme.value,
  label: theme.label,
  description: theme.description,
  author: theme.author,
  kind: getThemeKindFromMonacoBase(theme.base),
  base: theme.base,
  palette: isStaticEditorThemeCatalogEntry(theme) ? theme.palette : resolveDraculaPalette(null),
  entryPath: bundledUpstreamThemeEntryPathById.get(theme.value),
}))

const bundledThemeDefinitionsById = new Map<string, BundledThemeDefinition>(
  bundledThemeDefinitions.map((theme) => [theme.id, theme]),
)

const bundledResolvedThemeCache = new Map<string, ResolvedColorTheme>()

const bundledThemeOptions = bundledThemeDefinitions.map<ColorThemeOption>((theme) => ({
  value: theme.id,
  label: theme.label,
  description: theme.description,
  author: theme.author,
  kind: theme.kind,
  source: 'bundled',
}))

function createResolvedBundledTheme(theme: BundledThemeDefinition): ResolvedColorTheme {
  if (theme.entryPath) {
    const resolvedData = resolveColorThemeDataSync(theme.entryPath, loadBundledUpstreamThemeFile, theme.kind)

    return mergeResolvedThemeWithBuiltInBase(createResolvedTheme(
      {
        id: theme.id,
        label: theme.label,
        description: theme.description,
        author: theme.author,
        kind: resolvedData.kind,
        source: 'bundled',
      },
      resolvedData.colors,
      resolvedData.tokenColors,
      resolvedData.semanticHighlighting,
      resolvedData.semanticTokenColors,
    ))
  }

  return mergeResolvedThemeWithBuiltInBase(createResolvedTheme(
    {
      id: theme.id,
      label: theme.label,
      description: theme.description,
      author: theme.author,
      kind: theme.kind,
      source: 'bundled',
    },
    createBundledThemeColors(theme.palette, theme.kind),
    createBundledThemeTokenColors(theme.palette),
    false,
    {},
  ))
}

export function getBuiltInColorTheme(themeId: string): ResolvedColorTheme | null {
  return builtInResolvedThemesById.get(themeId) ?? null
}

export function getBuiltInColorThemes(): readonly ResolvedColorTheme[] {
  return builtInResolvedThemes
}

export function getBundledColorTheme(themeId: string): ResolvedColorTheme | null {
  const cachedTheme = bundledResolvedThemeCache.get(themeId)

  if (cachedTheme) {
    return cachedTheme
  }

  const definition = bundledThemeDefinitionsById.get(themeId)

  if (!definition) {
    return null
  }

  const resolvedTheme = createResolvedBundledTheme(definition)
  bundledResolvedThemeCache.set(themeId, resolvedTheme)
  return resolvedTheme
}

export function getBundledColorThemes(): readonly ResolvedColorTheme[] {
  return bundledThemeDefinitions.flatMap((theme) => {
    const resolvedTheme = getBundledColorTheme(theme.id)
    return resolvedTheme ? [resolvedTheme] : []
  })
}

export function resetBundledColorThemeCacheForTests(): void {
  bundledResolvedThemeCache.clear()
}

export function getBundledColorThemeOptions(): readonly ColorThemeOption[] {
  return bundledThemeOptions
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
    ...bundledThemeOptions,
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

  if (bundledThemeDefinitionsById.has(value)) {
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

  for (const bundledTheme of bundledThemeDefinitions) {
    const resolvedTheme = getBundledColorTheme(bundledTheme.id)

    if (resolvedTheme) {
      lookup[resolvedTheme.id] = resolvedTheme
    }
  }

  for (const theme of importedThemes) {
    lookup[theme.id] = resolvedImportedThemes[theme.id] ?? getFallbackThemeForImportedTheme(theme)
  }

  return lookup
}