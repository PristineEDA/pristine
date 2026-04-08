import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MenuBar } from './MenuBar';
import { WorkspaceProvider, useWorkspace } from '../context/WorkspaceContext';
import { SidebarProvider, useSidebar } from './ui/sidebar';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn(), toggleTheme: vi.fn() }),
}));

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
  it('calls electron window controls and routes close through a confirmation dialog', async () => {
    const user = userEvent.setup();

    renderMenuBar();
    const onCloseRequestedMock = vi.mocked(window.electronAPI!.onCloseRequested);
    const firstOnCloseRequestedCall = onCloseRequestedMock.mock.calls[0];
    const closeRequestedHandler = firstOnCloseRequestedCall?.[0];

    expect(closeRequestedHandler).toBeTypeOf('function');
    if (!closeRequestedHandler) {
      throw new Error('Expected onCloseRequested handler to be registered');
    }

    fireEvent.click(screen.getByTestId('window-control-minimize'));
    fireEvent.click(screen.getByTestId('window-control-maximize'));
    await user.click(screen.getByTestId('window-control-close'));

    expect(window.electronAPI?.minimize).toHaveBeenCalledTimes(1);
    expect(window.electronAPI?.maximize).toHaveBeenCalledTimes(1);
    expect(window.electronAPI?.close).toHaveBeenCalledTimes(1);

    await act(async () => {
      closeRequestedHandler();
    });

    expect(await screen.findByTestId('close-confirmation-dialog')).toBeVisible();
    expect(screen.getByText('Close Pristine?')).toBeVisible();
    expect(screen.getByText('You can quit the app now or keep it running in the system tray and reopen it later.')).toBeVisible();

    await user.click(screen.getByTestId('close-action-minimize-to-tray'));
    expect(window.electronAPI?.resolveCloseRequest).toHaveBeenCalledWith('tray', false);
    expect(screen.queryByTestId('close-confirmation-dialog')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('window-control-close'));
    await act(async () => {
      closeRequestedHandler();
    });
    await user.click(screen.getByTestId('close-action-remember-choice'));
    await user.click(screen.getByTestId('close-action-quit'));
    expect(window.electronAPI?.resolveCloseRequest).toHaveBeenCalledWith('quit', true);
  });

  it('shows the remembered close behavior in Settings and lets the user reset it', async () => {
    const user = userEvent.setup();
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'window.closeActionPreference' ? 'tray' : null,
    );

    renderMenuBar();

    await user.click(screen.getByTestId('menu-settings-button'));

    expect(await screen.findByTestId('settings-dialog')).toBeVisible();
    expect(screen.getByTestId('close-behavior-current-value')).toHaveTextContent('Current setting: Minimize to tray');

    await user.click(screen.getByTestId('reset-close-behavior'));

    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('window.closeActionPreference', null);
    expect(screen.getByTestId('close-behavior-current-value')).toHaveTextContent('Current setting: Ask every time');
    expect(screen.getByTestId('reset-close-behavior')).toBeDisabled();
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

  it('disables layout icons on unsupported pages and only disables the activity bar toggle outside code', () => {
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

    expect(onToggleLeftPanel).not.toHaveBeenCalled();
    expect(onToggleBottomPanel).not.toHaveBeenCalled();
    expect(onToggleRightPanel).not.toHaveBeenCalled();
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