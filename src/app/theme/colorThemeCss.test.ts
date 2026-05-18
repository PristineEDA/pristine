import { describe, expect, it } from 'vitest'

import { getAppliedColorThemeVariables } from './colorThemeCss'
import type { ResolvedColorTheme } from './colorThemeTypes'

function createTheme(colors: Record<string, string>): ResolvedColorTheme {
  return {
    id: 'test-theme',
    label: 'Test Theme',
    description: 'Theme used by unit tests',
    author: 'Pristine',
    kind: 'dark',
    source: 'imported',
    colors,
    tokenColors: [],
    semanticHighlighting: true,
    semanticTokenColors: {},
  }
}

describe('colorThemeCss', () => {
  it('maps StatusBar and unified chrome colors from VS Code workbench slots', () => {
    const variables = getAppliedColorThemeVariables(createTheme({
      foreground: '#cccccc',
      'editor.background': '#101010',
      'panel.background': '#181818',
      'panel.border': '#303030',
      'statusBar.background': '#005f9e',
      'statusBar.foreground': '#ffffff',
      'statusBar.border': '#004b7d',
      'statusBarItem.hoverBackground': '#0e73bd',
      'titleBar.activeBackground': '#222222',
      'activityBar.background': '#333333',
    }))

    expect(variables['--ide-statusbar-bg']).toBe('#005f9e')
    expect(variables['--ide-statusbar-fg']).toBe('#ffffff')
    expect(variables['--ide-statusbar-border']).toBe('#004b7d')
    expect(variables['--ide-statusbar-hover']).toBe('#0e73bd')
    expect(variables['--ide-unified-chrome-bg']).toBe('#005f9e')
    expect(variables['--ide-unified-chrome-fg']).toBe('#ffffff')
    expect(variables['--ide-unified-chrome-hover']).toBe('#0e73bd')
  })
})