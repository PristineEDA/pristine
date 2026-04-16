import { IDE_MONO_FONT_FAMILY } from './themeSource'

export const DEFAULT_EDITOR_FONT_SIZE = 13
export const MIN_EDITOR_FONT_SIZE = 10
export const MAX_EDITOR_FONT_SIZE = 24

export const EDITOR_FONT_SIZE_CONFIG_KEY = 'editor.fontSize'
export const EDITOR_FONT_FAMILY_CONFIG_KEY = 'editor.fontFamily'
export const EDITOR_THEME_CONFIG_KEY = 'editor.theme'
export const EDITOR_WORD_WRAP_CONFIG_KEY = 'editor.wordWrap'
export const EDITOR_RENDER_WHITESPACE_CONFIG_KEY = 'editor.renderWhitespace'
export const EDITOR_RENDER_CONTROL_CHARACTERS_CONFIG_KEY = 'editor.renderControlCharacters'
export const EDITOR_LINE_NUMBERS_CONFIG_KEY = 'editor.lineNumbers'
export const EDITOR_MINIMAP_ENABLED_CONFIG_KEY = 'editor.minimap.enabled'
export const EDITOR_GLYPH_MARGIN_CONFIG_KEY = 'editor.glyphMargin'
export const EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY = 'editor.guides.bracketPairs'
export const EDITOR_INDENT_GUIDES_CONFIG_KEY = 'editor.guides.indentation'

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
    value: 'zxproto',
    label: 'ZxProto',
    fontFamily: '"ZxProto", monospace',
    description: 'Companion 0xType monospace with a slightly sharper technical voice.',
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
    value: 'liberation-mono',
    label: 'Liberation Mono',
    fontFamily: '"Liberation Mono", monospace',
    description: 'Widely deployed open-source monospace from the Liberation family.',
  },
  {
    value: 'm-plus-code-latin',
    label: 'M PLUS Code Latin 60',
    fontFamily: '"M PLUS Code Latin 60", monospace',
    description: 'M+ project code-oriented Latin monospace in the 60 variant.',
  },
  {
    value: 'm-plus-code-latin-50',
    label: 'M PLUS Code Latin 50',
    fontFamily: '"M PLUS Code Latin 50", monospace',
    description: 'M+ project code-oriented Latin monospace in the 50 variant.',
  },
  {
    value: 'meslo-lg-dz',
    label: 'Meslo LG DZ',
    fontFamily: '"Meslo LG DZ", monospace',
    description: 'Terminal-friendly Meslo variant with crisp developer-focused forms.',
  },
  {
    value: 'meslo-lg-mdz',
    label: 'Meslo LG MDZ',
    fontFamily: '"Meslo LG MDZ", monospace',
    description: 'Meslo medium-width DZ variant tuned for terminal and code use.',
  },
  {
    value: 'meslo-lg-sdz',
    label: 'Meslo LG SDZ',
    fontFamily: '"Meslo LG SDZ", monospace',
    description: 'Meslo narrow DZ variant for denser code layouts.',
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

export const editorWordWrapOptions = [
  { value: 'off', label: 'Off', description: 'Disable soft wrapping for long lines.' },
  { value: 'on', label: 'On', description: 'Wrap long lines at the current viewport width.' },
  { value: 'bounded', label: 'Bounded', description: 'Wrap at the viewport width or Monaco wrap column, whichever is smaller.' },
  { value: 'wordWrapColumn', label: 'Wrap Column', description: 'Wrap long lines at Monaco\'s configured word wrap column.' },
] as const

export const editorRenderWhitespaceOptions = [
  { value: 'none', label: 'Hidden', description: 'Do not render whitespace markers.' },
  { value: 'boundary', label: 'Boundary', description: 'Render whitespace around word boundaries.' },
  { value: 'selection', label: 'Selection', description: 'Render whitespace only for the active selection.' },
  { value: 'trailing', label: 'Trailing', description: 'Render trailing whitespace markers.' },
  { value: 'all', label: 'All', description: 'Render whitespace markers everywhere.' },
] as const

export const editorLineNumbersOptions = [
  { value: 'on', label: 'On', description: 'Always show absolute line numbers.' },
  { value: 'off', label: 'Off', description: 'Hide the line number gutter.' },
  { value: 'relative', label: 'Relative', description: 'Show the current line and relative offsets around it.' },
  { value: 'interval', label: 'Interval', description: 'Render line numbers at regular intervals.' },
] as const

export type EditorFontFamilyId = (typeof editorFontFamilyOptions)[number]['value']
export type EditorThemeId = (typeof editorThemeOptions)[number]['value']
export type EditorWordWrapMode = (typeof editorWordWrapOptions)[number]['value']
export type EditorRenderWhitespaceMode = (typeof editorRenderWhitespaceOptions)[number]['value']
export type EditorLineNumbersMode = (typeof editorLineNumbersOptions)[number]['value']
export const DEFAULT_EDITOR_FONT_FAMILY = 'jetbrains-mono' as const satisfies EditorFontFamilyId
export const DEFAULT_EDITOR_THEME = 'dracula' as const satisfies EditorThemeId
export const DEFAULT_EDITOR_WORD_WRAP = 'off' as const satisfies EditorWordWrapMode
export const DEFAULT_EDITOR_RENDER_WHITESPACE = 'selection' as const satisfies EditorRenderWhitespaceMode
export const DEFAULT_EDITOR_LINE_NUMBERS = 'on' as const satisfies EditorLineNumbersMode
export const DEFAULT_EDITOR_RENDER_CONTROL_CHARACTERS = false
export const DEFAULT_EDITOR_MINIMAP_ENABLED = true
export const DEFAULT_EDITOR_GLYPH_MARGIN = true
export const DEFAULT_EDITOR_BRACKET_PAIR_GUIDES = true
export const DEFAULT_EDITOR_INDENT_GUIDES = true

const editorFontFamilyValues = new Set<EditorFontFamilyId>(editorFontFamilyOptions.map((option) => option.value))
const editorFontFamilyOptionsById = new Map<EditorFontFamilyId, (typeof editorFontFamilyOptions)[number]>(
  editorFontFamilyOptions.map((option) => [option.value, option]),
)
const editorThemeValues = new Set<EditorThemeId>(editorThemeOptions.map((option) => option.value))
const editorThemeOptionsById = new Map<EditorThemeId, (typeof editorThemeOptions)[number]>(
  editorThemeOptions.map((option) => [option.value, option]),
)
const editorWordWrapValues = new Set<EditorWordWrapMode>(editorWordWrapOptions.map((option) => option.value))
const editorWordWrapOptionsById = new Map<EditorWordWrapMode, (typeof editorWordWrapOptions)[number]>(
  editorWordWrapOptions.map((option) => [option.value, option]),
)
const editorRenderWhitespaceValues = new Set<EditorRenderWhitespaceMode>(editorRenderWhitespaceOptions.map((option) => option.value))
const editorRenderWhitespaceOptionsById = new Map<EditorRenderWhitespaceMode, (typeof editorRenderWhitespaceOptions)[number]>(
  editorRenderWhitespaceOptions.map((option) => [option.value, option]),
)
const editorLineNumbersValues = new Set<EditorLineNumbersMode>(editorLineNumbersOptions.map((option) => option.value))
const editorLineNumbersOptionsById = new Map<EditorLineNumbersMode, (typeof editorLineNumbersOptions)[number]>(
  editorLineNumbersOptions.map((option) => [option.value, option]),
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

function parseEditorBooleanSetting(value: unknown, defaultValue: boolean): boolean {
  return typeof value === 'boolean' ? value : defaultValue
}

export function isEditorWordWrapMode(value: unknown): value is EditorWordWrapMode {
  return typeof value === 'string' && editorWordWrapValues.has(value as EditorWordWrapMode)
}

export function getEditorWordWrapLabel(wordWrap: EditorWordWrapMode): string {
  return editorWordWrapOptionsById.get(wordWrap)?.label ?? 'Off'
}

export function parseEditorWordWrap(value: unknown): EditorWordWrapMode {
  return isEditorWordWrapMode(value) ? value : DEFAULT_EDITOR_WORD_WRAP
}

export function isEditorRenderWhitespaceMode(value: unknown): value is EditorRenderWhitespaceMode {
  return typeof value === 'string' && editorRenderWhitespaceValues.has(value as EditorRenderWhitespaceMode)
}

export function getEditorRenderWhitespaceLabel(renderWhitespace: EditorRenderWhitespaceMode): string {
  return editorRenderWhitespaceOptionsById.get(renderWhitespace)?.label ?? 'Selection'
}

export function parseEditorRenderWhitespace(value: unknown): EditorRenderWhitespaceMode {
  return isEditorRenderWhitespaceMode(value) ? value : DEFAULT_EDITOR_RENDER_WHITESPACE
}

export function isEditorLineNumbersMode(value: unknown): value is EditorLineNumbersMode {
  return typeof value === 'string' && editorLineNumbersValues.has(value as EditorLineNumbersMode)
}

export function getEditorLineNumbersLabel(lineNumbers: EditorLineNumbersMode): string {
  return editorLineNumbersOptionsById.get(lineNumbers)?.label ?? 'On'
}

export function parseEditorLineNumbers(value: unknown): EditorLineNumbersMode {
  return isEditorLineNumbersMode(value) ? value : DEFAULT_EDITOR_LINE_NUMBERS
}

export function parseEditorRenderControlCharacters(value: unknown): boolean {
  return parseEditorBooleanSetting(value, DEFAULT_EDITOR_RENDER_CONTROL_CHARACTERS)
}

export function parseEditorMinimapEnabled(value: unknown): boolean {
  return parseEditorBooleanSetting(value, DEFAULT_EDITOR_MINIMAP_ENABLED)
}

export function parseEditorGlyphMargin(value: unknown): boolean {
  return parseEditorBooleanSetting(value, DEFAULT_EDITOR_GLYPH_MARGIN)
}

export function parseEditorBracketPairGuides(value: unknown): boolean {
  return parseEditorBooleanSetting(value, DEFAULT_EDITOR_BRACKET_PAIR_GUIDES)
}

export function parseEditorIndentGuides(value: unknown): boolean {
  return parseEditorBooleanSetting(value, DEFAULT_EDITOR_INDENT_GUIDES)
}