
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX } from './components/code/shared/CodeWorkspaceShell';
import { resetWorkspaceGitStatusStoreForTests } from './git/workspaceGitStatus';

let renderRealActivityBar = false;

vi.mock('./components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div data-testid="panel-group">{children}</div>,
  ResizablePanel: ({ children, id, minSize, defaultSize, collapsed }: any) => {
    if (collapsed) {
      return null;
    }

    return <div data-testid={`panel-${id}`} data-min-size={minSize} data-default-size={defaultSize}>{children}</div>;
  },
  ResizableHandle: ({ hidden }: { hidden?: boolean }) => (hidden ? null : <div data-testid="panel-handle" />),
}));

vi.mock('./components/code/shared/MenuBar', async () => {
  const actual = await vi.importActual<typeof import('./context/WorkspaceContext')>('./context/WorkspaceContext');
  const sidebar = await vi.importActual<typeof import('./components/ui/sidebar')>('./components/ui/sidebar');

  return {
    MenuBar: ({
    showLeftPanel,
    showBottomPanel,
    showRightPanel,
    onShowLeftPanelChange,
    onShowBottomPanelChange,
    onShowRightPanelChange,
  }: any) => {
    const workspace = actual.useWorkspace();
    const activityBar = sidebar.useSidebar();

    return (
      <div data-testid="menu-bar">
        <span data-testid="menu-left-state">{String(showLeftPanel)}</span>
        <span data-testid="menu-bottom-state">{String(showBottomPanel)}</span>
        <span data-testid="menu-right-state">{String(showRightPanel)}</span>
        <span data-testid="main-content-view">{workspace.mainContentView}</span>
        <span data-testid="menu-layout-enabled">{String(workspace.canToggleLayoutPanels)}</span>
        <span data-testid="menu-activity-bar-state">{activityBar.state}</span>
        <button disabled={!workspace.canToggleLayoutPanels} onClick={() => onShowLeftPanelChange?.(!showLeftPanel)}>toggle-left-panel</button>
        <button disabled={!workspace.canToggleLayoutPanels} onClick={() => onShowBottomPanelChange?.(!showBottomPanel)}>toggle-bottom-panel</button>
        <button disabled={!workspace.canToggleLayoutPanels} onClick={() => onShowRightPanelChange?.(!showRightPanel)}>toggle-right-panel</button>
        <button onClick={activityBar.toggleSidebar}>toggle-activity-bar</button>
        <button onClick={() => workspace.setMainContentView('code')}>switch-code</button>
        <button onClick={() => workspace.setMainContentView('whiteboard')}>switch-whiteboard</button>
        <button onClick={() => workspace.setMainContentView('workflow')}>switch-workflow</button>
      </div>
    );
  },
  };
});

vi.mock('./components/code/shared/ActivityBar', async () => {
  const sidebar = await vi.importActual<typeof import('./components/ui/sidebar')>('./components/ui/sidebar');
  const actualActivityBar = await vi.importActual<typeof import('./components/code/shared/ActivityBar')>('./components/code/shared/ActivityBar');

  return {
    ActivityBar: ({ activeView, onItemSelect }: { activeView: string; onItemSelect: (view: string) => void }) => {
      if (renderRealActivityBar) {
        return <actualActivityBar.ActivityBar activeView={activeView} onItemSelect={onItemSelect} />;
      }

      const activityBar = sidebar.useSidebar();

      return (
        <div data-testid="activity-bar">
          <span data-testid="activity-view">{activeView}</span>
          <span data-testid="activity-bar-state">{activityBar.state}</span>
          <button onClick={() => onItemSelect('simulation')}>select-simulation</button>
          <button onClick={() => onItemSelect('synthesis')}>select-synthesis</button>
          <button onClick={() => onItemSelect('physical')}>select-physical</button>
          <button onClick={() => onItemSelect('factory')}>select-factory</button>
          <button onClick={() => onItemSelect('explorer')}>select-explorer</button>
        </div>
      );
    },
  };
});

vi.mock('./components/whiteboard/WhiteboardView', () => ({
  WhiteboardView: () => <div data-testid="whiteboard-view">whiteboard</div>,
}));

