import { IDE_MONO_FONT_FAMILY } from './themeSource'
import { editorThemeCatalog, editorThemeCatalogById } from './themeCatalog'

export const DEFAULT_EDITOR_FONT_SIZE = 13
export const MIN_EDITOR_FONT_SIZE = 10
export const MAX_EDITOR_FONT_SIZE = 24

export const EDITOR_FONT_SIZE_CONFIG_KEY = 'editor.fontSize'
export const EDITOR_FONT_FAMILY_CONFIG_KEY = 'editor.fontFamily'
export const EDITOR_THEME_CONFIG_KEY = 'editor.theme'
export const EDITOR_WORD_WRAP_CONFIG_KEY = 'editor.wordWrap'
export const EDITOR_RENDER_WHITESPACE_CONFIG_KEY = 'editor.renderWhitespace'
export const EDITOR_RENDER_CONTROL_CHARACTERS_CONFIG_KEY = 'editor.renderControlCharacters'
export const EDITOR_FONT_LIGATURES_CONFIG_KEY = 'editor.fontLigatures'
export const EDITOR_TAB_SIZE_CONFIG_KEY = 'editor.tabSize'
export const EDITOR_CURSOR_BLINKING_CONFIG_KEY = 'editor.cursorBlinking'
export const EDITOR_SMOOTH_SCROLLING_CONFIG_KEY = 'editor.smoothScrolling'
export const EDITOR_SCROLL_BEYOND_LAST_LINE_CONFIG_KEY = 'editor.scrollBeyondLastLine'
export const EDITOR_FOLDING_STRATEGY_CONFIG_KEY = 'editor.foldingStrategy'
export const EDITOR_LINE_NUMBERS_CONFIG_KEY = 'editor.lineNumbers'
export const EDITOR_MINIMAP_ENABLED_CONFIG_KEY = 'editor.minimap.enabled'
export const EDITOR_GLYPH_MARGIN_CONFIG_KEY = 'editor.glyphMargin'
export const EDITOR_BRACKET_PAIR_GUIDES_CONFIG_KEY = 'editor.guides.bracketPairs'
export const EDITOR_INDENT_GUIDES_CONFIG_KEY = 'editor.guides.indentation'

