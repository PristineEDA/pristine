import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('react-resizable-panels', () => ({
  PanelGroup: ({ children }: { children: React.ReactNode }) => <div data-testid="panel-group">{children}</div>,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PanelResizeHandle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
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

vi.mock('./components/EditorArea', () => ({
  EditorArea: ({ tabs, activeTabId, jumpToLine, onTabChange, onTabClose, onCursorChange }: any) => (
    <div>
      <span data-testid="editor-active-tab">{activeTabId}</span>
      <span data-testid="editor-tab-count">{tabs.length}</span>
      <span data-testid="editor-jump-line">{jumpToLine ?? 'none'}</span>
      <button onClick={() => onTabChange('rtl/core/alu.v')}>editor-activate-alu</button>
      <button onClick={() => onTabClose('rtl/core/reg_file.v')}>editor-close-open</button>
      <button onClick={() => onCursorChange?.(9, 3)}>editor-cursor</button>
    </div>
  ),
}));

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
  QuickOpenPalette: ({ isOpen, query, onQueryChange, onSelectResult, onClose }: any) => (
    isOpen ? (
      <div data-testid="quick-open-overlay">
        <span data-testid="quick-open-query">{query}</span>
        <button onClick={() => onQueryChange('alu')}>quick-open-set-query</button>
        <button onClick={() => onSelectResult({ path: 'rtl/core/alu.v', name: 'alu.v', score: 100 })}>quick-open-select-alu</button>
        <button onClick={onClose}>quick-open-close</button>
      </div>
    ) : null
  ),
}));

describe('App', () => {
  it('wires shared workspace state across panels', () => {
    render(<App />);

    expect(screen.getByTestId('menu-bar')).toBeInTheDocument();
    expect(screen.getByTestId('menu-left-state')).toHaveTextContent('true');
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('false');
    expect(screen.getByTestId('menu-right-state')).toHaveTextContent('false');
    expect(screen.getByTestId('activity-view')).toHaveTextContent('explorer');
    expect(screen.getByTestId('left-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('bottom-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('left-active-file')).toHaveTextContent('');
    expect(screen.getByTestId('editor-tab-count')).toHaveTextContent('0');
    expect(screen.getByTestId('status-bar')).toHaveTextContent(':1:1');

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
    expect(screen.getByTestId('right-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByText('right-open'));
    expect(screen.getByTestId('editor-tab-count')).toHaveTextContent('2');

    fireEvent.click(screen.getByText('editor-activate-alu'));
    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('rtl/core/alu.v');

    fireEvent.click(screen.getByText('toggle-bottom-panel'));
    expect(screen.getByTestId('menu-bottom-state')).toHaveTextContent('true');
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

    fireEvent.click(screen.getByText('quick-open-set-query'));
    expect(screen.getByTestId('quick-open-query')).toHaveTextContent('alu');

    fireEvent.click(screen.getByText('quick-open-select-alu'));

    expect(screen.queryByTestId('quick-open-overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('rtl/core/alu.v');
    expect(screen.getByTestId('left-reveal-path')).toHaveTextContent('rtl/core/alu.v');

    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    expect(await screen.findByTestId('quick-open-query')).toHaveTextContent('');

    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    expect(screen.queryByTestId('quick-open-overlay')).not.toBeInTheDocument();
  });
});