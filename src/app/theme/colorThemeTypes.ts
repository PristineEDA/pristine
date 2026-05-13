export type ThemeKind = 'light' | 'dark'

export interface VSCodeTokenColorSettings {
  foreground?: string
  background?: string
  fontStyle?: string
}

export interface VSCodeTokenColorRule {
  name?: string
  scope?: string | string[]
  settings?: VSCodeTokenColorSettings
}

export interface VSCodeColorThemeFile {
  $schema?: string
  name?: string
  include?: string
  type?: string
  uiTheme?: string
  colors?: Record<string, string>
  tokenColors?: string | VSCodeTokenColorRule[]
  semanticHighlighting?: boolean
  semanticTokenColors?: Record<string, string | VSCodeTokenColorSettings>
}

export interface ColorThemeOption {
  value: string
  label: string
  description: string
  author: string
  kind: ThemeKind
  source: 'builtin' | 'imported'
}

export interface ImportedColorThemeRecord {
  id: string
  label: string
  path: string
  description: string
  author: string
  kind: ThemeKind
}

export interface ResolvedColorTheme {
  id: string
  label: string
  description: string
  author: string
  kind: ThemeKind
  source: 'builtin' | 'imported'
  path?: string
  colors: Record<string, string>
  tokenColors: VSCodeTokenColorRule[]
  semanticHighlighting: boolean
  semanticTokenColors: Record<string, string | VSCodeTokenColorSettings>
}

export interface ColorThemePreviewPalette {
  surface: string
  background: string
  input: string
  selection: string
  comment: string
  foreground: string
  brightForeground: string
  pink: string
  purple: string
  cyan: string
  green: string
  yellow: string
  red: string
  orange: string
}