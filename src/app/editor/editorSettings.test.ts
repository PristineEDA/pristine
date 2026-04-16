import { describe, expect, it } from 'vitest'

import {
  DEFAULT_EDITOR_BRACKET_PAIR_GUIDES,
  DEFAULT_EDITOR_GLYPH_MARGIN,
  DEFAULT_EDITOR_INDENT_GUIDES,
  DEFAULT_EDITOR_LINE_NUMBERS,
  DEFAULT_EDITOR_MINIMAP_ENABLED,
  DEFAULT_EDITOR_RENDER_CONTROL_CHARACTERS,
  DEFAULT_EDITOR_RENDER_WHITESPACE,
  DEFAULT_EDITOR_WORD_WRAP,
  editorFontFamilyOptions,
  editorLineNumbersOptions,
  editorRenderWhitespaceOptions,
  editorWordWrapOptions,
  getEditorFontFamilyLabel,
  getEditorLineNumbersLabel,
  getEditorRenderWhitespaceLabel,
  getEditorWordWrapLabel,
  parseEditorBracketPairGuides,
  parseEditorFontFamily,
  parseEditorGlyphMargin,
  parseEditorIndentGuides,
  parseEditorLineNumbers,
  parseEditorMinimapEnabled,
  parseEditorRenderControlCharacters,
  parseEditorRenderWhitespace,
  parseEditorWordWrap,
} from './editorSettings'

describe('editorSettings', () => {
  it('exposes every bundled local font family in the Monaco settings list', () => {
    expect(editorFontFamilyOptions.map((option) => option.value)).toEqual(
      expect.arrayContaining([
        '0xproto',
        'zxproto',
        'agave',
        'dejavu-sans-mono',
        'fantasque-sans-mono',
        'hack',
        'hasklig',
        'julia-mono',
        'liberation-mono',
        'm-plus-code-latin',
        'm-plus-code-latin-50',
        'meslo-lg-dz',
        'meslo-lg-mdz',
        'meslo-lg-sdz',
        'monaspace-argon',
        'monaspace-krypton',
        'monaspace-neon',
        'monaspace-radon',
        'monaspace-xenon',
        'monoid',
      ]),
    )
  })

  it('parses and labels the newly exposed bundled font variants', () => {
    expect(parseEditorFontFamily('zxproto')).toBe('zxproto')
    expect(parseEditorFontFamily('m-plus-code-latin-50')).toBe('m-plus-code-latin-50')
    expect(parseEditorFontFamily('meslo-lg-mdz')).toBe('meslo-lg-mdz')
    expect(parseEditorFontFamily('meslo-lg-sdz')).toBe('meslo-lg-sdz')

    expect(getEditorFontFamilyLabel('zxproto')).toBe('ZxProto')
    expect(getEditorFontFamilyLabel('m-plus-code-latin-50')).toBe('M PLUS Code Latin 50')
    expect(getEditorFontFamilyLabel('meslo-lg-mdz')).toBe('Meslo LG MDZ')
    expect(getEditorFontFamilyLabel('meslo-lg-sdz')).toBe('Meslo LG SDZ')
  })

  it('parses Monaco display enum settings and falls back to defaults for invalid values', () => {
    expect(editorWordWrapOptions.map((option) => option.value)).toEqual(['off', 'on', 'bounded', 'wordWrapColumn'])
    expect(editorRenderWhitespaceOptions.map((option) => option.value)).toEqual(['none', 'boundary', 'selection', 'trailing', 'all'])
    expect(editorLineNumbersOptions.map((option) => option.value)).toEqual(['on', 'off', 'relative', 'interval'])

    expect(parseEditorWordWrap('bounded')).toBe('bounded')
    expect(parseEditorWordWrap('invalid')).toBe(DEFAULT_EDITOR_WORD_WRAP)
    expect(getEditorWordWrapLabel('wordWrapColumn')).toBe('Wrap Column')

    expect(parseEditorRenderWhitespace('all')).toBe('all')
    expect(parseEditorRenderWhitespace('invalid')).toBe(DEFAULT_EDITOR_RENDER_WHITESPACE)
    expect(getEditorRenderWhitespaceLabel('boundary')).toBe('Boundary')

    expect(parseEditorLineNumbers('relative')).toBe('relative')
    expect(parseEditorLineNumbers('invalid')).toBe(DEFAULT_EDITOR_LINE_NUMBERS)
    expect(getEditorLineNumbersLabel('interval')).toBe('Interval')
  })

  it('parses Monaco display booleans and falls back to stable defaults', () => {
    expect(parseEditorRenderControlCharacters(true)).toBe(true)
    expect(parseEditorRenderControlCharacters('invalid')).toBe(DEFAULT_EDITOR_RENDER_CONTROL_CHARACTERS)

    expect(parseEditorMinimapEnabled(false)).toBe(false)
    expect(parseEditorMinimapEnabled('invalid')).toBe(DEFAULT_EDITOR_MINIMAP_ENABLED)

    expect(parseEditorGlyphMargin(false)).toBe(false)
    expect(parseEditorGlyphMargin('invalid')).toBe(DEFAULT_EDITOR_GLYPH_MARGIN)

    expect(parseEditorBracketPairGuides(false)).toBe(false)
    expect(parseEditorBracketPairGuides('invalid')).toBe(DEFAULT_EDITOR_BRACKET_PAIR_GUIDES)

    expect(parseEditorIndentGuides(false)).toBe(false)
    expect(parseEditorIndentGuides('invalid')).toBe(DEFAULT_EDITOR_INDENT_GUIDES)
  })
})