export const editorFontFamilyOptions = [
  {
    value: 'jetbrains-mono',
    label: 'JetBrains Mono',
    author: 'JetBrains',
    fontFamily: IDE_MONO_FONT_FAMILY,
    description: 'Bundled default with broad glyph coverage.',
  },
  {
    value: 'fira-code',
    label: 'Fira Code',
    author: 'Nikita Prokopov',
    fontFamily: '"Fira Code", monospace',
    description: 'Popular coding font with ligatures.',
  },
  {
    value: 'cascadia-code',
    label: 'Cascadia Code',
    author: 'Microsoft',
    fontFamily: '"Cascadia Code", monospace',
    description: 'Microsoft open-source code font.',
  },
  {
    value: 'source-code-pro',
    label: 'Source Code Pro',
    author: 'Adobe',
    fontFamily: '"Source Code Pro", monospace',
    description: 'Adobe monospace tuned for dense code.',
  },
  {
    value: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    author: 'IBM',
    fontFamily: '"IBM Plex Mono", monospace',
    description: 'Structured grotesk-inspired coding font.',
  },
  {
    value: 'iosevka',
    label: 'Iosevka',
    author: 'Belleve Invis',
    fontFamily: 'Iosevka, monospace',
    description: 'Compact high-density monospace family.',
  },
  {
    value: 'victor-mono',
    label: 'Victor Mono',
    author: 'Rubjo Vampjoen',
    fontFamily: '"Victor Mono", monospace',
    description: 'Cursive italics with readable letterforms.',
  },
  {
    value: 'mononoki',
    label: 'Mononoki',
    author: 'Matthieu James',
    fontFamily: 'Mononoki, monospace',
    description: 'Rounded coding font with distinct punctuation.',
  },
  {
    value: 'anonymous-pro',
    label: 'Anonymous Pro',
    author: 'Mark Simonson',
    fontFamily: '"Anonymous Pro", monospace',
    description: 'Classic coding font with generous spacing.',
  },
  {
    value: 'comic-mono',
    label: 'Comic Mono',
    author: 'Craig Rozynski',
    fontFamily: '"Comic Mono", monospace',
    description: 'Playful monospace based on hand-drawn forms.',
  },
  {
    value: 'cousine',
    label: 'Cousine',
    author: 'Steve Matteson',
    fontFamily: 'Cousine, monospace',
    description: 'Metric-compatible coding font with neutral rhythm.',
  },
  {
    value: 'inconsolata',
    label: 'Inconsolata',
    author: 'Raph Levien',
    fontFamily: 'Inconsolata, monospace',
    description: 'Humanist monospace suited for long sessions.',
  },
  {
    value: 'noto-sans-mono',
    label: 'Noto Sans Mono',
    author: 'Google',
    fontFamily: '"Noto Sans Mono", monospace',
    description: 'Google monospace with broad language support.',
  },
  {
    value: 'space-mono',
    label: 'Space Mono',
    author: 'Colophon Foundry',
    fontFamily: '"Space Mono", monospace',
    description: 'Grotesk-inspired display monospace.',
  },
  {
    value: 'ubuntu-mono',
    label: 'Ubuntu Mono',
    author: 'Canonical',
    fontFamily: '"Ubuntu Mono", monospace',
    description: 'Ubuntu family monospace with strong readability.',
  },
  {
    value: '0xproto',
    label: '0xProto',
    author: '0xType',
    fontFamily: '"0xProto", monospace',
    description: 'Legibility-first coding font with restrained ligatures.',
  },
  {
    value: 'zxproto',
    label: 'ZxProto',
    author: '0xType',
    fontFamily: '"ZxProto", monospace',
    description: 'Companion 0xType monospace with a slightly sharper technical voice.',
  },
  {
    value: 'agave',
    label: 'Agave',
    author: 'Agave Project',
    fontFamily: 'Agave, monospace',
    description: 'Compact fixed-width face with strong terminal aesthetics.',
  },
  {
    value: 'dejavu-sans-mono',
    label: 'DejaVu Sans Mono',
    author: 'DejaVu Fonts',
    fontFamily: '"DejaVu Sans Mono", monospace',
    description: 'Widely deployed open-source monospace with broad glyph coverage.',
  },
  {
    value: 'fantasque-sans-mono',
    label: 'Fantasque Sans Mono',
    author: 'Jany Belluz',
    fontFamily: '"Fantasque Sans Mono", monospace',
    description: 'Friendly handwritten monospace tuned for code.',
  },
  {
    value: 'hack',
    label: 'Hack',
    author: 'Source Foundry',
    fontFamily: 'Hack, monospace',
    description: 'Source Foundry monospace built for low-resolution clarity.',
  },
  {
    value: 'hasklig',
    label: 'Hasklig',
    author: 'Ian Tuomi',
    fontFamily: 'Hasklig, monospace',
    description: 'Source Code Pro derivative with ligatures for code.',
  },
  {
    value: 'julia-mono',
    label: 'JuliaMono',
    author: 'Cormullion',
    fontFamily: 'JuliaMono, monospace',
    description: 'Technical monospace with exceptional Unicode and math support.',
  },
  {
    value: 'liberation-mono',
    label: 'Liberation Mono',
    author: 'Red Hat',
    fontFamily: '"Liberation Mono", monospace',
    description: 'Widely deployed open-source monospace from the Liberation family.',
  },
  {
    value: 'm-plus-code-latin',
    label: 'M PLUS Code Latin 60',
    author: 'M+ Fonts Project',
    fontFamily: '"M PLUS Code Latin 60", monospace',
    description: 'M+ project code-oriented Latin monospace in the 60 variant.',
  },
  {
    value: 'm-plus-code-latin-50',
    label: 'M PLUS Code Latin 50',
    author: 'M+ Fonts Project',
    fontFamily: '"M PLUS Code Latin 50", monospace',
    description: 'M+ project code-oriented Latin monospace in the 50 variant.',
  },
  {
    value: 'meslo-lg-dz',
    label: 'Meslo LG DZ',
    author: 'Andre Berg',
    fontFamily: '"Meslo LG DZ", monospace',
    description: 'Terminal-friendly Meslo variant with crisp developer-focused forms.',
  },
  {
    value: 'meslo-lg-mdz',
    label: 'Meslo LG MDZ',
    author: 'Andre Berg',
    fontFamily: '"Meslo LG MDZ", monospace',
    description: 'Meslo medium-width DZ variant tuned for terminal and code use.',
  },
  {
    value: 'meslo-lg-sdz',
    label: 'Meslo LG SDZ',
    author: 'Andre Berg',
    fontFamily: '"Meslo LG SDZ", monospace',
    description: 'Meslo narrow DZ variant for denser code layouts.',
  },
  {
    value: 'monaspace-argon',
    label: 'Monaspace Argon',
    author: 'GitHub Next',
    fontFamily: '"Monaspace Argon", monospace',
    description: 'GitHub Next monospace with a crisp editorial tone.',
  },
  {
    value: 'monaspace-krypton',
    label: 'Monaspace Krypton',
    author: 'GitHub Next',
    fontFamily: '"Monaspace Krypton", monospace',
    description: 'GitHub Next monospace with compact restrained forms.',
  },
  {
    value: 'monaspace-neon',
    label: 'Monaspace Neon',
    author: 'GitHub Next',
    fontFamily: '"Monaspace Neon", monospace',
    description: 'GitHub Next monospace optimized for expressive code text.',
  },
  {
    value: 'monaspace-radon',
    label: 'Monaspace Radon',
    author: 'GitHub Next',
    fontFamily: '"Monaspace Radon", monospace',
    description: 'GitHub Next monospace with softer rounder geometry.',
  },
  {
    value: 'monaspace-xenon',
    label: 'Monaspace Xenon',
    author: 'GitHub Next',
    fontFamily: '"Monaspace Xenon", monospace',
    description: 'GitHub Next monospace with sharper technical character.',
  },
  {
    value: 'monoid',
    label: 'Monoid',
    author: 'Andreas Larsen',
    fontFamily: 'Monoid, monospace',
    description: 'Dense programming font with optional ligature heritage.',
  },
] as const

