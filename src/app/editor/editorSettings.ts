export const DEFAULT_EDITOR_FONT_SIZE = 13
export const MIN_EDITOR_FONT_SIZE = 10
export const MAX_EDITOR_FONT_SIZE = 24

export const EDITOR_FONT_SIZE_CONFIG_KEY = 'editor.fontSize'
export const EDITOR_THEME_CONFIG_KEY = 'editor.theme'

export const editorThemeOptions = [
  { value: 'dracula', label: 'Dracula', description: 'Default dark theme with vivid accents.' },
  { value: 'github-light', label: 'GitHub Light', description: 'Clean light theme inspired by GitHub.' },
  { value: 'github-dark', label: 'GitHub Dark', description: 'GitHub-style dark theme with neutral contrast.' },
  { value: 'one-dark-pro', label: 'One Dark Pro', description: 'Balanced dark theme with familiar VS Code tones.' },
  { value: 'night-owl', label: 'Night Owl', description: 'High-contrast dark palette for long coding sessions.' },
  { value: 'tokyo-night', label: 'Tokyo Night', description: 'Modern deep-blue theme with cool accents.' },
  { value: 'solarized-light', label: 'Solarized Light', description: 'Soft light theme with reduced glare.' },
  { value: 'solarized-dark', label: 'Solarized Dark', description: 'Muted dark theme based on Solarized.' },
] as const

export type EditorThemeId = (typeof editorThemeOptions)[number]['value']

export function isEditorThemeId(value: unknown): value is EditorThemeId {
  return editorThemeOptions.some((option) => option.value === value)
}

export function getEditorThemeLabel(themeId: EditorThemeId): string {
  return editorThemeOptions.find((option) => option.value === themeId)?.label ?? 'Dracula'
}

export function parseEditorTheme(value: unknown): EditorThemeId {
  return isEditorThemeId(value) ? value : 'dracula'
}

export function clampEditorFontSize(value: number): number {
  return Math.min(MAX_EDITOR_FONT_SIZE, Math.max(MIN_EDITOR_FONT_SIZE, Math.round(value)))
}

export function parseEditorFontSize(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_EDITOR_FONT_SIZE
  }

  return clampEditorFontSize(value)
}