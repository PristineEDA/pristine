import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MenuBar } from './MenuBar';
import { WorkspaceProvider } from '../context/WorkspaceContext';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn(), toggleTheme: vi.fn() }),
}));

function renderMenuBar(props: React.ComponentProps<typeof MenuBar> = {}) {
  return render(
    <WorkspaceProvider>
      <MenuBar {...props} />
    </WorkspaceProvider>,
  );
}

describe('MenuBar', () => {
  it('calls electron window controls when titlebar buttons are clicked', () => {
    renderMenuBar();

    fireEvent.click(screen.getByTestId('window-control-minimize'));
    fireEvent.click(screen.getByTestId('window-control-maximize'));
    fireEvent.click(screen.getByTestId('window-control-close'));

    expect(window.electronAPI?.minimize).toHaveBeenCalledTimes(1);
    expect(window.electronAPI?.maximize).toHaveBeenCalledTimes(1);
    expect(window.electronAPI?.close).toHaveBeenCalledTimes(1);
  });

  it('does not render the select project dropdown or upgrade button', () => {
    renderMenuBar();

    expect(screen.queryByRole('button', { name: /select project/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upgrade to pro/i })).not.toBeInTheDocument();
  });

  it('calls the panel toggle callbacks from the layout icons', () => {
    const onToggleLeftPanel = vi.fn();
    const onToggleBottomPanel = vi.fn();
    const onToggleRightPanel = vi.fn();

    renderMenuBar({
      onToggleLeftPanel,
      onToggleBottomPanel,
      onToggleRightPanel,
    });

    fireEvent.click(screen.getByTestId('toggle-left-panel'));
    fireEvent.click(screen.getByTestId('toggle-bottom-panel'));
    fireEvent.click(screen.getByTestId('toggle-right-panel'));

    expect(onToggleLeftPanel).toHaveBeenCalledTimes(1);
    expect(onToggleBottomPanel).toHaveBeenCalledTimes(1);
    expect(onToggleRightPanel).toHaveBeenCalledTimes(1);
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
    expect(screen.getByTitle('Code')).toBeInTheDocument();
    expect(screen.getByTitle('Whiteboard')).toBeInTheDocument();
    expect(screen.getByTitle('Workflow')).toBeInTheDocument();
  });
});