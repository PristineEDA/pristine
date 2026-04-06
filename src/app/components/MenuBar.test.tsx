import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MenuBar } from './MenuBar';
import { WorkspaceProvider, useWorkspace } from '../context/WorkspaceContext';

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

function renderMenuBarWithControls(props: React.ComponentProps<typeof MenuBar> = {}) {
  return render(
    <WorkspaceProvider>
      <WorkspaceControls />
      <MenuBar {...props} />
    </WorkspaceProvider>,
  );
}

function WorkspaceControls() {
  const { setActiveView, setMainContentView } = useWorkspace();

  return (
    <div>
      <button onClick={() => setActiveView('simulation')}>set-simulation</button>
      <button onClick={() => setActiveView('synthesis')}>set-synthesis</button>
      <button onClick={() => setMainContentView('whiteboard')}>set-whiteboard</button>
      <button onClick={() => setMainContentView('code')}>set-code</button>
    </div>
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

  it('disables layout icons on unsupported pages and suppresses callbacks', () => {
    const onToggleLeftPanel = vi.fn();
    const onToggleBottomPanel = vi.fn();
    const onToggleRightPanel = vi.fn();

    renderMenuBarWithControls({
      onToggleLeftPanel,
      onToggleBottomPanel,
      onToggleRightPanel,
    });

    fireEvent.click(screen.getByText('set-synthesis'));

    expect(screen.getByTestId('toggle-left-panel')).toBeDisabled();
    expect(screen.getByTestId('toggle-bottom-panel')).toBeDisabled();
    expect(screen.getByTestId('toggle-right-panel')).toBeDisabled();
    expect(screen.getByTestId('toggle-left-panel')).toHaveClass('cursor-not-allowed');
    expect(screen.getByTestId('toggle-bottom-panel')).toHaveClass('cursor-not-allowed');
    expect(screen.getByTestId('toggle-right-panel')).toHaveClass('cursor-not-allowed');

    fireEvent.click(screen.getByTestId('toggle-left-panel'));
    fireEvent.click(screen.getByTestId('toggle-bottom-panel'));
    fireEvent.click(screen.getByTestId('toggle-right-panel'));

    expect(onToggleLeftPanel).not.toHaveBeenCalled();
    expect(onToggleBottomPanel).not.toHaveBeenCalled();
    expect(onToggleRightPanel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('set-simulation'));

    expect(screen.getByTestId('toggle-left-panel')).not.toBeDisabled();
    expect(screen.getByTestId('toggle-bottom-panel')).not.toBeDisabled();
    expect(screen.getByTestId('toggle-right-panel')).not.toBeDisabled();

    fireEvent.click(screen.getByText('set-whiteboard'));
    expect(screen.getByTestId('toggle-left-panel')).toBeDisabled();
    expect(screen.getByTestId('toggle-bottom-panel')).toBeDisabled();
    expect(screen.getByTestId('toggle-right-panel')).toBeDisabled();
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
  });

  it('shows a visible selected style on the active center view button and updates it after switching', () => {
    renderMenuBar();

    const codeButton = screen.getByTestId('center-view-code');
    const whiteboardButton = screen.getByTestId('center-view-whiteboard');

    expect(codeButton).toHaveAttribute('data-state', 'on');
    expect(codeButton).toHaveClass('data-[state=on]:bg-background', 'data-[state=on]:shadow-xs', 'data-[state=on]:border-border');
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