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
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'workbench.colorTheme' ? 'pink-cat-boo' : null,
    );

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('current-theme-id')).toHaveTextContent('pink-cat-boo');
    expect(document.documentElement).toHaveAttribute('data-color-theme-id', 'pink-cat-boo');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('workbench.colorTheme', 'pink-cat-boo');
  });

  it('accepts vendored upstream bundled theme ids from config and applies them through the unified provider', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'workbench.colorTheme' ? 'one-dark-pro' : null,
    );

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('current-theme-id')).toHaveTextContent('one-dark-pro');
    expect(document.documentElement).toHaveAttribute('data-color-theme-id', 'one-dark-pro');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('workbench.colorTheme', 'one-dark-pro');
  });

  it('accepts second-batch vendored light bundled theme ids from config and keeps the DOM in light mode', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'workbench.colorTheme' ? 'github-light-default' : null,
    );

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(screen.getByTestId('current-theme-id')).toHaveTextContent('github-light-default');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement).toHaveAttribute('data-color-theme-id', 'github-light-default');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('workbench.colorTheme', 'github-light-default');
  });

  it('accepts third-batch vendored light bundled theme ids from config and keeps the DOM in light mode', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'workbench.colorTheme' ? 'solarized-light' : null,
    );

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(screen.getByTestId('current-theme-id')).toHaveTextContent('solarized-light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement).toHaveAttribute('data-color-theme-id', 'solarized-light');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('workbench.colorTheme', 'solarized-light');
  });

  it('accepts fourth-batch vendored dark bundled theme ids from config and keeps the DOM in dark mode', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'workbench.colorTheme' ? 'night-owl' : null,
    );

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('current-theme-id')).toHaveTextContent('night-owl');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).toHaveAttribute('data-color-theme-id', 'night-owl');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('workbench.colorTheme', 'night-owl');
  });

  it('accepts fourth-batch vendored light bundled theme ids from config and keeps the DOM in light mode', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'workbench.colorTheme' ? 'noctis-lux' : null,
    );

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(screen.getByTestId('current-theme-id')).toHaveTextContent('noctis-lux');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement).toHaveAttribute('data-color-theme-id', 'noctis-lux');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('workbench.colorTheme', 'noctis-lux');
  });

  it('accepts fifth-batch vendored dark bundled theme ids from config and keeps the DOM in dark mode', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'workbench.colorTheme' ? 'macos-modern-dark-ventura-xcode-default' : null,
    );

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('current-theme-id')).toHaveTextContent('macos-modern-dark-ventura-xcode-default');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).toHaveAttribute('data-color-theme-id', 'macos-modern-dark-ventura-xcode-default');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('workbench.colorTheme', 'macos-modern-dark-ventura-xcode-default');
  });

  it('accepts fifth-batch vendored light bundled theme ids from config and keeps the DOM in light mode', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'workbench.colorTheme' ? 'macos-modern-light-ventura-xcode-low-key' : null,
    );

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(screen.getByTestId('current-theme-id')).toHaveTextContent('macos-modern-light-ventura-xcode-low-key');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement).toHaveAttribute('data-color-theme-id', 'macos-modern-light-ventura-xcode-low-key');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('workbench.colorTheme', 'macos-modern-light-ventura-xcode-low-key');
  });

  it('accepts sixth-batch vendored Dobri bundled theme ids from config and keeps the DOM in dark mode', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'workbench.colorTheme' ? 'dobri-next-a06-amethyst' : null,
    );

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('current-theme-id')).toHaveTextContent('dobri-next-a06-amethyst');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).toHaveAttribute('data-color-theme-id', 'dobri-next-a06-amethyst');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('workbench.colorTheme', 'dobri-next-a06-amethyst');
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
