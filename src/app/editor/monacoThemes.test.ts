import { describe, expect, it } from 'vitest'

import { editorThemeOptions } from './editorSettings'
import { getEditorThemeDefinition, getEditorThemePreview } from './monacoThemes'

describe('monacoThemes', () => {
  it('includes the latest bundled editor theme additions', () => {
    expect(editorThemeOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'hackr-theme', label: 'Hackr.io Theme', author: 'Robert Johns' }),
        expect.objectContaining({ value: 'light-owl', label: 'Light Owl', author: 'Sarah Drasner' }),
        expect.objectContaining({ value: 'one-monokai', label: 'One Monokai', author: 'Joshua Azemoh' }),
        expect.objectContaining({ value: 'slack-dark-mode', label: 'Slack Theme Dark Mode', author: 'Felipe Mendes' }),
      ]),
    )
    expect(editorThemeOptions.length).toBeGreaterThanOrEqual(46)
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