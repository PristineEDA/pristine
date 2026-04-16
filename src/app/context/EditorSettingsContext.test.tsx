import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorSettingsProvider, useEditorSettings } from './EditorSettingsContext'

const ensureEditorFontFamilyLoadedMock = vi.fn<(fontFamily: string) => Promise<void>>(() => Promise.resolve())

vi.mock('../editor/fontLoader', () => ({
  ensureEditorFontFamilyLoaded: (fontFamily: string) => ensureEditorFontFamilyLoadedMock(fontFamily),
}))

function EditorSettingsProbe() {
  const {
    bracketPairGuides,
    fontFamily,
    fontSize,
    glyphMargin,
    indentGuides,
    lineNumbers,
    minimapEnabled,
    renderControlCharacters,
    renderWhitespace,
    setBracketPairGuides,
    setFontFamily,
    setFontSize,
    setGlyphMargin,
    setIndentGuides,
    setLineNumbers,
    setMinimapEnabled,
    setRenderControlCharacters,
    setRenderWhitespace,
    setTheme,
    setWordWrap,
    theme,
    wordWrap,
  } = useEditorSettings()

  return (
    <div>
      <span data-testid="editor-bracket-pair-guides">{String(bracketPairGuides)}</span>
      <span data-testid="editor-font-family">{fontFamily}</span>
      <span data-testid="editor-font-size">{fontSize}</span>
      <span data-testid="editor-glyph-margin">{String(glyphMargin)}</span>
      <span data-testid="editor-indent-guides">{String(indentGuides)}</span>
      <span data-testid="editor-line-numbers">{lineNumbers}</span>
      <span data-testid="editor-minimap-enabled">{String(minimapEnabled)}</span>
      <span data-testid="editor-render-control-characters">{String(renderControlCharacters)}</span>
      <span data-testid="editor-render-whitespace">{renderWhitespace}</span>
      <span data-testid="editor-theme">{theme}</span>
      <span data-testid="editor-word-wrap">{wordWrap}</span>
      <button data-testid="set-bracket-pair-guides" onClick={() => setBracketPairGuides(false)}>
        Set bracket pair guides
      </button>
      <button data-testid="set-font-family" onClick={() => setFontFamily('meslo-lg-dz')}>
        Set font family
      </button>
      <button data-testid="set-font-size" onClick={() => setFontSize(18)}>
        Set font size
      </button>
      <button data-testid="set-glyph-margin" onClick={() => setGlyphMargin(false)}>
        Set glyph margin
      </button>
      <button data-testid="set-indent-guides" onClick={() => setIndentGuides(false)}>
        Set indent guides
      </button>
      <button data-testid="set-line-numbers" onClick={() => setLineNumbers('relative')}>
        Set line numbers
      </button>
      <button data-testid="set-minimap-enabled" onClick={() => setMinimapEnabled(false)}>
        Set minimap enabled
      </button>
      <button data-testid="set-invalid-font-size" onClick={() => setFontSize(99)}>
        Set invalid font size
      </button>
      <button data-testid="set-render-control-characters" onClick={() => setRenderControlCharacters(true)}>
        Set render control characters
      </button>
      <button data-testid="set-render-whitespace" onClick={() => setRenderWhitespace('all')}>
        Set render whitespace
      </button>
      <button data-testid="set-theme" onClick={() => setTheme('github-dark')}>
        Set theme
      </button>
      <button data-testid="set-word-wrap" onClick={() => setWordWrap('bounded')}>
        Set word wrap
      </button>
    </div>
  )
}

