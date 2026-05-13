import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';
import type { ImportedColorThemeRecord } from '../theme/colorThemeTypes';

function ThemeProbe() {
  const { theme, themeId, setTheme, toggleTheme } = useTheme();

  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="current-theme-id">{themeId}</span>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>
        Set dark
      </button>
      <button data-testid="set-light" onClick={() => setTheme('light')}>
        Set light
      </button>
      <button data-testid="toggle-theme" onClick={toggleTheme}>
        Toggle
      </button>
    </div>
  );
}

function renderWithConfiguredThemeId(themeId: string | null) {
  vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
    key === 'workbench.colorTheme' ? themeId : null,
  );

  render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>,
  );
}

function expectConfiguredThemeState(themeId: string, themeKind: 'dark' | 'light') {
  expect(screen.getByTestId('current-theme')).toHaveTextContent(themeKind);
  expect(screen.getByTestId('current-theme-id')).toHaveTextContent(themeId);

  if (themeKind === 'dark') {
    expect(document.documentElement).toHaveClass('dark');
  } else {
    expect(document.documentElement).not.toHaveClass('dark');
  }

  expect(document.documentElement).toHaveAttribute('data-color-theme-id', themeId);
  expect(window.electronAPI?.config.set).toHaveBeenCalledWith('workbench.colorTheme', themeId);
}

