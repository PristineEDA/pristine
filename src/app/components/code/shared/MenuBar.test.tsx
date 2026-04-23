import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuBar } from './MenuBar';
import { openSourceAttributionSections } from '../../../about/attributions';
import type { DesktopAuthSession } from '../../../auth/types';
import { WorkspaceProvider, useWorkspace } from '../../../context/WorkspaceContext';
import { SidebarProvider, useSidebar } from '../../ui/sidebar';
import { getEditorFontFamilyLabel } from '../../../editor/editorSettings';

const ensureEditorFontFamilyLoadedMock = vi.fn<(fontFamily: string) => Promise<void>>(() => Promise.resolve());
const setEditorFontSizeMock = vi.fn();
const setEditorFontFamilyMock = vi.fn();
const setEditorFontLigaturesMock = vi.fn();
const setEditorTabSizeMock = vi.fn();
const setEditorCursorBlinkingMock = vi.fn();
const setEditorWordWrapMock = vi.fn();
const setEditorRenderWhitespaceMock = vi.fn();
const setEditorRenderControlCharactersMock = vi.fn();
const setEditorSmoothScrollingMock = vi.fn();
const setEditorScrollBeyondLastLineMock = vi.fn();
const setEditorFoldingStrategyMock = vi.fn();
const setEditorLineNumbersMock = vi.fn();
const setEditorMinimapEnabledMock = vi.fn();
const setEditorGlyphMarginMock = vi.fn();
const setEditorBracketPairGuidesMock = vi.fn();
const setEditorIndentGuidesMock = vi.fn();
const setEditorThemeMock = vi.fn();
const setThemeMock = vi.fn();
const toggleThemeMock = vi.fn();
const clearUserErrorMock = vi.fn();
const openAccountPageMock = vi.fn(() => Promise.resolve(true));
const signOutMock = vi.fn(() => Promise.resolve(true));
const syncCloudConfigMock = vi.fn(() => Promise.resolve(true));
const undoActionRun = vi.fn(() => Promise.resolve());
const redoActionRun = vi.fn(() => Promise.resolve());
let mockedEditorBracketPairGuides = true;
let mockedEditorCursorBlinking = 'smooth';
let mockedEditorFontFamily = 'jetbrains-mono';
let mockedEditorFontLigatures = true;
let mockedEditorFontSize = 13;
let mockedEditorFoldingStrategy = 'indentation';
let mockedEditorGlyphMargin = true;
let mockedEditorIndentGuides = true;
let mockedEditorLineNumbers = 'on';
let mockedEditorMinimapEnabled = true;
let mockedEditorRenderControlCharacters = false;
let mockedEditorRenderWhitespace = 'selection';
let mockedEditorScrollBeyondLastLine = false;
let mockedEditorSmoothScrolling = true;
let mockedEditorTabSize = 4;
let mockedEditorTheme = 'dracula';
let mockedEditorWordWrap = 'off';
let mockedTheme: 'light' | 'dark' = 'light';
let mockedUserErrorMessage: string | null = null;
let mockedUserIsSyncing = false;
let mockedUserSession: DesktopAuthSession | null = null;
let mockedUserStatus: 'loading' | 'signed-in' | 'signed-out' = 'signed-out';

vi.mock('../../../context/EditorSettingsContext', () => ({
  useEditorSettings: () => ({
    bracketPairGuides: mockedEditorBracketPairGuides,
    cursorBlinking: mockedEditorCursorBlinking,
    fontFamilies: [],
    fontFamily: mockedEditorFontFamily,
    fontLigatures: mockedEditorFontLigatures,
    fontSize: mockedEditorFontSize,
    foldingStrategy: mockedEditorFoldingStrategy,
    glyphMargin: mockedEditorGlyphMargin,
    indentGuides: mockedEditorIndentGuides,
    lineNumbers: mockedEditorLineNumbers,
    minimapEnabled: mockedEditorMinimapEnabled,
    renderControlCharacters: mockedEditorRenderControlCharacters,
    renderWhitespace: mockedEditorRenderWhitespace,
    scrollBeyondLastLine: mockedEditorScrollBeyondLastLine,
    smoothScrolling: mockedEditorSmoothScrolling,
    tabSize: mockedEditorTabSize,
    setBracketPairGuides: setEditorBracketPairGuidesMock,
    setCursorBlinking: setEditorCursorBlinkingMock,
    setFontFamily: setEditorFontFamilyMock,
    setFontLigatures: setEditorFontLigaturesMock,
    setFontSize: setEditorFontSizeMock,
    setFoldingStrategy: setEditorFoldingStrategyMock,
    setGlyphMargin: setEditorGlyphMarginMock,
    setIndentGuides: setEditorIndentGuidesMock,
    setLineNumbers: setEditorLineNumbersMock,
    setMinimapEnabled: setEditorMinimapEnabledMock,
    setRenderControlCharacters: setEditorRenderControlCharactersMock,
    setRenderWhitespace: setEditorRenderWhitespaceMock,
    setScrollBeyondLastLine: setEditorScrollBeyondLastLineMock,
    setSmoothScrolling: setEditorSmoothScrollingMock,
    setTabSize: setEditorTabSizeMock,
    setTheme: setEditorThemeMock,
    setWordWrap: setEditorWordWrapMock,
    theme: mockedEditorTheme,
    themes: [],
    wordWrap: mockedEditorWordWrap,
  }),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: mockedTheme, setTheme: setThemeMock, toggleTheme: toggleThemeMock }),
}));

