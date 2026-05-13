import { beforeEach, describe, expect, it } from 'vitest'

import {
  buildAvailableColorThemeOptions,
  buildResolvedThemeLookup,
  getBundledColorTheme,
  parseConfiguredColorThemeId,
  resetBundledColorThemeCacheForTests,
} from './colorThemeRegistry'

describe('colorThemeRegistry', () => {
  beforeEach(() => {
    resetBundledColorThemeCacheForTests()
  })

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
      expect.objectContaining({
        value: 'one-dark-pro',
        label: 'One Dark Pro',
        author: 'Binaryify',
        source: 'bundled',
      }),
      expect.objectContaining({
        value: 'github-light-default',
        label: 'GitHub Light Default',
        author: 'GitHub',
        source: 'bundled',
      }),
      expect.objectContaining({
        value: 'tokyo-night-storm',
        label: 'Tokyo Night Storm',
        author: 'enkia',
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
    const theme = getBundledColorTheme('github-light-default')

    expect(theme).toEqual(expect.objectContaining({
      id: 'github-light-default',
      kind: 'light',
      source: 'bundled',
    }))
    expect(theme?.colors['editor.background']).toBe('#ffffff')
    expect(theme?.colors['editorLineNumber.foreground']).toBe('#8c959f')
    expect(theme?.colors['terminal.foreground']).toMatch(/^#.+/)
  })

  it('resolves second-batch vendored upstream bundled themes through the manifest and caches them', () => {
    const firstLightTheme = getBundledColorTheme('github-light-default')
    const secondLightTheme = getBundledColorTheme('github-light-default')
    const darkTheme = getBundledColorTheme('tokyo-night-storm')

    expect(firstLightTheme).toBe(secondLightTheme)
    expect(firstLightTheme).toEqual(expect.objectContaining({
      id: 'github-light-default',
      kind: 'light',
      source: 'bundled',
    }))
    expect(firstLightTheme?.colors['editor.background']).toBe('#ffffff')
    expect(firstLightTheme?.colors['editorLineNumber.foreground']).toBe('#8c959f')

    expect(darkTheme).toEqual(expect.objectContaining({
      id: 'tokyo-night-storm',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(darkTheme?.colors['editor.background']).toBe('#24283b')
    expect(darkTheme?.colors['editorLineNumber.foreground']).toBe('#3b4261')
    expect(darkTheme?.tokenColors.length ?? 0).toBeGreaterThan(100)
  })

  it('resolves third-batch vendored upstream bundled themes and preserves VS Code fallback colors when upstream keys are missing', () => {
    const firstGruvboxTheme = getBundledColorTheme('gruvbox-dark-medium')
    const secondGruvboxTheme = getBundledColorTheme('gruvbox-dark-medium')
    const solarizedLightTheme = getBundledColorTheme('solarized-light')
    const ayuLightTheme = getBundledColorTheme('ayu-light')
    const ayuLightBorderedTheme = getBundledColorTheme('ayu-light-bordered')

    expect(firstGruvboxTheme).toBe(secondGruvboxTheme)
    expect(firstGruvboxTheme).toEqual(expect.objectContaining({
      id: 'gruvbox-dark-medium',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(firstGruvboxTheme?.colors['editor.background']).toBe('#282828')
    expect(firstGruvboxTheme?.colors['editorLineNumber.foreground']).toBe('#665c54')
    expect(firstGruvboxTheme?.colors['editorLineNumber.activeForeground']).toBe('#BBBEBF')
    expect(firstGruvboxTheme?.tokenColors.length ?? 0).toBeGreaterThan(100)

    expect(solarizedLightTheme).toEqual(expect.objectContaining({
      id: 'solarized-light',
      kind: 'light',
      source: 'bundled',
    }))
    expect(solarizedLightTheme?.colors['editor.background']).toBe('#fdf6e3')
    expect(solarizedLightTheme?.colors['editorLineNumber.activeForeground']).toBe('#6f7776')
    expect(solarizedLightTheme?.tokenColors.length ?? 0).toBeGreaterThan(50)

    expect(ayuLightTheme).toEqual(expect.objectContaining({
      id: 'ayu-light',
      kind: 'light',
      source: 'bundled',
    }))
    expect(ayuLightBorderedTheme).toEqual(expect.objectContaining({
      id: 'ayu-light-bordered',
      kind: 'light',
      source: 'bundled',
    }))
    expect(ayuLightTheme?.colors['editor.background']).toBe('#f8f9fa')
    expect(ayuLightBorderedTheme?.colors['editor.background']).toBe('#fcfcfc')
    expect(ayuLightTheme?.colors['editor.background']).not.toBe(ayuLightBorderedTheme?.colors['editor.background'])
  })

  it('resolves fourth-batch vendored upstream bundled themes across single-theme and family manifests', () => {
    const firstNightOwlTheme = getBundledColorTheme('night-owl')
    const secondNightOwlTheme = getBundledColorTheme('night-owl')
    const draculaAtNightTheme = getBundledColorTheme('dracula-at-night')
    const noctisLuxTheme = getBundledColorTheme('noctis-lux')
    const rainglowPeacockTheme = getBundledColorTheme('rainglow-peacock')

    expect(firstNightOwlTheme).toBe(secondNightOwlTheme)
    expect(firstNightOwlTheme).toEqual(expect.objectContaining({
      id: 'night-owl',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(firstNightOwlTheme?.colors['editor.background']).toBe('#011627')
    expect(firstNightOwlTheme?.colors['editorLineNumber.activeForeground']).toBe('#C5E4FD')

    expect(draculaAtNightTheme).toEqual(expect.objectContaining({
      id: 'dracula-at-night',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(draculaAtNightTheme?.colors['editor.background']).toBe('#0E1419')
    expect(draculaAtNightTheme?.colors['terminal.background']).toBe('#0E1419')

    expect(noctisLuxTheme).toEqual(expect.objectContaining({
      id: 'noctis-lux',
      kind: 'light',
      source: 'bundled',
    }))
    expect(noctisLuxTheme?.colors['editor.background']).toBe('#fef8ec')
    expect(noctisLuxTheme?.colors['editorLineNumber.activeForeground']).toBe('#0099ad')
    expect(noctisLuxTheme?.colors['terminal.background']).toBe('#f6edda')

    expect(rainglowPeacockTheme).toEqual(expect.objectContaining({
      id: 'rainglow-peacock',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(rainglowPeacockTheme?.colors['editor.background']).toBe('#2b2a27')
    expect(rainglowPeacockTheme?.colors['editorLineNumber.foreground']).toBe('#605e57')
    expect(rainglowPeacockTheme?.colors['terminal.background']).toBe('#1e1d1b')
  })

  it('resolves fifth-batch vendored upstream macOS Modern themes across Ventura and classic path buckets', () => {
    const firstVenturaDarkTheme = getBundledColorTheme('macos-modern-dark-ventura-xcode-default')
    const secondVenturaDarkTheme = getBundledColorTheme('macos-modern-dark-ventura-xcode-default')
    const classicDarkTheme = getBundledColorTheme('macos-modern-dark-xcode-modern')
    const venturaLightTheme = getBundledColorTheme('macos-modern-light-ventura-xcode-low-key')

    expect(firstVenturaDarkTheme).toBe(secondVenturaDarkTheme)
    expect(firstVenturaDarkTheme).toEqual(expect.objectContaining({
      id: 'macos-modern-dark-ventura-xcode-default',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(firstVenturaDarkTheme?.colors['editor.background']).toBe('#232222')
    expect(firstVenturaDarkTheme?.colors['editorLineNumber.activeForeground']).toBe('#ffffffd8')
    expect(firstVenturaDarkTheme?.colors['input.background']).toBe('#403e3e')

    expect(classicDarkTheme).toEqual(expect.objectContaining({
      id: 'macos-modern-dark-xcode-modern',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(classicDarkTheme?.colors['editor.background']).toBe('#242529')
    expect(classicDarkTheme?.colors['panel.background']).toBe('#242529')
    expect(classicDarkTheme?.colors['statusBar.background']).toBe('#414045')

    expect(venturaLightTheme).toEqual(expect.objectContaining({
      id: 'macos-modern-light-ventura-xcode-low-key',
      kind: 'light',
      source: 'bundled',
    }))
    expect(venturaLightTheme?.colors['editor.background']).toBe('#ffffff')
    expect(venturaLightTheme?.colors['editorLineNumber.activeForeground']).toBe('#666666')
    expect(venturaLightTheme?.colors['input.background']).toBe('#fcfcfc')
  })

  it('prefers vendored upstream theme JSON for the first batch and caches resolved instances', () => {
    const firstTheme = getBundledColorTheme('one-dark-pro')
    const secondTheme = getBundledColorTheme('one-dark-pro')

    expect(firstTheme).toBe(secondTheme)
    expect(firstTheme).toEqual(expect.objectContaining({
      id: 'one-dark-pro',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(firstTheme?.colors['editor.background']).toBe('#282c34')
    expect(firstTheme?.colors['button.background']).toBe('#404754')
    expect(firstTheme?.tokenColors.length ?? 0).toBeGreaterThan(100)
  })
})