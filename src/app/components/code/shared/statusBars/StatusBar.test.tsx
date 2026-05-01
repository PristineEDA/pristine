import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LspProblem } from '../../../../lsp/lspProblems';
import { StatusBar } from './StatusBar';

const mockedGitStatus = {
  branchName: 'feature/git-ui',
  hasProjectFiles: true,
  isGitRepo: true,
  isLoading: false,
  pathStates: {},
};

const mockedProblemsByFile: Record<string, LspProblem[]> = {
  'rtl/tb/tb_cpu_top.sv': [
    {
      id: 'tb-error',
      severity: 'error',
      message: 'Top-level reset is undriven',
      file: 'tb_cpu_top.sv',
      fileId: 'rtl/tb/tb_cpu_top.sv',
      line: 12,
      column: 3,
    },
    {
      id: 'tb-warning',
      severity: 'warning',
      message: 'Potential latch inferred',
      file: 'tb_cpu_top.sv',
      fileId: 'rtl/tb/tb_cpu_top.sv',
      line: 18,
      column: 5,
    },
    {
      id: 'tb-info',
      severity: 'info',
      message: 'This info should not affect the status bar counts',
      file: 'tb_cpu_top.sv',
      fileId: 'rtl/tb/tb_cpu_top.sv',
      line: 22,
      column: 1,
    },
  ],
  'rtl/core/alu.v': [
    {
      id: 'alu-warning',
      severity: 'warning',
      message: 'Unused output',
      file: 'alu.v',
      fileId: 'rtl/core/alu.v',
      line: 9,
      column: 4,
    },
  ],
};

vi.mock('../../../../lsp/lspProblems', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../lsp/lspProblems')>();
  return {
    ...actual,
    useLspProblems: (fileId?: string | null) => {
      if (!fileId) {
        return [];
      }

      return mockedProblemsByFile[fileId] ?? [];
    },
  };
});

vi.mock('../../../../git/workspaceGitStatus', () => ({
  useWorkspaceGitStatus: () => mockedGitStatus,
  getWorkspaceGitBranchLabel: (snapshot: typeof mockedGitStatus) => (
    snapshot.hasProjectFiles && snapshot.isGitRepo && snapshot.branchName ? snapshot.branchName : 'git'
  ),
}));

