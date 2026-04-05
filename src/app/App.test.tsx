
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

const panelResizeMock = vi.fn();

vi.mock('./components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div data-testid="panel-group">{children}</div>,
  ResizablePanel: ({ children, id, minSize, defaultSize, panelRef, collapsed }: any) => {
    if (collapsed) {
      return null;
    }

    if (panelRef && typeof panelRef === 'object') {
      panelRef.current = { resize: panelResizeMock };
    }

    return <div data-testid={`panel-${id}`} data-min-size={minSize} data-default-size={defaultSize}>{children}</div>;
  },
  ResizableHandle: ({ hidden }: { hidden?: boolean }) => (hidden ? null : <div data-testid="panel-handle" />),
}));

vi.mock('./components/MenuBar', () => ({
  MenuBar: ({
    showLeftPanel,
    showBottomPanel,
    showRightPanel,
    onToggleLeftPanel,
    onToggleBottomPanel,
    onToggleRightPanel,
  }: any) => (
    <div data-testid="menu-bar">
      <span data-testid="menu-left-state">{String(showLeftPanel)}</span>
      <span data-testid="menu-bottom-state">{String(showBottomPanel)}</span>
      <span data-testid="menu-right-state">{String(showRightPanel)}</span>
      <button onClick={onToggleLeftPanel}>toggle-left-panel</button>
      <button onClick={onToggleBottomPanel}>toggle-bottom-panel</button>
      <button onClick={onToggleRightPanel}>toggle-right-panel</button>
    </div>
  ),
}));

vi.mock('./components/ActivityBar', () => ({
  ActivityBar: ({ activeView, onItemSelect }: { activeView: string; onItemSelect: (view: string) => void }) => (
    <div>
      <span data-testid="activity-view">{activeView}</span>
      <button onClick={() => onItemSelect('git')}>select-git</button>
      <button onClick={() => onItemSelect('explorer')}>select-explorer</button>
    </div>
  ),
}));

vi.mock('./components/LeftSidePanel', () => ({
  LeftSidePanel: ({ activeFileId, currentOutlineId, onFileOpen, onLineJump, revealRequest }: any) => (
    <div data-testid="left-panel">
      <span data-testid="left-active-file">{activeFileId}</span>
      <span data-testid="left-outline-file">{currentOutlineId}</span>
      <span data-testid="left-reveal-path">{revealRequest?.path ?? ''}</span>
      <button onClick={() => { onFileOpen('rtl/core/reg_file.v', 'reg_file.v'); onLineJump(77); }}>left-open</button>
    </div>
  ),
}));

vi.mock('./components/EditorSplitLayout', async () => {
  const actual = await vi.importActual<typeof import('./context/WorkspaceContext')>('./context/WorkspaceContext');

  return {
    EditorSplitLayout: ({ jumpToLine }: any) => {
      const workspace = actual.useWorkspace();

      return (
        <div>
          <span data-testid="editor-active-tab">{workspace.activeTabId}</span>
          <span data-testid="editor-tab-count">{workspace.tabs.length}</span>
          <span data-testid="editor-jump-line">{jumpToLine ?? 'none'}</span>
          <button onClick={() => workspace.setActiveTabId('rtl/core/alu.v')}>editor-activate-alu</button>
          <button onClick={() => workspace.closeFile('rtl/core/reg_file.v')}>editor-close-open</button>
          <button onClick={() => workspace.setCursorPos(9, 3)}>editor-cursor</button>
        </div>
      );
    },
  };
});

vi.mock('./components/RightSidePanel', () => ({
  RightSidePanel: ({ onFileOpen, onLineJump }: any) => (
    <div data-testid="right-panel">
      <button onClick={() => { onFileOpen('rtl/core/alu.v', 'alu.v'); onLineJump(33); }}>right-open</button>
    </div>
  ),
}));

vi.mock('./components/BottomPanel', () => ({
  BottomPanel: ({ onClose }: { onClose?: () => void }) => (
    <div>
      <span data-testid="bottom-panel">bottom</span>
      <button onClick={onClose}>close-bottom</button>
    </div>
  ),
}));

vi.mock('./components/StatusBar', () => ({
  StatusBar: ({ activeFileId, cursorLine, cursorCol }: any) => (
    <div data-testid="status-bar">{`${activeFileId}:${cursorLine}:${cursorCol}`}</div>
  ),
}));

