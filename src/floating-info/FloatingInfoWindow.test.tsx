import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../app/context/ThemeContext';
import { FloatingInfoWindow } from './FloatingInfoWindow';

vi.mock('liveline', () => ({
  Liveline: ({ theme, color }: { theme: string; color: string }) => (
    <div data-testid="liveline-mock" data-theme={theme} data-color={color} />
  ),
}));

const setFloatingInfoWindowExpanded = vi.fn(() => Promise.resolve(true));
const setFloatingInfoWindowMode = vi.fn(() => Promise.resolve(true));

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
    setFloatingInfoWindowMode,
  } as typeof window.electronAPI;

  return render(
    <ThemeProvider>
      <FloatingInfoWindow />
    </ThemeProvider>,
  );
}

describe('FloatingInfoWindow', () => {
  beforeEach(() => {
    setFloatingInfoWindowExpanded.mockClear();
    setFloatingInfoWindowMode.mockClear();
  });

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

  it('expands only after the hover delay, renders the liveline chart, and collapses after pointer leave', async () => {
    vi.useFakeTimers();
    renderFloatingInfoWindow();

    const floatingInfoWindow = screen.getByTestId('floating-info-window');

    fireEvent.pointerEnter(floatingInfoWindow);

    expect(floatingInfoWindow).toHaveAttribute('data-expanded', 'false');
    expect(floatingInfoWindow).toHaveAttribute('data-mode', 'collapsed');
    expect(screen.queryByTestId('floating-info-chart')).not.toBeInTheDocument();
    expect(setFloatingInfoWindowMode).not.toHaveBeenCalledWith('expanded');

    await act(async () => {
      vi.advanceTimersByTime(999);
    });

    expect(floatingInfoWindow).toHaveAttribute('data-expanded', 'false');
    expect(floatingInfoWindow).toHaveAttribute('data-mode', 'collapsed');

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(floatingInfoWindow).toHaveAttribute('data-expanded', 'true');
    expect(floatingInfoWindow).toHaveAttribute('data-mode', 'expanded');
    expect(setFloatingInfoWindowMode).toHaveBeenCalledWith('expanded');
    expect(screen.getByTestId('floating-info-chart')).toBeInTheDocument();
    expect(screen.getByTestId('floating-info-expanded-drag-region')).toHaveAttribute('data-app-region', 'drag');
    expect(screen.getByTestId('floating-info-chart-shell')).toHaveAttribute('data-app-region', 'no-drag');
    expect(screen.getByTestId('liveline-mock')).toHaveAttribute('data-theme', 'dark');

    vi.spyOn(floatingInfoWindow, 'getBoundingClientRect').mockReturnValue({
      bottom: 120,
      height: 120,
      left: 0,
      right: 240,
      top: 0,
      width: 240,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerLeave(floatingInfoWindow, {
      clientX: 20,
      clientY: 20,
    });
    await act(async () => {
      vi.advanceTimersByTime(160);
    });

    expect(floatingInfoWindow).toHaveAttribute('data-expanded', 'true');
    expect(floatingInfoWindow).toHaveAttribute('data-mode', 'expanded');
    expect(screen.getByTestId('floating-info-chart')).toBeInTheDocument();

    fireEvent.pointerLeave(floatingInfoWindow, {
      clientX: 999,
      clientY: 999,
    });
    await act(async () => {
      vi.advanceTimersByTime(160);
    });

    expect(floatingInfoWindow).toHaveAttribute('data-expanded', 'false');
    expect(floatingInfoWindow).toHaveAttribute('data-mode', 'collapsed');
    expect(setFloatingInfoWindowMode).toHaveBeenLastCalledWith('collapsed');
    expect(screen.queryByTestId('floating-info-chart')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('does not expand while a drag gesture is active', async () => {
    vi.useFakeTimers();
    renderFloatingInfoWindow();

    const floatingInfoWindow = screen.getByTestId('floating-info-window');
    const dragHandle = screen.getByTestId('floating-info-drag-handle');

    expect(dragHandle).toHaveAttribute('data-app-region', 'drag');

    fireEvent.pointerEnter(floatingInfoWindow);
    fireEvent.pointerDown(dragHandle);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(floatingInfoWindow).toHaveAttribute('data-expanded', 'false');
    expect(floatingInfoWindow).toHaveAttribute('data-mode', 'collapsed');
    expect(setFloatingInfoWindowMode).not.toHaveBeenCalledWith('expanded');

    fireEvent.pointerUp(floatingInfoWindow);
    fireEvent.pointerEnter(floatingInfoWindow);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(floatingInfoWindow).toHaveAttribute('data-expanded', 'true');
    expect(floatingInfoWindow).toHaveAttribute('data-mode', 'expanded');

    vi.useRealTimers();
  });

  it('enters the static detail view on double-click and returns to collapsed on Quit', () => {
    renderFloatingInfoWindow();

    const floatingInfoWindow = screen.getByTestId('floating-info-window');
    fireEvent.doubleClick(floatingInfoWindow);

    expect(floatingInfoWindow).toHaveAttribute('data-expanded', 'true');
    expect(floatingInfoWindow).toHaveAttribute('data-mode', 'detail');
    expect(setFloatingInfoWindowMode).toHaveBeenCalledWith('detail');
    expect(screen.getByTestId('floating-info-detail')).toBeInTheDocument();
    expect(screen.getByText('Pi Stats')).toBeInTheDocument();
    expect(screen.getByText('RTL Files')).toBeInTheDocument();
    expect(screen.getByText('Compile Activity')).toBeInTheDocument();
    expect(screen.getByText('Top Design Unit')).toBeInTheDocument();
    expect(screen.queryByText('Daily Spend')).not.toBeInTheDocument();
    expect(screen.queryByText('Top Language')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-info-detail-tab-simulation')).toBeInTheDocument();
    expect(screen.queryByTestId('floating-info-detail-tab-usage')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-info-detail-content')).toHaveClass(
      'overflow-y-auto',
      '[scrollbar-width:none]',
      '[&::-webkit-scrollbar]:hidden',
    );
    expect(screen.getAllByTestId('floating-info-metric-card')[0]).toHaveClass('bg-muted/60', 'border-border/80');

    expect(screen.getByTestId('floating-info-range-controls')).toHaveClass('bg-muted/75', 'border-border/80');
    for (const label of ['1d', '2d', '7d', 'All']) {
      const rangeButton = screen.getByTestId(`floating-info-range-${label.toLowerCase()}`);
      expect(rangeButton).toHaveAttribute('aria-label', label);
      expect(rangeButton).toHaveAttribute('title', label);
      expect(rangeButton).toHaveClass('h-5', 'w-5');
      expect(rangeButton.querySelector('svg')).toHaveClass('h-3.5', 'w-3.5');
    }
    expect(screen.getByTestId('floating-info-detail-refresh')).toHaveClass('h-5', 'w-5');
    expect(screen.getByTestId('floating-info-detail-settings')).toHaveClass('h-5', 'w-5');

    const dragRegion = screen.getByTestId('floating-info-detail-drag-region');
    expect(dragRegion).toHaveAttribute('data-app-region', 'drag');
    expect(dragRegion.getAttribute('style')).toContain('user-select: none');

    fireEvent.click(screen.getByTestId('floating-info-detail-tab-languages'));

    expect(screen.getAllByText('SystemVerilog')).not.toHaveLength(0);
    expect(screen.getByText('181.1K')).toBeInTheDocument();
    expect(screen.getByText('by HDL footprint')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('floating-info-detail-tab-projects'));

    expect(screen.getByText('retroSoC')).toBeInTheDocument();
    expect(screen.getByText('xpi_core')).toBeInTheDocument();
    expect(screen.queryByText('acme-dashboard')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('floating-info-detail-tab-models'));

    expect(screen.getByText('Model & Tool Usage')).toBeInTheDocument();
    expect(screen.getByText('Tool Calls')).toBeInTheDocument();
    expect(screen.getByText('Cache Read')).toBeInTheDocument();
    expect(screen.getByText('bash')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('floating-info-detail-tab-simulation'));

    expect(screen.getByText('Recent Simulation')).toBeInTheDocument();
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
    expect(screen.getByText('Waveforms')).toBeInTheDocument();
    expect(screen.getByText('xpi_loopback')).toBeInTheDocument();

    expect(screen.getByTestId('floating-info-detail-quit')).toHaveClass('h-5', 'gap-1');
    expect(screen.getByTestId('floating-info-detail-quit').querySelector('svg')).toHaveClass('h-3.5', 'w-3.5');
    expect(screen.getByTestId('floating-info-detail-shortcut')).toHaveTextContent('Q');
    expect(screen.getByTestId('floating-info-detail-shortcut')).toHaveClass('h-5', 'gap-1');
    expect(screen.getByTestId('floating-info-detail-shortcut').querySelector('svg')).toHaveClass('h-3.5', 'w-3.5');

    fireEvent.click(screen.getByTestId('floating-info-detail-quit'));

    expect(floatingInfoWindow).toHaveAttribute('data-expanded', 'false');
    expect(floatingInfoWindow).toHaveAttribute('data-mode', 'collapsed');
    expect(setFloatingInfoWindowMode).toHaveBeenLastCalledWith('collapsed');
    expect(screen.queryByTestId('floating-info-detail')).not.toBeInTheDocument();
  });

  it('does not leave detail mode after pointer leave', async () => {
    vi.useFakeTimers();
    renderFloatingInfoWindow();

    const floatingInfoWindow = screen.getByTestId('floating-info-window');
    fireEvent.doubleClick(floatingInfoWindow);
    setFloatingInfoWindowMode.mockClear();

    fireEvent.pointerLeave(floatingInfoWindow);
    await act(async () => {
      vi.advanceTimersByTime(160);
    });

    expect(floatingInfoWindow).toHaveAttribute('data-mode', 'detail');
    expect(screen.getByTestId('floating-info-detail')).toBeInTheDocument();
    expect(setFloatingInfoWindowMode).not.toHaveBeenCalledWith('collapsed');

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
