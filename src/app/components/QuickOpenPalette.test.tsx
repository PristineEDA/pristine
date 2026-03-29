import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuickOpenPalette } from './QuickOpenPalette';

const results = [
  { path: 'rtl/core/alu.v', name: 'alu.v', score: 100 },
  { path: 'rtl/core/reg_file.v', name: 'reg_file.v', score: 80 },
];

describe('QuickOpenPalette', () => {
  it('navigates results with arrow keys and opens the selected result with Enter', () => {
    const onClose = vi.fn();
    const onQueryChange = vi.fn();
    const onSelectedIndexChange = vi.fn();
    const onSelectResult = vi.fn();

    render(
      <QuickOpenPalette
        isOpen
        query="alu"
        results={results}
        selectedIndex={0}
        isLoading={false}
        errorMessage={null}
        onClose={onClose}
        onQueryChange={onQueryChange}
        onSelectedIndexChange={onSelectedIndexChange}
        onSelectResult={onSelectResult}
      />,
    );

    const input = screen.getByTestId('quick-open-input');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onSelectedIndexChange).toHaveBeenCalledWith(1);

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onSelectedIndexChange).toHaveBeenCalledWith(0);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelectResult).toHaveBeenCalledWith(results[0]);

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders file name and relative path for each result', () => {
    render(
      <QuickOpenPalette
        isOpen
        query=""
        results={results}
        selectedIndex={0}
        isLoading={false}
        errorMessage={null}
        onClose={vi.fn()}
        onQueryChange={vi.fn()}
        onSelectedIndexChange={vi.fn()}
        onSelectResult={vi.fn()}
      />,
    );

    expect(screen.getByText('alu.v')).toBeInTheDocument();
    expect(screen.getByText('rtl/core/alu.v')).toBeInTheDocument();
    expect(screen.getByText('reg_file.v')).toBeInTheDocument();
    expect(screen.getByText('rtl/core/reg_file.v')).toBeInTheDocument();
  });
});