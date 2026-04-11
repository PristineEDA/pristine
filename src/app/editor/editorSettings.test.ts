import { describe, expect, it } from 'vitest'

import {
  editorFontFamilyOptions,
  getEditorFontFamilyLabel,
  parseEditorFontFamily,
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
})