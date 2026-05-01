import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorSettingsProvider, useEditorSettings } from './EditorSettingsContext'

const ensureEditorFontFamilyLoadedMock = vi.fn<(fontFamily: string) => Promise<void>>(() => Promise.resolve())

vi.mock('../editor/fontLoader', () => ({
  ensureEditorFontFamilyLoaded: (fontFamily: string) => ensureEditorFontFamilyLoadedMock(fontFamily),
}))

function EditorSettingsProbe() {
  const {
    cursorBlinking,
    bracketPairGuides,
    fontFamily,
    fontLigatures,
    fontSize,
    foldingStrategy,
    glyphMargin,
    indentGuides,
    lineNumbers,
    minimapEnabled,
    renderControlCharacters,
    renderWhitespace,
    scrollBeyondLastLine,
    smoothScrolling,
    tabSize,
    setCursorBlinking,
    setBracketPairGuides,
    setFontFamily,
    setFontLigatures,
    setFontSize,
    setFoldingStrategy,
    setGlyphMargin,
    setIndentGuides,
    setLineNumbers,
    setMinimapEnabled,
    setRenderControlCharacters,
    setRenderWhitespace,
    setScrollBeyondLastLine,
    setSmoothScrolling,
    setTabSize,
    setTheme,
    setWordWrap,
    theme,
    wordWrap,
  } = useEditorSettings()

  return (
    <div>
      <span data-testid="editor-cursor-blinking">{cursorBlinking}</span>
      <span data-testid="editor-bracket-pair-guides">{String(bracketPairGuides)}</span>
      <span data-testid="editor-font-family">{fontFamily}</span>
      <span data-testid="editor-font-ligatures">{String(fontLigatures)}</span>
      <span data-testid="editor-font-size">{fontSize}</span>
      <span data-testid="editor-folding-strategy">{foldingStrategy}</span>
      <span data-testid="editor-glyph-margin">{String(glyphMargin)}</span>
      <span data-testid="editor-indent-guides">{String(indentGuides)}</span>
      <span data-testid="editor-line-numbers">{lineNumbers}</span>
      <span data-testid="editor-minimap-enabled">{String(minimapEnabled)}</span>
      <span data-testid="editor-render-control-characters">{String(renderControlCharacters)}</span>
      <span data-testid="editor-render-whitespace">{renderWhitespace}</span>
      <span data-testid="editor-scroll-beyond-last-line">{String(scrollBeyondLastLine)}</span>
      <span data-testid="editor-smooth-scrolling">{String(smoothScrolling)}</span>
      <span data-testid="editor-tab-size">{tabSize}</span>
      <span data-testid="editor-theme">{theme}</span>
      <span data-testid="editor-word-wrap">{wordWrap}</span>
      <button data-testid="set-cursor-blinking" onClick={() => setCursorBlinking('solid')}>
        Set cursor blinking
      </button>
      <button data-testid="set-bracket-pair-guides" onClick={() => setBracketPairGuides(false)}>
        Set bracket pair guides
      </button>
      <button data-testid="set-font-family" onClick={() => setFontFamily('meslo-lg-dz')}>
        Set font family
      </button>
      <button data-testid="set-font-ligatures" onClick={() => setFontLigatures(false)}>
        Set font ligatures
      </button>
      <button data-testid="set-font-size" onClick={() => setFontSize(18)}>
        Set font size
      </button>
      <button data-testid="set-folding-strategy" onClick={() => setFoldingStrategy('auto')}>
        Set folding strategy
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
      <button data-testid="set-scroll-beyond-last-line" onClick={() => setScrollBeyondLastLine(true)}>
        Set scroll beyond last line
      </button>
      <button data-testid="set-smooth-scrolling" onClick={() => setSmoothScrolling(false)}>
        Set smooth scrolling
      </button>
      <button data-testid="set-tab-size" onClick={() => setTabSize(2)}>
        Set tab size
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
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    vi.mocked(window.electronAPI!.config.get).mockReset()
    vi.mocked(window.electronAPI!.config.set).mockReset()
    ensureEditorFontFamilyLoadedMock.mockReset()
    ensureEditorFontFamilyLoadedMock.mockResolvedValue(undefined)
  })

  async function clickSetting(testId: string) {
    await user.click(screen.getByTestId(testId))
  }

  it('defaults to Dracula and 13px when persisted config is missing', () => {
    render(
      <EditorSettingsProvider>
        <EditorSettingsProbe />
      </EditorSettingsProvider>,
    )

    expect(screen.getByTestId('editor-font-size')).toHaveTextContent('13')
    expect(screen.getByTestId('editor-font-family')).toHaveTextContent('jetbrains-mono')
    expect(screen.getByTestId('editor-font-ligatures')).toHaveTextContent('true')
    expect(screen.getByTestId('editor-word-wrap')).toHaveTextContent('off')
    expect(screen.getByTestId('editor-tab-size')).toHaveTextContent('4')
    expect(screen.getByTestId('editor-render-whitespace')).toHaveTextContent('selection')
    expect(screen.getByTestId('editor-render-control-characters')).toHaveTextContent('false')
    expect(screen.getByTestId('editor-cursor-blinking')).toHaveTextContent('smooth')
    expect(screen.getByTestId('editor-line-numbers')).toHaveTextContent('on')
    expect(screen.getByTestId('editor-smooth-scrolling')).toHaveTextContent('true')
    expect(screen.getByTestId('editor-scroll-beyond-last-line')).toHaveTextContent('false')
    expect(screen.getByTestId('editor-folding-strategy')).toHaveTextContent('indentation')
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
            : key === 'editor.fontLigatures'
              ? false
            : key === 'editor.wordWrap'
              ? 'on'
              : key === 'editor.tabSize'
                ? 2
              : key === 'editor.renderWhitespace'
                ? 'all'
                : key === 'editor.renderControlCharacters'
                  ? true
                  : key === 'editor.cursorBlinking'
                    ? 'solid'
                  : key === 'editor.lineNumbers'
                    ? 'relative'
                    : key === 'editor.smoothScrolling'
                      ? false
                      : key === 'editor.scrollBeyondLastLine'
                        ? true
                        : key === 'editor.foldingStrategy'
                          ? 'auto'
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
    expect(screen.getByTestId('editor-font-ligatures')).toHaveTextContent('false')
    expect(screen.getByTestId('editor-word-wrap')).toHaveTextContent('on')
    expect(screen.getByTestId('editor-tab-size')).toHaveTextContent('2')
    expect(screen.getByTestId('editor-render-whitespace')).toHaveTextContent('all')
    expect(screen.getByTestId('editor-render-control-characters')).toHaveTextContent('true')
    expect(screen.getByTestId('editor-cursor-blinking')).toHaveTextContent('solid')
    expect(screen.getByTestId('editor-line-numbers')).toHaveTextContent('relative')
    expect(screen.getByTestId('editor-smooth-scrolling')).toHaveTextContent('false')
    expect(screen.getByTestId('editor-scroll-beyond-last-line')).toHaveTextContent('true')
    expect(screen.getByTestId('editor-folding-strategy')).toHaveTextContent('auto')
    expect(screen.getByTestId('editor-minimap-enabled')).toHaveTextContent('false')
    expect(screen.getByTestId('editor-glyph-margin')).toHaveTextContent('false')
    expect(screen.getByTestId('editor-bracket-pair-guides')).toHaveTextContent('false')
    expect(screen.getByTestId('editor-indent-guides')).toHaveTextContent('false')
    expect(screen.getByTestId('editor-theme')).toHaveTextContent('night-owl')
    expect(ensureEditorFontFamilyLoadedMock).toHaveBeenCalledWith('fira-code')
  })

  it('persists each editor setting interaction once', async () => {
    render(
      <EditorSettingsProvider>
        <EditorSettingsProbe />
      </EditorSettingsProvider>,
    )

    await clickSetting('set-theme')
    expect(window.electronAPI?.config.set).toHaveBeenCalledTimes(1)
    expect(window.electronAPI?.config.set).toHaveBeenLastCalledWith('editor.theme', 'github-dark')

    await clickSetting('set-word-wrap')
    expect(window.electronAPI?.config.set).toHaveBeenCalledTimes(2)
    expect(window.electronAPI?.config.set).toHaveBeenLastCalledWith('editor.wordWrap', 'bounded')

    await clickSetting('set-font-size')
    expect(window.electronAPI?.config.set).toHaveBeenCalledTimes(3)
    expect(window.electronAPI?.config.set).toHaveBeenLastCalledWith('editor.fontSize', 18)
  })

  it('persists display settings, font settings and theme updates and clamps invalid values', async () => {
    render(
      <EditorSettingsProvider>
        <EditorSettingsProbe />
      </EditorSettingsProvider>,
    )

    await clickSetting('set-cursor-blinking')
    expect(screen.getByTestId('editor-cursor-blinking')).toHaveTextContent('solid')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.cursorBlinking', 'solid')

    await clickSetting('set-word-wrap')
    expect(screen.getByTestId('editor-word-wrap')).toHaveTextContent('bounded')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.wordWrap', 'bounded')

    await clickSetting('set-tab-size')
    expect(screen.getByTestId('editor-tab-size')).toHaveTextContent('2')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.tabSize', 2)

    await clickSetting('set-render-whitespace')
    expect(screen.getByTestId('editor-render-whitespace')).toHaveTextContent('all')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.renderWhitespace', 'all')

    await clickSetting('set-render-control-characters')
    expect(screen.getByTestId('editor-render-control-characters')).toHaveTextContent('true')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.renderControlCharacters', true)

    await clickSetting('set-font-ligatures')
    expect(screen.getByTestId('editor-font-ligatures')).toHaveTextContent('false')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.fontLigatures', false)

    await clickSetting('set-line-numbers')
    expect(screen.getByTestId('editor-line-numbers')).toHaveTextContent('relative')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.lineNumbers', 'relative')

    await clickSetting('set-smooth-scrolling')
    expect(screen.getByTestId('editor-smooth-scrolling')).toHaveTextContent('false')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.smoothScrolling', false)

    await clickSetting('set-scroll-beyond-last-line')
    expect(screen.getByTestId('editor-scroll-beyond-last-line')).toHaveTextContent('true')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.scrollBeyondLastLine', true)

    await clickSetting('set-folding-strategy')
    expect(screen.getByTestId('editor-folding-strategy')).toHaveTextContent('auto')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.foldingStrategy', 'auto')

    await clickSetting('set-minimap-enabled')
    expect(screen.getByTestId('editor-minimap-enabled')).toHaveTextContent('false')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.minimap.enabled', false)

    await clickSetting('set-glyph-margin')
    expect(screen.getByTestId('editor-glyph-margin')).toHaveTextContent('false')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.glyphMargin', false)

    await clickSetting('set-bracket-pair-guides')
    expect(screen.getByTestId('editor-bracket-pair-guides')).toHaveTextContent('false')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.guides.bracketPairs', false)

    await clickSetting('set-indent-guides')
    expect(screen.getByTestId('editor-indent-guides')).toHaveTextContent('false')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.guides.indentation', false)

    await clickSetting('set-font-family')
    expect(screen.getByTestId('editor-font-family')).toHaveTextContent('meslo-lg-dz')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.fontFamily', 'meslo-lg-dz')
    expect(ensureEditorFontFamilyLoadedMock).toHaveBeenCalledWith('meslo-lg-dz')

    await clickSetting('set-font-size')
    expect(screen.getByTestId('editor-font-size')).toHaveTextContent('18')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.fontSize', 18)

    await clickSetting('set-theme')
    expect(screen.getByTestId('editor-theme')).toHaveTextContent('github-dark')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.theme', 'github-dark')

    await clickSetting('set-invalid-font-size')
    expect(screen.getByTestId('editor-font-size')).toHaveTextContent('24')
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('editor.fontSize', 24)
  })
})
