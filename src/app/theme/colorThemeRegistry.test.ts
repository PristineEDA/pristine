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
    expect(theme.colors['button.background']).toBe('#fe7c8ecc')
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

  it('resolves sixth-batch vendored upstream Dobri themes across A-series and C-series files', () => {
    const firstAmethystTheme = getBundledColorTheme('dobri-next-a06-amethyst')
    const secondAmethystTheme = getBundledColorTheme('dobri-next-a06-amethyst')
    const oxfordTheme = getBundledColorTheme('dobri-next-a07-oxford')
    const cupcakeTheme = getBundledColorTheme('dobri-next-c03-cupcake')
    const eveTheme = getBundledColorTheme('dobri-next-c09-eve')

    expect(firstAmethystTheme).toBe(secondAmethystTheme)
    expect(firstAmethystTheme).toEqual(expect.objectContaining({
      id: 'dobri-next-a06-amethyst',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(firstAmethystTheme?.colors['editor.background']).toBe('#150022')
    expect(firstAmethystTheme?.colors['editorLineNumber.foreground']).toBe('#5C6370')
    expect(firstAmethystTheme?.colors['editorLineNumber.activeForeground']).toBe('#BBBEBF')

    expect(oxfordTheme).toEqual(expect.objectContaining({
      id: 'dobri-next-a07-oxford',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(oxfordTheme?.colors['editor.background']).toBe('#263238')
    expect(oxfordTheme?.colors['activityBarBadge.background']).toBe('#64CA69')
    expect(oxfordTheme?.colors['input.background']).toBe('#263238')

    expect(cupcakeTheme).toEqual(expect.objectContaining({
      id: 'dobri-next-c03-cupcake',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(cupcakeTheme?.colors['editor.background']).toBe('#0b1015')
    expect(cupcakeTheme?.colors['editorLineNumber.foreground']).toBe('#858889')
    expect(cupcakeTheme?.colors['editorLineNumber.activeForeground']).toBe('#BBBEBF')

    expect(eveTheme).toEqual(expect.objectContaining({
      id: 'dobri-next-c09-eve',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(eveTheme?.colors['editor.foreground']).toBe('#97a7c8ff')
    expect(eveTheme?.colors['terminal.ansiCyan']).toBe('#89DDFF')
    expect(eveTheme?.colors['terminal.background']).toBe('#191A1B')
  })

  it('resolves seventh-batch vendored upstream One Dark Pro, GitHub accessibility, and Dracula Soft themes', () => {
    const firstNightFlatTheme = getBundledColorTheme('one-dark-pro-night-flat')
    const secondNightFlatTheme = getBundledColorTheme('one-dark-pro-night-flat')
    const githubLightHighContrastTheme = getBundledColorTheme('github-light-high-contrast')
    const githubDarkHighContrastTheme = getBundledColorTheme('github-dark-high-contrast')
    const draculaSoftTheme = getBundledColorTheme('dracula-soft')

    expect(firstNightFlatTheme).toBe(secondNightFlatTheme)
    expect(firstNightFlatTheme).toEqual(expect.objectContaining({
      id: 'one-dark-pro-night-flat',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(firstNightFlatTheme?.colors['editor.background']).toBe('#16191d')
    expect(firstNightFlatTheme?.colors['editorLineNumber.foreground']).toBe('#667187')
    expect(firstNightFlatTheme?.colors['terminal.background']).toBe('#16191d')

    expect(githubLightHighContrastTheme).toEqual(expect.objectContaining({
      id: 'github-light-high-contrast',
      kind: 'light',
      source: 'bundled',
    }))
    expect(githubLightHighContrastTheme?.colors['editor.background']).toBe('#ffffff')
    expect(githubLightHighContrastTheme?.colors['editorLineNumber.activeForeground']).toBe('#0e1116')
    expect(githubLightHighContrastTheme?.colors['input.background']).toBe('#ffffff')

    expect(githubDarkHighContrastTheme).toEqual(expect.objectContaining({
      id: 'github-dark-high-contrast',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(githubDarkHighContrastTheme?.colors['editor.background']).toBe('#0a0c10')
    expect(githubDarkHighContrastTheme?.colors['editorLineNumber.activeForeground']).toBe('#f0f3f6')
    expect(githubDarkHighContrastTheme?.colors['input.background']).toBe('#0a0c10')

    expect(draculaSoftTheme).toEqual(expect.objectContaining({
      id: 'dracula-soft',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(draculaSoftTheme?.colors['editor.background']).toBe('#282A36')
    expect(draculaSoftTheme?.colors['editorLineNumber.foreground']).toBe('#7b7f8b')
    expect(draculaSoftTheme?.colors['editorLineNumber.activeForeground']).toBe('#BBBEBF')
    expect(draculaSoftTheme?.colors['terminal.background']).toBe('#282A36')
  })

  it('resolves eighth-batch official vendored upstream themes across Copilot, C/C++ Themes, PowerShell, and Dark+ Syntax families', () => {
    const firstCopilotHigherContrastTheme = getBundledColorTheme('copilot-theme-higher-contrast')
    const secondCopilotHigherContrastTheme = getBundledColorTheme('copilot-theme-higher-contrast')
    const copilotTheme = getBundledColorTheme('copilot-theme')
    const visualStudioDarkTheme = getBundledColorTheme('visual-studio-dark-cpp')
    const visualStudio2017LightTheme = getBundledColorTheme('visual-studio-2017-light-cpp')
    const visualStudio2017DarkTheme = getBundledColorTheme('visual-studio-2017-dark-cpp')
    const visualStudioLightTheme = getBundledColorTheme('visual-studio-light-cpp')
    const powershellIseTheme = getBundledColorTheme('powershell-ise')
    const darkPlusSyntaxTheme = getBundledColorTheme('dark-plus-syntax')
    const lightPlusSyntaxTheme = getBundledColorTheme('light-plus-syntax')
    const lightPlusSyntaxHighContrastTheme = getBundledColorTheme('light-plus-syntax-high-contrast')

    expect(firstCopilotHigherContrastTheme).toBe(secondCopilotHigherContrastTheme)

    expect(copilotTheme).toEqual(expect.objectContaining({
      id: 'copilot-theme',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(copilotTheme?.colors['editor.background']).toBe('#232a2f')
    expect(copilotTheme?.colors['editorLineNumber.foreground']).toBe('#707a84')
    expect(copilotTheme?.tokenColors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        settings: expect.objectContaining({
          foreground: '#939da5',
        }),
      }),
    ]))

    expect(firstCopilotHigherContrastTheme).toEqual(expect.objectContaining({
      id: 'copilot-theme-higher-contrast',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(firstCopilotHigherContrastTheme?.colors['editor.background']).toBe('#232a2f')
    expect(firstCopilotHigherContrastTheme?.colors['editorLineNumber.activeForeground']).toBe('#d4dce4')
    expect(firstCopilotHigherContrastTheme?.tokenColors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        settings: expect.objectContaining({
          foreground: '#a8b2ba',
        }),
      }),
    ]))

    expect(visualStudioDarkTheme).toEqual(expect.objectContaining({
      id: 'visual-studio-dark-cpp',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(visualStudioDarkTheme?.colors['editor.background']).toBe('#1E1E1E')
    expect(visualStudioDarkTheme?.colors['editor.foreground']).toBe('#DADADA')
    expect(visualStudioDarkTheme?.colors['editorLineNumber.foreground']).toBe('#2b91af')

    expect(visualStudio2017LightTheme).toEqual(expect.objectContaining({
      id: 'visual-studio-2017-light-cpp',
      kind: 'light',
      source: 'bundled',
    }))
    expect(visualStudio2017LightTheme?.colors['editor.background']).toBe('#FFFFFF')
    expect(visualStudio2017LightTheme?.colors['editorWhitespace.foreground']).toBe('#2B91AF')

    expect(visualStudio2017DarkTheme).toEqual(expect.objectContaining({
      id: 'visual-studio-2017-dark-cpp',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(visualStudio2017DarkTheme?.colors['editor.foreground']).toBe('#D4D4D4')
    expect(visualStudio2017DarkTheme?.colors['editorWhitespace.foreground']).toBe('#204852')

    expect(visualStudioLightTheme).toEqual(expect.objectContaining({
      id: 'visual-studio-light-cpp',
      kind: 'light',
      source: 'bundled',
    }))
    expect(visualStudioLightTheme?.colors['editor.background']).toBe('#FFFFFF')
    expect(visualStudioLightTheme?.colors['editorLineNumber.foreground']).toBe('#2b91af')

    expect(powershellIseTheme).toEqual(expect.objectContaining({
      id: 'powershell-ise',
      kind: 'light',
      source: 'bundled',
    }))
    expect(powershellIseTheme?.colors['activityBar.background']).toBe('#E1ECF9')
    expect(powershellIseTheme?.colors['terminal.background']).toBe('#012456')
    expect(powershellIseTheme?.colors['terminal.foreground']).toBe('#F5F5F5')

    expect(darkPlusSyntaxTheme).toEqual(expect.objectContaining({
      id: 'dark-plus-syntax',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(darkPlusSyntaxTheme?.colors['editor.background']).toBe('#1e1e1e')
    expect(darkPlusSyntaxTheme?.colors['editorLineNumber.activeForeground']).toBe('#608b4e')
    expect(darkPlusSyntaxTheme?.colors['terminal.background']).toBe('#1e1e1e')

    expect(lightPlusSyntaxTheme).toEqual(expect.objectContaining({
      id: 'light-plus-syntax',
      kind: 'light',
      source: 'bundled',
    }))
    expect(lightPlusSyntaxTheme?.colors['editor.background']).toBe('#d4d4d4')
    expect(lightPlusSyntaxTheme?.colors['editorLineNumber.activeForeground']).toBe('#008000')
    expect(lightPlusSyntaxTheme?.colors['terminal.background']).toBe('#d4d4d4')

    expect(lightPlusSyntaxHighContrastTheme).toEqual(expect.objectContaining({
      id: 'light-plus-syntax-high-contrast',
      kind: 'light',
      source: 'bundled',
    }))
    expect(lightPlusSyntaxHighContrastTheme?.colors['editor.background']).toBe('#ffffff')
    expect(lightPlusSyntaxHighContrastTheme?.colors['editorLineNumber.activeForeground']).toBe('#008000')
    expect(lightPlusSyntaxHighContrastTheme?.colors['terminal.background']).toBe('#ffffff')
  })

  it('resolves ninth-batch vendored upstream Theme, Palenight, Vue, Spinel, and Light Owl themes through the manifest', () => {
    const firstThemeDarkerTheme = getBundledColorTheme('theme-darker')
    const secondThemeDarkerTheme = getBundledColorTheme('theme-darker')
    const themeTheme = getBundledColorTheme('theme')
    const themeFlatTheme = getBundledColorTheme('theme-flat')
    const themeMixTheme = getBundledColorTheme('theme-mix')
    const palenightTheme = getBundledColorTheme('palenight-theme')
    const palenightOperatorTheme = getBundledColorTheme('palenight-operator')
    const palenightMildContrastTheme = getBundledColorTheme('palenight-mild-contrast')
    const vueTheme = getBundledColorTheme('vue-theme')
    const vueThemeHighContrast = getBundledColorTheme('vue-theme-high-contrast')
    const spinelTheme = getBundledColorTheme('spinel')
    const spinelLightTheme = getBundledColorTheme('spinel-light')
    const lightOwlTheme = getBundledColorTheme('light-owl')

    expect(firstThemeDarkerTheme).toBe(secondThemeDarkerTheme)

    expect(themeTheme).toEqual(expect.objectContaining({
      id: 'theme',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(themeTheme?.colors['activityBar.background']).toBe('#282c34')
    expect(themeTheme?.colors['sideBar.background']).toBe('#21252b')

    expect(themeFlatTheme).toEqual(expect.objectContaining({
      id: 'theme-flat',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(themeFlatTheme?.colors['sideBar.background']).toBe('#282c34')

    expect(themeMixTheme).toEqual(expect.objectContaining({
      id: 'theme-mix',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(themeMixTheme?.colors['activityBar.background']).toBe('#21252b')

    expect(firstThemeDarkerTheme).toEqual(expect.objectContaining({
      id: 'theme-darker',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(firstThemeDarkerTheme?.colors['editor.background']).toBe('#23272e')
    expect(firstThemeDarkerTheme?.colors['sideBar.background']).toBe('#1e2227')
    expect(firstThemeDarkerTheme?.colors['terminal.background']).toBe('#23272e')

    expect(palenightTheme).toEqual(expect.objectContaining({
      id: 'palenight-theme',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(palenightTheme?.colors['activityBar.background']).toBe('#282C3D')
    expect(palenightTheme?.colors['editorLineNumber.foreground']).toBe('#4c5374')

    expect(palenightOperatorTheme).toEqual(expect.objectContaining({
      id: 'palenight-operator',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(palenightOperatorTheme?.colors['editor.background']).toBe('#292D3E')
    expect(palenightOperatorTheme?.tokenColors.length ?? 0).toBeGreaterThan(50)

    expect(palenightMildContrastTheme).toEqual(expect.objectContaining({
      id: 'palenight-mild-contrast',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(palenightMildContrastTheme?.colors['activityBar.background']).toBe('#242839')
    expect(palenightMildContrastTheme?.colors['sideBar.background']).toBe('#25293A')

    expect(vueTheme).toEqual(expect.objectContaining({
      id: 'vue-theme',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(vueTheme?.colors['activityBar.background']).toBe('#002b36')
    expect(vueTheme?.colors['editor.background']).toBe('#002b36')

    expect(vueThemeHighContrast).toEqual(expect.objectContaining({
      id: 'vue-theme-high-contrast',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(vueThemeHighContrast?.colors['activityBar.background']).toBe('#002933')
    expect(vueThemeHighContrast?.colors['editorLineNumber.activeForeground']).toBe('#d4d4d4dc')

    expect(spinelTheme).toEqual(expect.objectContaining({
      id: 'spinel',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(spinelTheme?.colors['editor.background']).toBe('#2f2f2f')
    expect(spinelTheme?.colors['terminal.background']).toBe('#2a2a2a')

    expect(spinelLightTheme).toEqual(expect.objectContaining({
      id: 'spinel-light',
      kind: 'light',
      source: 'bundled',
    }))
    expect(spinelLightTheme?.colors['editor.background']).toBe('#e3e2ec')
    expect(spinelLightTheme?.colors['terminal.background']).toBe('#e3e2ec')

    expect(lightOwlTheme).toEqual(expect.objectContaining({
      id: 'light-owl',
      kind: 'light',
      source: 'bundled',
    }))
    expect(lightOwlTheme?.colors['editor.background']).toBe('#FBFBFB')
    expect(lightOwlTheme?.colors['editorLineNumber.foreground']).toBe('#90A7B2')
    expect(lightOwlTheme?.colors['editorLineNumber.activeForeground']).toBe('#403f53')
  })

  it('resolves tenth-batch vendored upstream Moonlight, Andromeda, Darcula, Monokai, Atom, Min, Aura, Deepdark, and selected standalone themes through the manifest', () => {
    const firstAndromedaTheme = getBundledColorTheme('andromeda')
    const secondAndromedaTheme = getBundledColorTheme('andromeda')

    expect(firstAndromedaTheme).toBe(secondAndromedaTheme)

    const batchThemeExpectations = [
      { id: 'moonlight-ii', kind: 'dark' },
      { id: 'moonlight', kind: 'dark' },
      { id: 'andromeda', kind: 'dark' },
      { id: 'andromeda-colorizer', kind: 'dark' },
      { id: 'andromeda-bordered', kind: 'dark' },
      { id: 'darcula-theme', kind: 'dark' },
      { id: 'darcula-pycharm-dark-gui', kind: 'dark' },
      { id: 'darcula-pycharm-light-gui', kind: 'dark' },
      { id: 'darcula-theme-from-intellij', kind: 'dark' },
      { id: 'monokai-night', kind: 'dark' },
      { id: 'monokai-dark-soda', kind: 'dark' },
      { id: 'monokai-plusplus', kind: 'dark' },
      { id: 'monokai-plusplus-unified', kind: 'dark' },
      { id: 'atom-one-dark', kind: 'dark' },
      { id: 'atom-one-light', kind: 'light' },
      { id: 'atom-material-theme', kind: 'dark' },
      { id: 'min-dark', kind: 'dark' },
      { id: 'min-light', kind: 'light' },
      { id: 'aura-dark', kind: 'dark' },
      { id: 'aura-soft-dark', kind: 'dark' },
      { id: 'deepdark-material-theme', kind: 'dark' },
      { id: 'deepdark-material-theme-full-black', kind: 'dark' },
      { id: 'synthwave-84', kind: 'dark' },
      { id: 'cobalt2', kind: 'dark' },
      { id: 'omni', kind: 'dark' },
      { id: 'kanagawa', kind: 'dark' },
    ] as const

    for (const { id, kind } of batchThemeExpectations) {
      expect(getBundledColorTheme(id)).toEqual(expect.objectContaining({
        id,
        kind,
        source: 'bundled',
      }))
    }

    expect(firstAndromedaTheme).toEqual(expect.objectContaining({
      id: 'andromeda',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(firstAndromedaTheme?.colors['activityBar.background']).toBe('#23262E')
    expect(firstAndromedaTheme?.colors['editor.background']).toBe('#23262E')
    expect(firstAndromedaTheme?.colors['editor.foreground']).toBe('#D5CED9')

    const andromedaColorizerTheme = getBundledColorTheme('andromeda-colorizer')
    expect(andromedaColorizerTheme?.tokenColors.length ?? 0).toBeGreaterThan(50)
    expect(andromedaColorizerTheme?.tokenColors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        settings: expect.objectContaining({
          foreground: '#00e8c6',
        }),
      }),
    ]))

    const darculaPycharmLightGuiTheme = getBundledColorTheme('darcula-pycharm-light-gui')
    expect(darculaPycharmLightGuiTheme?.colors['editor.background']).toBe('#2B2B2B')
    expect(darculaPycharmLightGuiTheme?.colors['editorLineNumber.activeForeground']).toBe('#A4A3A3')
    expect(darculaPycharmLightGuiTheme?.colors['terminal.background']).toBe('#252526')

    const monokaiPlusplusUnifiedTheme = getBundledColorTheme('monokai-plusplus-unified')
    expect(monokaiPlusplusUnifiedTheme?.colors['activityBar.background']).toBe('#1c1c1c')
    expect(monokaiPlusplusUnifiedTheme?.colors['terminal.background']).toBe('#1c1c1c')

    const atomOneLightTheme = getBundledColorTheme('atom-one-light')
    expect(atomOneLightTheme?.colors['activityBar.background']).toBe('#FAFAFA')
    expect(atomOneLightTheme?.colors['editor.background']).toBe('#FAFAFA')
    expect(atomOneLightTheme?.colors['editorLineNumber.activeForeground']).toBe('#383A42')

    const minLightTheme = getBundledColorTheme('min-light')
    expect(minLightTheme?.colors['editor.background']).toBe('#ffffff')
    expect(minLightTheme?.colors['editorLineNumber.foreground']).toBe('#CCC')
    expect(minLightTheme?.colors['terminal.background']).toBe('#fff')

    const auraSoftDarkTheme = getBundledColorTheme('aura-soft-dark')
    expect(auraSoftDarkTheme?.colors['activityBar.background']).toBe('#21202e')
    expect(auraSoftDarkTheme?.colors['editor.background']).toBe('#21202e')
    expect(auraSoftDarkTheme?.colors['terminal.background']).toBe('#21202e')

    const deepdarkMaterialThemeFullBlack = getBundledColorTheme('deepdark-material-theme-full-black')
    expect(deepdarkMaterialThemeFullBlack?.colors['activityBar.background']).toBe('#080808')
    expect(deepdarkMaterialThemeFullBlack?.colors['editor.background']).toBe('#080808')
    expect(deepdarkMaterialThemeFullBlack?.colors['editorLineNumber.foreground']).toBe('#50504F')

    const cobalt2Theme = getBundledColorTheme('cobalt2')
    expect(cobalt2Theme?.colors['editor.background']).toBe('#193549')
    expect(cobalt2Theme?.colors['editorLineNumber.foreground']).toBe('#aaa')
    expect(cobalt2Theme?.colors['terminal.background']).toBe('#122738')

    const kanagawaTheme = getBundledColorTheme('kanagawa')
    expect(kanagawaTheme?.colors['editor.background']).toBe('#1F1F28')
    expect(kanagawaTheme?.colors['editorLineNumber.foreground']).toBe('#54546D')
    expect(kanagawaTheme?.colors['editorLineNumber.activeForeground']).toBe('#957FB8')
    expect(kanagawaTheme?.colors['terminal.background']).toBe('#1F1F28')
  })

  it('resolves eleventh-batch vendored upstream GitHub Light, Winter is Coming, Slack, Hopscotch, Gruvbox Material, and Mayukai themes through the manifest', () => {
    const firstSlackAubergineDarkEditorTheme = getBundledColorTheme('slack-aubergine-dark-editor')
    const secondSlackAubergineDarkEditorTheme = getBundledColorTheme('slack-aubergine-dark-editor')

    expect(firstSlackAubergineDarkEditorTheme).toBe(secondSlackAubergineDarkEditorTheme)

    const batchThemeExpectations = [
      { id: 'github-light-theme', kind: 'light' },
      { id: 'github-light-theme-gray', kind: 'light' },
      { id: 'winter-is-coming-dark-blue', kind: 'dark' },
      { id: 'winter-is-coming-light', kind: 'light' },
      { id: 'winter-is-coming-dark-black', kind: 'dark' },
      { id: 'slack-dark-mode', kind: 'dark' },
      { id: 'slack-aubergine', kind: 'dark' },
      { id: 'slack-aubergine-dark', kind: 'dark' },
      { id: 'slack-aubergine-dark-editor', kind: 'dark' },
      { id: 'slack-monument', kind: 'dark' },
      { id: 'slack-hoth', kind: 'light' },
      { id: 'slack-protanopia-deuteranopia', kind: 'dark' },
      { id: 'slack-choco-mint', kind: 'dark' },
      { id: 'slack-ochin', kind: 'dark' },
      { id: 'slack-work-hard', kind: 'dark' },
      { id: 'slack-tritanopia', kind: 'dark' },
      { id: 'hopscotch', kind: 'dark' },
      { id: 'hopscotch-mono', kind: 'dark' },
      { id: 'hopscotch-proofreader', kind: 'dark' },
      { id: 'gruvbox-material-dark', kind: 'dark' },
      { id: 'gruvbox-material-light', kind: 'light' },
      { id: 'mayukai-dark', kind: 'dark' },
      { id: 'mayukai-mirage-gruvbox-darktooth', kind: 'dark' },
      { id: 'mayukai-midnight', kind: 'dark' },
    ] as const

    for (const { id, kind } of batchThemeExpectations) {
      expect(getBundledColorTheme(id)).toEqual(expect.objectContaining({
        id,
        kind,
        source: 'bundled',
      }))
    }

    expect(firstSlackAubergineDarkEditorTheme).toEqual(expect.objectContaining({
      id: 'slack-aubergine-dark-editor',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(firstSlackAubergineDarkEditorTheme?.colors['activityBar.background']).toBe('#261C25')
    expect(firstSlackAubergineDarkEditorTheme?.colors['editor.background']).toBe('#3E313C')
    expect(firstSlackAubergineDarkEditorTheme?.colors['editor.foreground']).toBe('#f6f6f4')
    expect(firstSlackAubergineDarkEditorTheme?.colors['editorLineNumber.foreground']).toBe('#b9b9b9')

    const githubLightThemeGray = getBundledColorTheme('github-light-theme-gray')
    expect(githubLightThemeGray?.colors['activityBar.background']).toBe('#f0f0f0')
    expect(githubLightThemeGray?.colors['editor.background']).toBe('#f0f0f0')
    expect(githubLightThemeGray?.colors['editorLineNumber.foreground']).toBe('#babbbc')
    expect(githubLightThemeGray?.colors['editorLineNumber.activeForeground']).toBe('#000000')

    const winterIsComingLightTheme = getBundledColorTheme('winter-is-coming-light')
    expect(winterIsComingLightTheme?.colors['editor.background']).toBe('#FFFFFF')
    expect(winterIsComingLightTheme?.colors['editor.foreground']).toBe('#236ebf')
    expect(winterIsComingLightTheme?.colors['editorLineNumber.foreground']).toBe('#2f86d2')

    const hopscotchProofreaderTheme = getBundledColorTheme('hopscotch-proofreader')
    expect(hopscotchProofreaderTheme?.colors['activityBar.background']).toBe('#392f4b')
    expect(hopscotchProofreaderTheme?.colors['editor.background']).toBe('#322931')
    expect(hopscotchProofreaderTheme?.colors['editorLineNumber.foreground']).toBe('#b9b5b8')
    expect(hopscotchProofreaderTheme?.tokenColors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        settings: expect.objectContaining({
          foreground: '#b9b5b8',
        }),
      }),
    ]))

    const gruvboxMaterialDarkTheme = getBundledColorTheme('gruvbox-material-dark')
    expect(gruvboxMaterialDarkTheme?.colors['activityBar.background']).toBe('#292828')
    expect(gruvboxMaterialDarkTheme?.colors['editor.background']).toBe('#292828')
    expect(gruvboxMaterialDarkTheme?.colors['editorLineNumber.foreground']).toBe('#7c6f64')
    expect(gruvboxMaterialDarkTheme?.colors['editorLineNumber.activeForeground']).toBe('#928374')

    const mayukaiMidnightTheme = getBundledColorTheme('mayukai-midnight')
    expect(mayukaiMidnightTheme?.colors['activityBar.background']).toBe('#0d131f')
    expect(mayukaiMidnightTheme?.colors['editor.background']).toBe('#141824')
    expect(mayukaiMidnightTheme?.colors['editorLineNumber.activeForeground']).toBe('#707a8ccc')
    expect(mayukaiMidnightTheme?.colors['terminal.background']).toBe('#1b1c24')
  })

  it('resolves the final-batch vendored upstream remaining bundled themes through the manifest', () => {
    const firstElectronTheme = getBundledColorTheme('electron')
    const secondElectronTheme = getBundledColorTheme('electron')

    expect(firstElectronTheme).toBe(secondElectronTheme)

    const batchThemeExpectations = [
      { id: 'om-theme-default-dracula-italic', kind: 'dark' },
      { id: 'pink-cat-boo', kind: 'dark' },
      { id: 'naruto-dark', kind: 'dark' },
      { id: 'alabaster', kind: 'light' },
      { id: 'horizon', kind: 'dark' },
      { id: 'horizon-bright', kind: 'light' },
      { id: 'winter-is-coming-dark', kind: 'dark' },
      { id: 'hackr-theme', kind: 'dark' },
      { id: 'one-monokai', kind: 'dark' },
      { id: 'snazzy-light', kind: 'light' },
      { id: 'hack-the-box', kind: 'dark' },
      { id: 'hack-the-box-lite', kind: 'dark' },
      { id: 'jellyfish', kind: 'dark' },
      { id: 'electron', kind: 'dark' },
    ] as const

    for (const { id, kind } of batchThemeExpectations) {
      expect(getBundledColorTheme(id)).toEqual(expect.objectContaining({
        id,
        kind,
        source: 'bundled',
      }))
    }

    const omTheme = getBundledColorTheme('om-theme-default-dracula-italic')
    expect(omTheme?.colors['activityBar.background']).toBe('#13141f')
    expect(omTheme?.colors['editor.background']).toBe('#13141f')
    expect(omTheme?.colors['editorLineNumber.foreground']).toBe('#6272A4')
    expect(omTheme?.colors['terminal.background']).toBe('#13141f')

    const alabasterTheme = getBundledColorTheme('alabaster')
    expect(alabasterTheme?.colors['activityBar.background']).toBe('#F0F0F0')
    expect(alabasterTheme?.colors['editor.background']).toBe('#F7F7F7')
    expect(alabasterTheme?.colors['editorLineNumber.foreground']).toBe('#9DA39A')
    expect(alabasterTheme?.colors['editor.findMatchBackground']).toBe('#FFBC5D')

    const horizonBrightTheme = getBundledColorTheme('horizon-bright')
    expect(horizonBrightTheme?.colors['activityBar.background']).toBe('#FDF0ED')
    expect(horizonBrightTheme?.colors['editor.background']).toBe('#FDF0ED')
    expect(horizonBrightTheme?.colors['editorLineNumber.foreground']).toBe('#06060C1A')
    expect(horizonBrightTheme?.colors['editorLineNumber.activeForeground']).toBe('#06060C80')

    const winterIsComingDarkTheme = getBundledColorTheme('winter-is-coming-dark')
    expect(winterIsComingDarkTheme?.colors['activityBar.background']).toBe('#282822')
    expect(winterIsComingDarkTheme?.colors['editor.background']).toBe('#282822')
    expect(winterIsComingDarkTheme?.colors['editor.foreground']).toBe('#a7dbf7')
    expect(winterIsComingDarkTheme?.colors['editorLineNumber.foreground']).toBe('#219fd5')

    expect(firstElectronTheme).toEqual(expect.objectContaining({
      id: 'electron',
      kind: 'dark',
      source: 'bundled',
    }))
    expect(firstElectronTheme?.colors['activityBar.background']).toBe('#141820')
    expect(firstElectronTheme?.colors['editor.background']).toBe('#212836')
    expect(firstElectronTheme?.colors['editorLineNumber.foreground']).toBe('#3D4D67')
    expect(firstElectronTheme?.colors['editorLineNumber.activeForeground']).toBe('#818ca6')
    expect(firstElectronTheme?.colors['terminal.background']).toBe('#1C212E')
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