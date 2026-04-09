import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';

function ThemeProbe() {
  const { theme, setTheme, toggleTheme } = useTheme();

  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>
        Set dark
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
    localStorage.removeItem('pristine-theme');
    vi.mocked(window.electronAPI!.config.get).mockReset();
    vi.mocked(window.electronAPI!.config.set).mockReset();
  });

  it('defaults to the light theme when no persisted value exists', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('prefers the persisted config theme over legacy localStorage', () => {
    localStorage.setItem('pristine-theme', 'light');
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'ui.theme' ? 'dark' : null,
    );

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('persists theme updates to config and keeps the DOM class in sync', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByTestId('set-dark'));

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('ui.theme', 'dark');
    expect(localStorage.getItem('pristine-theme')).toBe('dark');

    fireEvent.click(screen.getByTestId('toggle-theme'));

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('ui.theme', 'light');
    expect(localStorage.getItem('pristine-theme')).toBe('light');
  });
});