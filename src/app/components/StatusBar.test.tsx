import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBar } from './StatusBar';

describe('StatusBar', () => {
  it('shows branch, diagnostics, cursor state, and inferred language', () => {
    render(
      <StatusBar activeFileId="tb_cpu" cursorLine={18} cursorCol={4} />,
    );

    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('Sync')).toBeInTheDocument();
    expect(screen.getByText('Ln 18, Col 4')).toBeInTheDocument();
    expect(screen.getByText('SystemVerilog')).toBeInTheDocument();
    expect(screen.getByText('Verilator 5.024')).toBeInTheDocument();
  });
});