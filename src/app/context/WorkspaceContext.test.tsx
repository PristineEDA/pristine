import { useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
      <div data-testid="delete-dialog-target">{workspace.deleteConfirmationDialog?.targetPath ?? ''}</div>
      <div data-testid="delete-dialog-type">{workspace.deleteConfirmationDialog?.entryType ?? ''}</div>
      <div data-testid="clipboard-mode">{workspace.workspaceClipboard?.mode ?? ''}</div>
      <div data-testid="clipboard-path">{workspace.workspaceClipboard?.sourcePath ?? ''}</div>
      <div data-testid="workspace-tree-refresh-token">{workspace.workspaceTreeRefreshToken}</div>

      <button onClick={() => workspace.setActiveView('simulation')}>set-view</button>
      <button onClick={() => workspace.openFile('rtl/core/reg_file.v', 'reg_file.v')}>open-reg</button>
      <button onClick={() => workspace.openFile('rtl/core/alu.v', 'alu.v')}>open-alu</button>
      <button onClick={() => workspace.openUntitledFile()}>open-untitled</button>
      <button onClick={() => workspace.openPreviewFile('rtl/core/reg_file.v', 'reg_file.v')}>preview-reg</button>
      <button onClick={() => workspace.openPreviewFile('rtl/core/alu.v', 'alu.v')}>preview-alu</button>
      <button onClick={() => { void workspace.createWorkspaceFile('rtl/generated/new_file.sv'); }}>create-file</button>
      <button onClick={() => { void workspace.createWorkspaceFolder('rtl/generated'); }}>create-folder</button>
      <button onClick={() => { void workspace.copyWorkspaceEntry('rtl/core/reg_file.v', 'file'); }}>copy-reg</button>
      <button onClick={() => { void workspace.copyWorkspaceEntry('rtl/core', 'folder'); }}>copy-core-folder</button>
      <button onClick={() => { void workspace.cutWorkspaceEntry('rtl/core/reg_file.v', 'file'); }}>cut-reg</button>
      <button onClick={() => workspace.clearWorkspaceClipboard()}>clear-clipboard</button>
      <button onClick={() => { void workspace.deleteWorkspaceEntry('rtl/core/reg_file.v', 'file'); }}>delete-reg</button>
      <button onClick={() => { void workspace.deleteWorkspaceEntry('rtl/core', 'folder'); }}>delete-core-folder</button>
      <button onClick={() => { void workspace.pasteWorkspaceEntry('rtl/core'); }}>paste-core</button>
      <button onClick={() => { void workspace.pasteWorkspaceEntry('rtl'); }}>paste-rtl</button>
      <button onClick={() => { void workspace.renameWorkspaceEntry('rtl/core/reg_file.v', 'rtl/core/reg_file_renamed.v', 'file'); }}>rename-reg</button>
      <button onClick={() => { void workspace.renameWorkspaceEntry('rtl/core', 'rtl/renamed_core', 'folder'); }}>rename-core-folder</button>
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
      <button onClick={() => workspace.updateFileContent(workspace.activeTabId, 'module untitled; endmodule')}>edit-active</button>
      <button onClick={() => workspace.updateFileContent(workspace.activeTabId, '')}>clear-active</button>
      <button onClick={() => { void workspace.saveActiveFile(); }}>save-active</button>
      <button onClick={() => { void workspace.saveAllFiles(); }}>save-all</button>
      <button onClick={() => workspace.openUnsavedChangesDialog()}>open-unsaved-dialog</button>
      <button onClick={() => { void workspace.confirmUnsavedChangesSave(); }}>confirm-save</button>
      <button onClick={() => workspace.discardUnsavedChanges()}>discard-unsaved</button>
      <button onClick={() => workspace.cancelUnsavedChanges()}>cancel-unsaved</button>
      <button onClick={() => { void workspace.confirmDeleteConfirmation(); }}>confirm-delete</button>
      <button onClick={() => workspace.cancelDeleteConfirmation()}>cancel-delete</button>
      <button onClick={() => workspace.closeFile('rtl/core/reg_file.v')}>close-reg</button>
      <button onClick={() => workspace.closeActiveTabInFocusedGroup()}>close-active</button>
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
  beforeEach(() => {
    vi.clearAllMocks();
    undoActionRun.mockClear();
    redoActionRun.mockClear();
    vi.mocked(window.electronAPI!.fs.copyFile).mockResolvedValue(undefined);
    vi.mocked(window.electronAPI!.fs.copyDirectory).mockResolvedValue(undefined);
    vi.mocked(window.electronAPI!.fs.deleteFile).mockResolvedValue(undefined);
    vi.mocked(window.electronAPI!.fs.deleteDirectory).mockResolvedValue(undefined);
  });

  it('arms copy clipboard state, creates a -copy file on paste, and keeps the clipboard armed afterwards', async () => {
    vi.mocked(window.electronAPI!.fs.exists).mockImplementation(async (filePath: string) => (
      filePath === 'rtl/core/reg_file.v' || filePath === 'rtl/core'
    ));

    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('copy-reg'));

    await waitFor(() => {
      expect(screen.getByTestId('clipboard-mode')).toHaveTextContent('copy');
      expect(screen.getByTestId('clipboard-path')).toHaveTextContent('rtl/core/reg_file.v');
    });

    fireEvent.click(screen.getByText('paste-core'));

    await waitFor(() => {
      expect(window.electronAPI?.fs.copyFile).toHaveBeenCalledWith('rtl/core/reg_file.v', 'rtl/core/reg_file-copy.v');
      expect(screen.getByTestId('workspace-tree-refresh-token')).toHaveTextContent('1');
      expect(screen.getByTestId('clipboard-mode')).toHaveTextContent('copy');
    });
  });

  it('copies folders through the directory copy API', async () => {
    vi.mocked(window.electronAPI!.fs.exists).mockImplementation(async (filePath: string) => (
      filePath === 'rtl/core' || filePath === 'rtl'
    ));

    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('copy-core-folder'));

    await waitFor(() => {
      expect(screen.getByTestId('clipboard-mode')).toHaveTextContent('copy');
      expect(screen.getByTestId('clipboard-path')).toHaveTextContent('rtl/core');
    });

    fireEvent.click(screen.getByText('paste-rtl'));

    await waitFor(() => {
      expect(window.electronAPI?.fs.copyDirectory).toHaveBeenCalledWith('rtl/core', 'rtl/core-copy');
    });
  });

  it('cuts a workspace file, pastes it into a new folder, clears the clipboard, and updates open tabs', async () => {
    vi.mocked(window.electronAPI!.fs.exists).mockImplementation(async (filePath: string) => (
      filePath === 'rtl/core/reg_file.v' || filePath === 'rtl'
    ));

    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('cut-reg'));

    await waitFor(() => {
      expect(screen.getByTestId('clipboard-mode')).toHaveTextContent('cut');
    });

    fireEvent.click(screen.getByText('paste-rtl'));

    await waitFor(() => {
      expect(window.electronAPI?.fs.rename).toHaveBeenCalledWith('rtl/core/reg_file.v', 'rtl/reg_file.v');
      expect(screen.getByTestId('active-tab')).toHaveTextContent('rtl/reg_file.v');
      expect(screen.getByTestId('tabs')).toHaveTextContent('rtl/reg_file.v');
      expect(screen.getByTestId('clipboard-mode')).toHaveTextContent('');
    });
  });

  it('prompts for unsaved changes before arming copy clipboard state', async () => {
    vi.mocked(window.electronAPI!.fs.exists).mockResolvedValue(true);

    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('edit-reg'));
    fireEvent.click(screen.getByText('copy-reg'));

    await waitFor(() => {
      expect(screen.getByTestId('unsaved-dialog-files')).toHaveTextContent('rtl/core/reg_file.v');
    });
    expect(screen.getByTestId('clipboard-mode')).toHaveTextContent('');

    fireEvent.click(screen.getByText('discard-unsaved'));

    await waitFor(() => {
      expect(screen.getByTestId('clipboard-mode')).toHaveTextContent('copy');
      expect(screen.getByTestId('clipboard-path')).toHaveTextContent('rtl/core/reg_file.v');
    });
  });

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

  it('creates untitled files, marks them dirty when edited, and clears dirty state when reverted', async () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-untitled'));

    expect(screen.getByTestId('tabs')).toHaveTextContent('untitled-1');
    expect(screen.getByTestId('active-tab')).toHaveTextContent('untitled-1');
    expect(screen.getByTestId('dirty-files')).toHaveTextContent('');

    fireEvent.click(screen.getByText('edit-active'));
    expect(screen.getByTestId('dirty-files')).toHaveTextContent('untitled-1');

    fireEvent.click(screen.getByText('clear-active'));
    expect(screen.getByTestId('dirty-files')).toHaveTextContent('');
  });

  it('creates a workspace file on disk and refreshes the explorer token', async () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('create-file'));

    await waitFor(() => {
      expect(window.electronAPI?.fs.writeFile).toHaveBeenCalledWith('rtl/generated/new_file.sv', '');
      expect(screen.getByTestId('workspace-tree-refresh-token')).toHaveTextContent('1');
    });
  });

  it('creates a workspace folder on disk and refreshes the explorer token', async () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('create-folder'));

    await waitFor(() => {
      expect(window.electronAPI?.fs.createDirectory).toHaveBeenCalledWith('rtl/generated');
      expect(screen.getByTestId('workspace-tree-refresh-token')).toHaveTextContent('1');
    });
  });

  it('saves untitled files through the native save dialog flow and refreshes the workspace tree when saved in-workspace', async () => {
    vi.mocked(window.electronAPI!.dialog.showSaveDialog).mockResolvedValueOnce({
      canceled: false,
      filePath: 'C:/workspace/rtl/generated/new_file.sv',
      workspaceRelativePath: 'rtl/generated/new_file.sv',
    });

    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-untitled'));
    fireEvent.click(screen.getByText('edit-active'));
    fireEvent.click(screen.getByText('save-active'));

    await waitFor(() => {
      expect(window.electronAPI?.dialog.showSaveDialog).toHaveBeenCalledWith('untitled-1');
      expect(window.electronAPI?.fs.writeFile).toHaveBeenCalledWith('rtl/generated/new_file.sv', 'module untitled; endmodule');
    });

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('rtl/generated/new_file.sv');
      expect(screen.getByTestId('tabs')).toHaveTextContent('rtl/generated/new_file.sv');
      expect(screen.getByTestId('dirty-files')).toHaveTextContent('');
      expect(screen.getByTestId('workspace-tree-refresh-token')).toHaveTextContent('1');
    });
  });

  it('closes a clean untitled tab immediately without opening the unsaved dialog', async () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-untitled'));
    fireEvent.click(screen.getByText('close-active'));

    await waitFor(() => {
      expect(screen.getByTestId('tabs')).not.toHaveTextContent('untitled-1');
      expect(screen.getByTestId('unsaved-dialog-files')).toHaveTextContent('');
    });
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

  it('prompts before closing a dirty untitled file and can discard it', async () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-untitled'));
    fireEvent.click(screen.getByText('edit-active'));
    fireEvent.click(screen.getByText('close-active'));

    await waitFor(() => {
      expect(screen.getByTestId('unsaved-dialog-files')).toHaveTextContent('untitled-1');
    });

    fireEvent.click(screen.getByText('discard-unsaved'));

    await waitFor(() => {
      expect(screen.getByTestId('tabs')).not.toHaveTextContent('untitled-1');
      expect(screen.getByTestId('unsaved-dialog-files')).toHaveTextContent('');
    });
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

  it('renames an open file and updates the active tab path', async () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('rename-reg'));

    await waitFor(() => {
      expect(window.electronAPI?.fs.rename).toHaveBeenCalledWith('rtl/core/reg_file.v', 'rtl/core/reg_file_renamed.v');
      expect(screen.getByTestId('active-tab')).toHaveTextContent('rtl/core/reg_file_renamed.v');
      expect(screen.getByTestId('tabs')).toHaveTextContent('rtl/core/reg_file_renamed.v');
    });
  });

  it('renames an open folder and cascades the new prefix through open tabs', async () => {
    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('open-alu'));
    fireEvent.click(screen.getByText('rename-core-folder'));

    await waitFor(() => {
      expect(window.electronAPI?.fs.rename).toHaveBeenCalledWith('rtl/core', 'rtl/renamed_core');
      expect(screen.getByTestId('groups')).toHaveTextContent('rtl/renamed_core/reg_file.v');
      expect(screen.getByTestId('groups')).toHaveTextContent('rtl/renamed_core/alu.v');
      expect(screen.getByTestId('active-tab')).toHaveTextContent('rtl/renamed_core/alu.v');
    });
  });

  it('deletes a workspace file after confirmation and refreshes the explorer token', async () => {
    vi.mocked(window.electronAPI!.fs.exists).mockResolvedValue(true);

    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('delete-reg'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-dialog-target')).toHaveTextContent('rtl/core/reg_file.v');
      expect(screen.getByTestId('delete-dialog-type')).toHaveTextContent('file');
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(window.electronAPI?.fs.deleteFile).toHaveBeenCalledWith('rtl/core/reg_file.v');
      expect(screen.getByTestId('workspace-tree-refresh-token')).toHaveTextContent('1');
      expect(screen.getByTestId('delete-dialog-target')).toHaveTextContent('');
    });
  });

  it('closes deleted open files after confirmation', async () => {
    vi.mocked(window.electronAPI!.fs.exists).mockResolvedValue(true);

    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    expect(screen.getByTestId('tabs')).toHaveTextContent('rtl/core/reg_file.v');

    fireEvent.click(screen.getByText('delete-reg'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-dialog-target')).toHaveTextContent('rtl/core/reg_file.v');
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(screen.getByTestId('tabs')).not.toHaveTextContent('rtl/core/reg_file.v');
    });
  });

  it('deletes a folder recursively and closes affected open tabs', async () => {
    vi.mocked(window.electronAPI!.fs.exists).mockResolvedValue(true);

    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('open-alu'));

    fireEvent.click(screen.getByText('delete-core-folder'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-dialog-target')).toHaveTextContent('rtl/core');
      expect(screen.getByTestId('delete-dialog-type')).toHaveTextContent('folder');
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(window.electronAPI?.fs.deleteDirectory).toHaveBeenCalledWith('rtl/core');
      expect(screen.getByTestId('groups')).not.toHaveTextContent('rtl/core/reg_file.v');
      expect(screen.getByTestId('groups')).not.toHaveTextContent('rtl/core/alu.v');
      expect(screen.getByTestId('workspace-tree-refresh-token')).toHaveTextContent('1');
    });
  });

  it('prompts for unsaved changes before showing delete confirmation', async () => {
    vi.mocked(window.electronAPI!.fs.exists).mockResolvedValue(true);

    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('edit-reg'));
    fireEvent.click(screen.getByText('delete-reg'));

    await waitFor(() => {
      expect(screen.getByTestId('unsaved-dialog-files')).toHaveTextContent('rtl/core/reg_file.v');
    });
    expect(screen.getByTestId('delete-dialog-target')).toHaveTextContent('');

    fireEvent.click(screen.getByText('discard-unsaved'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-dialog-target')).toHaveTextContent('rtl/core/reg_file.v');
    });

    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(window.electronAPI?.fs.deleteFile).toHaveBeenCalledWith('rtl/core/reg_file.v');
    });
  });

  it('cancels delete confirmation without mutating the workspace', async () => {
    vi.mocked(window.electronAPI!.fs.exists).mockResolvedValue(true);

    render(
      <WorkspaceProvider>
        <WorkspaceHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('delete-reg'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-dialog-target')).toHaveTextContent('rtl/core/reg_file.v');
    });

    fireEvent.click(screen.getByText('cancel-delete'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-dialog-target')).toHaveTextContent('');
    });
    expect(window.electronAPI?.fs.deleteFile).not.toHaveBeenCalled();
    expect(screen.getByTestId('tabs')).toHaveTextContent('rtl/core/reg_file.v');
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