vi.mock('../../../context/UserContext', () => ({
  useUser: () => ({
    clearError: clearUserErrorMock,
    errorMessage: mockedUserErrorMessage,
    isSyncing: mockedUserIsSyncing,
    openAccountPage: openAccountPageMock,
    session: mockedUserSession,
    signOut: signOutMock,
    status: mockedUserStatus,
    syncCloudConfig: syncCloudConfigMock,
  }),
}));

vi.mock('../../../editor/fontLoader', () => ({
  ensureEditorFontFamilyLoaded: (fontFamily: string) => ensureEditorFontFamilyLoadedMock(fontFamily),
}));

beforeEach(() => {
  mockedEditorBracketPairGuides = true;
  mockedEditorCursorBlinking = 'smooth';
  mockedEditorFontFamily = 'jetbrains-mono';
  mockedEditorFontLigatures = true;
  mockedEditorFontSize = 13;
  mockedEditorFoldingStrategy = 'indentation';
  mockedEditorGlyphMargin = true;
  mockedEditorIndentGuides = true;
  mockedEditorLineNumbers = 'on';
  mockedEditorMinimapEnabled = true;
  mockedEditorRenderControlCharacters = false;
  mockedEditorRenderWhitespace = 'selection';
  mockedEditorScrollBeyondLastLine = false;
  mockedEditorSmoothScrolling = true;
  mockedEditorTabSize = 4;
  mockedEditorTheme = 'dracula';
  mockedEditorWordWrap = 'off';
  mockedTheme = 'light';
  mockedUserErrorMessage = null;
  mockedUserIsSyncing = false;
  mockedUserSession = null;
  mockedUserStatus = 'signed-out';
  window.electronAPI!.platform = 'win32';
  ensureEditorFontFamilyLoadedMock.mockReset();
  ensureEditorFontFamilyLoadedMock.mockResolvedValue(undefined);
  setEditorBracketPairGuidesMock.mockReset();
  setEditorCursorBlinkingMock.mockReset();
  setEditorFontFamilyMock.mockReset();
  setEditorFontLigaturesMock.mockReset();
  setEditorFontSizeMock.mockReset();
  setEditorFoldingStrategyMock.mockReset();
  setEditorGlyphMarginMock.mockReset();
  setEditorIndentGuidesMock.mockReset();
  setEditorLineNumbersMock.mockReset();
  setEditorMinimapEnabledMock.mockReset();
  setEditorRenderControlCharactersMock.mockReset();
  setEditorRenderWhitespaceMock.mockReset();
  setEditorScrollBeyondLastLineMock.mockReset();
  setEditorSmoothScrollingMock.mockReset();
  setEditorTabSizeMock.mockReset();
  setEditorThemeMock.mockReset();
  setEditorWordWrapMock.mockReset();
  setThemeMock.mockReset();
  toggleThemeMock.mockReset();
  clearUserErrorMock.mockReset();
  openAccountPageMock.mockReset();
  openAccountPageMock.mockResolvedValue(true);
  signOutMock.mockReset();
  signOutMock.mockResolvedValue(true);
  syncCloudConfigMock.mockReset();
  syncCloudConfigMock.mockResolvedValue(true);
  undoActionRun.mockClear();
  redoActionRun.mockClear();
  vi.mocked(window.electronAPI!.minimize).mockReset();
  vi.mocked(window.electronAPI!.maximize).mockReset();
  vi.mocked(window.electronAPI!.close).mockReset();
  vi.mocked(window.electronAPI!.isMaximized).mockReset();
  vi.mocked(window.electronAPI!.isMaximized).mockReturnValue(false);
  vi.mocked(window.electronAPI!.isFullScreen).mockReset();
  vi.mocked(window.electronAPI!.isFullScreen).mockReturnValue(false);
  vi.mocked(window.electronAPI!.onMaximizedChange).mockReset();
  vi.mocked(window.electronAPI!.onMaximizedChange).mockImplementation(() => vi.fn());
  vi.mocked(window.electronAPI!.onFullScreenChange).mockReset();
  vi.mocked(window.electronAPI!.onFullScreenChange).mockImplementation(() => vi.fn());
  vi.mocked(window.electronAPI!.config.get).mockReset();
  vi.mocked(window.electronAPI!.config.set).mockReset();
  vi.mocked(window.electronAPI!.setFloatingInfoWindowVisible).mockReset();
  vi.mocked(window.electronAPI!.menu.onCommand).mockReset();
});