vi.mock('./components/QuickOpenPalette', () => ({
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

describe('App', () => {
  it('opens the left panel on demand and resizes it from the container width', async () => {
    class ResizeObserverMock {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe = (target: Element) => {
        Object.defineProperty(target, 'clientWidth', {
          configurable: true,
          value: 1280,
        });

        this.callback([{ target, contentRect: { width: 1280 } as DOMRectReadOnly }] as ResizeObserverEntry[], this as unknown as ResizeObserver);
      };

      disconnect = vi.fn();
      unobserve = vi.fn();
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);

    render(<App />);

  expect(screen.queryByTestId('panel-left-panel')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('toggle-left-panel'));

    expect(screen.getByTestId('panel-left-panel')).toHaveAttribute('data-min-size', '12');
    expect(screen.getByTestId('panel-left-panel')).toHaveAttribute('data-default-size', '18');

    await waitFor(() => {
      expect(panelResizeMock).toHaveBeenCalledWith('18.13%');
    });
  });

  it('wires shared workspace state across panels', () => {
    render(<App />);

    expect(screen.getByTestId('menu-bar')).toBeInTheDocument();
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('false');
    expect(screen.getByTestId('activity-view')).toHaveTextContent('explorer');
    expect(screen.queryByTestId('panel-left-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('left-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bottom-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('editor-tab-count')).toHaveTextContent('0');
    expect(screen.getByTestId('status-bar')).toHaveTextContent(':1:1');

    fireEvent.click(screen.getByText('toggle-left-panel'));
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('true');
    expect(screen.getByTestId('panel-left-panel')).toHaveAttribute('data-default-size', '18');
    expect(screen.getByTestId('left-panel')).toBeInTheDocument();
    expect(screen.getByTestId('left-active-file')).toHaveTextContent('');

    fireEvent.click(screen.getByText('select-git'));
    expect(screen.getByTestId('activity-view')).toHaveTextContent('git');

    fireEvent.click(screen.getByText('left-open'));
    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('rtl/core/reg_file.v');
    expect(screen.getByTestId('editor-tab-count')).toHaveTextContent('1');
    expect(screen.getByTestId('editor-jump-line')).toHaveTextContent('77');

    fireEvent.click(screen.getByText('editor-cursor'));
    expect(screen.getByTestId('status-bar')).toHaveTextContent('rtl/core/reg_file.v:9:3');

    fireEvent.click(screen.getByText('toggle-right-panel'));
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('true');
    expect(screen.getByTestId('panel-right-panel')).toHaveAttribute('data-default-size', '22');
    expect(screen.getByTestId('right-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByText('right-open'));
    expect(screen.getByTestId('editor-tab-count')).toHaveTextContent('2');

    fireEvent.click(screen.getByText('editor-activate-alu'));
    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('rtl/core/alu.v');

    fireEvent.click(screen.getByText('toggle-bottom-panel'));
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('true');
    expect(screen.getByTestId('panel-bottom-panel')).toHaveAttribute('data-default-size', '40');
    expect(screen.getByTestId('bottom-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByText('close-bottom'));
    expect(screen.queryByTestId('bottom-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('select-git'));
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.queryByTestId('left-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('select-explorer'));
    expect(screen.getByTestId('activity-view')).toHaveTextContent('explorer');
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('true');
    expect(screen.getByTestId('left-panel')).toBeInTheDocument();
  });

  it('toggles the left and bottom panels with Ctrl+B and Ctrl+J', () => {
    render(<App />);

    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('false');

    fireEvent.keyDown(document, { key: 'b', ctrlKey: true });
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('true');
    expect(screen.getByTestId('left-panel')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'j', ctrlKey: true });
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('true');
    expect(screen.getByTestId('bottom-panel')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'b', ctrlKey: true });
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.queryByTestId('left-panel')).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'j', ctrlKey: true });
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('false');
    expect(screen.queryByTestId('bottom-panel')).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByText('quick-open-set-query'));
    expect(screen.getByTestId('quick-open-query')).toHaveTextContent('alu');

    fireEvent.click(screen.getByText('quick-open-select-alu'));

    expect(screen.queryByTestId('quick-open-overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('rtl/core/alu.v');

    fireEvent.click(screen.getByText('toggle-left-panel'));
    expect(screen.getByTestId('left-reveal-path')).toHaveTextContent('rtl/core/alu.v');

    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    expect(await screen.findByTestId('quick-open-query')).toHaveTextContent('');
    expect(screen.getByTestId('quick-open-mode')).toHaveTextContent('recent');
    expect(screen.getByTestId('quick-open-result-paths')).toHaveTextContent('rtl/core/alu.v');

    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    expect(screen.queryByTestId('quick-open-overlay')).not.toBeInTheDocument();
  });

  it('keeps the left sidebar hidden when quick open selects a file', async () => {
    vi.mocked(window.electronAPI!.fs.listFiles).mockResolvedValue([
      'README.md',
      'rtl/core/alu.v',
    ]);

    render(<App />);

    fireEvent.click(screen.getByText('select-git'));
    fireEvent.click(screen.getByText('select-git'));
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.getByTestId('activity-view')).toHaveTextContent('git');

    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    await screen.findByTestId('quick-open-overlay');

    fireEvent.click(screen.getByText('quick-open-select-alu'));

    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('false');
    expect(screen.getByTestId('activity-view')).toHaveTextContent('git');
    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('rtl/core/alu.v');
    expect(screen.queryByTestId('left-panel')).not.toBeInTheDocument();
  });
});