import { IDE_MONO_FONT_FAMILY } from './themeSource'

export const DEFAULT_EDITOR_FONT_SIZE = 13
export const MIN_EDITOR_FONT_SIZE = 10
export const MAX_EDITOR_FONT_SIZE = 24

export const EDITOR_FONT_SIZE_CONFIG_KEY = 'editor.fontSize'
export const EDITOR_FONT_FAMILY_CONFIG_KEY = 'editor.fontFamily'
export const EDITOR_THEME_CONFIG_KEY = 'editor.theme'

export const editorFontFamilyOptions = [
  {
    value: 'jetbrains-mono',
    label: 'JetBrains Mono',
    fontFamily: IDE_MONO_FONT_FAMILY,
    description: 'Bundled default with broad glyph coverage.',
  },
  {
    value: 'fira-code',
    label: 'Fira Code',
    fontFamily: '"Fira Code", monospace',
    description: 'Popular coding font with ligatures.',
  },
  {
    value: 'cascadia-code',
    label: 'Cascadia Code',
    fontFamily: '"Cascadia Code", monospace',
    description: 'Microsoft open-source code font.',
  },
  {
    value: 'source-code-pro',
    label: 'Source Code Pro',
    fontFamily: '"Source Code Pro", monospace',
    description: 'Adobe monospace tuned for dense code.',
  },
  {
    value: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    fontFamily: '"IBM Plex Mono", monospace',
    description: 'Structured grotesk-inspired coding font.',
  },
  {
    value: 'iosevka',
    label: 'Iosevka',
    fontFamily: 'Iosevka, monospace',
    description: 'Compact high-density monospace family.',
  },
  {
    value: 'victor-mono',
    label: 'Victor Mono',
    fontFamily: '"Victor Mono", monospace',
    description: 'Cursive italics with readable letterforms.',
  },
  {
    value: 'mononoki',
    label: 'Mononoki',
    fontFamily: 'Mononoki, monospace',
    description: 'Rounded coding font with distinct punctuation.',
  },
  {
    value: 'anonymous-pro',
    label: 'Anonymous Pro',
    fontFamily: '"Anonymous Pro", monospace',
    description: 'Classic coding font with generous spacing.',
  },
  {
    value: 'comic-mono',
    label: 'Comic Mono',
    fontFamily: '"Comic Mono", monospace',
    description: 'Playful monospace based on hand-drawn forms.',
  },
  {
    value: 'cousine',
    label: 'Cousine',
    fontFamily: 'Cousine, monospace',
    description: 'Metric-compatible coding font with neutral rhythm.',
  },
  {
    value: 'inconsolata',
    label: 'Inconsolata',
    fontFamily: 'Inconsolata, monospace',
    description: 'Humanist monospace suited for long sessions.',
  },
  {
    value: 'noto-sans-mono',
    label: 'Noto Sans Mono',
    fontFamily: '"Noto Sans Mono", monospace',
    description: 'Google monospace with broad language support.',
  },
  {
    value: 'space-mono',
    label: 'Space Mono',
    fontFamily: '"Space Mono", monospace',
    description: 'Grotesk-inspired display monospace.',
  },
  {
    value: 'ubuntu-mono',
    label: 'Ubuntu Mono',
    fontFamily: '"Ubuntu Mono", monospace',
    description: 'Ubuntu family monospace with strong readability.',
  },
  {
    value: '0xproto',
    label: '0xProto',
    fontFamily: '"0xProto", monospace',
    description: 'Legibility-first coding font with restrained ligatures.',
  },
  {
    value: 'agave',
    label: 'Agave',
    fontFamily: 'Agave, monospace',
    description: 'Compact fixed-width face with strong terminal aesthetics.',
  },
  {
    value: 'dejavu-sans-mono',
    label: 'DejaVu Sans Mono',
    fontFamily: '"DejaVu Sans Mono", monospace',
    description: 'Widely deployed open-source monospace with broad glyph coverage.',
  },
  {
    value: 'fantasque-sans-mono',
    label: 'Fantasque Sans Mono',
    fontFamily: '"Fantasque Sans Mono", monospace',
    description: 'Friendly handwritten monospace tuned for code.',
  },
  {
    value: 'hack',
    label: 'Hack',
    fontFamily: 'Hack, monospace',
    description: 'Source Foundry monospace built for low-resolution clarity.',
  },
  {
    value: 'hasklig',
    label: 'Hasklig',
    fontFamily: 'Hasklig, monospace',
    description: 'Source Code Pro derivative with ligatures for code.',
  },
  {
    value: 'julia-mono',
    label: 'JuliaMono',
    fontFamily: 'JuliaMono, monospace',
    description: 'Technical monospace with exceptional Unicode and math support.',
  },
  {
    value: 'm-plus-code-latin',
    label: 'M PLUS Code Latin',
    fontFamily: '"M PLUS Code Latin", monospace',
    description: 'M+ project code-oriented Latin monospace variant.',
  },
  {
    value: 'monaspace-argon',
    label: 'Monaspace Argon',
    fontFamily: '"Monaspace Argon", monospace',
    description: 'GitHub Next monospace with a crisp editorial tone.',
  },
  {
    value: 'monaspace-krypton',
    label: 'Monaspace Krypton',
    fontFamily: '"Monaspace Krypton", monospace',
    description: 'GitHub Next monospace with compact restrained forms.',
  },
  {
    value: 'monaspace-neon',
    label: 'Monaspace Neon',
    fontFamily: '"Monaspace Neon", monospace',
    description: 'GitHub Next monospace optimized for expressive code text.',
  },
  {
    value: 'monaspace-radon',
    label: 'Monaspace Radon',
    fontFamily: '"Monaspace Radon", monospace',
    description: 'GitHub Next monospace with softer rounder geometry.',
  },
  {
    value: 'monaspace-xenon',
    label: 'Monaspace Xenon',
    fontFamily: '"Monaspace Xenon", monospace',
    description: 'GitHub Next monospace with sharper technical character.',
  },
  {
    value: 'monoid',
    label: 'Monoid',
    fontFamily: 'Monoid, monospace',
    description: 'Dense programming font with optional ligature heritage.',
  },
] as const

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

