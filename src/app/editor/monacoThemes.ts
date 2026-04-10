import { createDraculaThemeDefinition } from './draculaTheme'
import { DEFAULT_EDITOR_THEME, type EditorThemeId, editorThemeOptions } from './editorSettings'
import {
  type DraculaPalette,
  getRootThemeStyles,
  type StyleReader,
} from './themeSource'

type MonacoBaseTheme = 'vs' | 'vs-dark'

const THEME_REGISTRATION_MARKER = '__pristineThemesRegistered'

interface StaticThemeDefinition {
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

const staticThemes: Record<Exclude<EditorThemeId, 'dracula'>, StaticThemeDefinition> = {
  'github-light': {
    base: 'vs',
    palette: {
      surface: '#f6f8fa',
      background: '#ffffff',
      input: '#ffffff',
      selection: '#dbe9ff',
      comment: '#6e7781',
      foreground: '#1f2328',
      brightForeground: '#24292f',
      pink: '#cf222e',
      purple: '#8250df',
      cyan: '#0550ae',
      green: '#116329',
      yellow: '#9a6700',
      red: '#cf222e',
      orange: '#bc4c00',
    },
  },
  'github-dark': {
    base: 'vs-dark',
    palette: {
      surface: '#161b22',
      background: '#0d1117',
      input: '#21262d',
      selection: '#264f78',
      comment: '#8b949e',
      foreground: '#c9d1d9',
      brightForeground: '#f0f6fc',
      pink: '#ff7b72',
      purple: '#d2a8ff',
      cyan: '#79c0ff',
      green: '#7ee787',
      yellow: '#d29922',
      red: '#ff7b72',
      orange: '#ffa657',
    },
  },
  'one-dark-pro': {
    base: 'vs-dark',
    palette: {
      surface: '#21252b',
      background: '#282c34',
      input: '#2c313c',
      selection: '#3e4451',
      comment: '#5c6370',
      foreground: '#abb2bf',
      brightForeground: '#d7dae0',
      pink: '#c678dd',
      purple: '#c678dd',
      cyan: '#56b6c2',
      green: '#98c379',
      yellow: '#e5c07b',
      red: '#e06c75',
      orange: '#d19a66',
    },
  },
  'night-owl': {
    base: 'vs-dark',
    palette: {
      surface: '#102131',
      background: '#011627',
      input: '#122d42',
      selection: '#1d3b53',
      comment: '#637777',
      foreground: '#d6deeb',
      brightForeground: '#ffffff',
      pink: '#c792ea',
      purple: '#c792ea',
      cyan: '#82aaff',
      green: '#addb67',
      yellow: '#ecc48d',
      red: '#ef5350',
      orange: '#f78c6c',
    },
  },
  'tokyo-night': {
    base: 'vs-dark',
    palette: {
      surface: '#1f2335',
      background: '#1a1b26',
      input: '#24283b',
      selection: '#33467c',
      comment: '#565f89',
      foreground: '#c0caf5',
      brightForeground: '#d5d6db',
      pink: '#ff79c6',
      purple: '#bb9af7',
      cyan: '#7dcfff',
      green: '#9ece6a',
      yellow: '#e0af68',
      red: '#f7768e',
      orange: '#ff9e64',
    },
  },
  'solarized-light': {
    base: 'vs',
    palette: {
      surface: '#eee8d5',
      background: '#fdf6e3',
      input: '#fdf6e3',
      selection: '#eee8d5',
      comment: '#93a1a1',
      foreground: '#657b83',
      brightForeground: '#586e75',
      pink: '#d33682',
      purple: '#6c71c4',
      cyan: '#2aa198',
      green: '#859900',
      yellow: '#b58900',
      red: '#dc322f',
      orange: '#cb4b16',
    },
  },
  'solarized-dark': {
    base: 'vs-dark',
    palette: {
      surface: '#073642',
      background: '#002b36',
      input: '#073642',
      selection: '#134b5c',
      comment: '#586e75',
      foreground: '#839496',
      brightForeground: '#93a1a1',
      pink: '#d33682',
      purple: '#6c71c4',
      cyan: '#2aa198',
      green: '#859900',
      yellow: '#b58900',
      red: '#dc322f',
      orange: '#cb4b16',
    },
  },
}

export function getEditorThemeDefinition(
  themeId: EditorThemeId,
  styles: StyleReader | null = getRootThemeStyles(),
) {
  if (themeId === DEFAULT_EDITOR_THEME) {
    return createDraculaThemeDefinition(styles)
  }

  const staticTheme = staticThemes[themeId]
  return createThemeDefinition(staticTheme.base, staticTheme.palette)
}

export function registerEditorThemes(monaco: any): void {
  if (!monaco) {
    return
  }

  if (monaco[THEME_REGISTRATION_MARKER] === true) {
    return
  }

  monaco[THEME_REGISTRATION_MARKER] = true

  for (const option of editorThemeOptions) {
    monaco.editor.defineTheme(option.value, getEditorThemeDefinition(option.value) as any)
  }
}