type PersistedSettingsOptions = {
  appTheme?: 'light' | 'dark';
  bracketPairGuides?: boolean;
  closeAction?: 'quit' | 'tray';
  cursorBlinking?: string;
  floatingInfoWindowVisible?: boolean;
  fontFamily?: string;
  fontLigatures?: boolean;
  fontSize?: number;
  foldingStrategy?: string;
  glyphMargin?: boolean;
  indentGuides?: boolean;
  lineNumbers?: string;
  minimapEnabled?: boolean;
  renderControlCharacters?: boolean;
  renderWhitespace?: string;
  scrollBeyondLastLine?: boolean;
  smoothScrolling?: boolean;
  tabSize?: number;
  editorTheme?: string;
  wordWrap?: string;
};

function mockPersistedSettingsConfig(options: PersistedSettingsOptions = {}) {
  const persisted = {
    appTheme: 'light' as const,
    bracketPairGuides: true,
    closeAction: 'quit' as const,
    cursorBlinking: 'smooth',
    floatingInfoWindowVisible: false,
    fontFamily: 'jetbrains-mono',
    fontLigatures: true,
    fontSize: 13,
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
    editorTheme: 'dracula',
    wordWrap: 'off',
    ...options,
  };

  vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) => {
    switch (key) {
      case 'ui.theme':
        return persisted.appTheme;
      case 'editor.guides.bracketPairs':
        return persisted.bracketPairGuides;
      case 'window.closeActionPreference':
        return persisted.closeAction;
      case 'editor.cursorBlinking':
        return persisted.cursorBlinking;
      case 'ui.floatingInfoWindow.visible':
        return persisted.floatingInfoWindowVisible;
      case 'editor.fontFamily':
        return persisted.fontFamily;
      case 'editor.fontLigatures':
        return persisted.fontLigatures;
      case 'editor.fontSize':
        return persisted.fontSize;
      case 'editor.foldingStrategy':
        return persisted.foldingStrategy;
      case 'editor.glyphMargin':
        return persisted.glyphMargin;
      case 'editor.guides.indentation':
        return persisted.indentGuides;
      case 'editor.lineNumbers':
        return persisted.lineNumbers;
      case 'editor.minimap.enabled':
        return persisted.minimapEnabled;
      case 'editor.renderControlCharacters':
        return persisted.renderControlCharacters;
      case 'editor.renderWhitespace':
        return persisted.renderWhitespace;
      case 'editor.scrollBeyondLastLine':
        return persisted.scrollBeyondLastLine;
      case 'editor.smoothScrolling':
        return persisted.smoothScrolling;
      case 'editor.tabSize':
        return persisted.tabSize;
      case 'editor.theme':
        return persisted.editorTheme;
      case 'editor.wordWrap':
        return persisted.wordWrap;
      default:
        return null;
    }
  });

  return persisted;
}

function renderMenuBar(props: React.ComponentProps<typeof MenuBar> = {}) {
  return render(
    <SidebarProvider defaultOpen={false} keyboardShortcut={false}>
      <WorkspaceProvider>
        <SidebarStateProbe />
        <MenuBar {...props} />
      </WorkspaceProvider>
    </SidebarProvider>,
  );
}

function renderMenuBarWithControls(props: React.ComponentProps<typeof MenuBar> = {}) {
  return render(
    <SidebarProvider defaultOpen={false} keyboardShortcut={false}>
      <WorkspaceProvider>
        <SidebarStateProbe />
        <WorkspaceControls />
        <MenuBar {...props} />
      </WorkspaceProvider>
    </SidebarProvider>,
  );
}

function SidebarStateProbe() {
  const { state } = useSidebar();

  return <span data-testid="sidebar-state">{state}</span>;
}