export const editorThemeOptions = editorThemeCatalog.map((theme) => ({
  value: theme.value,
  label: theme.label,
  description: theme.description,
  author: theme.author,
  sourceUrl: theme.sourceUrl,
  license: theme.license,
}))

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

export const editorTabSizeOptions = [
  { value: 2, label: '2 spaces', description: 'Compact indentation for dense code layouts.' },
  { value: 4, label: '4 spaces', description: 'Balanced default for most source files.' },
  { value: 8, label: '8 spaces', description: 'Wide indentation for traditional hardware codebases.' },
] as const

export const editorCursorBlinkingOptions = [
  { value: 'blink', label: 'Blink', description: 'Use Monaco\'s classic blinking caret animation.' },
  { value: 'smooth', label: 'Smooth', description: 'Use a softer eased blinking animation.' },
  { value: 'phase', label: 'Phase', description: 'Fade the caret in and out using phase timing.' },
  { value: 'expand', label: 'Expand', description: 'Animate the caret with a subtle expansion effect.' },
  { value: 'solid', label: 'Solid', description: 'Keep the caret constantly visible without blinking.' },
] as const

export const editorLineNumbersOptions = [
  { value: 'on', label: 'On', description: 'Always show absolute line numbers.' },
  { value: 'off', label: 'Off', description: 'Hide the line number gutter.' },
  { value: 'relative', label: 'Relative', description: 'Show the current line and relative offsets around it.' },
  { value: 'interval', label: 'Interval', description: 'Render line numbers at regular intervals.' },
] as const

export const editorFoldingStrategyOptions = [
  {
    value: 'indentation',
    label: 'Indentation',
    description: 'Infer folding ranges from indentation and structural markers in the file.',
  },
  {
    value: 'auto',
    label: 'Auto',
    description: 'Prefer Monaco language-aware folding providers when they are available.',
  },
] as const

