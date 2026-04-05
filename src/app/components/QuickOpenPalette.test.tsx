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
        mode="search"
        query="alu"
        results={results}
        selectedIndex={0}
        isLoading={false}
        errorMessage={null}
        emptyMessage="No matching files"
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

  it('disables spellcheck and scrolls the selected row into view during keyboard navigation', () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(
      <QuickOpenPalette
        isOpen
        mode="search"
        query="alu"
        results={results}
        selectedIndex={0}
        isLoading={false}
        errorMessage={null}
        emptyMessage="No matching files"
        onClose={vi.fn()}
        onQueryChange={vi.fn()}
        onSelectedIndexChange={vi.fn()}
        onSelectResult={vi.fn()}
      />,
    );

    expect(screen.getByTestId('quick-open-input')).toHaveAttribute('spellcheck', 'false');
    expect(scrollIntoView).toHaveBeenCalled();

    scrollIntoView.mockClear();

    rerender(
      <QuickOpenPalette
        isOpen
        mode="search"
        query="alu"
        results={results}
        selectedIndex={1}
        isLoading={false}
        errorMessage={null}
        emptyMessage="No matching files"
        onClose={vi.fn()}
        onQueryChange={vi.fn()}
        onSelectedIndexChange={vi.fn()}
        onSelectResult={vi.fn()}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('renders file name and relative path for each result', () => {
    render(
      <QuickOpenPalette
        isOpen
        mode="recent"
        query=""
        results={results}
        selectedIndex={0}
        isLoading={false}
        errorMessage={null}
        emptyMessage="No recently opened files"
        onClose={vi.fn()}
        onQueryChange={vi.fn()}
        onSelectedIndexChange={vi.fn()}
        onSelectResult={vi.fn()}
      />,
    );

    expect(screen.getByTestId('quick-open-overlay')).toHaveClass('bg-muted');
    expect(screen.getByTestId('quick-open-overlay')).not.toHaveClass('bg-muted/40');
    expect(screen.queryByText('recent')).not.toBeInTheDocument();
    expect(screen.queryByText('Recently opened')).not.toBeInTheDocument();
    expect(screen.getByText('alu.v')).toBeInTheDocument();
    expect(screen.getByTestId('quick-open-icon-rtl_core_alu_v')).toBeInTheDocument();
    expect(screen.getByTestId('quick-open-path-rtl_core_alu_v')).toHaveTextContent('rtl/core');
    expect(screen.getByTestId('quick-open-result-rtl_core_alu_v')).toHaveClass('cursor-pointer');
    expect(screen.getByText('reg_file.v')).toBeInTheDocument();
    expect(screen.getByTestId('quick-open-path-rtl_core_reg_file_v')).toHaveTextContent('rtl/core');
  });

  it('highlights matched characters in the file name and path', () => {
    const regFileResult = results[1]!;

    render(
      <QuickOpenPalette
        isOpen
        mode="search"
        query="reg"
        results={[regFileResult]}
        selectedIndex={0}
        isLoading={false}
        errorMessage={null}
        emptyMessage="No matching files"
        onClose={vi.fn()}
        onQueryChange={vi.fn()}
        onSelectedIndexChange={vi.fn()}
        onSelectResult={vi.fn()}
      />,
    );

    expect(screen.getByTestId('quick-open-match-name-rtl_core_reg_file_v-0')).toHaveTextContent('r');
    expect(screen.getByTestId('quick-open-match-name-rtl_core_reg_file_v-1')).toHaveTextContent('e');
    expect(screen.getByTestId('quick-open-match-name-rtl_core_reg_file_v-2')).toHaveTextContent('g');
  });

  it('renders a recent empty state message when no recent files are available', () => {
    render(
      <QuickOpenPalette
        isOpen
        mode="recent"
        query=""
        results={[]}
        selectedIndex={0}
        isLoading={false}
        errorMessage={null}
        emptyMessage="No recently opened files"
        onClose={vi.fn()}
        onQueryChange={vi.fn()}
        onSelectedIndexChange={vi.fn()}
        onSelectResult={vi.fn()}
      />,
    );

    expect(screen.getByTestId('quick-open-empty')).toHaveTextContent('No recently opened files');
  });
});