describe('ThemeContext', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-color-theme-id');
    vi.mocked(window.electronAPI!.config.get).mockReset();
    vi.mocked(window.electronAPI!.config.set).mockReset();
    vi.mocked(window.electronAPI!.config.onDidChange).mockReset();
    vi.mocked(window.electronAPI!.config.onDidChange).mockImplementation(() => vi.fn());
  });

  it('defaults to Dark 2026 when no persisted value exists', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('current-theme-id')).toHaveTextContent('vscode-2026-dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('prefers the persisted unified color theme id from config', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'workbench.colorTheme' ? 'vscode-2026-light' : null,
    );

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(screen.getByTestId('current-theme-id')).toHaveTextContent('vscode-2026-light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('accepts bundled third-party theme ids from config and applies them through the unified provider', () => {
    renderWithConfiguredThemeId('pink-cat-boo');

    expectConfiguredThemeState('pink-cat-boo', 'dark');
  });

  it('accepts vendored upstream bundled theme ids from config and applies them through the unified provider', () => {
    renderWithConfiguredThemeId('one-dark-pro');

    expectConfiguredThemeState('one-dark-pro', 'dark');
  });

  it('accepts second-batch vendored light bundled theme ids from config and keeps the DOM in light mode', () => {
    renderWithConfiguredThemeId('github-light-default');

    expectConfiguredThemeState('github-light-default', 'light');
  });

  it('accepts third-batch vendored light bundled theme ids from config and keeps the DOM in light mode', () => {
    renderWithConfiguredThemeId('solarized-light');

    expectConfiguredThemeState('solarized-light', 'light');
  });

  it('accepts fourth-batch vendored dark bundled theme ids from config and keeps the DOM in dark mode', () => {
    renderWithConfiguredThemeId('night-owl');

    expectConfiguredThemeState('night-owl', 'dark');
  });

  it('accepts fourth-batch vendored light bundled theme ids from config and keeps the DOM in light mode', () => {
    renderWithConfiguredThemeId('noctis-lux');

    expectConfiguredThemeState('noctis-lux', 'light');
  });

  it('accepts fifth-batch vendored dark bundled theme ids from config and keeps the DOM in dark mode', () => {
    renderWithConfiguredThemeId('macos-modern-dark-ventura-xcode-default');

    expectConfiguredThemeState('macos-modern-dark-ventura-xcode-default', 'dark');
  });

  it('accepts fifth-batch vendored light bundled theme ids from config and keeps the DOM in light mode', () => {
    renderWithConfiguredThemeId('macos-modern-light-ventura-xcode-low-key');

    expectConfiguredThemeState('macos-modern-light-ventura-xcode-low-key', 'light');
  });

  it('accepts sixth-batch vendored Dobri bundled theme ids from config and keeps the DOM in dark mode', () => {
    renderWithConfiguredThemeId('dobri-next-a06-amethyst');

    expectConfiguredThemeState('dobri-next-a06-amethyst', 'dark');
  });

  it('accepts seventh-batch vendored dark bundled theme ids from config and keeps the DOM in dark mode', () => {
    renderWithConfiguredThemeId('github-dark-high-contrast');

    expectConfiguredThemeState('github-dark-high-contrast', 'dark');
  });

  it('accepts seventh-batch vendored light bundled theme ids from config and keeps the DOM in light mode', () => {
    renderWithConfiguredThemeId('github-light-high-contrast');

    expectConfiguredThemeState('github-light-high-contrast', 'light');
  });

  it('accepts eighth-batch official vendored dark bundled theme ids from config and keeps the DOM in dark mode', () => {
    renderWithConfiguredThemeId('copilot-theme-higher-contrast');

    expectConfiguredThemeState('copilot-theme-higher-contrast', 'dark');
  });

  it('accepts eighth-batch official vendored light bundled theme ids from config and keeps the DOM in light mode', () => {
    renderWithConfiguredThemeId('visual-studio-light-cpp');

    expectConfiguredThemeState('visual-studio-light-cpp', 'light');
  });

  it('accepts ninth-batch vendored dark bundled theme ids from config and keeps the DOM in dark mode', () => {
    renderWithConfiguredThemeId('vue-theme-high-contrast');

    expectConfiguredThemeState('vue-theme-high-contrast', 'dark');
  });

  it('accepts ninth-batch vendored light bundled theme ids from config and keeps the DOM in light mode', () => {
    renderWithConfiguredThemeId('light-owl');

    expectConfiguredThemeState('light-owl', 'light');
  });

  it('accepts tenth-batch vendored dark bundled theme ids from config and keeps the DOM in dark mode', () => {
    renderWithConfiguredThemeId('andromeda');

    expectConfiguredThemeState('andromeda', 'dark');
  });

  it('accepts tenth-batch vendored light bundled theme ids from config and keeps the DOM in light mode', () => {
    renderWithConfiguredThemeId('atom-one-light');

    expectConfiguredThemeState('atom-one-light', 'light');
  });

  it('accepts eleventh-batch vendored dark bundled theme ids from config and keeps the DOM in dark mode', () => {
    renderWithConfiguredThemeId('slack-aubergine-dark-editor');

    expectConfiguredThemeState('slack-aubergine-dark-editor', 'dark');
  });

  it('accepts eleventh-batch vendored light bundled theme ids from config and keeps the DOM in light mode', () => {
    renderWithConfiguredThemeId('github-light-theme-gray');

    expectConfiguredThemeState('github-light-theme-gray', 'light');
  });

  it('persists theme updates to the unified config keys and keeps the DOM class in sync', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByTestId('set-light'));

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(screen.getByTestId('current-theme-id')).toHaveTextContent('vscode-2026-light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('workbench.colorTheme', 'vscode-2026-light');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('workbench.colorThemeKind', 'light');

    fireEvent.click(screen.getByTestId('toggle-theme'));

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('current-theme-id')).toHaveTextContent('vscode-2026-dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('workbench.colorTheme', 'vscode-2026-dark');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('workbench.colorThemeKind', 'dark');
  });

  it('does not persist imported themes during startup when no imported themes are configured', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(window.electronAPI?.config.set).not.toHaveBeenCalledWith('workbench.importedColorThemes', expect.anything());
  });

  it('ignores equivalent config change events without rerendering theme consumers', () => {
    let handleConfigChange: ((key: string, value: unknown) => void) | null = null;
    let renderCount = 0;

    vi.mocked(window.electronAPI!.config.onDidChange).mockImplementation((callback) => {
      handleConfigChange = callback;
      return vi.fn();
    });

    function RenderCountProbe() {
      const { importedThemes, themeId } = useTheme();
      renderCount += 1;

      return (
        <div>
          <span data-testid="render-theme-id">{themeId}</span>
          <span data-testid="imported-theme-count">{importedThemes.length}</span>
        </div>
      );
    }

    render(
      <ThemeProvider>
        <RenderCountProbe />
      </ThemeProvider>,
    );

    const initialRenderCount = renderCount;

    act(() => {
      handleConfigChange?.('workbench.importedColorThemes', []);
      handleConfigChange?.('workbench.colorTheme', 'vscode-2026-dark');
    });

    expect(screen.getByTestId('render-theme-id')).toHaveTextContent('vscode-2026-dark');
    expect(screen.getByTestId('imported-theme-count')).toHaveTextContent('0');
    expect(renderCount).toBe(initialRenderCount);
    expect(window.electronAPI?.config.onDidChange).toHaveBeenCalledTimes(1);
  });

  it('accepts external imported theme config changes without echoing them back to config', () => {
    const importedTheme: ImportedColorThemeRecord = {
      id: 'imported-night-00000001',
      label: 'Night',
      path: 'themes/night.json',
      description: 'Imported from night.json.',
      author: 'Imported theme',
      kind: 'dark',
    };
    let handleConfigChange: ((key: string, value: unknown) => void) | null = null;

    vi.mocked(window.electronAPI!.config.onDidChange).mockImplementation((callback) => {
      handleConfigChange = callback;
      return vi.fn();
    });

    function ImportedThemeProbe() {
      const { importedThemes } = useTheme();

      return (
        <span data-testid="imported-theme-id">
          {importedThemes[0]?.id ?? 'none'}
        </span>
      );
    }

    render(
      <ThemeProvider>
        <ImportedThemeProbe />
      </ThemeProvider>,
    );
    vi.mocked(window.electronAPI!.config.set).mockClear();

    act(() => {
      handleConfigChange?.('workbench.importedColorThemes', [importedTheme]);
    });

    expect(screen.getByTestId('imported-theme-id')).toHaveTextContent(importedTheme.id);
    expect(window.electronAPI?.config.set).not.toHaveBeenCalledWith('workbench.importedColorThemes', expect.anything());
  });
});