vi.mock('./components/workflow/WorkflowView', () => ({
  WorkflowView: ({ title = 'Workflow', testId = 'workflow-view' }: { title?: string; testId?: string }) => (
    <div data-testid={testId}>{title}</div>
  ),
}));

vi.mock('./components/code/explorer/LeftSidePanel', () => ({
  LeftSidePanel: ({ activeFileId, currentOutlineId, onFileOpen, onLineJump, revealRequest }: any) => (
    <div data-testid="left-panel">
      <span data-testid="left-active-file">{activeFileId}</span>
      <span data-testid="left-outline-file">{currentOutlineId}</span>
      <span data-testid="left-reveal-path">{revealRequest?.path ?? ''}</span>
      <span data-testid="left-reveal-token">{revealRequest?.token ?? ''}</span>
      <button onClick={() => { onFileOpen('rtl/core/reg_file.v', 'reg_file.v'); onLineJump(77); }}>left-open</button>
    </div>
  ),
}));

vi.mock('./components/code/shared/EditorSplitLayout', async () => {
  const actual = await vi.importActual<typeof import('./context/WorkspaceContext')>('./context/WorkspaceContext');

  return {
    EditorSplitLayout: ({ jumpToLine, onActiveFileReveal }: any) => {
      const workspace = actual.useWorkspace();
      const restoreRequest = workspace.focusedGroupId ? workspace.getCursorRestoreRequest(workspace.focusedGroupId) : undefined;

      return (
        <div>
          <span data-testid="editor-active-tab">{workspace.activeTabId}</span>
          <span data-testid="editor-tab-count">{workspace.tabs.length}</span>
          <span data-testid="editor-jump-line">{jumpToLine ?? 'none'}</span>
          <span data-testid="editor-restore-file">{restoreRequest?.fileId ?? ''}</span>
          <span data-testid="editor-restore-line">{restoreRequest?.line ?? ''}</span>
          <span data-testid="editor-restore-col">{restoreRequest?.col ?? ''}</span>
          <button onClick={() => { onActiveFileReveal?.('rtl/core/reg_file.v'); workspace.setActiveTabId('rtl/core/reg_file.v'); }}>editor-activate-reg</button>
          <button onClick={() => { onActiveFileReveal?.('rtl/core/alu.v'); workspace.setActiveTabId('rtl/core/alu.v'); }}>editor-activate-alu</button>
          <button onClick={() => workspace.closeFile('rtl/core/reg_file.v')}>editor-close-open</button>
          <button onClick={() => workspace.setCursorPos(9, 3)}>editor-cursor</button>
        </div>
      );
    },
  };
});

vi.mock('./components/code/explorer/RightSidePanel', () => ({
  RightSidePanel: ({ onFileOpen, onLineJump, onThreadListExpandedChange, onThreadListWidthChange }: any) => (
    <div data-testid="right-panel">
      <button onClick={() => { onFileOpen('rtl/core/alu.v', 'alu.v'); onLineJump(33); }}>right-open</button>
      <button onClick={() => onThreadListExpandedChange?.(true)}>assistant-expand-thread-list</button>
      <button onClick={() => onThreadListExpandedChange?.(false)}>assistant-collapse-thread-list</button>
      <button onClick={() => onThreadListWidthChange?.(280)}>assistant-thread-list-width-280</button>
      <button onClick={() => onThreadListWidthChange?.(340)}>assistant-thread-list-width-340</button>
    </div>
  ),
}));

vi.mock('./components/code/explorer/BottomPanel', () => ({
  BottomPanel: ({ onClose }: { onClose?: () => void }) => (
    <div>
      <span data-testid="bottom-panel">bottom</span>
      <button onClick={onClose}>close-bottom</button>
    </div>
  ),
}));

vi.mock('./components/code/shared/statusBars/AppStatusBar', () => ({
  AppStatusBar: ({ mainContentView, activeView, activeFileId, cursorLine, cursorCol }: any) => (
    <div data-testid="status-bar">
      <span data-testid="status-bar-main-view">{mainContentView}</span>
      <span data-testid="status-bar-code-view">{activeView}</span>
      <span data-testid="status-bar-active-file">{activeFileId}</span>
      <span data-testid="status-bar-cursor">{`${cursorLine}:${cursorCol}`}</span>
    </div>
  ),
}));

