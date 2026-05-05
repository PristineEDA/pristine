import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getEditorFontFamilyLabel } from '../../../editor/editorSettings';
import {
  ensureEditorFontFamilyLoadedMock,
  mockPersistedSettingsConfig,
  renderMenuBar,
  setEditorBracketPairGuidesMock,
  setEditorCursorBlinkingMock,
  setEditorFoldingStrategyMock,
  setEditorFontFamilyMock,
  setEditorFontLigaturesMock,
  setEditorGlyphMarginMock,
  setEditorIndentGuidesMock,
  setEditorLineNumbersMock,
  setEditorMinimapEnabledMock,
  setEditorRenderControlCharactersMock,
  setEditorRenderWhitespaceMock,
  setEditorScrollBeyondLastLineMock,
  setEditorSmoothScrollingMock,
  setEditorTabSizeMock,
  setEditorThemeMock,
  setEditorWordWrapMock,
  setThemeMock,
} from './MenuBar.testSupport';

describe('MenuBar settings', () => {
  it('opens settings from native menu commands on macOS', async () => {
    window.electronAPI!.platform = 'darwin';
    mockPersistedSettingsConfig({
      appTheme: 'dark',
      closeAction: 'tray',
      floatingInfoWindowVisible: true,
      fontFamily: 'fira-code',
      fontSize: 18,
      editorTheme: 'night-owl',
    });

    renderMenuBar();

    const menuCommandHandler = vi.mocked(window.electronAPI!.menu.onCommand).mock.calls[0]?.[0];
    await act(async () => {
      menuCommandHandler?.({ action: 'open-settings' });
    });

    expect(await screen.findByTestId('settings-dialog')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-family-combobox')).toHaveTextContent(getEditorFontFamilyLabel('fira-code'));
  });

  it('opens settings from the File menu using the shared settings behavior', async () => {
    const user = userEvent.setup();

    mockPersistedSettingsConfig({
      appTheme: 'dark',
      closeAction: 'tray',
      floatingInfoWindowVisible: true,
      fontFamily: 'fira-code',
      fontSize: 18,
      editorTheme: 'night-owl',
    });

    renderMenuBar();

    await user.click(screen.getByText('File'));
    expect(await screen.findByText('Ctrl+Q')).toBeInTheDocument();
    await user.click(await screen.findByText('Setting...'));

    expect(await screen.findByTestId('settings-dialog')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-family-combobox')).toHaveTextContent(getEditorFontFamilyLabel('fira-code'));
    expect(screen.getByTestId('settings-editor-font-family-advanced-button')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-size-value')).toHaveTextContent('18px');
    expect(screen.getByTestId('settings-editor-theme-combobox')).toHaveTextContent('Night Owl');
  });

  it('shows editor settings plus theme, close-to-tray and floating info window visibility', async () => {
    const user = userEvent.setup();
    mockPersistedSettingsConfig({
      appTheme: 'dark',
      bracketPairGuides: false,
      closeAction: 'tray',
      cursorBlinking: 'solid',
      floatingInfoWindowVisible: true,
      fontFamily: 'fira-code',
      fontLigatures: false,
      fontSize: 18,
      foldingStrategy: 'auto',
      glyphMargin: false,
      indentGuides: false,
      lineNumbers: 'relative',
      minimapEnabled: false,
      renderControlCharacters: true,
      renderWhitespace: 'all',
      scrollBeyondLastLine: true,
      smoothScrolling: false,
      tabSize: 8,
      editorTheme: 'night-owl',
      wordWrap: 'bounded',
    });

    renderMenuBar();

    await user.click(screen.getByTestId('menu-settings-button'));

    expect(await screen.findByTestId('settings-dialog')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-family-combobox')).toHaveTextContent(getEditorFontFamilyLabel('fira-code'));
    expect(screen.getByTestId('settings-editor-font-size-value')).toHaveTextContent('18px');
    expect(screen.getByTestId('settings-editor-theme-combobox')).toHaveTextContent('Night Owl');
    expect(screen.getByTestId('settings-editor-word-wrap-combobox')).toHaveTextContent('Bounded');
    expect(screen.getByTestId('settings-editor-tab-size-combobox')).toHaveTextContent('8 spaces');
    expect(screen.getByTestId('settings-editor-cursor-blinking-combobox')).toHaveTextContent('Solid');
    expect(screen.getByTestId('settings-editor-render-whitespace-combobox')).toHaveTextContent('All');
    expect(screen.getByTestId('settings-editor-line-numbers-combobox')).toHaveTextContent('Relative');
    expect(screen.getByTestId('settings-editor-folding-strategy-combobox')).toHaveTextContent('Auto');
    expect(screen.getByTestId('settings-editor-font-ligatures-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-editor-render-control-characters-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-editor-smooth-scrolling-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-editor-scroll-beyond-last-line-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-editor-minimap-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-editor-glyph-margin-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-editor-bracket-pair-guides-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-editor-indent-guides-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-theme-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-close-to-tray-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-floating-info-window-switch')).toHaveAttribute('data-state', 'checked');

    await user.click(screen.getByTestId('settings-editor-font-family-combobox'));
    await user.click(await screen.findByTestId('settings-editor-font-family-option-victor-mono'));
    await user.click(screen.getByTestId('settings-editor-word-wrap-combobox'));
    await user.click(await screen.findByTestId('settings-editor-word-wrap-option-on'));
    await user.click(screen.getByTestId('settings-editor-tab-size-combobox'));
    await user.click(await screen.findByTestId('settings-editor-tab-size-option-2'));
    await user.click(screen.getByTestId('settings-editor-cursor-blinking-combobox'));
    await user.click(await screen.findByTestId('settings-editor-cursor-blinking-option-phase'));
    await user.click(screen.getByTestId('settings-editor-render-whitespace-combobox'));
    await user.click(await screen.findByTestId('settings-editor-render-whitespace-option-boundary'));
    await user.click(screen.getByTestId('settings-editor-line-numbers-combobox'));
    await user.click(await screen.findByTestId('settings-editor-line-numbers-option-interval'));
    await user.click(screen.getByTestId('settings-editor-folding-strategy-combobox'));
    await user.click(await screen.findByTestId('settings-editor-folding-strategy-option-indentation'));
    await user.click(screen.getByTestId('settings-editor-theme-combobox'));
    await user.click(await screen.findByTestId('settings-editor-theme-option-github-dark'));
    await user.click(screen.getByTestId('settings-editor-font-ligatures-switch'));
    await user.click(screen.getByTestId('settings-editor-render-control-characters-switch'));
    await user.click(screen.getByTestId('settings-editor-smooth-scrolling-switch'));
    await user.click(screen.getByTestId('settings-editor-scroll-beyond-last-line-switch'));
    await user.click(screen.getByTestId('settings-editor-minimap-switch'));
    await user.click(screen.getByTestId('settings-editor-glyph-margin-switch'));
    await user.click(screen.getByTestId('settings-editor-bracket-pair-guides-switch'));
    await user.click(screen.getByTestId('settings-editor-indent-guides-switch'));
    await user.click(screen.getByTestId('settings-theme-switch'));
    await user.click(screen.getByTestId('settings-close-to-tray-switch'));
    await user.click(screen.getByTestId('settings-floating-info-window-switch'));

    expect(screen.getByTestId('settings-editor-font-family-combobox')).toHaveTextContent('Victor Mono');
    expect(screen.getByTestId('settings-editor-word-wrap-combobox')).toHaveTextContent('On');
    expect(screen.getByTestId('settings-editor-tab-size-combobox')).toHaveTextContent('2 spaces');
    expect(screen.getByTestId('settings-editor-theme-combobox')).toHaveTextContent('GitHub Dark');
    expect(screen.getByTestId('settings-editor-font-ligatures-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-theme-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-close-to-tray-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-floating-info-window-switch')).toHaveAttribute('data-state', 'unchecked');

    expect(setEditorFontFamilyMock).toHaveBeenCalledWith('victor-mono');
    expect(setEditorWordWrapMock).toHaveBeenCalledWith('on');
    expect(setEditorTabSizeMock).toHaveBeenCalledWith(2);
    expect(setEditorCursorBlinkingMock).toHaveBeenCalledWith('phase');
    expect(setEditorRenderWhitespaceMock).toHaveBeenCalledWith('boundary');
    expect(setEditorLineNumbersMock).toHaveBeenCalledWith('interval');
    expect(setEditorFoldingStrategyMock).toHaveBeenCalledWith('indentation');
    expect(setEditorFontLigaturesMock).toHaveBeenCalledWith(true);
    expect(setEditorRenderControlCharactersMock).toHaveBeenCalledWith(false);
    expect(setEditorSmoothScrollingMock).toHaveBeenCalledWith(true);
    expect(setEditorScrollBeyondLastLineMock).toHaveBeenCalledWith(false);
    expect(setEditorMinimapEnabledMock).toHaveBeenCalledWith(true);
    expect(setEditorGlyphMarginMock).toHaveBeenCalledWith(true);
    expect(setEditorBracketPairGuidesMock).toHaveBeenCalledWith(true);
    expect(setEditorIndentGuidesMock).toHaveBeenCalledWith(true);
    expect(setEditorThemeMock).toHaveBeenCalledWith('github-dark');
    expect(setThemeMock).toHaveBeenCalledWith('light');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('window.closeActionPreference', 'quit');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('ui.floatingInfoWindow.visible', false);
    expect(window.electronAPI?.setFloatingInfoWindowVisible).toHaveBeenCalledWith(false);
  }, 15000);

  it('opens the advanced editor font picker, filters preview cards, and applies the selected preview card', async () => {
    const user = userEvent.setup();

    mockPersistedSettingsConfig({
      fontFamily: 'fira-code',
    });

    renderMenuBar();

    await user.click(screen.getByTestId('menu-settings-button'));
    expect(await screen.findByTestId('settings-dialog')).toBeVisible();

    await user.click(screen.getByTestId('settings-editor-font-family-advanced-button'));

    expect(await screen.findByTestId('settings-editor-font-family-advanced-dialog')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-family-current-section')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-family-available-section')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-family-advanced-grid')).toBeVisible();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Available fonts')).toBeInTheDocument();
    const searchInput = screen.getByTestId('settings-editor-font-family-advanced-search-input');
    expect(searchInput).toHaveAttribute('placeholder', 'Search editor fonts...');
    expect(searchInput).toHaveClass('border-foreground/20');
    await waitFor(() => {
      expect(searchInput).not.toHaveFocus();
      expect(screen.getByTestId('settings-editor-font-family-advanced-close-button')).toHaveFocus();
    });
    expect(screen.getByTestId('settings-editor-font-family-current-card-fira-code')).toHaveAttribute('data-state', 'unselected');
    expect(screen.getByTestId('settings-editor-font-family-current-author-fira-code')).toHaveTextContent('Nikita Prokopov');
    expect(screen.getByTestId('settings-editor-font-family-preview-card-fira-code')).toHaveAttribute('data-state', 'selected');
    expect(screen.getByTestId('settings-editor-font-family-preview-letters-victor-mono')).toHaveTextContent('AaBbCcDdEe');
    expect(screen.getByTestId('settings-editor-font-family-preview-digits-victor-mono')).toHaveTextContent('0123456789');
    expect(screen.getByTestId('settings-editor-font-family-preview-author-victor-mono')).toHaveTextContent('Rubjo Vampjoen');
    expect(ensureEditorFontFamilyLoadedMock).toHaveBeenCalledWith('victor-mono');

    await user.type(searchInput, 'fira');

    expect(screen.getByTestId('settings-editor-font-family-current-card-fira-code')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-family-preview-card-fira-code')).toHaveAttribute('data-state', 'selected');
    expect(screen.queryByTestId('settings-editor-font-family-preview-card-victor-mono')).not.toBeInTheDocument();

    await user.clear(searchInput);
    fireEvent.change(searchInput, { target: { value: 'zzz' } });

    expect(screen.getByTestId('settings-editor-font-family-current-card-fira-code')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-family-advanced-empty-state')).toHaveTextContent('No editor font found.');
    expect(screen.queryByTestId('settings-editor-font-family-preview-card-fira-code')).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'victor');

    expect(screen.getByTestId('settings-editor-font-family-preview-card-victor-mono')).toHaveAttribute('data-state', 'unselected');
    expect(screen.queryByTestId('settings-editor-font-family-preview-card-fira-code')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('settings-editor-font-family-preview-card-victor-mono'));

    await waitFor(() => {
      expect(screen.queryByTestId('settings-editor-font-family-advanced-dialog')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('settings-editor-font-family-combobox')).toHaveTextContent('Victor Mono');
    expect(setEditorFontFamilyMock).toHaveBeenCalledWith('victor-mono');
  });

  it('opens the advanced editor theme picker, filters preview cards, and applies the selected preview card', async () => {
    const user = userEvent.setup();

    mockPersistedSettingsConfig({
      editorTheme: 'dracula',
    });

    renderMenuBar();

    await user.click(screen.getByTestId('menu-settings-button'));
    expect(await screen.findByTestId('settings-dialog')).toBeVisible();

    await user.click(screen.getByTestId('settings-editor-theme-advanced-button'));

    expect(await screen.findByTestId('settings-editor-theme-advanced-dialog')).toBeVisible();
    expect(screen.getByTestId('settings-editor-theme-current-section')).toBeVisible();
    expect(screen.getByTestId('settings-editor-theme-available-section')).toBeVisible();
    expect(screen.getByTestId('settings-editor-theme-advanced-grid')).toBeVisible();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Available themes')).toBeInTheDocument();
    const searchInput = screen.getByTestId('settings-editor-theme-advanced-search-input');
    expect(searchInput).toHaveAttribute('placeholder', 'Search editor themes...');
    expect(searchInput).toHaveClass('border-foreground/20');
    await waitFor(() => {
      expect(searchInput).not.toHaveFocus();
      expect(screen.getByTestId('settings-editor-theme-advanced-close-button')).toHaveFocus();
    });
    expect(screen.getByTestId('settings-editor-theme-current-card-dracula')).toHaveAttribute('data-state', 'unselected');
    expect(screen.getByTestId('settings-editor-theme-current-author-dracula')).toHaveTextContent('Dracula Theme');
    expect(screen.getByTestId('settings-editor-theme-current-editor-dracula')).toBeVisible();
    expect(screen.getByTestId('settings-editor-theme-preview-card-dracula')).toHaveAttribute('data-state', 'selected');
    expect(screen.getByTestId('settings-editor-theme-preview-label-macos-modern-dark-ventura-xcode-default')).toHaveClass('truncate');
    expect(screen.getByTestId('settings-editor-theme-preview-label-macos-modern-dark-ventura-xcode-default')).toHaveClass('w-full');
    expect(screen.getByTestId('settings-editor-theme-preview-author-dracula')).toHaveTextContent('Dracula Theme');
    expect(screen.getByTestId('settings-editor-theme-preview-editor-palenight-theme')).toBeVisible();
    expect(screen.getByTestId('settings-editor-theme-preview-author-palenight-theme')).toHaveTextContent('Olaolu Olawuyi');
    expect(screen.getByTestId('settings-editor-theme-preview-line-module-palenight-theme')).toHaveTextContent('module alu(clk)');
    expect(screen.getByTestId('settings-editor-theme-preview-selection-palenight-theme')).toHaveTextContent("sum = calc('RUN')");

    await user.type(searchInput, 'zzz');

    expect(screen.getByTestId('settings-editor-theme-current-card-dracula')).toBeVisible();
    expect(screen.getByTestId('settings-editor-theme-advanced-empty-state')).toHaveTextContent('No editor theme found.');
    expect(screen.queryByTestId('settings-editor-theme-preview-card-dracula')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'palenight' } });

    expect(screen.getByTestId('settings-editor-theme-preview-card-palenight-theme')).toHaveAttribute('data-state', 'unselected');
    expect(screen.queryByTestId('settings-editor-theme-preview-card-dracula')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('settings-editor-theme-preview-card-palenight-theme'));

    await waitFor(() => {
      expect(screen.queryByTestId('settings-editor-theme-advanced-dialog')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('settings-editor-theme-combobox')).toHaveTextContent('Palenight Theme');
    expect(setEditorThemeMock).toHaveBeenCalledWith('palenight-theme');
  });

  it('re-reads persisted settings each time the dialog opens', async () => {
    const user = userEvent.setup();
    mockPersistedSettingsConfig({
      appTheme: 'dark',
      bracketPairGuides: false,
      closeAction: 'tray',
      cursorBlinking: 'solid',
      floatingInfoWindowVisible: true,
      fontFamily: 'fira-code',
      fontLigatures: false,
      fontSize: 18,
      foldingStrategy: 'auto',
      glyphMargin: false,
      indentGuides: false,
      lineNumbers: 'relative',
      minimapEnabled: false,
      renderControlCharacters: true,
      renderWhitespace: 'all',
      scrollBeyondLastLine: true,
      smoothScrolling: false,
      tabSize: 8,
      editorTheme: 'night-owl',
      wordWrap: 'bounded',
    });

    renderMenuBar();

    await user.click(screen.getByTestId('menu-settings-button'));

    expect(await screen.findByTestId('settings-dialog')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-family-combobox')).toHaveTextContent(getEditorFontFamilyLabel('fira-code'));
    expect(screen.getByTestId('settings-editor-font-size-value')).toHaveTextContent('18px');
    expect(screen.getByTestId('settings-editor-theme-combobox')).toHaveTextContent('Night Owl');
    expect(screen.getByTestId('settings-editor-word-wrap-combobox')).toHaveTextContent('Bounded');
    expect(screen.getByTestId('settings-editor-tab-size-combobox')).toHaveTextContent('8 spaces');
    expect(screen.getByTestId('settings-editor-cursor-blinking-combobox')).toHaveTextContent('Solid');
    expect(screen.getByTestId('settings-editor-render-whitespace-combobox')).toHaveTextContent('All');
    expect(screen.getByTestId('settings-editor-line-numbers-combobox')).toHaveTextContent('Relative');
    expect(screen.getByTestId('settings-editor-folding-strategy-combobox')).toHaveTextContent('Auto');
    expect(screen.getByTestId('settings-editor-font-ligatures-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-editor-render-control-characters-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-editor-smooth-scrolling-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-editor-scroll-beyond-last-line-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-editor-minimap-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-theme-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-close-to-tray-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-floating-info-window-switch')).toHaveAttribute('data-state', 'checked');

    await user.click(screen.getByTestId('settings-close-button'));

    mockPersistedSettingsConfig({
      appTheme: 'light',
      bracketPairGuides: true,
      closeAction: 'quit',
      cursorBlinking: 'smooth',
      floatingInfoWindowVisible: false,
      fontFamily: 'jetbrains-mono',
      fontLigatures: true,
      fontSize: 12,
      foldingStrategy: 'indentation',
      glyphMargin: true,
      indentGuides: true,
      lineNumbers: 'on',
      minimapEnabled: true,
      renderControlCharacters: false,
      renderWhitespace: 'selection',
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      tabSize: 4,
      editorTheme: 'github-light',
      wordWrap: 'off',
    });

    await user.click(screen.getByTestId('menu-settings-button'));

    expect(await screen.findByTestId('settings-dialog')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-family-combobox')).toHaveTextContent('JetBrains Mono');
    expect(screen.getByTestId('settings-editor-font-size-value')).toHaveTextContent('12px');
    expect(screen.getByTestId('settings-editor-theme-combobox')).toHaveTextContent('GitHub Light');
    expect(screen.getByTestId('settings-editor-word-wrap-combobox')).toHaveTextContent('Off');
    expect(screen.getByTestId('settings-editor-tab-size-combobox')).toHaveTextContent('4 spaces');
    expect(screen.getByTestId('settings-editor-cursor-blinking-combobox')).toHaveTextContent('Smooth');
    expect(screen.getByTestId('settings-editor-render-whitespace-combobox')).toHaveTextContent('Selection');
    expect(screen.getByTestId('settings-editor-line-numbers-combobox')).toHaveTextContent('On');
    expect(screen.getByTestId('settings-editor-folding-strategy-combobox')).toHaveTextContent('Indentation');
    expect(screen.getByTestId('settings-editor-font-ligatures-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-editor-render-control-characters-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-editor-smooth-scrolling-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-editor-scroll-beyond-last-line-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-editor-minimap-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-theme-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-close-to-tray-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-floating-info-window-switch')).toHaveAttribute('data-state', 'unchecked');
  });

  it('renders newly downloaded Monaco font options in the settings combobox', async () => {
    const user = userEvent.setup();

    renderMenuBar();

    await user.click(screen.getByTestId('menu-settings-button'));
    await user.click(screen.getByTestId('settings-editor-font-family-combobox'));

    expect(await screen.findByTestId('settings-editor-font-family-option-liberation-mono')).toHaveTextContent('Liberation Mono');
    expect(screen.getByTestId('settings-editor-font-family-option-zxproto')).toHaveTextContent('ZxProto');
    expect(screen.getByTestId('settings-editor-font-family-option-m-plus-code-latin-50')).toHaveTextContent('M PLUS Code Latin 50');
    expect(screen.getByTestId('settings-editor-font-family-option-meslo-lg-dz')).toHaveTextContent('Meslo LG DZ');
    expect(screen.getByTestId('settings-editor-font-family-option-meslo-lg-mdz')).toHaveTextContent('Meslo LG MDZ');
    expect(screen.getByTestId('settings-editor-font-family-option-meslo-lg-sdz')).toHaveTextContent('Meslo LG SDZ');
    expect(await screen.findByTestId('settings-editor-font-family-option-monaspace-neon')).toHaveTextContent('Monaspace Neon');
    expect(screen.getByTestId('settings-editor-font-family-option-0xproto')).toHaveTextContent('0xProto');
    expect(screen.getByTestId('settings-editor-font-family-option-julia-mono')).toHaveTextContent('JuliaMono');
  });
});
