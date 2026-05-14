import {
  getBuiltInColorThemes,
} from './colorThemeRegistry'
import type { ResolvedColorTheme, VSCodeTokenColorRule } from './colorThemeTypes'

type MonacoBaseTheme = 'vs' | 'vs-dark'

interface MonacoTokenRule {
  token: string
  foreground: string | undefined
  background: string | undefined
  fontStyle: string | undefined
}

interface MonacoThemeDefinition {
  base: MonacoBaseTheme
  inherit: true
  rules: MonacoTokenRule[]
  colors: ResolvedColorTheme['colors']
}

let themeDefinitionCache = new WeakMap<ResolvedColorTheme, MonacoThemeDefinition>()
let definedThemesByMonaco = new WeakMap<object, WeakSet<ResolvedColorTheme>>()
let builtInThemesRegisteredByMonaco = new WeakSet<object>()

function normalizeMonacoHexColor(color: string | undefined): string | undefined {
  if (!color) {
    return undefined
  }

  const normalized = color.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{3,8}$/.test(normalized)) {
    return undefined
  }

  if (normalized.length === 3 || normalized.length === 4) {
    return normalized
      .split('')
      .map((segment) => `${segment}${segment}`)
      .join('')
  }

  return normalized
}

function normalizeMonacoTokenColor(color: string | undefined): string | undefined {
  return normalizeMonacoHexColor(color)
}

function normalizeMonacoUiColor(color: string | undefined): string | undefined {
  const normalized = normalizeMonacoHexColor(color)
  return normalized ? `#${normalized}` : undefined
}

function normalizeMonacoThemeColors(colors: ResolvedColorTheme['colors']): ResolvedColorTheme['colors'] {
  const normalizedColors: ResolvedColorTheme['colors'] = {}

  for (const [colorId, colorValue] of Object.entries(colors)) {
    const normalized = normalizeMonacoUiColor(colorValue)

    if (normalized) {
      normalizedColors[colorId] = normalized
    }
  }

  return normalizedColors
}

function flattenScopes(scope: string | string[] | undefined): string[] {
  if (!scope) {
    return []
  }

  const scopes = Array.isArray(scope) ? scope : [scope]
  return scopes
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function tokenColorRuleToMonacoRules(rule: VSCodeTokenColorRule) {
  const scopes = flattenScopes(rule.scope)
  const foreground = normalizeMonacoTokenColor(rule.settings?.foreground)
  const background = normalizeMonacoTokenColor(rule.settings?.background)
  const fontStyle = rule.settings?.fontStyle?.trim()

  if (scopes.length === 0 || (!foreground && !background && !fontStyle)) {
    return []
  }

  return scopes.map((scope) => ({
    token: scope,
    foreground,
    background,
    fontStyle,
  }))
}

export function createMonacoThemeDefinition(theme: ResolvedColorTheme) {
  const cachedDefinition = themeDefinitionCache.get(theme)

  if (cachedDefinition) {
    return cachedDefinition
  }

  const definition: MonacoThemeDefinition = {
    base: (theme.kind === 'light' ? 'vs' : 'vs-dark') as MonacoBaseTheme,
    inherit: true,
    rules: theme.tokenColors.flatMap(tokenColorRuleToMonacoRules),
    colors: normalizeMonacoThemeColors(theme.colors),
  }

  themeDefinitionCache.set(theme, definition)

  return definition
}

export function defineMonacoTheme(monaco: any, theme: ResolvedColorTheme): void {
  if (!monaco || (typeof monaco !== 'object' && typeof monaco !== 'function')) {
    return
  }

  const monacoInstance = monaco as object
  const definedThemes = definedThemesByMonaco.get(monacoInstance) ?? new WeakSet<ResolvedColorTheme>()

  if (definedThemes.has(theme)) {
    return
  }

  definedThemes.add(theme)
  definedThemesByMonaco.set(monacoInstance, definedThemes)

  monaco.editor.defineTheme(theme.id, createMonacoThemeDefinition(theme))
}

export function registerBuiltInMonacoThemes(monaco: any): void {
  if (!monaco || (typeof monaco !== 'object' && typeof monaco !== 'function')) {
    return
  }

  const monacoInstance = monaco as object

  if (builtInThemesRegisteredByMonaco.has(monacoInstance)) {
    return
  }

  builtInThemesRegisteredByMonaco.add(monacoInstance)

  for (const theme of getBuiltInColorThemes()) {
    defineMonacoTheme(monaco, theme)
  }
}

export function resetMonacoColorThemeCacheForTests(): void {
  themeDefinitionCache = new WeakMap<ResolvedColorTheme, MonacoThemeDefinition>()
  definedThemesByMonaco = new WeakMap<object, WeakSet<ResolvedColorTheme>>()
  builtInThemesRegisteredByMonaco = new WeakSet<object>()
}
