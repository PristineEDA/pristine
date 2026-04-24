import { describe, expect, it } from 'vitest'

import { editorThemeOptions } from './editorSettings'
import { getEditorThemeDefinition, getEditorThemePreview } from './monacoThemes'

describe('monacoThemes', () => {
  it('includes the latest bundled editor theme additions', () => {
    expect(editorThemeOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'theme', label: 'Theme', author: 'Mhammed Talhaouy' }),
        expect.objectContaining({ value: 'theme-flat', label: 'Theme Flat', author: 'Mhammed Talhaouy' }),
        expect.objectContaining({ value: 'theme-mix', label: 'Theme Mix', author: 'Mhammed Talhaouy' }),
        expect.objectContaining({ value: 'theme-darker', label: 'Theme Darker', author: 'Mhammed Talhaouy' }),
        expect.objectContaining({ value: 'palenight-operator', label: 'Palenight Operator', author: 'Olaolu Olawuyi' }),
        expect.objectContaining({ value: 'palenight-mild-contrast', label: 'Palenight (Mild Contrast)', author: 'Olaolu Olawuyi' }),
        expect.objectContaining({ value: 'andromeda-colorizer', label: 'Andromeda Colorizer', author: 'Eliver Lara' }),
        expect.objectContaining({ value: 'andromeda-bordered', label: 'Andromeda Bordered', author: 'Eliver Lara' }),
        expect.objectContaining({ value: 'dracula-soft', label: 'Dracula Theme Soft', author: 'Dracula Theme' }),
        expect.objectContaining({ value: 'dracula-at-night', label: 'Dracula At Night', author: 'Billy Ceskavich' }),
        expect.objectContaining({ value: 'om-theme-default-dracula-italic', label: 'OM Theme (Default Dracula Italic)', author: 'Otávio Miranda' }),
        expect.objectContaining({ value: 'pink-cat-boo', label: 'Pink Cat Boo', author: 'Fiona Fan' }),
        expect.objectContaining({ value: 'naruto-dark', label: 'NarutoDark', author: 'Thomaz' }),
        expect.objectContaining({ value: 'macos-modern-dark-ventura-xcode-default', label: 'MacOS Modern Dark - Ventura Xcode Default', author: 'David B. Waters' }),
        expect.objectContaining({ value: 'macos-modern-light-ventura-xcode-default', label: 'MacOS Modern Light - Ventura Xcode Default', author: 'David B. Waters' }),
        expect.objectContaining({ value: 'dobri-next-a06-amethyst', label: 'Dobri Next -A06- Amethyst', author: 'Sergio Dobri' }),
        expect.objectContaining({ value: 'rainglow-peacock', label: 'Peacock (rainglow)', author: 'Dayle Rees' }),
        expect.objectContaining({ value: 'noctis-azureus', label: 'Noctis Azureus', author: 'Liviu Schera' }),
        expect.objectContaining({ value: 'noctis-bordo', label: 'Noctis Bordo', author: 'Liviu Schera' }),
        expect.objectContaining({ value: 'noctis-obscuro', label: 'Noctis Obscuro', author: 'Liviu Schera' }),
        expect.objectContaining({ value: 'noctis-sereno', label: 'Noctis Sereno', author: 'Liviu Schera' }),
        expect.objectContaining({ value: 'noctis-uva', label: 'Noctis Uva', author: 'Liviu Schera' }),
        expect.objectContaining({ value: 'noctis-minimus', label: 'Noctis Minimus', author: 'Liviu Schera' }),
        expect.objectContaining({ value: 'noctis-hibernus', label: 'Noctis Hibernus', author: 'Liviu Schera' }),
        expect.objectContaining({ value: 'noctis-lilac', label: 'Noctis Lilac', author: 'Liviu Schera' }),
        expect.objectContaining({ value: 'ayu-mirage-bordered', label: 'Ayu Mirage Bordered', author: 'teabyii' }),
        expect.objectContaining({ value: 'ayu-light-bordered', label: 'Ayu Light Bordered', author: 'teabyii' }),
        expect.objectContaining({ value: 'ayu-dark-bordered', label: 'Ayu Dark Bordered', author: 'teabyii' }),
        expect.objectContaining({ value: 'slack-aubergine', label: 'Slack Theme Aubergine', author: 'Felipe Mendes' }),
        expect.objectContaining({ value: 'slack-aubergine-dark', label: 'Slack Theme Aubergine Dark', author: 'Felipe Mendes' }),
        expect.objectContaining({ value: 'slack-monument', label: 'Slack Theme Monument', author: 'Felipe Mendes' }),
        expect.objectContaining({ value: 'slack-hoth', label: 'Slack Theme Hoth', author: 'Felipe Mendes' }),
        expect.objectContaining({ value: 'slack-choco-mint', label: 'Slack Theme Choco Mint', author: 'Felipe Mendes' }),
        expect.objectContaining({ value: 'slack-ochin', label: 'Slack Theme Ochin', author: 'Felipe Mendes' }),
        expect.objectContaining({ value: 'slack-protanopia-deuteranopia', label: 'Slack Theme Protanopia & Deuteranopia', author: 'Felipe Mendes' }),
        expect.objectContaining({ value: 'slack-work-hard', label: 'Slack Theme Work Hard', author: 'Felipe Mendes' }),
        expect.objectContaining({ value: 'slack-tritanopia', label: 'Slack Theme Tritanopia', author: 'Felipe Mendes' }),
        expect.objectContaining({ value: 'gruvbox-dark-medium', label: 'Gruvbox Dark Medium', author: 'jdinhify' }),
        expect.objectContaining({ value: 'gruvbox-dark-soft', label: 'Gruvbox Dark Soft', author: 'jdinhify' }),
        expect.objectContaining({ value: 'gruvbox-light-medium', label: 'Gruvbox Light Medium', author: 'jdinhify' }),
        expect.objectContaining({ value: 'gruvbox-light-soft', label: 'Gruvbox Light Soft', author: 'jdinhify' }),
        expect.objectContaining({ value: 'one-dark-pro-flat', label: 'One Dark Pro Flat', author: 'Binaryify' }),
        expect.objectContaining({ value: 'one-dark-pro-darker', label: 'One Dark Pro Darker', author: 'Binaryify' }),
        expect.objectContaining({ value: 'one-dark-pro-mix', label: 'One Dark Pro Mix', author: 'Binaryify' }),
        expect.objectContaining({ value: 'one-dark-pro-night-flat', label: 'One Dark Pro Night Flat', author: 'Binaryify' }),
        expect.objectContaining({ value: 'visual-studio-2017-dark-cpp', label: '2017 Dark (Visual Studio - C/C++)', author: 'Microsoft' }),
        expect.objectContaining({ value: 'visual-studio-light-cpp', label: 'Light (Visual Studio - C/C++)', author: 'Microsoft' }),
        expect.objectContaining({ value: 'copilot-theme-higher-contrast', label: 'Copilot Theme - Higher Contrast', author: 'Benjamin Benais' }),
        expect.objectContaining({ value: 'jellyfish', label: 'JellyFish', author: 'Pawel Borkar' }),
        expect.objectContaining({ value: 'spinel', label: 'Spinel', author: 'Shopify' }),
        expect.objectContaining({ value: 'spinel-light', label: 'Spinel Light', author: 'Shopify' }),
        expect.objectContaining({ value: 'visual-studio-dark-cpp', label: 'Dark (Visual Studio - C/C++)', author: 'Microsoft' }),
        expect.objectContaining({ value: 'visual-studio-2017-light-cpp', label: '2017 Light (Visual Studio - C/C++)', author: 'Microsoft' }),
        expect.objectContaining({ value: 'powershell-ise', label: 'PowerShell ISE', author: 'Microsoft' }),
        expect.objectContaining({ value: 'github-light-theme', label: 'Github Light Theme', author: 'Hyzeta' }),
        expect.objectContaining({ value: 'github-light-theme-gray', label: 'Github Light Theme - Gray', author: 'Hyzeta' }),
        expect.objectContaining({ value: 'github-light-colorblind', label: 'GitHub Light Colorblind', author: 'GitHub' }),
        expect.objectContaining({ value: 'github-dark-colorblind', label: 'GitHub Dark Colorblind', author: 'GitHub' }),
        expect.objectContaining({ value: 'github-light-default', label: 'GitHub Light Default', author: 'GitHub' }),
        expect.objectContaining({ value: 'github-light-high-contrast', label: 'GitHub Light High Contrast', author: 'GitHub' }),
        expect.objectContaining({ value: 'github-dark-high-contrast', label: 'GitHub Dark High Contrast', author: 'GitHub' }),
        expect.objectContaining({ value: 'github-dark-default', label: 'GitHub Dark Default', author: 'GitHub' }),
        expect.objectContaining({ value: 'tokyo-night-light', label: 'Tokyo Night Light', author: 'enkia' }),
        expect.objectContaining({ value: 'vue-theme-high-contrast', label: 'Vue Theme High Contrast', author: 'Mario Rodeghiero' }),
        expect.objectContaining({ value: 'github-dark-dimmed', label: 'GitHub Dark Dimmed', author: 'GitHub' }),
        expect.objectContaining({ value: 'winter-is-coming-dark-black', label: 'Winter is Coming (Dark Black)', author: 'John Papa' }),
        expect.objectContaining({ value: 'copilot-theme', label: 'Copilot Theme', author: 'Benjamin Benais' }),
        expect.objectContaining({ value: 'deepdark-material-theme', label: 'Deepdark Material Theme', author: 'Nimda' }),
        expect.objectContaining({ value: 'deepdark-material-theme-full-black', label: 'Deepdark Material Theme | Full Black Version', author: 'Nimda' }),
        expect.objectContaining({ value: 'hack-the-box', label: 'Hack The Box', author: 'silofy' }),
        expect.objectContaining({ value: 'hack-the-box-lite', label: 'Hack The Box-Lite', author: 'silofy' }),
        expect.objectContaining({ value: 'monokai-dark-soda', label: 'Monokai Dark Soda', author: 'Adam Caviness' }),
        expect.objectContaining({ value: 'mayukai-dark', label: 'Mayukai Dark', author: 'Gulajava Ministudio' }),
        expect.objectContaining({ value: 'mayukai-mirage-gruvbox-darktooth', label: 'Mayukai Mirage Gruvbox Darktooth', author: 'Gulajava Ministudio' }),
        expect.objectContaining({ value: 'mayukai-midnight', label: 'Mayukai Midnight', author: 'Gulajava Ministudio' }),
        expect.objectContaining({ value: 'moonlight', label: 'Moonlight', author: 'atomiks' }),
        expect.objectContaining({ value: 'gruvbox-material-dark', label: 'Gruvbox Material Dark', author: 'sainnhe' }),
        expect.objectContaining({ value: 'gruvbox-material-light', label: 'Gruvbox Material Light', author: 'sainnhe' }),
        expect.objectContaining({ value: 'atom-material-theme', label: 'Atom Material Theme', author: 'tobiasalthoff' }),
        expect.objectContaining({ value: 'hopscotch', label: 'Hopscotch', author: 'Jan T. Sott' }),
        expect.objectContaining({ value: 'hopscotch-mono', label: 'Hopscotch Mono', author: 'Jan T. Sott' }),
        expect.objectContaining({ value: 'hopscotch-proofreader', label: 'Hopscotch [proofreader]', author: 'Jan T. Sott' }),
        expect.objectContaining({ value: 'monokai-plusplus', label: 'Monokai++', author: 'Davide Casella' }),
        expect.objectContaining({ value: 'darcula-pycharm-dark-gui', label: 'Darcula Pycharm with Dark GUI', author: 'garytyler' }),
        expect.objectContaining({ value: 'darcula-pycharm-light-gui', label: 'Darcula Pycharm with Light GUI', author: 'garytyler' }),
        expect.objectContaining({ value: 'darcula-theme-from-intellij', label: 'Darcula Theme from IntelliJ', author: 'Minh Tri Nguyen' }),
        expect.objectContaining({ value: 'electron', label: 'Electron', author: 'Kus Cámara' }),
        expect.objectContaining({ value: 'dark-plus-syntax', label: 'dark-plus-syntax', author: 'dunstontc' }),
        expect.objectContaining({ value: 'light-plus-syntax', label: 'light-plus-syntax', author: 'dunstontc' }),
        expect.objectContaining({ value: 'light-plus-syntax-high-contrast', label: 'light-plus-syntax (high contrast)', author: 'dunstontc' }),
        expect.objectContaining({ value: 'rose-pine-moon', label: 'Rose Pine Moon', author: 'Rose Pine' }),
        expect.objectContaining({ value: 'kanagawa', label: 'Kanagawa', author: 'barklan' }),
        expect.objectContaining({ value: 'palenight-theme', label: 'Palenight Theme', author: 'Olaolu Olawuyi' }),
        expect.objectContaining({ value: 'catppuccin-frappe', label: 'Catppuccin Frappe', author: 'Catppuccin Organization' }),
        expect.objectContaining({ value: 'tokyo-night-storm', label: 'Tokyo Night Storm', author: 'enkia' }),
        expect.objectContaining({ value: 'vue-theme', label: 'Vue Theme', author: 'Mario Rodeghiero' }),
      ]),
    )
    expect(editorThemeOptions.length).toBeGreaterThanOrEqual(140)
  })

  it('preserves upstream Monaco base themes for Slack variants', () => {
    expect(getEditorThemePreview('slack-aubergine', null).base).toBe('vs')
    expect(getEditorThemePreview('slack-aubergine-dark', null).base).toBe('vs-dark')
    expect(getEditorThemePreview('slack-monument', null).base).toBe('vs-dark')
    expect(getEditorThemePreview('slack-hoth', null).base).toBe('vs')
    expect(getEditorThemePreview('slack-choco-mint', null).base).toBe('vs-dark')
    expect(getEditorThemePreview('slack-ochin', null).base).toBe('vs')
    expect(getEditorThemePreview('slack-protanopia-deuteranopia', null).base).toBe('vs-dark')
    expect(getEditorThemePreview('slack-work-hard', null).base).toBe('vs-dark')
    expect(getEditorThemePreview('slack-tritanopia', null).base).toBe('vs-dark')
  })

  it('exposes preview data for every editor theme option', () => {
    for (const option of editorThemeOptions) {
      const preview = getEditorThemePreview(option.value, null)

      expect(option.author.length).toBeGreaterThan(0)
      expect(option.sourceUrl).toMatch(/^https:\/\//)
      expect(option.license.length).toBeGreaterThan(0)
      expect(['vs', 'vs-dark']).toContain(preview.base)
      expect(preview.palette.background).toMatch(/^#.+/)
      expect(preview.palette.foreground).toMatch(/^#.+/)
      expect(preview.palette.comment).toMatch(/^#.+/)
      expect(preview.palette.selection).toMatch(/^#.+/)
      expect(preview.palette.pink).toMatch(/^#.+/)
      expect(preview.palette.yellow).toMatch(/^#.+/)
      expect(preview.palette.cyan).toMatch(/^#.+/)
      expect(preview.palette.green).toMatch(/^#.+/)
    }
  })

  it('does not bundle GPL-family copyleft editor themes', () => {
    for (const option of editorThemeOptions) {
      expect(option.license).not.toMatch(/\b(?:AGPL|LGPL|GPL)\b/i)
    }
  })

  it('falls back to the bundled dracula palette without DOM styles', () => {
    const preview = getEditorThemePreview('dracula', null)

    expect(preview.base).toBe('vs-dark')
    expect(preview.palette.background).toBe('#282a36')
    expect(preview.palette.foreground).toBe('#f8f8f2')
    expect(preview.palette.selection).toBe('#44475a')
    expect(preview.palette.comment).toBe('#6272a4')
  })

  it('builds monaco definitions from the shared preview palette', () => {
    const preview = getEditorThemePreview('github-dark', null)
    const definition = getEditorThemeDefinition('github-dark', null)

    expect(definition.base).toBe(preview.base)
    expect(definition.colors['editor.background']).toBe(preview.palette.background)
    expect(definition.colors['editor.foreground']).toBe(preview.palette.foreground)
    expect(definition.colors['editor.selectionBackground']).toBe(preview.palette.selection)
    expect(definition.colors['editorLineNumber.foreground']).toBe(preview.palette.comment)
  })
})