import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import { MenuBar } from './MenuBar';
import type { DesktopAuthSession } from '../../../auth/types';
import { WorkspaceProvider, useWorkspace } from '../../../context/WorkspaceContext';
import type { ColorThemeOption, ColorThemePreviewPalette, ResolvedColorTheme } from '../../../theme/colorThemeTypes';
import { SidebarProvider, useSidebar } from '../../ui/sidebar';

export const ensureEditorFontFamilyLoadedMock = vi.fn<(fontFamily: string) => Promise<void>>(() => Promise.resolve());
export const setEditorFontSizeMock = vi.fn();
export const setEditorFontFamilyMock = vi.fn();
export const setEditorFontLigaturesMock = vi.fn();
export const setEditorTabSizeMock = vi.fn();
export const setEditorCursorBlinkingMock = vi.fn();
export const setEditorWordWrapMock = vi.fn();
export const setEditorRenderWhitespaceMock = vi.fn();
export const setEditorRenderControlCharactersMock = vi.fn();
export const setEditorSmoothScrollingMock = vi.fn();
export const setEditorScrollBeyondLastLineMock = vi.fn();
export const setEditorFoldingStrategyMock = vi.fn();
export const setEditorLineNumbersMock = vi.fn();
export const setEditorMinimapEnabledMock = vi.fn();
export const setEditorGlyphMarginMock = vi.fn();
export const setEditorBracketPairGuidesMock = vi.fn();
export const setEditorIndentGuidesMock = vi.fn();
export const setEditorThemeMock = vi.fn();
export const setThemeMock = vi.fn();
export const toggleThemeMock = vi.fn();
export const importThemeMock = vi.fn<() => Promise<ColorThemeOption | null>>();
export const getThemePreviewMock = vi.fn<(themeId: string) => ColorThemePreviewPalette>();
export const clearUserErrorMock = vi.fn();
export const openAccountPageMock = vi.fn(() => Promise.resolve(true));
export const signOutMock = vi.fn(() => Promise.resolve(true));
export const syncCloudConfigMock = vi.fn(() => Promise.resolve(true));
export const undoActionRun = vi.fn(() => Promise.resolve());
export const redoActionRun = vi.fn(() => Promise.resolve());

const defaultColorThemeOptions: ColorThemeOption[] = [
  {
    value: 'vscode-2026-dark',
    label: 'Dark 2026',
    description: 'Built-in VS Code 2026 dark color theme.',
    author: 'Microsoft',
    kind: 'dark',
    source: 'builtin',
  },
  {
    value: 'vscode-2026-light',
    label: 'Light 2026',
    description: 'Built-in VS Code 2026 light color theme.',
    author: 'Microsoft',
    kind: 'light',
    source: 'builtin',
  },
  {
    value: 'pink-cat-boo',
    label: 'Pink Cat Boo',
    description: 'Playful dark theme with rose-pink chrome, powder-blue accents, and warm banana-yellow strings.',
    author: 'Fiona Fan',
    kind: 'dark',
    source: 'bundled',
  },
];

const defaultThemePreviews: Record<string, ColorThemePreviewPalette> = {
  'vscode-2026-dark': {
    surface: '#181818',
    background: '#101010',
    input: '#202020',
    selection: '#264f78',
    comment: '#8b949e',
    foreground: '#f5f5f5',
    brightForeground: '#ffffff',
    pink: '#c586c0',
    purple: '#d2a8ff',
    cyan: '#79c0ff',
    green: '#7ee787',
    yellow: '#dcdcaa',
    red: '#f48771',
    orange: '#ffa657',
  },
  'vscode-2026-light': {
    surface: '#f4f4f5',
    background: '#ffffff',
    input: '#f8fafc',
    selection: '#dbeafe',
    comment: '#6b7280',
    foreground: '#111827',
    brightForeground: '#0f172a',
    pink: '#a21caf',
    purple: '#7c3aed',
    cyan: '#0284c7',
    green: '#059669',
    yellow: '#b45309',
    red: '#dc2626',
    orange: '#ea580c',
  },
  'pink-cat-boo': {
    surface: '#2d2f42',
    background: '#202330',
    input: '#202330',
    selection: '#472541',
    comment: '#6D7A72',
    foreground: '#FFF0F5',
    brightForeground: '#ffffff',
    pink: '#FF4791',
    purple: '#DCBFF2',
    cyan: '#A2C2EB',
    green: '#58B896',
    yellow: '#FAE8B6',
    red: '#FF62A5',
    orange: '#ffc85b',
  },
};

function resolveThemeOption(themeId: string, options: readonly ColorThemeOption[] = defaultColorThemeOptions): ColorThemeOption {
  return options.find((option) => option.value === themeId)
    ?? defaultColorThemeOptions.find((option) => option.value === themeId)
    ?? defaultColorThemeOptions[0]!;
}