describe('StatusBar', () => {
  beforeEach(() => {
    mockedGitStatus.branchName = 'feature/git-ui';
    mockedGitStatus.hasProjectFiles = true;
    mockedGitStatus.isGitRepo = true;
  });

  it('shows branch, diagnostics, cursor state, and inferred language from file paths', () => {
    render(
      <StatusBar activeFileId="rtl/tb/tb_cpu_top.sv" cursorLine={18} cursorCol={4} />,
    );

    expect(screen.getByTestId('status-bar-branch-label')).toHaveTextContent('feature/git-ui');
    expect(screen.getByText('Sync')).toBeInTheDocument();
    expect(screen.getByText('Ln 18, Col 4')).toBeInTheDocument();
    expect(screen.getByText('SystemVerilog')).toBeInTheDocument();
    expect(screen.getByText('Verilator 5.024')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar-error-count')).toHaveTextContent('1');
    expect(screen.getByTestId('status-bar-warning-count')).toHaveTextContent('1');
  });

  it('shows specialized labels for config and script files used in the editor area', () => {
    const { rerender } = render(
      <StatusBar activeFileId="constraints/timing.xdc" cursorLine={1} cursorCol={1} />,
    );

    expect(screen.getByText('XDC')).toBeInTheDocument();

    rerender(<StatusBar activeFileId="scripts/build.tcl" cursorLine={1} cursorCol={1} />);
    expect(screen.getByText('Tcl')).toBeInTheDocument();

    rerender(<StatusBar activeFileId="scripts/deploy.sh" cursorLine={1} cursorCol={1} />);
    expect(screen.getByText('Shell')).toBeInTheDocument();

    rerender(<StatusBar activeFileId="config/project.json" cursorLine={1} cursorCol={1} />);
    expect(screen.getByText('JSON')).toBeInTheDocument();

    rerender(<StatusBar activeFileId="startup/crt0.s" cursorLine={1} cursorCol={1} />);
    expect(screen.getByText('Assembly')).toBeInTheDocument();

    rerender(<StatusBar activeFileId="build/Makefile" cursorLine={1} cursorCol={1} />);
    expect(screen.getByText('Makefile')).toBeInTheDocument();
  });

  it('falls back to the generic git label when no project files are open or the workspace is not a git repo', () => {
    mockedGitStatus.branchName = '';
    mockedGitStatus.hasProjectFiles = false;
    mockedGitStatus.isGitRepo = false;

    const { rerender } = render(
      <StatusBar activeFileId="rtl/core/alu.v" cursorLine={9} cursorCol={3} />,
    );

    expect(screen.getByTestId('status-bar-branch-label')).toHaveTextContent('git');

    mockedGitStatus.branchName = 'feature/git-ui';
    mockedGitStatus.hasProjectFiles = true;
    mockedGitStatus.isGitRepo = true;

    rerender(<StatusBar activeFileId="rtl/core/alu.v" cursorLine={9} cursorCol={3} />);

    expect(screen.getByTestId('status-bar-branch-label')).toHaveTextContent('feature/git-ui');
  });

  it('shows 0 error and warning counts when no file is open', () => {
    render(
      <StatusBar activeFileId="" cursorLine={1} cursorCol={1} />,
    );

    expect(screen.getByText('Plain Text')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar-error-count')).toHaveTextContent('0');
    expect(screen.getByTestId('status-bar-warning-count')).toHaveTextContent('0');
  });

  it('adds stronger hover highlights, delays hover card open, and closes it immediately on leave', async () => {
    const user = userEvent.setup();

    render(
      <StatusBar
        activeFileId="rtl/tb/tb_cpu_top.sv"
        cursorLine={18}
        cursorCol={4}
        dirtyFileCount={2}
        savingFileCount={1}
        onSaveAll={vi.fn()}
      />,
    );

    const branchTrigger = screen.getByTestId('status-bar-branch-label').closest('[data-slot="hover-card-trigger"]');
    const savingTrigger = screen.getByTestId('status-bar-saving-summary').closest('[data-slot="hover-card-trigger"]');

    expect(branchTrigger).not.toBeNull();
    expect(branchTrigger).toHaveClass('hover:bg-primary-foreground/30');
    expect(branchTrigger).toHaveClass('dark:hover:bg-primary-foreground/10');
    expect(savingTrigger).not.toBeNull();
    expect(savingTrigger).toHaveClass('hover:bg-primary-foreground/30');
    expect(savingTrigger).toHaveClass('dark:hover:bg-primary-foreground/10');

    await user.hover(branchTrigger as HTMLElement);

    expect(screen.queryByText('Git Branch')).not.toBeInTheDocument();

    expect(await screen.findByText('Git Branch')).toBeInTheDocument();
    expect(screen.getByText('Placeholder details about the current workspace branch.')).toBeInTheDocument();

    await user.unhover(branchTrigger as HTMLElement);

    await waitFor(() => {
      expect(screen.queryByText('Git Branch')).not.toBeInTheDocument();
    });

    await user.hover(savingTrigger as HTMLElement);

    expect(screen.queryByText('Save Progress')).not.toBeInTheDocument();
    expect(await screen.findByText('Save Progress')).toBeInTheDocument();
  });

  it('opens hover details when a status bar item receives keyboard focus', async () => {
    render(
      <StatusBar activeFileId="rtl/tb/tb_cpu_top.sv" cursorLine={18} cursorCol={4} />,
    );

    const branchTrigger = screen.getByTestId('status-bar-branch-label').closest('[data-slot="hover-card-trigger"]');

    expect(branchTrigger).not.toBeNull();

    (branchTrigger as HTMLElement).focus();

    expect(await screen.findByText('Git Branch')).toBeInTheDocument();
  });

  it('shows unsaved summaries and exposes Save All and review actions', async () => {
    const user = userEvent.setup();
    const onOpenUnsavedFiles = vi.fn();
    const onSaveAll = vi.fn();

    render(
      <StatusBar
        activeFileId="rtl/core/alu.v"
        cursorLine={9}
        cursorCol={3}
        dirtyFileCount={2}
        failedSaveFileCount={1}
        savingFileCount={0}
        onOpenUnsavedFiles={onOpenUnsavedFiles}
        onSaveAll={onSaveAll}
      />,
    );

    expect(screen.getByTestId('status-bar-unsaved-summary')).toHaveTextContent('2 Unsaved');
    expect(screen.getByTestId('status-bar-save-error-summary')).toHaveTextContent('1 Save Failed');

    await user.click(screen.getByTestId('status-bar-unsaved-summary'));
    await user.click(screen.getByTestId('status-bar-save-error-summary'));
    await user.click(screen.getByTestId('status-bar-save-all'));

    expect(onOpenUnsavedFiles).toHaveBeenCalledTimes(2);
    expect(onSaveAll).toHaveBeenCalledTimes(1);
  });

  it('shows saving progress and disables Save All while files are being saved', async () => {
    const user = userEvent.setup();
    const onSaveAll = vi.fn();

    render(
      <StatusBar
        activeFileId="rtl/core/alu.v"
        cursorLine={9}
        cursorCol={3}
        dirtyFileCount={2}
        savingFileCount={1}
        onSaveAll={onSaveAll}
      />,
    );

    expect(screen.getByTestId('status-bar-unsaved-summary')).toHaveTextContent('2 Unsaved');
    expect(screen.getByTestId('status-bar-saving-summary')).toHaveTextContent('Saving 1');
    expect(screen.getByTestId('status-bar-save-all')).toBeDisabled();

    await user.click(screen.getByTestId('status-bar-save-all'));

    expect(onSaveAll).not.toHaveBeenCalled();
  });
});
