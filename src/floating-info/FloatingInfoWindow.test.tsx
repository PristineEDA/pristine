import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../app/context/ThemeContext';
import { FloatingInfoWindow } from './FloatingInfoWindow';

vi.mock('liveline', () => ({
  Liveline: ({ theme, color }: { theme: string; color: string }) => (
    <div data-testid="liveline-mock" data-theme={theme} data-color={color} />
  ),
}));

const setFloatingInfoWindowExpanded = vi.fn(() => Promise.resolve(true));

function renderFloatingInfoWindow() {
  window.electronAPI = {
    ...window.electronAPI,
    config: {
      get: (key: string) => {
        if (key === 'workbench.colorTheme') {
          return 'vscode-2026-dark';
        }

        if (key === 'workbench.importedThemes') {
          return [];
        }

        return null;
      },
      set: vi.fn(() => Promise.resolve()),
      onDidChange: vi.fn(() => () => {}),
    },
    setFloatingInfoWindowExpanded,
  } as typeof window.electronAPI;

  return render(
    <ThemeProvider>
      <FloatingInfoWindow />
    </ThemeProvider>,
  );
}

describe('FloatingInfoWindow', () => {
  it('renders the floating info shell with the expected status tokens', () => {
    renderFloatingInfoWindow();

    expect(screen.getByTestId('floating-info-window')).toBeInTheDocument();
    expect(screen.getByTestId('floating-info-percent')).toHaveTextContent('68%');
    expect(screen.getByTestId('floating-info-text')).toHaveTextContent('SYNC');
  });

  it('renders the expected outer shell and bordered inner frame', () => {
    const { container } = renderFloatingInfoWindow();
    const shell = container.firstChild as HTMLElement | null;

    expect(shell).toHaveClass('h-screen', 'w-screen', 'overflow-hidden');
    expect(screen.getByTestId('floating-info-window')).toHaveClass('border');
  });

  it('expands on hover, renders the liveline chart, and collapses after pointer leave', async () => {
    vi.useFakeTimers();
    renderFloatingInfoWindow();

    const floatingInfoWindow = screen.getByTestId('floating-info-window');

    fireEvent.pointerEnter(floatingInfoWindow);

    expect(floatingInfoWindow).toHaveAttribute('data-expanded', 'true');
    expect(setFloatingInfoWindowExpanded).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('floating-info-chart')).toBeInTheDocument();
    expect(screen.getByTestId('liveline-mock')).toHaveAttribute('data-theme', 'dark');

    fireEvent.pointerLeave(floatingInfoWindow);
    await act(async () => {
      vi.advanceTimersByTime(160);
    });

    expect(floatingInfoWindow).toHaveAttribute('data-expanded', 'false');
    expect(setFloatingInfoWindowExpanded).toHaveBeenLastCalledWith(false);
    expect(screen.queryByTestId('floating-info-chart')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('updates the live series count over time', async () => {
    vi.useFakeTimers();
    renderFloatingInfoWindow();

    const floatingInfoWindow = screen.getByTestId('floating-info-window');
    const initialCount = Number(floatingInfoWindow.getAttribute('data-series-count'));
    const initialLatestTime = floatingInfoWindow.getAttribute('data-latest-time');

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(Number(floatingInfoWindow.getAttribute('data-series-count'))).toBe(initialCount);
    expect(floatingInfoWindow.getAttribute('data-latest-time')).not.toBe(initialLatestTime);

    vi.useRealTimers();
  });
});