function createResolvedTheme(themeId: string, options: readonly ColorThemeOption[] = defaultColorThemeOptions): ResolvedColorTheme {
  const option = resolveThemeOption(themeId, options);
  const preview = defaultThemePreviews[option.value] ?? defaultThemePreviews['vscode-2026-dark']!;

  return {
    id: option.value,
    label: option.label,
    description: option.description,
    author: option.author,
    kind: option.kind,
    source: option.source,
    colors: {
      'editor.background': preview.background,
      foreground: preview.foreground,
      'panel.background': preview.surface,
    },
    tokenColors: [],
    semanticHighlighting: true,
    semanticTokenColors: {},
  };
}

function applyThemeSelection(themeId: string) {
  const option = resolveThemeOption(themeId, themeMockState.availableThemes);
  themeMockState.themeId = option.value;
  themeMockState.theme = option.kind;
  themeMockState.activeTheme = createResolvedTheme(option.value, themeMockState.availableThemes);
}

interface EditorSettingsMockState {
  bracketPairGuides: boolean;
  cursorBlinking: string;
  fontFamily: string;
  fontLigatures: boolean;
  fontSize: number;
  foldingStrategy: string;
  glyphMargin: boolean;
  indentGuides: boolean;
  lineNumbers: string;
  minimapEnabled: boolean;
  renderControlCharacters: boolean;
  renderWhitespace: string;
  scrollBeyondLastLine: boolean;
  smoothScrolling: boolean;
  tabSize: number;
  theme: string;
  wordWrap: string;
}

interface UserMockState {
  errorMessage: string | null;
  isSyncing: boolean;
  session: DesktopAuthSession | null;
  status: 'loading' | 'signed-in' | 'signed-out';
}

const defaultEditorSettingsMockState: EditorSettingsMockState = {
  bracketPairGuides: true,
  cursorBlinking: 'smooth',
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
  theme: 'dracula',
  wordWrap: 'off',
};

const defaultUserMockState: UserMockState = {
  errorMessage: null,
  isSyncing: false,
  session: null,
  status: 'signed-out',
};

const editorSettingsMockState: EditorSettingsMockState = { ...defaultEditorSettingsMockState };
const themeMockState: {
  activeTheme: ResolvedColorTheme;
  availableThemes: ColorThemeOption[];
  importedThemes: Array<{ author: string; description: string; id: string; kind: 'light' | 'dark'; label: string; path: string }>;
  isImportingTheme: boolean;
  theme: 'light' | 'dark';
  themeId: string;
} = {
  activeTheme: createResolvedTheme('vscode-2026-dark'),
  availableThemes: [...defaultColorThemeOptions],
  importedThemes: [],
  isImportingTheme: false,
  theme: 'dark',
  themeId: 'vscode-2026-dark',
};
export const userMockState: UserMockState = { ...defaultUserMockState };

vi.mock('../../../context/EditorSettingsContext', () => ({
  useEditorSettings: () => ({
    bracketPairGuides: editorSettingsMockState.bracketPairGuides,
    cursorBlinking: editorSettingsMockState.cursorBlinking,
    fontFamilies: [],
    fontFamily: editorSettingsMockState.fontFamily,
    fontLigatures: editorSettingsMockState.fontLigatures,
    fontSize: editorSettingsMockState.fontSize,
    foldingStrategy: editorSettingsMockState.foldingStrategy,
    glyphMargin: editorSettingsMockState.glyphMargin,
    indentGuides: editorSettingsMockState.indentGuides,
    lineNumbers: editorSettingsMockState.lineNumbers,
    minimapEnabled: editorSettingsMockState.minimapEnabled,
    renderControlCharacters: editorSettingsMockState.renderControlCharacters,
    renderWhitespace: editorSettingsMockState.renderWhitespace,
    scrollBeyondLastLine: editorSettingsMockState.scrollBeyondLastLine,
    smoothScrolling: editorSettingsMockState.smoothScrolling,
    tabSize: editorSettingsMockState.tabSize,
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
    theme: editorSettingsMockState.theme,
    themes: [],
    wordWrap: editorSettingsMockState.wordWrap,
  }),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: themeMockState.theme,
    themeId: themeMockState.themeId,
    activeTheme: themeMockState.activeTheme,
    availableThemes: themeMockState.availableThemes,
    importedThemes: themeMockState.importedThemes,
    isImportingTheme: themeMockState.isImportingTheme,
    getThemePreview: getThemePreviewMock,
    importTheme: importThemeMock,
    setTheme: setThemeMock,
    toggleTheme: toggleThemeMock,
  }),
}));

vi.mock('../../../context/UserContext', () => ({
  useUser: () => ({
    clearError: clearUserErrorMock,
    errorMessage: userMockState.errorMessage,
    isSyncing: userMockState.isSyncing,
    openAccountPage: openAccountPageMock,
    session: userMockState.session,
    signOut: signOutMock,
    status: userMockState.status,
    syncCloudConfig: syncCloudConfigMock,
  }),
}));

