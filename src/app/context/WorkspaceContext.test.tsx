import { useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext';

const undoActionRun = vi.fn(() => Promise.resolve());
const redoActionRun = vi.fn(() => Promise.resolve());

type WorkspaceActionSnapshot = Pick<ReturnType<typeof useWorkspace>,
  'closeFile'
  | 'openUnsavedChangesDialog'
  | 'saveActiveFile'
  | 'saveAllFiles'
  | 'setShowBottomPanel'
>;

function WorkspaceHarness() {
  const workspace = useWorkspace();

  return (
    <div>
      <div data-testid="active-view">{workspace.activeView}</div>
      <div data-testid="tabs">{workspace.tabs.map((tab) => tab.id).join(',')}</div>
      <div data-testid="active-tab">{workspace.activeTabId}</div>
      <div data-testid="groups">{workspace.editorGroups.map((group) => `${group.id}:${group.tabs.map((tab) => tab.id).join('|')}`).join(';')}</div>
      <div data-testid="focused-group">{workspace.focusedGroupId ?? 'none'}</div>
      <div data-testid="preview-tab">{workspace.editorGroups.find((group) => group.id === (workspace.focusedGroupId ?? ''))?.previewTabId ?? 'none'}</div>
      <div data-testid="jump-line">{workspace.jumpToLine ?? 'none'}</div>
      <div data-testid="cursor">{`${workspace.cursorLine}:${workspace.cursorCol}`}</div>
      <div data-testid="bottom-panel">{workspace.showBottomPanel ? 'open' : 'closed'}</div>
      <div data-testid="dirty-files">{workspace.dirtyFileIds.join(',')}</div>
      <div data-testid="unsaved-dialog-files">{workspace.unsavedChangesDialog?.fileIds.join(',') ?? ''}</div>

      <button onClick={() => workspace.setActiveView('simulation')}>set-view</button>
      <button onClick={() => workspace.openFile('rtl/core/reg_file.v', 'reg_file.v')}>open-reg</button>
      <button onClick={() => workspace.openFile('rtl/core/alu.v', 'alu.v')}>open-alu</button>
      <button onClick={() => workspace.openPreviewFile('rtl/core/reg_file.v', 'reg_file.v')}>preview-reg</button>
      <button onClick={() => workspace.openPreviewFile('rtl/core/alu.v', 'alu.v')}>preview-alu</button>
      <button onClick={() => workspace.pinTab('rtl/core/alu.v')}>pin-alu</button>
      <button onClick={() => workspace.openFile('rtl/core/reg_file.v', 'reg_file.v')}>open-existing</button>
      <button onClick={() => workspace.splitGroup('group-1')}>split-group-1</button>
      <button onClick={() => workspace.focusGroup('group-1')}>focus-group-1</button>
      <button onClick={() => workspace.focusGroup('group-2')}>focus-group-2</button>
      <button onClick={() => workspace.setActiveTabId('rtl/core/alu.v')}>activate-alu</button>
      <button onClick={() => workspace.closeFile('rtl/core/alu.v')}>close-alu</button>
      <button onClick={() => workspace.jumpTo(42)}>jump</button>
      <button onClick={() => workspace.setCursorPos(8, 16)}>cursor</button>
      <button onClick={() => workspace.setShowBottomPanel(false)}>hide-bottom</button>
      <button onClick={() => workspace.updateFileContentInGroup('group-1', 'rtl/core/reg_file.v', 'module reg_file; logic dirty; endmodule')}>edit-reg</button>
      <button onClick={() => workspace.updateFileContentInGroup('group-1', 'rtl/core/alu.v', 'module alu; logic dirty; endmodule')}>edit-alu</button>
      <button onClick={() => { void workspace.saveActiveFile(); }}>save-active</button>
      <button onClick={() => { void workspace.saveAllFiles(); }}>save-all</button>
      <button onClick={() => workspace.openUnsavedChangesDialog()}>open-unsaved-dialog</button>
      <button onClick={() => { void workspace.confirmUnsavedChangesSave(); }}>confirm-save</button>
      <button onClick={() => workspace.discardUnsavedChanges()}>discard-unsaved</button>
      <button onClick={() => workspace.cancelUnsavedChanges()}>cancel-unsaved</button>
      <button onClick={() => workspace.closeFile('rtl/core/reg_file.v')}>close-reg</button>
      <button onClick={() => workspace.registerEditorRef('group-1', {
        getAction: (actionId: string) => ({ run: actionId === 'undo' ? undoActionRun : redoActionRun }),
      })}>register-editor</button>
      <button onClick={() => { void workspace.undoActiveEditor(); }}>undo-editor</button>
      <button onClick={() => { void workspace.redoActiveEditor(); }}>redo-editor</button>
    </div>
  );
}

function StableActionHarness({ onSnapshot }: { onSnapshot: (snapshot: WorkspaceActionSnapshot) => void }) {
  const workspace = useWorkspace();

  useEffect(() => {
    onSnapshot({
      closeFile: workspace.closeFile,
      openUnsavedChangesDialog: workspace.openUnsavedChangesDialog,
      saveActiveFile: workspace.saveActiveFile,
      saveAllFiles: workspace.saveAllFiles,
      setShowBottomPanel: workspace.setShowBottomPanel,
    });
  }, [
    onSnapshot,
    workspace.closeFile,
    workspace.openUnsavedChangesDialog,
    workspace.saveActiveFile,
    workspace.saveAllFiles,
    workspace.setShowBottomPanel,
  ]);

  return <WorkspaceHarness />;
}

describe('WorkspaceContext', () => {
  it('tracks dirty files, saves the active file, and clears dirty state after saving', async () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('edit-reg'));

    expect(screen.getByTestId('dirty-files')).toHaveTextContent('rtl/core/reg_file.v');

    fireEvent.click(screen.getByText('save-active'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(window.electronAPI?.fs.writeFile).toHaveBeenCalledWith('rtl/core/reg_file.v', 'module reg_file; logic dirty; endmodule');
    expect(screen.getByTestId('dirty-files')).toHaveTextContent('');
  });

  it('routes undo and redo through the active editor instance', async () => {
    undoActionRun.mockClear();
    redoActionRun.mockClear();

    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('register-editor'));
    fireEvent.click(screen.getByText('undo-editor'));
    fireEvent.click(screen.getByText('redo-editor'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(undoActionRun).toHaveBeenCalledTimes(1);
    expect(redoActionRun).toHaveBeenCalledTimes(1);
  });

  it('saves all dirty files through the shared workspace command', async () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('edit-reg'));
    fireEvent.click(screen.getByText('open-alu'));
    fireEvent.click(screen.getByText('edit-alu'));

    expect(screen.getByTestId('dirty-files')).toHaveTextContent('rtl/core/reg_file.v,rtl/core/alu.v');

    fireEvent.click(screen.getByText('save-all'));

    await waitFor(() => {
      expect(window.electronAPI?.fs.writeFile).toHaveBeenCalledWith('rtl/core/reg_file.v', 'module reg_file; logic dirty; endmodule');
      expect(window.electronAPI?.fs.writeFile).toHaveBeenCalledWith('rtl/core/alu.v', 'module alu; logic dirty; endmodule');
    });

    await waitFor(() => {
      expect(screen.getByTestId('dirty-files')).toBeEmptyDOMElement();
    });
  });

  it('opens the unsaved files manager for the current dirty files', async () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('edit-reg'));
    fireEvent.click(screen.getByText('open-unsaved-dialog'));

    await waitFor(() => {
      expect(screen.getByTestId('unsaved-dialog-files')).toHaveTextContent('rtl/core/reg_file.v');
    });
  });

  it('prompts before closing a dirty file and can discard the changes', async () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('edit-reg'));
    fireEvent.click(screen.getByText('close-reg'));

    await waitFor(() => {
      expect(screen.getByTestId('unsaved-dialog-files')).toHaveTextContent('rtl/core/reg_file.v');
    });

    fireEvent.click(screen.getByText('discard-unsaved'));

    await waitFor(() => {
      expect(screen.getByTestId('unsaved-dialog-files')).toHaveTextContent('');
    });
    expect(screen.getByTestId('tabs')).not.toHaveTextContent('rtl/core/reg_file.v');
  });

  it('prompts for unsaved changes when the main process requests a window close and resolves the request on save', async () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('edit-reg'));

    await waitFor(() => {
      expect(vi.mocked(window.electronAPI!.onCloseRequested).mock.calls.length).toBeGreaterThan(0);
    });

    const closeRequestCalls = vi.mocked(window.electronAPI!.onCloseRequested).mock.calls;
    const closeRequestHandler = closeRequestCalls[closeRequestCalls.length - 1]?.[0];

    await act(async () => {
      closeRequestHandler?.({ requestId: 7, action: 'quit' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('unsaved-dialog-files')).toHaveTextContent('rtl/core/reg_file.v');
    });

    fireEvent.click(screen.getByText('confirm-save'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(window.electronAPI?.fs.writeFile).toHaveBeenCalledWith('rtl/core/reg_file.v', 'module reg_file; logic dirty; endmodule');
    expect(window.electronAPI?.resolveCloseRequest).toHaveBeenCalledWith(7, 'proceed');
  });

  it('keeps the window-close listener registered once across workspace file updates', async () => {
    vi.mocked(window.electronAPI!.onCloseRequested).mockClear();

    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    expect(window.electronAPI?.onCloseRequested).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('edit-reg'));
    fireEvent.click(screen.getByText('open-alu'));
    fireEvent.click(screen.getByText('edit-alu'));

    await waitFor(() => {
      expect(screen.getByTestId('dirty-files')).toHaveTextContent('rtl/core/reg_file.v,rtl/core/alu.v');
    });

    expect(window.electronAPI?.onCloseRequested).toHaveBeenCalledTimes(1);
  });

  it('keeps workspace action references stable across unrelated workspace updates', async () => {
    const snapshots: WorkspaceActionSnapshot[] = [];

    render(
      <WorkspaceProvider>
        <StableActionHarness onSnapshot={(snapshot) => { snapshots.push(snapshot); }} />
      </WorkspaceProvider>,
    );

    await waitFor(() => {
      expect(snapshots.length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('edit-reg'));
    fireEvent.click(screen.getByText('set-view'));

    await waitFor(() => {
      expect(screen.getByTestId('active-view')).toHaveTextContent('simulation');
      expect(screen.getByTestId('dirty-files')).toHaveTextContent('rtl/core/reg_file.v');
      expect(snapshots).toHaveLength(1);
    });
  });

  it('opens a new file and activates it', () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));

    expect(screen.getByTestId('tabs')).toHaveTextContent('rtl/core/reg_file.v');
    expect(screen.getByTestId('active-tab')).toHaveTextContent('rtl/core/reg_file.v');
  });

  it('does not duplicate an existing tab', () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('open-existing'));

    expect(screen.getByTestId('tabs')).toHaveTextContent('rtl/core/reg_file.v');
    expect(screen.getByTestId('active-tab')).toHaveTextContent('rtl/core/reg_file.v');
  });

  it('replaces the current preview tab and clears preview state when pinned later', () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('preview-reg'));
    expect(screen.getByTestId('tabs')).toHaveTextContent('rtl/core/reg_file.v');
    expect(screen.getByTestId('preview-tab')).toHaveTextContent('rtl/core/reg_file.v');

    fireEvent.click(screen.getByText('preview-alu'));
    expect(screen.getByTestId('tabs')).toHaveTextContent('rtl/core/alu.v');
    expect(screen.getByTestId('preview-tab')).toHaveTextContent('rtl/core/alu.v');

    fireEvent.click(screen.getByText('open-existing'));
    expect(screen.getByTestId('tabs')).toHaveTextContent('rtl/core/alu.v,rtl/core/reg_file.v');
    expect(screen.getByTestId('preview-tab')).toHaveTextContent('rtl/core/alu.v');

    fireEvent.click(screen.getByText('open-alu'));
    expect(screen.getByTestId('preview-tab')).toHaveTextContent('none');
  });

  it('pins a preview tab without changing the tab order', () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('preview-alu'));
    expect(screen.getByTestId('preview-tab')).toHaveTextContent('rtl/core/alu.v');

    fireEvent.click(screen.getByText('pin-alu'));

    expect(screen.getByTestId('tabs')).toHaveTextContent('rtl/core/alu.v');
    expect(screen.getByTestId('active-tab')).toHaveTextContent('rtl/core/alu.v');
    expect(screen.getByTestId('preview-tab')).toHaveTextContent('none');
  });

  it('opens files into the last focused split group', () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('split-group-1'));
    fireEvent.click(screen.getByText('open-alu'));

    expect(screen.getByTestId('focused-group')).toHaveTextContent('group-2');
    expect(screen.getByTestId('groups')).toHaveTextContent('group-1:rtl/core/reg_file.v');
    expect(screen.getByTestId('groups')).toHaveTextContent('group-2:rtl/core/reg_file.v|rtl/core/alu.v');
  });

  it('closes the active tab and selects the nearest neighbor', () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('open-alu'));
    fireEvent.click(screen.getByText('activate-alu'));
    fireEvent.click(screen.getByText('close-alu'));

    expect(screen.getByTestId('tabs')).toHaveTextContent('rtl/core/reg_file.v');
    expect(screen.getByTestId('active-tab')).toHaveTextContent('rtl/core/reg_file.v');
  });

  it('updates cursor position, active view, and bottom panel state', () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('set-view'));
    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('cursor'));
    fireEvent.click(screen.getByText('hide-bottom'));

    expect(screen.getByTestId('active-view')).toHaveTextContent('simulation');
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