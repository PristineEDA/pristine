import { createDraculaThemeDefinition } from './draculaTheme'
import { DEFAULT_EDITOR_THEME, type EditorThemeId } from './editorSettings'
import { claimMonacoRegistration, resetMonacoRegistrationForTests } from './monacoRegistrationTracker'
import {
  type DraculaPalette,
  getRootThemeStyles,
  resolveDraculaPalette,
  type StyleReader,
} from './themeSource'
import {
  editorThemeCatalog,
  editorThemeCatalogById,
  isStaticEditorThemeCatalogEntry,
  type MonacoBaseTheme,
} from './themeCatalog'

const THEME_REGISTRATION_KEY = 'editor-themes'
const DRACULA_BASE_THEME = 'vs-dark' as const satisfies MonacoBaseTheme

export interface EditorThemePreview {
  base: MonacoBaseTheme
  palette: DraculaPalette
}

function normalizeMonacoTokenColor(color: string) {
  const normalized = color.trim().replace(/^#/, '')

  if (normalized.length === 3 || normalized.length === 4) {
    return normalized
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
  }

  return normalized
}

function createThemeDefinition(base: MonacoBaseTheme, palette: DraculaPalette) {
  return {
    base,
    inherit: true,
    rules: [
      { token: 'keyword', foreground: normalizeMonacoTokenColor(palette.pink), fontStyle: 'bold' },
      { token: 'keyword.control', foreground: normalizeMonacoTokenColor(palette.pink) },
      { token: 'support.function', foreground: normalizeMonacoTokenColor(palette.green) },
      { token: 'support.function.shell', foreground: normalizeMonacoTokenColor(palette.green) },
      { token: 'comment', foreground: normalizeMonacoTokenColor(palette.comment), fontStyle: 'italic' },
      { token: 'string', foreground: normalizeMonacoTokenColor(palette.yellow) },
      { token: 'string.invalid', foreground: normalizeMonacoTokenColor(palette.red) },
      { token: 'number', foreground: normalizeMonacoTokenColor(palette.purple) },
      { token: 'identifier', foreground: normalizeMonacoTokenColor(palette.foreground) },
      { token: 'variable', foreground: normalizeMonacoTokenColor(palette.orange) },
      { token: 'variable.automatic', foreground: normalizeMonacoTokenColor(palette.orange), fontStyle: 'bold' },
      { token: 'variable.shell', foreground: normalizeMonacoTokenColor(palette.cyan) },
      { token: 'delimiter', foreground: normalizeMonacoTokenColor(palette.foreground) },
      { token: 'operator', foreground: normalizeMonacoTokenColor(palette.pink) },
      { token: 'operator.assignment.immediate', foreground: normalizeMonacoTokenColor(palette.pink), fontStyle: 'bold' },
      { token: 'operator.assignment.append', foreground: normalizeMonacoTokenColor(palette.green), fontStyle: 'bold' },
      { token: 'operator.assignment.conditional', foreground: normalizeMonacoTokenColor(palette.purple), fontStyle: 'bold' },
      { token: 'operator.assignment.recursive', foreground: normalizeMonacoTokenColor(palette.orange), fontStyle: 'bold' },
      { token: 'meta.recipe', foreground: normalizeMonacoTokenColor(palette.comment) },
      { token: 'type', foreground: normalizeMonacoTokenColor(palette.cyan), fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': palette.background,
      'editor.foreground': palette.foreground,
      'editorLineNumber.foreground': palette.comment,
      'editorLineNumber.activeForeground': palette.foreground,
      'editor.selectionBackground': palette.selection,
      'editor.inactiveSelectionBackground': `${palette.selection}88`,
      'editor.lineHighlightBackground': `${palette.selection}55`,
      'editorCursor.foreground': palette.foreground,
      'editorWhitespace.foreground': palette.selection,
      'editorWidget.background': palette.surface,
      'editorWidget.border': palette.comment,
      'editorSuggestWidget.background': palette.surface,
      'editorSuggestWidget.border': palette.comment,
      'editorSuggestWidget.selectedBackground': palette.selection,
      'editorGutter.background': palette.background,
      'editorError.foreground': palette.red,
      'editorWarning.foreground': palette.orange,
      'editorIndentGuide.background1': palette.selection,
      'editorIndentGuide.activeBackground1': palette.comment,
      'editorBracketMatch.background': palette.selection,
      'editorBracketMatch.border': palette.foreground,
      'scrollbar.shadow': palette.surface,
      'scrollbarSlider.background': `${palette.selection}88`,
      'scrollbarSlider.hoverBackground': `${palette.selection}cc`,
      'scrollbarSlider.activeBackground': palette.comment,
    },
  } as const
}

export function getEditorThemePreview(
  themeId: EditorThemeId,
  styles: StyleReader | null = getRootThemeStyles(),
): EditorThemePreview {
  if (themeId === DEFAULT_EDITOR_THEME) {
    return {
      base: DRACULA_BASE_THEME,
      palette: resolveDraculaPalette(styles),
    }
  }

  const themeEntry = editorThemeCatalogById.get(themeId)

  if (!themeEntry || !isStaticEditorThemeCatalogEntry(themeEntry)) {
    throw new Error(`Missing static editor theme catalog entry for '${themeId}'.`)
  }

  return {
    base: themeEntry.base,
    palette: themeEntry.palette,
  }
}

export function getEditorThemeDefinition(
  themeId: EditorThemeId,
  styles: StyleReader | null = getRootThemeStyles(),
) {
  if (themeId === DEFAULT_EDITOR_THEME) {
    return createDraculaThemeDefinition(styles)
  }

  const preview = getEditorThemePreview(themeId, styles)
  return createThemeDefinition(preview.base, preview.palette)
}

export function registerEditorThemes(monaco: any): void {
  if (!claimMonacoRegistration(THEME_REGISTRATION_KEY, monaco)) {
    return
  }

  for (const theme of editorThemeCatalog) {
    monaco.editor.defineTheme(theme.value, getEditorThemeDefinition(theme.value) as any)
  }
}

export function resetEditorThemeRegistrationForTests(): void {
  resetMonacoRegistrationForTests(THEME_REGISTRATION_KEY)
}