vi.mock('../../../editor/fontLoader', () => ({
  ensureEditorFontFamilyLoaded: (fontFamily: string) => ensureEditorFontFamilyLoadedMock(fontFamily),
}));

function resetContextMockState() {
  Object.assign(editorSettingsMockState, defaultEditorSettingsMockState);
  Object.assign(userMockState, defaultUserMockState);
  themeMockState.availableThemes = [...defaultColorThemeOptions];
  themeMockState.importedThemes = [];
  themeMockState.isImportingTheme = false;
  applyThemeSelection('vscode-2026-dark');
}

function resetEditorSettingsMocks() {
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
}

function resetThemeMocks() {
  importThemeMock.mockReset();
  importThemeMock.mockResolvedValue(null);
  getThemePreviewMock.mockReset();
  getThemePreviewMock.mockImplementation((themeId: string) => defaultThemePreviews[themeId] ?? defaultThemePreviews['vscode-2026-dark']!);
  setThemeMock.mockReset();
  setThemeMock.mockImplementation((theme: string) => {
    if (theme === 'light') {
      applyThemeSelection('vscode-2026-light');
      return;
    }

    if (theme === 'dark') {
      applyThemeSelection('vscode-2026-dark');
      return;
    }

    applyThemeSelection(theme);
  });
  toggleThemeMock.mockReset();
  toggleThemeMock.mockImplementation(() => {
    applyThemeSelection(themeMockState.theme === 'dark' ? 'vscode-2026-light' : 'vscode-2026-dark');
  });
}

function resetUserMocks() {
  clearUserErrorMock.mockReset();
  openAccountPageMock.mockReset();
  openAccountPageMock.mockResolvedValue(true);
  signOutMock.mockReset();
  signOutMock.mockResolvedValue(true);
  syncCloudConfigMock.mockReset();
  syncCloudConfigMock.mockResolvedValue(true);
}

function resetWorkspaceCommandMocks() {
  undoActionRun.mockClear();
  redoActionRun.mockClear();
}

function resetElectronApiMocks() {
  window.electronAPI!.platform = 'win32';
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
  vi.mocked(window.electronAPI!.notices.revealBundledFiles).mockReset();
  vi.mocked(window.electronAPI!.notices.revealBundledFiles).mockResolvedValue(true);
}

beforeEach(() => {
  resetContextMockState();
  resetEditorSettingsMocks();
  resetThemeMocks();
  resetUserMocks();
  resetWorkspaceCommandMocks();
  resetElectronApiMocks();
});

export type PersistedSettingsOptions = {
  bracketPairGuides?: boolean;
  closeAction?: 'quit' | 'tray';
  colorTheme?: string;
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

export function mockPersistedSettingsConfig(options: PersistedSettingsOptions = {}) {
  const persisted = {
    bracketPairGuides: true,
    closeAction: 'quit' as const,
    colorTheme: 'vscode-2026-dark',
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

  applyThemeSelection(persisted.colorTheme);

  vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) => {
    switch (key) {
      case 'workbench.colorTheme':
        return persisted.colorTheme;
      case 'workbench.importedColorThemes':
        return themeMockState.importedThemes;
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

export interface MenuBarTestHarnessProps {
  menuBarProps?: React.ComponentProps<typeof MenuBar>;
  withWorkspaceControls?: boolean;
}

export function MenuBarTestHarness({
  menuBarProps = {},
  withWorkspaceControls = false,
}: MenuBarTestHarnessProps) {
  return (
    <SidebarProvider defaultOpen={false} keyboardShortcut={false}>
      <WorkspaceProvider>
        <SidebarStateProbe />
        {withWorkspaceControls && <WorkspaceControls />}
        <MenuBar {...menuBarProps} />
      </WorkspaceProvider>
    </SidebarProvider>
  );
}

export function renderMenuBar(props: React.ComponentProps<typeof MenuBar> = {}) {
  return render(
    <MenuBarTestHarness menuBarProps={props} />,
  );
}

export function renderMenuBarWithControls(props: React.ComponentProps<typeof MenuBar> = {}) {
  return render(
    <MenuBarTestHarness menuBarProps={props} withWorkspaceControls />,
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

export function hasNormalizedTextContent(expectedText: string) {
  const normalizedExpectedText = expectedText.replace(/\s+/g, '');

  return (_content: string, element?: Element | null) =>
    element?.textContent?.replace(/\s+/g, '') === normalizedExpectedText;
}

export async function clickByText(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByText(text));
}

export async function clickByTestId(user: ReturnType<typeof userEvent.setup>, testId: string) {
  await user.click(screen.getByTestId(testId));
}
