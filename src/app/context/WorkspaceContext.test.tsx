import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext';

function WorkspaceHarness() {
  const workspace = useWorkspace();

  return (
    <div>
      <div data-testid="active-view">{workspace.activeView}</div>
      <div data-testid="tabs">{workspace.tabs.map((tab) => tab.id).join(',')}</div>
      <div data-testid="active-tab">{workspace.activeTabId}</div>
      <div data-testid="jump-line">{workspace.jumpToLine ?? 'none'}</div>
      <div data-testid="cursor">{`${workspace.cursorLine}:${workspace.cursorCol}`}</div>
      <div data-testid="bottom-panel">{workspace.showBottomPanel ? 'open' : 'closed'}</div>

      <button onClick={() => workspace.setActiveView('problems')}>set-view</button>
      <button onClick={() => workspace.openFile('reg_file', 'reg_file.v')}>open-reg</button>
      <button onClick={() => workspace.openFile('uart_tx', 'uart_tx.v')}>open-existing</button>
      <button onClick={() => workspace.setActiveTabId('alu')}>activate-alu</button>
      <button onClick={() => workspace.closeFile('alu')}>close-alu</button>
      <button onClick={() => workspace.jumpTo(42)}>jump</button>
      <button onClick={() => workspace.setCursorPos(8, 16)}>cursor</button>
      <button onClick={() => workspace.setShowBottomPanel(false)}>hide-bottom</button>
    </div>
  );
}

describe('WorkspaceContext', () => {
  it('opens a new file and activates it', () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));

    expect(screen.getByTestId('tabs')).toHaveTextContent('uart_tx,alu,cpu_top,reg_file');
    expect(screen.getByTestId('active-tab')).toHaveTextContent('reg_file');
  });

  it('does not duplicate an existing tab', () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-existing'));

    expect(screen.getByTestId('tabs')).toHaveTextContent('uart_tx,alu,cpu_top');
    expect(screen.getByTestId('active-tab')).toHaveTextContent('uart_tx');
  });

  it('closes the active tab and selects the nearest neighbor', () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('activate-alu'));
    fireEvent.click(screen.getByText('close-alu'));

    expect(screen.getByTestId('tabs')).toHaveTextContent('uart_tx,cpu_top');
    expect(screen.getByTestId('active-tab')).toHaveTextContent('cpu_top');
  });

  it('updates cursor position, active view, and bottom panel state', () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('set-view'));
    fireEvent.click(screen.getByText('cursor'));
    fireEvent.click(screen.getByText('hide-bottom'));

    expect(screen.getByTestId('active-view')).toHaveTextContent('problems');
    expect(screen.getByTestId('cursor')).toHaveTextContent('8:16');
    expect(screen.getByTestId('bottom-panel')).toHaveTextContent('closed');
  });

  it('resets jumpToLine after the debounce window', () => {
    vi.useFakeTimers();

    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('jump'));
    expect(screen.getByTestId('jump-line')).toHaveTextContent('42');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByTestId('jump-line')).toHaveTextContent('none');
    vi.useRealTimers();
  });
});