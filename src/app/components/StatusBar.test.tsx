import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBar } from './StatusBar';

describe('StatusBar', () => {
  it('shows branch, diagnostics, cursor state, and inferred language from file paths', () => {
    render(
      <StatusBar activeFileId="rtl/tb/tb_cpu_top.sv" cursorLine={18} cursorCol={4} />,
    );

    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('Sync')).toBeInTheDocument();
    expect(screen.getByText('Ln 18, Col 4')).toBeInTheDocument();
    expect(screen.getByText('SystemVerilog')).toBeInTheDocument();
    expect(screen.getByText('Verilator 5.024')).toBeInTheDocument();
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
});