function WorkspaceControls() {
  const {
    openFile,
    registerEditorRef,
    setActiveView,
    setMainContentView,
    updateFileContentInGroup,
  } = useWorkspace();

  return (
    <div>
      <button onClick={() => setActiveView('simulation')}>set-simulation</button>
      <button onClick={() => setActiveView('synthesis')}>set-synthesis</button>
      <button onClick={() => setMainContentView('whiteboard')}>set-whiteboard</button>
      <button onClick={() => setMainContentView('code')}>set-code</button>
      <button onClick={() => openFile('rtl/core/reg_file.v', 'reg_file.v')}>open-reg</button>
      <button onClick={() => openFile('rtl/core/alu.v', 'alu.v')}>open-alu</button>
      <button onClick={() => updateFileContentInGroup('group-1', 'rtl/core/reg_file.v', 'module reg_file; logic dirty; endmodule')}>edit-reg</button>
      <button onClick={() => updateFileContentInGroup('group-1', 'rtl/core/alu.v', 'module alu; logic dirty; endmodule')}>edit-alu</button>
      <button onClick={() => registerEditorRef('group-1', {
        getAction: (actionId: string) => ({ run: actionId === 'undo' ? undoActionRun : redoActionRun }),
      })}>register-editor</button>
    </div>
  );
}

function hasNormalizedTextContent(expectedText: string) {
  const normalizedExpectedText = expectedText.replace(/\s+/g, '');

  return (_content: string, element?: Element | null) =>
    element?.textContent?.replace(/\s+/g, '') === normalizedExpectedText;
}

