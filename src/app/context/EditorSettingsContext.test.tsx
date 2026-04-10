import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorSettingsProvider, useEditorSettings } from './EditorSettingsContext'

function EditorSettingsProbe() {
  const { fontFamily, fontSize, setFontFamily, setFontSize, setTheme, theme } = useEditorSettings()

  return (
    <div>
      <span data-testid="editor-font-family">{fontFamily}</span>
      <span data-testid="editor-font-size">{fontSize}</span>
      <span data-testid="editor-theme">{theme}</span>
      <button data-testid="set-font-family" onClick={() => setFontFamily('monaspace-neon')}>
        Set font family
      </button>
      <button data-testid="set-font-size" onClick={() => setFontSize(18)}>
        Set font size
      </button>
      <button data-testid="set-invalid-font-size" onClick={() => setFontSize(99)}>
        Set invalid font size
      </button>
      <button data-testid="set-theme" onClick={() => setTheme('github-dark')}>
        Set theme
      </button>
    </div>
  )
}

describe('EditorSettingsContext', () => {
  beforeEach(() => {
    vi.mocked(window.electronAPI!.config.get).mockReset()
    vi.mocked(window.electronAPI!.config.set).mockReset()
  })

  it('defaults to Dracula and 13px when persisted config is missing', () => {
    render(
      <EditorSettingsProvider>
        <EditorSettingsProbe />
      </EditorSettingsProvider>,
    )

    expect(screen.getByTestId('editor-font-size')).toHaveTextContent('13')
    expect(screen.getByTestId('editor-font-family')).toHaveTextContent('jetbrains-mono')
    expect(screen.getByTestId('editor-theme')).toHaveTextContent('dracula')
  })

  it('reads persisted editor settings from config', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'editor.fontFamily'
        ? 'fira-code'
        : key === 'editor.fontSize'
          ? 17
          : key === 'editor.theme'
            ? 'night-owl'
            : null,
    )

    render(
      <EditorSettingsProvider>
        <EditorSettingsProbe />
      </EditorSettingsProvider>,
    )

    expect(screen.getByTestId('editor-font-family')).toHaveTextContent('fira-code')
    expect(screen.getByTestId('editor-font-size')).toHaveTextContent('17')
    expect(screen.getByTestId('editor-theme')).toHaveTextContent('night-owl')
  })

  it('persists font family, font size and theme updates and clamps invalid values', () => {
    render(
      <EditorSettingsProvider>
        <EditorSettingsProbe />
      </EditorSettingsProvider>,
    )

    fireEvent.click(screen.getByTestId('set-font-family'))
    expect(screen.getByTestId('editor-font-family')).toHaveTextContent('monaspace-neon')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.fontFamily', 'monaspace-neon')

    fireEvent.click(screen.getByTestId('set-font-size'))
    expect(screen.getByTestId('editor-font-size')).toHaveTextContent('18')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.fontSize', 18)

    fireEvent.click(screen.getByTestId('set-theme'))
    expect(screen.getByTestId('editor-theme')).toHaveTextContent('github-dark')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.theme', 'github-dark')

    fireEvent.click(screen.getByTestId('set-invalid-font-size'))
    expect(screen.getByTestId('editor-font-size')).toHaveTextContent('24')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.fontSize', 24)
  })
})