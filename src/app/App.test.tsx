import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('react-resizable-panels', () => ({
  PanelGroup: ({ children }: { children: React.ReactNode }) => <div data-testid="panel-group">{children}</div>,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PanelResizeHandle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./components/MenuBar', () => ({
  MenuBar: () => <div data-testid="menu-bar">menu</div>,
}));

vi.mock('./components/ActivityBar', () => ({
  ActivityBar: ({ activeView, onViewChange }: { activeView: string; onViewChange: (view: string) => void }) => (
    <div>
      <span data-testid="activity-view">{activeView}</span>
      <button onClick={() => onViewChange('search')}>switch-activity</button>
    </div>
  ),
}));

vi.mock('./components/LeftSidePanel', () => ({
  LeftSidePanel: ({ activeFileId, currentOutlineId, onFileOpen, onLineJump }: any) => (
    <div>
      <span data-testid="left-active-file">{activeFileId}</span>
      <span data-testid="left-outline-file">{currentOutlineId}</span>
      <button onClick={() => { onFileOpen('reg_file', 'reg_file.v'); onLineJump(77); }}>left-open</button>
    </div>
  ),
}));

vi.mock('./components/EditorArea', () => ({
  EditorArea: ({ tabs, activeTabId, jumpToLine, onTabChange, onTabClose, onCursorChange }: any) => (
    <div>
      <span data-testid="editor-active-tab">{activeTabId}</span>
      <span data-testid="editor-tab-count">{tabs.length}</span>
      <span data-testid="editor-jump-line">{jumpToLine ?? 'none'}</span>
      <button onClick={() => onTabChange('alu')}>editor-activate-alu</button>
      <button onClick={() => onTabClose('uart_tx')}>editor-close-uart</button>
      <button onClick={() => onCursorChange?.(9, 3)}>editor-cursor</button>
    </div>
  ),
}));

vi.mock('./components/RightSidePanel', () => ({
  RightSidePanel: ({ onFileOpen, onLineJump }: any) => (
    <div>
      <button onClick={() => { onFileOpen('tb_cpu', 'tb_cpu_top.sv'); onLineJump(33); }}>right-open</button>
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

describe('App', () => {
  it('wires shared workspace state across panels', () => {
    render(<App />);

    expect(screen.getByTestId('menu-bar')).toBeInTheDocument();
    expect(screen.getByTestId('activity-view')).toHaveTextContent('explorer');
    expect(screen.getByTestId('left-active-file')).toHaveTextContent('uart_tx');
    expect(screen.getByTestId('editor-tab-count')).toHaveTextContent('3');
    expect(screen.getByTestId('status-bar')).toHaveTextContent('uart_tx:1:1');

    fireEvent.click(screen.getByText('switch-activity'));
    expect(screen.getByTestId('activity-view')).toHaveTextContent('search');

    fireEvent.click(screen.getByText('left-open'));
    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('reg_file');
    expect(screen.getByTestId('editor-tab-count')).toHaveTextContent('4');
    expect(screen.getByTestId('editor-jump-line')).toHaveTextContent('77');

    fireEvent.click(screen.getByText('editor-cursor'));
    expect(screen.getByTestId('status-bar')).toHaveTextContent('reg_file:9:3');

    fireEvent.click(screen.getByText('editor-activate-alu'));
    expect(screen.getByTestId('editor-active-tab')).toHaveTextContent('alu');

    fireEvent.click(screen.getByText('close-bottom'));
    expect(screen.queryByTestId('bottom-panel')).not.toBeInTheDocument();
  });
});