describe('MenuBar', () => {
  it('calls electron window controls directly', async () => {
    const user = userEvent.setup();

    renderMenuBar();

    fireEvent.click(screen.getByTestId('window-control-minimize'));
    fireEvent.click(screen.getByTestId('window-control-maximize'));
    await user.click(screen.getByTestId('window-control-close'));

    expect(window.electronAPI?.minimize).toHaveBeenCalledTimes(1);
    expect(window.electronAPI?.maximize).toHaveBeenCalledTimes(1);
    expect(window.electronAPI?.close).toHaveBeenCalledTimes(1);
  });

  it('renders Ctrl-based menu shortcuts on non-macOS platforms', async () => {
    const user = userEvent.setup();

    renderMenuBar();

    await user.click(screen.getByText('File'));

    expect(await screen.findByText(hasNormalizedTextContent('New ProjectCtrl+N'))).toBeInTheDocument();
    expect(screen.getByText(hasNormalizedTextContent('SaveCtrl+S'))).toBeInTheDocument();
    expect(screen.getByText(hasNormalizedTextContent('Save As...Ctrl+Shift+S'))).toBeInTheDocument();
    expect(screen.getByText(hasNormalizedTextContent('CloseCtrl+Q'))).toBeInTheDocument();
  });

  it('hides the window-local app icon, menu items, and trailing avatar separator on macOS', () => {
    window.electronAPI!.platform = 'darwin';

    renderMenuBar();

    expect(screen.getByTestId('macos-traffic-light-clearance')).toBeInTheDocument();
    expect(screen.queryByTestId('menu-app-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-menubar')).not.toBeInTheDocument();
    expect(screen.queryByText('File')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Help')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-avatar-separator')).not.toBeInTheDocument();
    expect(screen.getByTestId('toggle-theme')).toBeInTheDocument();
    expect(screen.getByTestId('menu-settings-button')).toBeInTheDocument();
    expect(screen.getByTestId('user-avatar-button')).toBeInTheDocument();
  });

  it('opens sign-in and sign-up actions from the user account popover when signed out', async () => {
    const user = userEvent.setup();

    renderMenuBar();

    await user.click(screen.getByTestId('user-avatar-button'));
    expect(await screen.findByTestId('user-account-popover')).toBeInTheDocument();

    await user.click(screen.getByTestId('user-sign-in-button'));
    await user.click(screen.getByTestId('user-sign-up-button'));

    expect(openAccountPageMock).toHaveBeenNthCalledWith(1, 'login');
    expect(openAccountPageMock).toHaveBeenNthCalledWith(2, 'signup');
  });

  it('shows the signed-in account summary and sync actions in the user account popover', async () => {
    const user = userEvent.setup();

    mockedUserStatus = 'signed-in';
    mockedUserSession = {
      avatarUrl: 'https://example.com/avatar.png',
      email: 'alice@example.com',
      syncedAt: '2026-04-18T12:00:00.000Z',
      userId: 'user-1',
      username: 'Alice Chen',
    };

    renderMenuBar();

    await user.click(screen.getByTestId('user-avatar-button'));

    expect(await screen.findByTestId('user-account-name')).toHaveTextContent('Alice Chen');
    expect(screen.getByTestId('user-account-email')).toHaveTextContent('alice@example.com');
    expect(screen.getByTestId('user-account-sync-status')).toHaveTextContent('Synced');

    await user.click(screen.getByTestId('user-sync-config-button'));
    await user.click(screen.getByTestId('user-sign-out-button'));

    expect(syncCloudConfigMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('restores the signed-out placeholder avatar after signing out from a signed-in session', () => {
    mockedUserStatus = 'signed-in';
    mockedUserSession = {
      avatarUrl: 'https://example.com/avatar.png',
      email: 'alice@example.com',
      syncedAt: '2026-04-18T12:00:00.000Z',
      userId: 'user-1',
      username: 'Alice Chen',
    };

    const view = renderMenuBar();

    expect(screen.getByTestId('user-avatar-button').querySelector('svg')).toBeNull();

    mockedUserStatus = 'signed-out';
    mockedUserSession = null;
    view.rerender(
      <SidebarProvider defaultOpen={false} keyboardShortcut={false}>
        <WorkspaceProvider>
          <SidebarStateProbe />
          <MenuBar />
        </WorkspaceProvider>
      </SidebarProvider>,
    );

    expect(screen.getByTestId('user-avatar-button').querySelector('svg')).toBeInTheDocument();
  });

  it('keeps the activity bar trigger position on macOS maximize and only left-aligns it in full-screen', () => {
    let fullScreenListener: ((fullScreen: boolean) => void) | undefined;
    const dispose = vi.fn();

    window.electronAPI!.platform = 'darwin';
    vi.mocked(window.electronAPI!.isMaximized).mockReturnValue(true);
    vi.mocked(window.electronAPI!.onFullScreenChange).mockImplementation((callback: (fullScreen: boolean) => void) => {
      fullScreenListener = callback;
      return dispose;
    });

    const { unmount } = renderMenuBar();
    const trigger = screen.getByTestId('toggle-activity-bar');

    expect(screen.getByTestId('macos-traffic-light-clearance')).toBeInTheDocument();
    expect(trigger).toHaveClass('ml-1');
    expect(window.electronAPI!.onMaximizedChange).not.toHaveBeenCalled();

    act(() => {
      fullScreenListener?.(true);
    });

    expect(screen.queryByTestId('macos-traffic-light-clearance')).not.toBeInTheDocument();
    expect(trigger).toHaveClass('ml-2');
    expect(trigger).not.toHaveClass('ml-1');

    act(() => {
      fullScreenListener?.(false);
    });

    expect(screen.getByTestId('macos-traffic-light-clearance')).toBeInTheDocument();
    expect(trigger).toHaveClass('ml-1');

    unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

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

  it('opens About from the Help menu using the shared attribution data', async () => {
    const user = userEvent.setup();
    const firstAttributionItem = openSourceAttributionSections[0]?.items[0];

    if (!firstAttributionItem) {
      throw new Error('Expected at least one attribution item');
    }

    renderMenuBar();

    await user.click(screen.getByText('Help'));
    await user.click(await screen.findByText('About'));

    expect(await screen.findByTestId('about-dialog')).toBeVisible();

    for (const section of openSourceAttributionSections) {
      expect(screen.getByText(section.title)).toBeInTheDocument();
    }

    expect(screen.getByText(firstAttributionItem.name)).toBeInTheDocument();
    expect(screen.getByText(firstAttributionItem.url)).toBeInTheDocument();
    expect(screen.getByText(firstAttributionItem.author)).toBeInTheDocument();
  });

  it('opens About from native menu commands on macOS', async () => {
    window.electronAPI!.platform = 'darwin';

    renderMenuBar();

    const menuCommandHandler = vi.mocked(window.electronAPI!.menu.onCommand).mock.calls[0]?.[0];
    await act(async () => {
      menuCommandHandler?.({ action: 'open-about' });
    });

    expect(await screen.findByTestId('about-dialog')).toBeVisible();
    expect(screen.getByText('Bundled Binaries & Extra Resources')).toBeInTheDocument();
  });

  it('routes save, undo, and redo through the shared workspace commands', async () => {
    const user = userEvent.setup();

    renderMenuBarWithControls();

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('edit-reg'));
    fireEvent.click(screen.getByText('register-editor'));

    await user.click(screen.getByText('File'));
    await user.click(await screen.findByText('Save'));
    await user.click(screen.getByText('Edit'));
    await user.click(await screen.findByText('Undo'));
    await user.click(screen.getByText('Edit'));
    await user.click(await screen.findByText('Redo'));

    expect(window.electronAPI?.fs.writeFile).toHaveBeenCalledWith('rtl/core/reg_file.v', 'module reg_file; logic dirty; endmodule');
    expect(undoActionRun).toHaveBeenCalledTimes(1);
    expect(redoActionRun).toHaveBeenCalledTimes(1);
  });

  it('routes Save All through the shared workspace command', async () => {
    const user = userEvent.setup();

    renderMenuBarWithControls();

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('edit-reg'));
    fireEvent.click(screen.getByText('open-alu'));
    fireEvent.click(screen.getByText('edit-alu'));

    await user.click(screen.getByText('File'));
    await user.click(await screen.findByText('Save All'));

    expect(window.electronAPI?.fs.writeFile).toHaveBeenCalledWith('rtl/core/reg_file.v', 'module reg_file; logic dirty; endmodule');
    expect(window.electronAPI?.fs.writeFile).toHaveBeenCalledWith('rtl/core/alu.v', 'module alu; logic dirty; endmodule');
  });

  it('routes native macOS save, Save All, and undo commands through the same workspace actions', async () => {
    window.electronAPI!.platform = 'darwin';

    renderMenuBarWithControls();

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('edit-reg'));
    fireEvent.click(screen.getByText('open-alu'));
    fireEvent.click(screen.getByText('edit-alu'));
    fireEvent.click(screen.getByText('register-editor'));

    const menuCommandHandler = vi.mocked(window.electronAPI!.menu.onCommand).mock.calls[0]?.[0];

    await act(async () => {
      menuCommandHandler?.({ action: 'save-file' });
      menuCommandHandler?.({ action: 'save-all-files' });
      menuCommandHandler?.({ action: 'undo-editor' });
    });

    expect(window.electronAPI?.fs.writeFile).toHaveBeenCalledWith('rtl/core/alu.v', 'module alu; logic dirty; endmodule');
    expect(window.electronAPI?.fs.writeFile).toHaveBeenCalledWith('rtl/core/reg_file.v', 'module reg_file; logic dirty; endmodule');
    expect(undoActionRun).toHaveBeenCalledTimes(1);
  });

  it('opens settings from the File menu using the shared settings behavior', async () => {
    const user = userEvent.setup();
    const expectedCloseShortcut = window.electronAPI?.platform === 'darwin' ? '⌘Q' : 'Ctrl+Q';

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
    expect(await screen.findByText(expectedCloseShortcut)).toBeInTheDocument();
    await user.click(await screen.findByText('Setting...'));

    expect(await screen.findByTestId('settings-dialog')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-family-combobox')).toHaveTextContent(getEditorFontFamilyLabel('fira-code'));
    expect(screen.getByTestId('settings-editor-font-family-advanced-button')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-size-value')).toHaveTextContent('18px');
    expect(screen.getByTestId('settings-editor-theme-combobox')).toHaveTextContent('Night Owl');
  });

  it('closes the app from the File menu using the shared close behavior', async () => {
    const user = userEvent.setup();

    renderMenuBar();

    await user.click(screen.getByText('File'));
    await user.click(await screen.findByText('Close'));

    expect(window.electronAPI?.close).toHaveBeenCalledTimes(1);
  });

  it('closes the app with the platform close shortcut', () => {
    const isMacOS = window.electronAPI?.platform === 'darwin';

    renderMenuBar();

    fireEvent.keyDown(window, {
      key: 'q',
      ctrlKey: !isMacOS,
      metaKey: isMacOS,
    });

    expect(window.electronAPI?.close).toHaveBeenCalledTimes(1);
  });

  it('closes the app with Command+Q on macOS', () => {
    window.electronAPI!.platform = 'darwin';

    renderMenuBar();

    fireEvent.keyDown(window, {
      key: 'q',
      metaKey: true,
    });

    expect(window.electronAPI?.close).toHaveBeenCalledTimes(1);
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

  it('opens the advanced editor font picker and applies the selected preview card', async () => {
    const user = userEvent.setup();

    mockPersistedSettingsConfig({
      fontFamily: 'fira-code',
    });

    renderMenuBar();

    await user.click(screen.getByTestId('menu-settings-button'));
    expect(await screen.findByTestId('settings-dialog')).toBeVisible();

    await user.click(screen.getByTestId('settings-editor-font-family-advanced-button'));

    expect(await screen.findByTestId('settings-editor-font-family-advanced-dialog')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-family-advanced-grid')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-family-preview-card-fira-code')).toHaveAttribute('data-state', 'selected');
    expect(screen.getByTestId('settings-editor-font-family-preview-letters-victor-mono')).toHaveTextContent('AaBbCcDdEe');
    expect(screen.getByTestId('settings-editor-font-family-preview-digits-victor-mono')).toHaveTextContent('0123456789');
    expect(ensureEditorFontFamilyLoadedMock).toHaveBeenCalledWith('victor-mono');

    await user.click(screen.getByTestId('settings-editor-font-family-preview-card-victor-mono'));

    await waitFor(() => {
      expect(screen.queryByTestId('settings-editor-font-family-advanced-dialog')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('settings-editor-font-family-combobox')).toHaveTextContent('Victor Mono');
    expect(setEditorFontFamilyMock).toHaveBeenCalledWith('victor-mono');
  });

  it('opens the advanced editor theme picker and applies the selected preview card', async () => {
    const user = userEvent.setup();

    mockPersistedSettingsConfig({
      editorTheme: 'dracula',
    });

    renderMenuBar();

    await user.click(screen.getByTestId('menu-settings-button'));
    expect(await screen.findByTestId('settings-dialog')).toBeVisible();

    await user.click(screen.getByTestId('settings-editor-theme-advanced-button'));

    expect(await screen.findByTestId('settings-editor-theme-advanced-dialog')).toBeVisible();
    expect(screen.getByTestId('settings-editor-theme-advanced-grid')).toBeVisible();
    expect(screen.getByTestId('settings-editor-theme-preview-card-dracula')).toHaveAttribute('data-state', 'selected');
    expect(screen.getByTestId('settings-editor-theme-preview-author-dracula')).toHaveTextContent('Dracula Theme');
    expect(screen.getByTestId('settings-editor-theme-preview-editor-aura-soft-dark')).toBeVisible();
    expect(screen.getByTestId('settings-editor-theme-preview-author-aura-soft-dark')).toHaveTextContent('Dalton Menezes');
    expect(screen.getByTestId('settings-editor-theme-preview-line-module-aura-soft-dark')).toHaveTextContent('module alu(clk)');
    expect(screen.getByTestId('settings-editor-theme-preview-selection-aura-soft-dark')).toHaveTextContent("sum = calc('RUN')");

    await user.click(screen.getByTestId('settings-editor-theme-preview-card-aura-soft-dark'));

    await waitFor(() => {
      expect(screen.queryByTestId('settings-editor-theme-advanced-dialog')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('settings-editor-theme-combobox')).toHaveTextContent('Aura Soft Dark');
    expect(setEditorThemeMock).toHaveBeenCalledWith('aura-soft-dark');
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

  it('keeps the menubar theme toggle wired to the shared theme action', async () => {
    const user = userEvent.setup();

    renderMenuBar();

    await user.click(screen.getByTestId('toggle-theme'));

    expect(toggleThemeMock).toHaveBeenCalledTimes(1);
  });

  it('does not render the select project dropdown or upgrade button', () => {
    renderMenuBar();

    expect(screen.queryByRole('button', { name: /select project/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upgrade to pro/i })).not.toBeInTheDocument();
  });

  it('calls the panel toggle callbacks from the layout icons', () => {
    const onShowLeftPanelChange = vi.fn();
    const onShowBottomPanelChange = vi.fn();
    const onShowRightPanelChange = vi.fn();

    renderMenuBar({
      onShowLeftPanelChange,
      onShowBottomPanelChange,
      onShowRightPanelChange,
    });

    fireEvent.click(screen.getByTestId('toggle-left-panel'));
    fireEvent.click(screen.getByTestId('toggle-bottom-panel'));
    fireEvent.click(screen.getByTestId('toggle-right-panel'));

    expect(onShowLeftPanelChange).toHaveBeenCalledTimes(1);
    expect(onShowLeftPanelChange).toHaveBeenCalledWith(true);
    expect(onShowBottomPanelChange).toHaveBeenCalledTimes(1);
    expect(onShowBottomPanelChange).toHaveBeenCalledWith(true);
    expect(onShowRightPanelChange).toHaveBeenCalledTimes(1);
    expect(onShowRightPanelChange).toHaveBeenCalledWith(true);
  });

  it('disables layout icons on unsupported pages and only disables the activity bar toggle outside code', () => {
    const onShowLeftPanelChange = vi.fn();
    const onShowBottomPanelChange = vi.fn();
    const onShowRightPanelChange = vi.fn();

    renderMenuBarWithControls({
      onShowLeftPanelChange,
      onShowBottomPanelChange,
      onShowRightPanelChange,
    });

    fireEvent.click(screen.getByText('set-synthesis'));

    expect(screen.getByTestId('toggle-left-panel')).toBeDisabled();
    expect(screen.getByTestId('toggle-bottom-panel')).toBeDisabled();
    expect(screen.getByTestId('toggle-right-panel')).toBeDisabled();
    expect(screen.getByTestId('toggle-activity-bar')).not.toBeDisabled();
    expect(screen.getByTestId('toggle-left-panel')).toHaveClass('cursor-not-allowed');
    expect(screen.getByTestId('toggle-bottom-panel')).toHaveClass('cursor-not-allowed');
    expect(screen.getByTestId('toggle-right-panel')).toHaveClass('cursor-not-allowed');
    expect(screen.getByTestId('toggle-activity-bar')).not.toHaveClass('cursor-not-allowed');

    expect(screen.getByTestId('sidebar-state')).toHaveTextContent('collapsed');
    fireEvent.click(screen.getByTestId('toggle-left-panel'));
    fireEvent.click(screen.getByTestId('toggle-bottom-panel'));
    fireEvent.click(screen.getByTestId('toggle-right-panel'));
    fireEvent.click(screen.getByTestId('toggle-activity-bar'));

    expect(onShowLeftPanelChange).not.toHaveBeenCalled();
    expect(onShowBottomPanelChange).not.toHaveBeenCalled();
    expect(onShowRightPanelChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('sidebar-state')).toHaveTextContent('expanded');

    fireEvent.click(screen.getByText('set-simulation'));

    expect(screen.getByTestId('toggle-left-panel')).not.toBeDisabled();
    expect(screen.getByTestId('toggle-bottom-panel')).not.toBeDisabled();
    expect(screen.getByTestId('toggle-right-panel')).not.toBeDisabled();
    expect(screen.getByTestId('toggle-activity-bar')).not.toBeDisabled();

    fireEvent.click(screen.getByText('set-whiteboard'));
    expect(screen.getByTestId('toggle-left-panel')).toBeDisabled();
    expect(screen.getByTestId('toggle-bottom-panel')).toBeDisabled();
    expect(screen.getByTestId('toggle-right-panel')).toBeDisabled();
    expect(screen.getByTestId('toggle-activity-bar')).toBeDisabled();
    expect(screen.getByTestId('toggle-activity-bar')).not.toHaveClass('cursor-not-allowed');

    fireEvent.click(screen.getByTestId('toggle-activity-bar'));
    expect(screen.getByTestId('sidebar-state')).toHaveTextContent('expanded');
  });

  it('reflects active panel visibility on the layout buttons', () => {
    renderMenuBar({
      showLeftPanel: true,
      showBottomPanel: false,
      showRightPanel: true,
    });

    expect(screen.getByTestId('toggle-left-panel')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('toggle-bottom-panel')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('toggle-right-panel')).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the centered view switcher interactive inside the title bar', () => {
    renderMenuBar();

    const switcher = screen.getByTestId('center-view-switcher') as HTMLDivElement;

    expect(switcher.style.pointerEvents).toBe('auto');
    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Whiteboard')).toBeInTheDocument();
    expect(screen.getByLabelText('Workflow')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-activity-bar')).toBeInTheDocument();
  });

  it('renders the activity bar trigger after the menu items and toggles the shared sidebar state', () => {
    renderMenuBar();

    const trigger = screen.getByTestId('toggle-activity-bar');
    const readFilledRect = () => trigger.querySelector('rect[fill="currentColor"]');

    expect(screen.getByTestId('sidebar-state')).toHaveTextContent('collapsed');
    expect(trigger).toHaveAttribute('aria-pressed', 'false');
    expect(readFilledRect()).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByTestId('sidebar-state')).toHaveTextContent('expanded');
    expect(trigger).toHaveAttribute('aria-pressed', 'true');
    expect(readFilledRect()).not.toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByTestId('sidebar-state')).toHaveTextContent('collapsed');
    expect(trigger).toHaveAttribute('aria-pressed', 'false');
    expect(readFilledRect()).toBeNull();
  });

  it('shows a visible selected style on the active center view button and updates it after switching', () => {
    renderMenuBar();

    const codeButton = screen.getByTestId('center-view-code');
    const whiteboardButton = screen.getByTestId('center-view-whiteboard');

    expect(codeButton).toHaveAttribute('data-state', 'on');
    expect(codeButton).toHaveClass('data-[state=on]:bg-background', 'data-[state=on]:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.08)]', 'data-[state=on]:border-border/80');
    expect(whiteboardButton).toHaveAttribute('data-state', 'off');

    fireEvent.click(whiteboardButton);

    expect(codeButton).toHaveAttribute('data-state', 'off');
    expect(whiteboardButton).toHaveAttribute('data-state', 'on');
  });

  it('adds a pointer cursor on hover to the interactive menubar controls', () => {
    renderMenuBar();

    expect(screen.getByLabelText('Code')).toHaveClass('hover:cursor-pointer');
    expect(screen.getByLabelText('Whiteboard')).toHaveClass('hover:cursor-pointer');
    expect(screen.getByLabelText('Workflow')).toHaveClass('hover:cursor-pointer');
    expect(screen.getByTestId('toggle-left-panel')).toHaveClass('hover:cursor-pointer');
    expect(screen.getByTestId('toggle-bottom-panel')).toHaveClass('hover:cursor-pointer');
    expect(screen.getByTestId('toggle-right-panel')).toHaveClass('hover:cursor-pointer');
    expect(screen.getByTestId('toggle-theme')).toHaveClass('hover:cursor-pointer');
    expect(screen.getByTestId('user-avatar-button')).toHaveClass('hover:cursor-pointer');
  });

  it('renders shadcn tooltip content for the center view switcher on hover', async () => {
    const user = userEvent.setup();

    renderMenuBar();

    await user.hover(screen.getByLabelText('Code'));
    expect(await screen.findByRole('tooltip', { name: 'Code' })).toBeInTheDocument();
  });
});