import { describe, expect, it } from 'vitest'

import {
  buildAvailableColorThemeOptions,
  buildResolvedThemeLookup,
  getBundledColorTheme,
  parseConfiguredColorThemeId,
} from './colorThemeRegistry'

describe('colorThemeRegistry', () => {
  it('includes bundled third-party themes in the unified theme options', () => {
    const options = buildAvailableColorThemeOptions([])

    expect(options).toEqual(expect.arrayContaining([
      expect.objectContaining({
        value: 'pink-cat-boo',
        label: 'Pink Cat Boo',
        author: 'Fiona Fan',
        source: 'bundled',
      }),
      expect.objectContaining({
        value: 'github-light',
        label: 'GitHub Light',
        author: 'GitHub',
        source: 'bundled',
      }),
    ]))
  })

  it('accepts bundled theme ids from config and resolves them through the shared lookup', () => {
    expect(parseConfiguredColorThemeId('pink-cat-boo', [])).toBe('pink-cat-boo')

    const theme = buildResolvedThemeLookup([])['pink-cat-boo']

    expect(theme).toEqual(expect.objectContaining({
      id: 'pink-cat-boo',
      source: 'bundled',
      kind: 'dark',
    }))
    expect(theme).toBeDefined()

    if (!theme) {
      throw new Error('Expected pink-cat-boo to resolve from the unified theme lookup.')
    }

    expect(theme.colors['editor.background']).toBe('#202330')
    expect(theme.colors['button.background']).toBe('#A2C2EB')
    expect(theme.colors['terminal.selectionBackground']).toMatch(/^#.+/)
  })

  it('keeps bundled light themes accessible as unified workbench themes', () => {
    const theme = getBundledColorTheme('github-light')

    expect(theme).toEqual(expect.objectContaining({
      id: 'github-light',
      kind: 'light',
      source: 'bundled',
    }))
    expect(theme?.colors['editor.background']).toMatch(/^#.+/)
    expect(theme?.colors['terminal.foreground']).toMatch(/^#.+/)
  })
})