export type EditorFontFamilyId = (typeof editorFontFamilyOptions)[number]['value']
export type EditorThemeId = (typeof editorThemeCatalog)[number]['value']
export type EditorWordWrapMode = (typeof editorWordWrapOptions)[number]['value']
export type EditorRenderWhitespaceMode = (typeof editorRenderWhitespaceOptions)[number]['value']
export type EditorTabSize = (typeof editorTabSizeOptions)[number]['value']
export type EditorCursorBlinkingMode = (typeof editorCursorBlinkingOptions)[number]['value']
export type EditorLineNumbersMode = (typeof editorLineNumbersOptions)[number]['value']
export type EditorFoldingStrategy = (typeof editorFoldingStrategyOptions)[number]['value']
export const DEFAULT_EDITOR_FONT_FAMILY = 'jetbrains-mono' as const satisfies EditorFontFamilyId
export const DEFAULT_EDITOR_THEME = 'dracula' as const satisfies EditorThemeId
export const DEFAULT_EDITOR_WORD_WRAP = 'off' as const satisfies EditorWordWrapMode
export const DEFAULT_EDITOR_RENDER_WHITESPACE = 'selection' as const satisfies EditorRenderWhitespaceMode
export const DEFAULT_EDITOR_FONT_LIGATURES = true
export const DEFAULT_EDITOR_TAB_SIZE = 4 as const satisfies EditorTabSize
export const DEFAULT_EDITOR_CURSOR_BLINKING = 'smooth' as const satisfies EditorCursorBlinkingMode
export const DEFAULT_EDITOR_LINE_NUMBERS = 'on' as const satisfies EditorLineNumbersMode
export const DEFAULT_EDITOR_SMOOTH_SCROLLING = true
export const DEFAULT_EDITOR_SCROLL_BEYOND_LAST_LINE = false
export const DEFAULT_EDITOR_FOLDING_STRATEGY = 'indentation' as const satisfies EditorFoldingStrategy
export const DEFAULT_EDITOR_RENDER_CONTROL_CHARACTERS = false
export const DEFAULT_EDITOR_MINIMAP_ENABLED = true
export const DEFAULT_EDITOR_GLYPH_MARGIN = true
export const DEFAULT_EDITOR_BRACKET_PAIR_GUIDES = true
export const DEFAULT_EDITOR_INDENT_GUIDES = true

const editorFontFamilyValues = new Set<EditorFontFamilyId>(editorFontFamilyOptions.map((option) => option.value))
const editorFontFamilyOptionsById = new Map<EditorFontFamilyId, (typeof editorFontFamilyOptions)[number]>(
  editorFontFamilyOptions.map((option) => [option.value, option]),
)
const editorThemeValues = new Set<EditorThemeId>(editorThemeCatalog.map((option) => option.value))
const editorWordWrapValues = new Set<EditorWordWrapMode>(editorWordWrapOptions.map((option) => option.value))
const editorWordWrapOptionsById = new Map<EditorWordWrapMode, (typeof editorWordWrapOptions)[number]>(
  editorWordWrapOptions.map((option) => [option.value, option]),
)
const editorRenderWhitespaceValues = new Set<EditorRenderWhitespaceMode>(editorRenderWhitespaceOptions.map((option) => option.value))
const editorRenderWhitespaceOptionsById = new Map<EditorRenderWhitespaceMode, (typeof editorRenderWhitespaceOptions)[number]>(
  editorRenderWhitespaceOptions.map((option) => [option.value, option]),
)
const editorTabSizeValues = new Set<EditorTabSize>(editorTabSizeOptions.map((option) => option.value))
const editorTabSizeOptionsById = new Map<EditorTabSize, (typeof editorTabSizeOptions)[number]>(
  editorTabSizeOptions.map((option) => [option.value, option]),
)
const editorCursorBlinkingValues = new Set<EditorCursorBlinkingMode>(editorCursorBlinkingOptions.map((option) => option.value))
const editorCursorBlinkingOptionsById = new Map<EditorCursorBlinkingMode, (typeof editorCursorBlinkingOptions)[number]>(
  editorCursorBlinkingOptions.map((option) => [option.value, option]),
)
const editorLineNumbersValues = new Set<EditorLineNumbersMode>(editorLineNumbersOptions.map((option) => option.value))
const editorLineNumbersOptionsById = new Map<EditorLineNumbersMode, (typeof editorLineNumbersOptions)[number]>(
  editorLineNumbersOptions.map((option) => [option.value, option]),
)
const editorFoldingStrategyValues = new Set<EditorFoldingStrategy>(editorFoldingStrategyOptions.map((option) => option.value))
const editorFoldingStrategyOptionsById = new Map<EditorFoldingStrategy, (typeof editorFoldingStrategyOptions)[number]>(
  editorFoldingStrategyOptions.map((option) => [option.value, option]),
)

