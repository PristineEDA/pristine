import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppStatusBar } from './AppStatusBar';

describe('AppStatusBar', () => {
  it('renders the explorer status bar for the code explorer view', () => {
    render(
      <AppStatusBar
        mainContentView="code"
        activeView="explorer"
        activeFileId="rtl/tb/tb_cpu_top.sv"
        cursorLine={18}
        cursorCol={4}
      />,
    );

    expect(screen.getByTestId('status-bar')).toHaveAttribute('data-status-bar-id', 'code-explorer');
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('Ln 18, Col 4')).toBeInTheDocument();
    expect(screen.getByText('SystemVerilog')).toBeInTheDocument();
  });

  it('renders a placeholder status bar for code views without an implementation', () => {
    render(
      <AppStatusBar
        mainContentView="code"
        activeView="simulation"
        activeFileId=""
        cursorLine={1}
        cursorCol={1}
      />,
    );

    expect(screen.getByTestId('status-bar')).toHaveAttribute('data-status-bar-id', 'code-simulation');
    expect(screen.getByText('Simulation')).toBeInTheDocument();
    expect(screen.getByText('Placeholder')).toBeInTheDocument();
  });

  it('renders a whiteboard placeholder status bar outside code', () => {
    render(
      <AppStatusBar
        mainContentView="whiteboard"
        activeView="explorer"
        activeFileId=""
        cursorLine={1}
        cursorCol={1}
      />,
    );

    expect(screen.getByTestId('status-bar')).toHaveAttribute('data-status-bar-id', 'whiteboard');
    expect(screen.getByText('Whiteboard')).toBeInTheDocument();
    expect(screen.getByText('Status Bar Placeholder')).toBeInTheDocument();
  });

  it('renders a workflow placeholder status bar outside code', () => {
    render(
      <AppStatusBar
        mainContentView="workflow"
        activeView="explorer"
        activeFileId=""
        cursorLine={1}
        cursorCol={1}
      />,
    );

    expect(screen.getByTestId('status-bar')).toHaveAttribute('data-status-bar-id', 'workflow');
    expect(screen.getByText('Workflow')).toBeInTheDocument();
    expect(screen.getByText('Status Bar Placeholder')).toBeInTheDocument();
  });
});
