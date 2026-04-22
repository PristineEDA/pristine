import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkspaceProvider, useWorkspace } from '../../../context/WorkspaceContext';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

function UnsavedChangesDialogHarness() {
  const workspace = useWorkspace();

  return (
    <div>
      <div data-testid="dirty-files">{workspace.dirtyFileIds.join(',')}</div>
      <button onClick={() => workspace.openFile('rtl/core/reg_file.v', 'reg_file.v')}>open-reg</button>
      <button onClick={() => workspace.openFile('rtl/core/alu.v', 'alu.v')}>open-alu</button>
      <button onClick={() => workspace.openUntitledFile()}>open-untitled</button>
      <button onClick={() => workspace.updateFileContentInGroup('group-1', 'rtl/core/reg_file.v', 'module reg_file; logic dirty; endmodule')}>edit-reg</button>
      <button onClick={() => workspace.updateFileContentInGroup('group-1', 'rtl/core/alu.v', 'module alu; logic dirty; endmodule')}>edit-alu</button>
      <button onClick={() => workspace.updateFileContent(workspace.activeTabId, 'module untitled; endmodule')}>edit-active</button>
      <button onClick={() => workspace.openUnsavedChangesDialog()}>open-unsaved-dialog</button>
      <button onClick={() => workspace.closeActiveTabInFocusedGroup()}>close-active</button>
      <UnsavedChangesDialog />
    </div>
  );
}

describe('UnsavedChangesDialog', () => {
  it('saves only the selected unsaved files and keeps the remaining files in the dialog', async () => {
    render(
      <WorkspaceProvider>
        <UnsavedChangesDialogHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('edit-reg'));
    fireEvent.click(screen.getByText('open-alu'));
    fireEvent.click(screen.getByText('edit-alu'));
    fireEvent.click(screen.getByText('open-unsaved-dialog'));

    expect(await screen.findByTestId('unsaved-changes-dialog')).toBeVisible();
    expect(screen.getByTestId('unsaved-changes-selection-summary')).toHaveTextContent('2 selected • 2 total');

    fireEvent.click(screen.getByRole('checkbox', { name: /alu\.v rtl\/core\/alu\.v/i }));

    expect(screen.getByTestId('unsaved-changes-selection-summary')).toHaveTextContent('1 selected • 2 total');
    expect(screen.getByTestId('unsaved-changes-save-all')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('unsaved-changes-save'));

    await waitFor(() => {
      expect(window.electronAPI?.fs.writeFile).toHaveBeenCalledWith('rtl/core/reg_file.v', 'module reg_file; logic dirty; endmodule');
    });

    expect(window.electronAPI?.fs.writeFile).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('dirty-files')).toHaveTextContent('rtl/core/alu.v');
    expect(screen.getByTestId('unsaved-changes-selection-summary')).toHaveTextContent('1 selected • 1 total');

    const fileList = screen.getByTestId('unsaved-changes-file-list');
    expect(within(fileList).queryByText('reg_file.v')).not.toBeInTheDocument();
    expect(within(fileList).getByText('alu.v')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('unsaved-changes-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('unsaved-changes-dialog')).not.toBeInTheDocument();
    });
  });

  it('renders a dedicated three-button close confirmation for a single dirty tab', async () => {
    render(
      <WorkspaceProvider>
        <UnsavedChangesDialogHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-untitled'));
    fireEvent.click(screen.getByText('edit-active'));
    fireEvent.click(screen.getByText('close-active'));

    expect(await screen.findByTestId('unsaved-changes-single-file')).toBeVisible();
    expect(screen.getByTestId('unsaved-changes-single-file')).toHaveTextContent('untitled-1');
    expect(screen.getByTestId('unsaved-changes-cancel')).toHaveTextContent('Cancel');
    expect(screen.getByTestId('unsaved-changes-discard')).toHaveTextContent("Don't save");
    expect(screen.getByTestId('unsaved-changes-save')).toHaveTextContent('Save');
    expect(screen.queryByTestId('unsaved-changes-file-list')).not.toBeInTheDocument();
  });
});