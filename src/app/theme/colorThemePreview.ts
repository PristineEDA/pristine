import type { ColorThemePreviewPalette, ResolvedColorTheme, VSCodeTokenColorRule } from './colorThemeTypes'

function normalizeColorValue(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback
  }

  const normalized = value.trim()
  if (!normalized) {
    return fallback
  }

  if (normalized.startsWith('#')) {
    return normalized
  }

  if (/^[0-9a-fA-F]{3,8}$/.test(normalized)) {
    return `#${normalized}`
  }

  return normalized
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

function resolveTokenForeground(
  tokenColors: readonly VSCodeTokenColorRule[],
  scopes: readonly string[],
  fallback: string,
): string {
  for (let index = tokenColors.length - 1; index >= 0; index -= 1) {
    const tokenColor = tokenColors[index]
    if (!tokenColor) {
      continue
    }

    const tokenScopes = flattenScopes(tokenColor.scope)

    if (!tokenScopes.some((tokenScope) => scopes.includes(tokenScope))) {
      continue
    }

    const foreground = tokenColor.settings?.foreground
    if (typeof foreground === 'string' && foreground.trim().length > 0) {
      return normalizeColorValue(foreground, fallback)
    }
  }

  return fallback
}

function resolveThemeColor(theme: ResolvedColorTheme, ids: readonly string[], fallback: string): string {
  for (const id of ids) {
    const value = theme.colors[id]

    if (typeof value === 'string' && value.trim().length > 0) {
      return normalizeColorValue(value, fallback)
    }
  }

  return fallback
}

export function getColorThemePreview(theme: ResolvedColorTheme): ColorThemePreviewPalette {
  const background = resolveThemeColor(theme, ['editor.background', 'panel.background'], theme.kind === 'dark' ? '#1f1f1f' : '#ffffff')
  const surface = resolveThemeColor(theme, ['editorWidget.background', 'panel.background', 'sideBar.background'], background)
  const input = resolveThemeColor(theme, ['input.background', 'quickInput.background'], surface)
  const selection = resolveThemeColor(theme, ['editor.selectionBackground', 'list.activeSelectionBackground'], theme.kind === 'dark' ? '#264f78' : '#dbeafe')
  const comment = resolveTokenForeground(theme.tokenColors, ['comment', 'punctuation.definition.comment'], resolveThemeColor(theme, ['descriptionForeground', 'editorLineNumber.foreground', 'disabledForeground'], theme.kind === 'dark' ? '#8b949e' : '#6b7280'))
  const foreground = resolveThemeColor(theme, ['editor.foreground', 'foreground'], theme.kind === 'dark' ? '#cccccc' : '#1f2937')
  const brightForeground = resolveThemeColor(theme, ['editorCursor.foreground', 'button.foreground'], foreground)
  const pink = resolveTokenForeground(theme.tokenColors, ['keyword', 'keyword.control', 'storage', 'storage.type'], theme.kind === 'dark' ? '#c586c0' : '#a21caf')
  const purple = resolveTokenForeground(theme.tokenColors, ['entity.name.function', 'support.function'], theme.kind === 'dark' ? '#d2a8ff' : '#7c3aed')
  const cyan = resolveTokenForeground(theme.tokenColors, ['support.class', 'support.type', 'entity.name.type', 'meta.property-name'], theme.kind === 'dark' ? '#79c0ff' : '#0284c7')
  const green = resolveTokenForeground(theme.tokenColors, ['entity.name.tag', 'support.constant.property-value', 'support.constant.color'], theme.kind === 'dark' ? '#7ee787' : '#059669')
  const yellow = resolveTokenForeground(theme.tokenColors, ['string', 'markup.inline.raw'], theme.kind === 'dark' ? '#dcdcaa' : '#b45309')
  const red = resolveThemeColor(theme, ['errorForeground', 'editorError.foreground'], theme.kind === 'dark' ? '#f48771' : '#dc2626')
  const orange = resolveTokenForeground(theme.tokenColors, ['variable', 'meta.definition.variable.name', 'entity.name', 'markup.heading'], theme.kind === 'dark' ? '#ffa657' : '#ea580c')

  return {
    surface,
    background,
    input,
    selection,
    comment,
    foreground,
    brightForeground,
    pink,
    purple,
    cyan,
    green,
    yellow,
    red,
    orange,
  }
}