describe('EditorSettingsContext', () => {
  beforeEach(() => {
    vi.mocked(window.electronAPI!.config.get).mockReset()
    vi.mocked(window.electronAPI!.config.set).mockReset()
    ensureEditorFontFamilyLoadedMock.mockReset()
    ensureEditorFontFamilyLoadedMock.mockResolvedValue(undefined)
  })

  it('defaults to Dracula and 13px when persisted config is missing', () => {
    render(
      <EditorSettingsProvider>
        <EditorSettingsProbe />
      </EditorSettingsProvider>,
    )

    expect(screen.getByTestId('editor-font-size')).toHaveTextContent('13')
    expect(screen.getByTestId('editor-font-family')).toHaveTextContent('jetbrains-mono')
    expect(screen.getByTestId('editor-word-wrap')).toHaveTextContent('off')
    expect(screen.getByTestId('editor-render-whitespace')).toHaveTextContent('selection')
    expect(screen.getByTestId('editor-render-control-characters')).toHaveTextContent('false')
    expect(screen.getByTestId('editor-line-numbers')).toHaveTextContent('on')
    expect(screen.getByTestId('editor-minimap-enabled')).toHaveTextContent('true')
    expect(screen.getByTestId('editor-glyph-margin')).toHaveTextContent('true')
    expect(screen.getByTestId('editor-bracket-pair-guides')).toHaveTextContent('true')
    expect(screen.getByTestId('editor-indent-guides')).toHaveTextContent('true')
    expect(screen.getByTestId('editor-theme')).toHaveTextContent('dracula')
    expect(ensureEditorFontFamilyLoadedMock).toHaveBeenCalledWith('jetbrains-mono')
  })

  it('reads persisted editor settings from config', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'editor.fontFamily'
        ? 'fira-code'
        : key === 'editor.fontSize'
          ? 17
          : key === 'editor.theme'
            ? 'night-owl'
            : key === 'editor.wordWrap'
              ? 'on'
              : key === 'editor.renderWhitespace'
                ? 'all'
                : key === 'editor.renderControlCharacters'
                  ? true
                  : key === 'editor.lineNumbers'
                    ? 'relative'
                    : key === 'editor.minimap.enabled'
                      ? false
                      : key === 'editor.glyphMargin'
                        ? false
                        : key === 'editor.guides.bracketPairs'
                          ? false
                          : key === 'editor.guides.indentation'
                            ? false
                            : null,
    )

    render(
      <EditorSettingsProvider>
        <EditorSettingsProbe />
      </EditorSettingsProvider>,
    )

    expect(screen.getByTestId('editor-font-family')).toHaveTextContent('fira-code')
    expect(screen.getByTestId('editor-font-size')).toHaveTextContent('17')
    expect(screen.getByTestId('editor-word-wrap')).toHaveTextContent('on')
    expect(screen.getByTestId('editor-render-whitespace')).toHaveTextContent('all')
    expect(screen.getByTestId('editor-render-control-characters')).toHaveTextContent('true')
    expect(screen.getByTestId('editor-line-numbers')).toHaveTextContent('relative')
    expect(screen.getByTestId('editor-minimap-enabled')).toHaveTextContent('false')
    expect(screen.getByTestId('editor-glyph-margin')).toHaveTextContent('false')
    expect(screen.getByTestId('editor-bracket-pair-guides')).toHaveTextContent('false')
    expect(screen.getByTestId('editor-indent-guides')).toHaveTextContent('false')
    expect(screen.getByTestId('editor-theme')).toHaveTextContent('night-owl')
    expect(ensureEditorFontFamilyLoadedMock).toHaveBeenCalledWith('fira-code')
  })

  it('persists display settings, font settings and theme updates and clamps invalid values', () => {
    render(
      <EditorSettingsProvider>
        <EditorSettingsProbe />
      </EditorSettingsProvider>,
    )

    fireEvent.click(screen.getByTestId('set-word-wrap'))
    expect(screen.getByTestId('editor-word-wrap')).toHaveTextContent('bounded')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.wordWrap', 'bounded')

    fireEvent.click(screen.getByTestId('set-render-whitespace'))
    expect(screen.getByTestId('editor-render-whitespace')).toHaveTextContent('all')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.renderWhitespace', 'all')

    fireEvent.click(screen.getByTestId('set-render-control-characters'))
    expect(screen.getByTestId('editor-render-control-characters')).toHaveTextContent('true')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.renderControlCharacters', true)

    fireEvent.click(screen.getByTestId('set-line-numbers'))
    expect(screen.getByTestId('editor-line-numbers')).toHaveTextContent('relative')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.lineNumbers', 'relative')

    fireEvent.click(screen.getByTestId('set-minimap-enabled'))
    expect(screen.getByTestId('editor-minimap-enabled')).toHaveTextContent('false')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.minimap.enabled', false)

    fireEvent.click(screen.getByTestId('set-glyph-margin'))
    expect(screen.getByTestId('editor-glyph-margin')).toHaveTextContent('false')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.glyphMargin', false)

    fireEvent.click(screen.getByTestId('set-bracket-pair-guides'))
    expect(screen.getByTestId('editor-bracket-pair-guides')).toHaveTextContent('false')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.guides.bracketPairs', false)

    fireEvent.click(screen.getByTestId('set-indent-guides'))
    expect(screen.getByTestId('editor-indent-guides')).toHaveTextContent('false')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.guides.indentation', false)

    fireEvent.click(screen.getByTestId('set-font-family'))
    expect(screen.getByTestId('editor-font-family')).toHaveTextContent('meslo-lg-dz')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.fontFamily', 'meslo-lg-dz')
    expect(ensureEditorFontFamilyLoadedMock).toHaveBeenCalledWith('meslo-lg-dz')

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