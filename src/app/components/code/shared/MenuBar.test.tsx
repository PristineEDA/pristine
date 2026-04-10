import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuBar } from './MenuBar';
import { WorkspaceProvider, useWorkspace } from '../../../context/WorkspaceContext';
import { SidebarProvider, useSidebar } from '../../ui/sidebar';

const setEditorFontSizeMock = vi.fn();
const setEditorThemeMock = vi.fn();
const setThemeMock = vi.fn();
const toggleThemeMock = vi.fn();
let mockedEditorFontSize = 13;
let mockedEditorTheme = 'dracula';
let mockedTheme: 'light' | 'dark' = 'light';

vi.mock('../../../context/EditorSettingsContext', () => ({
  useEditorSettings: () => ({
    fontSize: mockedEditorFontSize,
    setFontSize: setEditorFontSizeMock,
    setTheme: setEditorThemeMock,
    theme: mockedEditorTheme,
    themes: [],
  }),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: mockedTheme, setTheme: setThemeMock, toggleTheme: toggleThemeMock }),
}));

beforeEach(() => {
  mockedEditorFontSize = 13;
  mockedEditorTheme = 'dracula';
  mockedTheme = 'light';
  setEditorFontSizeMock.mockReset();
  setEditorThemeMock.mockReset();
  setThemeMock.mockReset();
  toggleThemeMock.mockReset();
  vi.mocked(window.electronAPI!.config.get).mockReset();
  vi.mocked(window.electronAPI!.config.set).mockReset();
  vi.mocked(window.electronAPI!.setFloatingInfoWindowVisible).mockReset();
});

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

  it('shows editor settings plus theme, close-to-tray and floating info window visibility', async () => {
    const user = userEvent.setup();
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === 'ui.theme'
        ? 'dark'
        : key === 'editor.fontSize'
          ? 18
          : key === 'editor.theme'
            ? 'night-owl'
            :
      key === 'window.closeActionPreference'
        ? 'tray'
        : key === 'ui.floatingInfoWindow.visible'
          ? true
          : null,
    );

    renderMenuBar();

    await user.click(screen.getByTestId('menu-settings-button'));

    expect(await screen.findByTestId('settings-dialog')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-size-value')).toHaveTextContent('18px');
    expect(screen.getByTestId('settings-editor-theme-combobox')).toHaveTextContent('Night Owl');
    expect(screen.getByTestId('settings-theme-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-close-to-tray-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-floating-info-window-switch')).toHaveAttribute('data-state', 'checked');

    await user.click(screen.getByTestId('settings-editor-theme-combobox'));
    await user.click(await screen.findByTestId('settings-editor-theme-option-github-dark'));
    await user.click(screen.getByTestId('settings-theme-switch'));
    await user.click(screen.getByTestId('settings-close-to-tray-switch'));
    await user.click(screen.getByTestId('settings-floating-info-window-switch'));

    expect(setEditorThemeMock).toHaveBeenCalledWith('github-dark');
    expect(setThemeMock).toHaveBeenCalledWith('light');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('window.closeActionPreference', 'quit');
    expect(window.electronAPI?.config.set).toHaveBeenCalledWith('ui.floatingInfoWindow.visible', false);
    expect(window.electronAPI?.setFloatingInfoWindowVisible).toHaveBeenCalledWith(false);
  });

  it('re-reads persisted settings each time the dialog opens', async () => {
    const user = userEvent.setup();
    const configGetMock = vi.mocked(window.electronAPI!.config.get);

    configGetMock.mockImplementation((key: string) =>
      key === 'ui.theme'
        ? 'dark'
        : key === 'editor.fontSize'
          ? 18
          : key === 'editor.theme'
            ? 'night-owl'
            :
      key === 'window.closeActionPreference'
        ? 'tray'
        : key === 'ui.floatingInfoWindow.visible'
          ? true
          : null,
    );

    renderMenuBar();

    await user.click(screen.getByTestId('menu-settings-button'));

    expect(await screen.findByTestId('settings-dialog')).toBeVisible();
    expect(screen.getByTestId('settings-editor-font-size-value')).toHaveTextContent('18px');
    expect(screen.getByTestId('settings-editor-theme-combobox')).toHaveTextContent('Night Owl');
    expect(screen.getByTestId('settings-theme-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-close-to-tray-switch')).toHaveAttribute('data-state', 'checked');
    expect(screen.getByTestId('settings-floating-info-window-switch')).toHaveAttribute('data-state', 'checked');

    await user.click(screen.getByTestId('settings-close-button'));

    configGetMock.mockImplementation((key: string) =>
      key === 'ui.theme'
        ? 'light'
        : key === 'editor.fontSize'
          ? 12
          : key === 'editor.theme'
            ? 'github-light'
            :
      key === 'window.closeActionPreference'
        ? 'quit'
        : key === 'ui.floatingInfoWindow.visible'
          ? false
          : null,
    );

    await user.click(screen.getByTestId('menu-settings-button'));

    expect(await screen.findByTestId('settings-dialog')).toBeVisible();
  expect(screen.getByTestId('settings-editor-font-size-value')).toHaveTextContent('12px');
  expect(screen.getByTestId('settings-editor-theme-combobox')).toHaveTextContent('GitHub Light');
    expect(screen.getByTestId('settings-theme-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-close-to-tray-switch')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('settings-floating-info-window-switch')).toHaveAttribute('data-state', 'unchecked');
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