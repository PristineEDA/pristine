import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActivityBar } from './ActivityBar';

describe('ActivityBar', () => {
  it('renders navigation items and switches active view', () => {
    const onViewChange = vi.fn();

    render(<ActivityBar activeView="explorer" onViewChange={onViewChange} />);

    const searchButton = screen.getByTitle('Search');
    fireEvent.click(searchButton);

    expect(onViewChange).toHaveBeenCalledWith('search');
    expect(screen.getByText('Explorer')).toBeInTheDocument();
    expect(screen.getByText('Source Control')).toBeInTheDocument();
  });
});