export function isEditorFontFamilyId(value: unknown): value is EditorFontFamilyId {
  return typeof value === 'string' && editorFontFamilyValues.has(value as EditorFontFamilyId)
}

export function getEditorFontFamilyLabel(fontFamilyId: EditorFontFamilyId): string {
  return editorFontFamilyOptionsById.get(fontFamilyId)?.label ?? 'JetBrains Mono'
}

export function getEditorFontFamilyAuthor(fontFamilyId: EditorFontFamilyId): string {
  return editorFontFamilyOptionsById.get(fontFamilyId)?.author ?? 'JetBrains'
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
  return editorThemeCatalogById.get(themeId)?.label ?? 'Dracula'
}

export function getEditorThemeAuthor(themeId: EditorThemeId): string {
  return editorThemeCatalogById.get(themeId)?.author ?? 'Dracula Theme'
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

function parseEditorNumericChoice<T extends number>(
  value: unknown,
  validValues: Set<T>,
  defaultValue: T,
): T {
  const numericValue = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number.parseInt(value, 10)
      : null

  return typeof numericValue === 'number' && validValues.has(numericValue as T)
    ? numericValue as T
    : defaultValue
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

export function getEditorTabSizeLabel(tabSize: EditorTabSize): string {
  return editorTabSizeOptionsById.get(tabSize)?.label ?? '4 spaces'
}

export function parseEditorTabSize(value: unknown): EditorTabSize {
  return parseEditorNumericChoice(value, editorTabSizeValues, DEFAULT_EDITOR_TAB_SIZE)
}

export function isEditorCursorBlinkingMode(value: unknown): value is EditorCursorBlinkingMode {
  return typeof value === 'string' && editorCursorBlinkingValues.has(value as EditorCursorBlinkingMode)
}

export function getEditorCursorBlinkingLabel(cursorBlinking: EditorCursorBlinkingMode): string {
  return editorCursorBlinkingOptionsById.get(cursorBlinking)?.label ?? 'Smooth'
}

export function parseEditorCursorBlinking(value: unknown): EditorCursorBlinkingMode {
  return isEditorCursorBlinkingMode(value) ? value : DEFAULT_EDITOR_CURSOR_BLINKING
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

export function isEditorFoldingStrategy(value: unknown): value is EditorFoldingStrategy {
  return typeof value === 'string' && editorFoldingStrategyValues.has(value as EditorFoldingStrategy)
}

export function getEditorFoldingStrategyLabel(foldingStrategy: EditorFoldingStrategy): string {
  return editorFoldingStrategyOptionsById.get(foldingStrategy)?.label ?? 'Indentation'
}

export function parseEditorFoldingStrategy(value: unknown): EditorFoldingStrategy {
  return isEditorFoldingStrategy(value) ? value : DEFAULT_EDITOR_FOLDING_STRATEGY
}

export function parseEditorFontLigatures(value: unknown): boolean {
  return parseEditorBooleanSetting(value, DEFAULT_EDITOR_FONT_LIGATURES)
}

export function parseEditorSmoothScrolling(value: unknown): boolean {
  return parseEditorBooleanSetting(value, DEFAULT_EDITOR_SMOOTH_SCROLLING)
}

export function parseEditorScrollBeyondLastLine(value: unknown): boolean {
  return parseEditorBooleanSetting(value, DEFAULT_EDITOR_SCROLL_BEYOND_LAST_LINE)
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