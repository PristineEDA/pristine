import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Problem } from '../../../../data/mockData';

let mockedProblems: Problem[] = [];

vi.mock('../../../../data/mockDataLoader', () => ({
  useProblemsList: () => mockedProblems,
}));

import { ProblemsTabPanel } from './ProblemsTabPanel';

describe('ProblemsTabPanel', () => {
  beforeEach(() => {
    mockedProblems = [];
  });

  it('renders grouped sections with counts and file locations', () => {
    mockedProblems = [
      {
        id: 'error-1',
        severity: 'error',
        message: 'Top-level module is missing a reset synchronizer',
        file: 'cpu_top.v',
        fileId: 'cpu_top',
        line: 48,
        column: 9,
      },
      {
        id: 'warning-1',
        severity: 'warning',
        message: 'Unused signal may be optimized away',
        file: 'alu.v',
        fileId: 'alu',
        line: 19,
        column: 4,
      },
      {
        id: 'info-1',
        severity: 'info',
        message: 'Consider registering the output for timing closure',
        file: 'uart_tx.v',
        fileId: 'uart_tx',
        line: 17,
        column: 15,
      },
    ];

    render(<ProblemsTabPanel />);

    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(screen.getByText('Infos')).toBeInTheDocument();
    expect(screen.getAllByText('(1)')).toHaveLength(3);

    expect(screen.getByText('Top-level module is missing a reset synchronizer')).toBeInTheDocument();
    expect(screen.getByText('cpu_top.v L48:9')).toBeInTheDocument();
    expect(screen.getByText('Unused signal may be optimized away')).toBeInTheDocument();
    expect(screen.getByText('alu.v L19:4')).toBeInTheDocument();
    expect(screen.getByText('Consider registering the output for timing closure')).toBeInTheDocument();
    expect(screen.getByText('uart_tx.v L17:15')).toBeInTheDocument();
  });

  it('omits section headers that have no matching problems', () => {
    mockedProblems = [
      {
        id: 'warning-1',
        severity: 'warning',
        message: 'Potential latch inferred in combinational block',
        file: 'decode.v',
        fileId: 'decode',
        line: 27,
        column: 2,
      },
    ];

    render(<ProblemsTabPanel />);

    expect(screen.queryByText('Errors')).not.toBeInTheDocument();
    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(screen.queryByText('Infos')).not.toBeInTheDocument();
    expect(screen.getByText('(1)')).toBeInTheDocument();
  });

  it('renders an empty panel when there are no problems', () => {
    const { container } = render(<ProblemsTabPanel />);

    expect(screen.queryByText('Errors')).not.toBeInTheDocument();
    expect(screen.queryByText('Warnings')).not.toBeInTheDocument();
    expect(screen.queryByText('Infos')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass('flex-1', 'overflow-y-auto', 'py-1');
    expect(container).toHaveTextContent('');
  });
});