vi.mock('./components/code/shared/QuickOpenPalette', () => ({
  QuickOpenPalette: ({ isOpen, mode, query, results, onQueryChange, onSelectResult, onClose }: any) => (
    isOpen ? (
      <div data-testid="quick-open-overlay">
        <span data-testid="quick-open-mode">{mode}</span>
        <span data-testid="quick-open-query">{query}</span>
        <span data-testid="quick-open-result-paths">{results.map((result: any) => result.path).join('|')}</span>
        <button onClick={() => onQueryChange('alu')}>quick-open-set-query</button>
        <button onClick={() => onSelectResult({ path: 'rtl/core/alu.v', name: 'alu.v', score: 100 })}>quick-open-select-alu</button>
        <button onClick={onClose}>quick-open-close</button>
      </div>
    ) : null
  ),
}));

type TestUser = ReturnType<typeof userEvent.setup>;

let testUser: TestUser;

async function clickText(text: string) {
  await testUser.click(screen.getByText(text));
}

async function clickTestId(testId: string) {
  await testUser.click(screen.getByTestId(testId));
}

describe('App', () => {
  beforeEach(() => {
    testUser = userEvent.setup();
    renderRealActivityBar = false;
    resetWorkspaceGitStatusStoreForTests();
    vi.clearAllMocks();
  });

  it('opens the left panel at 240px and remembers dragged width across code view switches', async () => {
    render(<App />);

    expect(screen.queryByTestId('panel-left-panel')).not.toBeInTheDocument();

    await clickText('toggle-left-panel');

    expect(screen.getByTestId('panel-left-panel')).toHaveStyle({ width: '240px' });

    const leftHandle = screen.getByTestId('panel-handle-left-panel');
    fireEvent.pointerDown(leftHandle, { clientX: 240, pointerId: 1 });
    fireEvent.pointerMove(leftHandle, { clientX: 300, pointerId: 1 });
    fireEvent.pointerUp(leftHandle, { clientX: 300, pointerId: 1 });

    expect(screen.getByTestId('panel-left-panel')).toHaveStyle({ width: '300px' });

    await clickText('select-simulation');
    expect(await screen.findByTestId('code-view-simulation')).toBeInTheDocument();

    await clickText('select-explorer');

    await waitFor(() => {
      expect(screen.getByTestId('panel-left-panel')).toHaveStyle({ width: '300px' });
    });
  });

  it('wires shared workspace state across panels', async () => {
    render(<App />);

    expect(screen.getByTestId('menu-bar')).toBeInTheDocument();
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('false');
    expect(screen.getByTestId('main-content-view')).toHaveTextContent('code');
    expect(screen.getByTestId('menu-layout-enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('activity-view')).toHaveTextContent('explorer');
    expect(screen.getByTestId('activity-bar')).toBeInTheDocument();
    expect(screen.getByTestId('menu-activity-bar-state')).toHaveTextContent('collapsed');
    expect(screen.getByTestId('activity-bar-state')).toHaveTextContent('collapsed');
    expect(screen.queryByTestId('panel-left-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('left-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bottom-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('editor-tab-count')).toHaveTextContent('0');
    expect(screen.getByTestId('status-bar-main-view')).toHaveTextContent('code');
    expect(screen.getByTestId('status-bar-code-view')).toHaveTextContent('explorer');
    expect(screen.getByTestId('status-bar-active-file')).toHaveTextContent('');
    expect(screen.getByTestId('status-bar-cursor')).toHaveTextContent('1:1');

    await clickText('toggle-left-panel');
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('true');
    expect(screen.getByTestId('panel-left-panel')).toHaveStyle({ width: '240px' });
    expect(screen.getByTestId('left-panel')).toBeInTheDocument();
    expect(screen.getByTestId('left-active-file')).toHaveTextContent('');

    await clickText('left-open');
    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('rtl/core/reg_file.v');
    expect(screen.getByTestId('editor-tab-count')).toHaveTextContent('1');
    expect(screen.getByTestId('editor-jump-line')).toHaveTextContent('77');

    await clickText('editor-cursor');
    expect(screen.getByTestId('status-bar-active-file')).toHaveTextContent('rtl/core/reg_file.v');
    expect(screen.getByTestId('status-bar-cursor')).toHaveTextContent('9:3');

    await clickText('toggle-right-panel');
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('true');
    expect(screen.getByTestId('panel-right-panel')).toHaveStyle({ width: `${EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX}px` });
    expect(screen.getByTestId('right-panel')).toBeInTheDocument();

    await clickText('right-open');
    expect(screen.getByTestId('editor-tab-count')).toHaveTextContent('2');

    await clickText('editor-activate-alu');
    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('rtl/core/alu.v');

    await clickText('toggle-bottom-panel');
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('true');
    expect(screen.getByTestId('panel-bottom-panel')).toHaveAttribute('data-default-size', '40');
    expect(screen.getByTestId('bottom-panel')).toBeInTheDocument();

    await clickText('close-bottom');
    expect(screen.queryByTestId('bottom-panel')).not.toBeInTheDocument();

    await clickText('select-simulation');
    expect(await screen.findByTestId('code-view-simulation')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('activity-view')).toHaveTextContent('simulation');
    });
    expect(screen.getByTestId('status-bar-main-view')).toHaveTextContent('code');
    expect(screen.getByTestId('status-bar-code-view')).toHaveTextContent('simulation');
    expect(screen.getByTestId('panel-simulation-left-panel')).toBeInTheDocument();
    expect(screen.getByTestId('panel-simulation-bottom-panel')).toBeInTheDocument();
    expect(screen.getByTestId('panel-simulation-right-panel')).toBeInTheDocument();
    expect(screen.getByTestId('simulation-left-panel-content')).toHaveTextContent('Left Panel');
    expect(screen.getByTestId('simulation-main-panel-content')).toHaveTextContent('Simulation Workspace');
    expect(screen.getByTestId('simulation-bottom-panel-content')).toHaveTextContent('Bottom Panel');
    expect(screen.getByTestId('simulation-right-panel-content')).toHaveTextContent('Right Panel');

    await clickText('select-explorer');
    expect(screen.getByTestId('activity-view')).toHaveTextContent('explorer');
    expect(screen.getByTestId('status-bar-code-view')).toHaveTextContent('explorer');
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('true');
    expect(screen.getByTestId('left-panel')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel')).toBeInTheDocument();
  });

  it('hides the activity bar outside code and restores the last selected code subview', async () => {
    render(<App />);

    await clickText('select-synthesis');
    expect(await screen.findByTestId('code-view-synthesis')).toHaveTextContent('Synthesis');

    await clickText('switch-whiteboard');
    expect(screen.getByTestId('main-content-view')).toHaveTextContent('whiteboard');
    expect(screen.queryByTestId('activity-bar')).not.toBeInTheDocument();
    expect(await screen.findByTestId('whiteboard-view')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar-main-view')).toHaveTextContent('whiteboard');

    await clickText('switch-workflow');
    expect(screen.getByTestId('main-content-view')).toHaveTextContent('workflow');
    expect(screen.queryByTestId('activity-bar')).not.toBeInTheDocument();
    expect(await screen.findByTestId('workflow-view')).toHaveTextContent('Workflow');
    expect(screen.getByTestId('status-bar-main-view')).toHaveTextContent('workflow');

    await clickText('switch-code');
    expect(screen.getByTestId('main-content-view')).toHaveTextContent('code');
    expect(screen.getByTestId('activity-bar')).toBeInTheDocument();
    expect(screen.getByTestId('activity-view')).toHaveTextContent('synthesis');
    expect(screen.getByTestId('status-bar-main-view')).toHaveTextContent('code');
    expect(screen.getByTestId('status-bar-code-view')).toHaveTextContent('synthesis');
    expect(await screen.findByTestId('code-view-synthesis')).toHaveTextContent('Synthesis');
  });

  it('keeps the activity bar collapse state when switching away from and back to code', async () => {
    render(<App />);

    expect(screen.getByTestId('menu-activity-bar-state')).toHaveTextContent('collapsed');
    expect(screen.getByTestId('activity-bar-state')).toHaveTextContent('collapsed');

    await clickText('toggle-activity-bar');
    expect(screen.getByTestId('menu-activity-bar-state')).toHaveTextContent('expanded');
    expect(screen.getByTestId('activity-bar-state')).toHaveTextContent('expanded');

    await clickText('switch-whiteboard');
    expect(screen.getByTestId('main-content-view')).toHaveTextContent('whiteboard');
    expect(screen.queryByTestId('activity-bar')).not.toBeInTheDocument();
    expect(screen.getByTestId('menu-activity-bar-state')).toHaveTextContent('expanded');

    await clickText('switch-code');
    expect(screen.getByTestId('main-content-view')).toHaveTextContent('code');
    expect(screen.getByTestId('activity-bar')).toBeInTheDocument();
    expect(screen.getByTestId('activity-bar-state')).toHaveTextContent('expanded');
  });

  it('switches the actual code view when a real ActivityBar item is clicked', async () => {
    renderRealActivityBar = true;

    try {
      render(<App />);

      await clickTestId('activity-item-simulation');

      expect(await screen.findByTestId('code-view-simulation')).toBeInTheDocument();
      expect(screen.getByTestId('simulation-main-panel-content')).toHaveTextContent('Simulation Workspace');

      await clickTestId('activity-item-physical');

      expect(await screen.findByTestId('code-view-physical')).toHaveTextContent('Physical Design');
    } finally {
      renderRealActivityBar = false;
    }
  });

  it('toggles the left, bottom, and right panels with Ctrl+B, Ctrl+J, and Ctrl+Alt+B', () => {
    render(<App />);

    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('false');

    fireEvent.keyDown(document, { key: 'b', ctrlKey: true });
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('true');
    expect(screen.getByTestId('left-panel')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'j', ctrlKey: true });
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('true');
    expect(screen.getByTestId('bottom-panel')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'b', ctrlKey: true, altKey: true });
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('true');
    expect(screen.getByTestId('right-panel')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'b', ctrlKey: true });
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.queryByTestId('left-panel')).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'j', ctrlKey: true });
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('false');
    expect(screen.queryByTestId('bottom-panel')).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'b', ctrlKey: true, altKey: true });
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('false');
    expect(screen.getByTestId('panel-right-panel')).toHaveStyle({ width: '0px' });
    expect(screen.getByTestId('panel-right-panel')).toHaveAttribute('aria-hidden', 'true');
  });

  it('remembers panel visibility per code subview and disables layout interactions on unsupported pages', async () => {
    render(<App />);

    await clickText('toggle-left-panel');
    await clickText('toggle-right-panel');

    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('true');
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('true');
    expect(screen.getByTestId('left-panel')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel')).toBeInTheDocument();

    await clickText('select-simulation');
    expect(await screen.findByTestId('menu-layout-enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('true');
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('true');
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('true');

    await clickText('toggle-left-panel');
    await clickText('toggle-bottom-panel');
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('false');
    expect(screen.queryByTestId('panel-simulation-left-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-simulation-bottom-panel')).not.toBeInTheDocument();

    await clickText('select-synthesis');
    expect(await screen.findByTestId('menu-layout-enabled')).toHaveTextContent('false');
    expect(screen.getByText('toggle-left-panel')).toBeDisabled();
    expect(screen.getByText('toggle-bottom-panel')).toBeDisabled();
    expect(screen.getByText('toggle-right-panel')).toBeDisabled();
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('false');

    fireEvent.keyDown(document, { key: 'b', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'j', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'b', ctrlKey: true, altKey: true });
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('false');

    await clickText('switch-whiteboard');
    expect(screen.getByTestId('menu-layout-enabled')).toHaveTextContent('false');

    await clickText('switch-code');
    expect(screen.getByTestId('activity-view')).toHaveTextContent('synthesis');
    expect(screen.getByTestId('menu-layout-enabled')).toHaveTextContent('false');

    await clickText('select-simulation');
    expect(await screen.findByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('true');

    await clickText('select-explorer');
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('true');
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('true');
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('false');
  });

  it('does not carry the simulation right panel into explorer after returning from higher-priority navigation', async () => {
    render(<App />);

    await clickText('select-simulation');
    expect(await screen.findByTestId('menu-right-state')).toHaveTextContent('true');

    await clickText('toggle-left-panel');
    await clickText('toggle-bottom-panel');
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('true');

    await clickText('select-synthesis');
    expect(await screen.findByTestId('menu-layout-enabled')).toHaveTextContent('false');

    await clickText('switch-whiteboard');
    expect(screen.getByTestId('main-content-view')).toHaveTextContent('whiteboard');

    await clickText('switch-workflow');
    expect(screen.getByTestId('main-content-view')).toHaveTextContent('workflow');

    await clickText('switch-code');
    expect(screen.getByTestId('activity-view')).toHaveTextContent('synthesis');
    expect(screen.getByTestId('menu-layout-enabled')).toHaveTextContent('false');

    await clickText('select-simulation');
    expect(await screen.findByTestId('menu-right-state')).toHaveTextContent('true');

    await clickText('select-explorer');
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('false');
    expect(screen.queryByTestId('panel-left-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-right-panel')).not.toBeInTheDocument();
  });

  it('opens quick open with Ctrl+P, resets the query on reopen, and selects a file', async () => {
    vi.mocked(window.electronAPI!.fs.listFiles).mockResolvedValue([
      'README.md',
      'rtl/core/alu.v',
      '.gitignore',
    ]);

    render(<App />);

    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });

    await screen.findByTestId('quick-open-overlay');
    expect(window.electronAPI?.fs.listFiles).toHaveBeenCalledWith('.');
    expect(screen.getByTestId('quick-open-mode')).toHaveTextContent('recent');

    await clickText('quick-open-set-query');
    expect(screen.getByTestId('quick-open-query')).toHaveTextContent('alu');

    await clickText('quick-open-select-alu');

    expect(screen.queryByTestId('quick-open-overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('rtl/core/alu.v');

    await clickText('toggle-left-panel');
    expect(screen.getByTestId('left-reveal-path')).toHaveTextContent('rtl/core/alu.v');

    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    expect(await screen.findByTestId('quick-open-query')).toHaveTextContent('');
    expect(screen.getByTestId('quick-open-mode')).toHaveTextContent('recent');
    expect(screen.getByTestId('quick-open-result-paths')).toHaveTextContent('rtl/core/alu.v');

    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    expect(screen.queryByTestId('quick-open-overlay')).not.toBeInTheDocument();
  });

  it('reveals the active file in explorer when editor tab activation changes or repeats', async () => {
    render(<App />);

    await clickText('toggle-left-panel');
    await clickText('left-open');
    await clickText('toggle-right-panel');
    await clickText('right-open');
    await clickText('editor-activate-reg');

    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('rtl/core/reg_file.v');
    expect(screen.getByTestId('left-reveal-path')).toHaveTextContent('rtl/core/reg_file.v');

    const firstRevealToken = Number(screen.getByTestId('left-reveal-token').textContent);

    await clickText('editor-activate-reg');

    expect(screen.getByTestId('left-reveal-path')).toHaveTextContent('rtl/core/reg_file.v');
    expect(Number(screen.getByTestId('left-reveal-token').textContent)).toBeGreaterThan(firstRevealToken);
  });

  it('keeps the left sidebar hidden when quick open selects a file', async () => {
    vi.mocked(window.electronAPI!.fs.listFiles).mockResolvedValue([
      'README.md',
      'rtl/core/alu.v',
    ]);

    render(<App />);

    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.getByTestId('activity-view')).toHaveTextContent('explorer');

    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    await screen.findByTestId('quick-open-overlay');

    await clickText('quick-open-select-alu');

    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.getByTestId('activity-view')).toHaveTextContent('explorer');
    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('rtl/core/alu.v');
    expect(screen.queryByTestId('left-panel')).not.toBeInTheDocument();
  });

  it('keeps explorer side widths independent when toggling either side panel', async () => {
    render(<App />);

    await clickText('toggle-left-panel');
    await clickText('toggle-right-panel');

    expect(screen.getByTestId('panel-left-panel')).toHaveStyle({ width: '240px' });
    expect(screen.getByTestId('panel-right-panel')).toHaveStyle({ width: `${EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX}px` });

    const leftHandle = screen.getByTestId('panel-handle-left-panel');
    fireEvent.pointerDown(leftHandle, { clientX: 240, pointerId: 1 });
    fireEvent.pointerMove(leftHandle, { clientX: 320, pointerId: 1 });
    fireEvent.pointerUp(leftHandle, { clientX: 320, pointerId: 1 });

    const rightHandle = screen.getByTestId('panel-handle-right-panel');
    fireEvent.pointerDown(rightHandle, { clientX: 900, pointerId: 2 });
    fireEvent.pointerMove(rightHandle, { clientX: 840, pointerId: 2 });
    fireEvent.pointerUp(rightHandle, { clientX: 840, pointerId: 2 });

    expect(screen.getByTestId('panel-left-panel')).toHaveStyle({ width: '320px' });
    expect(screen.getByTestId('panel-right-panel')).toHaveStyle({ width: '360px' });

    await clickText('toggle-left-panel');

    expect(screen.queryByTestId('panel-left-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('panel-right-panel')).toHaveStyle({ width: '360px' });

    await clickText('toggle-left-panel');

    await waitFor(() => {
      expect(screen.getByTestId('panel-left-panel')).toHaveStyle({ width: '320px' });
    });
    expect(screen.getByTestId('panel-right-panel')).toHaveStyle({ width: '360px' });

    await clickText('toggle-right-panel');

    expect(screen.getByTestId('panel-right-panel')).toHaveStyle({ width: '0px' });
    expect(screen.getByTestId('panel-right-panel')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('panel-left-panel')).toHaveStyle({ width: '320px' });

    await clickText('toggle-right-panel');

    await waitFor(() => {
      expect(screen.getByTestId('panel-right-panel')).toHaveStyle({ width: '360px' });
    });
    expect(screen.getByTestId('panel-left-panel')).toHaveStyle({ width: '320px' });
  });

  it('widens the whole explorer right sidebar when the assistant chat list expands', async () => {
    render(<App />);

    await clickText('toggle-right-panel');

    expect(screen.getByTestId('panel-right-panel')).toHaveStyle({ width: `${EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX}px` });

    await clickText('assistant-expand-thread-list');

    expect(screen.getByTestId('panel-right-panel')).toHaveStyle({ width: '448px' });

    await clickText('assistant-thread-list-width-340');

    expect(screen.getByTestId('panel-right-panel')).toHaveStyle({ width: '648px' });

    await clickText('assistant-collapse-thread-list');

    expect(screen.getByTestId('panel-right-panel')).toHaveStyle({ width: `${EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX}px` });
  });

  it('restores the previous editor file and cursor snapshot when quick open closes without a selection', async () => {
    vi.mocked(window.electronAPI!.fs.listFiles).mockResolvedValue([
      'README.md',
      'rtl/core/alu.v',
      'rtl/core/reg_file.v',
    ]);

    render(<App />);

    await clickText('toggle-left-panel');
    await clickText('left-open');
    await clickText('editor-cursor');

    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('rtl/core/reg_file.v');
    expect(screen.getByTestId('status-bar-cursor')).toHaveTextContent('9:3');

    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    await screen.findByTestId('quick-open-overlay');

    await clickText('quick-open-set-query');
    await clickText('quick-open-close');

    expect(screen.queryByTestId('quick-open-overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('rtl/core/reg_file.v');
    expect(screen.getByTestId('editor-restore-file')).toHaveTextContent('rtl/core/reg_file.v');
    expect(screen.getByTestId('editor-restore-line')).toHaveTextContent('9');
    expect(screen.getByTestId('editor-restore-col')).toHaveTextContent('3');
  });

  it('refreshes workspace git status when the window regains focus', async () => {
    render(<App />);

    expect(window.electronAPI?.onWindowFocus).toHaveBeenCalledTimes(1);
    expect(window.electronAPI?.git.getStatus).not.toHaveBeenCalled();

    const focusHandler = vi.mocked(window.electronAPI!.onWindowFocus).mock.calls[0]?.[0];
    if (!focusHandler) {
      throw new Error('Expected App to subscribe to the Electron window focus stream');
    }

    focusHandler();

    await waitFor(() => {
      expect(window.electronAPI?.git.getStatus).toHaveBeenCalledTimes(1);
    });

    focusHandler();

    await waitFor(() => {
      expect(window.electronAPI?.git.getStatus).toHaveBeenCalledTimes(2);
    });
  });
});
