import { describe, expect, it, vi } from 'vitest'
import {
  createMonacoThemeDefinition,
  defineMonacoTheme,
  registerBuiltInMonacoThemes,
} from './monacoColorTheme'
import type { ResolvedColorTheme } from './colorThemeTypes'

function createTheme(id = 'imported-night'): ResolvedColorTheme {
  return {
    id,
    label: 'Night',
    description: 'Imported night theme.',
    author: 'Theme author',
    kind: 'dark',
    source: 'imported',
    colors: {
      'editor.background': '#101010',
      'editor.foreground': '#f0f0f0',
    },
    tokenColors: [
      {
        scope: 'keyword, storage.type',
        settings: {
          foreground: '#abc',
          fontStyle: 'bold',
        },
      },
    ],
    semanticHighlighting: true,
    semanticTokenColors: {},
  }
}

function createMonacoMock() {
  return {
    editor: {
      defineTheme: vi.fn(),
    },
  }
}

describe('monacoColorTheme', () => {
  it('reuses the converted Monaco definition for the same resolved theme object', () => {
    const theme = createTheme()

    const firstDefinition = createMonacoThemeDefinition(theme)
    const secondDefinition = createMonacoThemeDefinition(theme)

    expect(secondDefinition).toBe(firstDefinition)
    expect(firstDefinition.rules).toEqual([
      {
        token: 'keyword',
        foreground: 'aabbcc',
        background: undefined,
        fontStyle: 'bold',
      },
      {
        token: 'storage.type',
        foreground: 'aabbcc',
        background: undefined,
        fontStyle: 'bold',
      },
    ])
  })

  it('normalizes short hex UI colors before defining a Monaco theme', () => {
    const theme = createTheme('imported-day')

    theme.kind = 'light'
    theme.colors = {
      'editor.background': '#f7f7f7',
      'editor.foreground': '#000',
      'statusBar.foreground': '#fff',
    }

    expect(createMonacoThemeDefinition(theme).colors).toEqual({
      'editor.background': '#f7f7f7',
      'editor.foreground': '#000000',
      'statusBar.foreground': '#ffffff',
    })
  })

  it('defines the same resolved theme only once for a Monaco instance', () => {
    const monaco = createMonacoMock()
    const theme = createTheme()

    defineMonacoTheme(monaco, theme)
    defineMonacoTheme(monaco, theme)

    expect(monaco.editor.defineTheme).toHaveBeenCalledTimes(1)
    expect(monaco.editor.defineTheme).toHaveBeenCalledWith(theme.id, createMonacoThemeDefinition(theme))
  })

  it('registers built-in themes only once per Monaco instance', () => {
    const monaco = createMonacoMock()

    registerBuiltInMonacoThemes(monaco)
    const firstRegistrationCount = monaco.editor.defineTheme.mock.calls.length
    registerBuiltInMonacoThemes(monaco)

    expect(firstRegistrationCount).toBeGreaterThan(0)
    expect(monaco.editor.defineTheme).toHaveBeenCalledTimes(firstRegistrationCount)
  })

  it('keeps registration caches isolated between Monaco instances', () => {
    const firstMonaco = createMonacoMock()
    const secondMonaco = createMonacoMock()
    const theme = createTheme('imported-day')

    defineMonacoTheme(firstMonaco, theme)
    defineMonacoTheme(secondMonaco, theme)

    expect(firstMonaco.editor.defineTheme).toHaveBeenCalledTimes(1)
    expect(secondMonaco.editor.defineTheme).toHaveBeenCalledTimes(1)
  })
})