export type EditorFontFamilyId = (typeof editorFontFamilyOptions)[number]['value']
export type EditorThemeId = (typeof editorThemeOptions)[number]['value']
export const DEFAULT_EDITOR_FONT_FAMILY = 'jetbrains-mono' as const satisfies EditorFontFamilyId
export const DEFAULT_EDITOR_THEME = 'dracula' as const satisfies EditorThemeId

const editorFontFamilyValues = new Set<EditorFontFamilyId>(editorFontFamilyOptions.map((option) => option.value))
const editorFontFamilyOptionsById = new Map<EditorFontFamilyId, (typeof editorFontFamilyOptions)[number]>(
  editorFontFamilyOptions.map((option) => [option.value, option]),
)
const editorThemeValues = new Set<EditorThemeId>(editorThemeOptions.map((option) => option.value))
const editorThemeOptionsById = new Map<EditorThemeId, (typeof editorThemeOptions)[number]>(
  editorThemeOptions.map((option) => [option.value, option]),
)

export function isEditorFontFamilyId(value: unknown): value is EditorFontFamilyId {
  return typeof value === 'string' && editorFontFamilyValues.has(value as EditorFontFamilyId)
}

export function getEditorFontFamilyLabel(fontFamilyId: EditorFontFamilyId): string {
  return editorFontFamilyOptionsById.get(fontFamilyId)?.label ?? 'JetBrains Mono'
}

export function getEditorFontFamilyStack(fontFamilyId: EditorFontFamilyId): string {
  return editorFontFamilyOptionsById.get(fontFamilyId)?.fontFamily ?? IDE_MONO_FONT_FAMILY
}

export function parseEditorFontFamily(value: unknown): EditorFontFamilyId {
  return isEditorFontFamilyId(value) ? value : DEFAULT_EDITOR_FONT_FAMILY
}

export function isEditorThemeId(value: unknown): value is EditorThemeId {
  return typeof value === 'string' && editorThemeValues.has(value as EditorThemeId)
}

export function getEditorThemeLabel(themeId: EditorThemeId): string {
  return editorThemeOptionsById.get(themeId)?.label ?? 'Dracula'
}

export function parseEditorTheme(value: unknown): EditorThemeId {
  return isEditorThemeId(value) ? value : DEFAULT_EDITOR_THEME
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