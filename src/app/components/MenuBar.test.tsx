import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MenuBar } from './MenuBar';

describe('MenuBar', () => {
  it('calls electron window controls when titlebar buttons are clicked', () => {
    render(<MenuBar />);

    fireEvent.click(screen.getByTestId('window-control-minimize'));
    fireEvent.click(screen.getByTestId('window-control-maximize'));
    fireEvent.click(screen.getByTestId('window-control-close'));

    expect(window.electronAPI?.minimize).toHaveBeenCalledTimes(1);
    expect(window.electronAPI?.maximize).toHaveBeenCalledTimes(1);
    expect(window.electronAPI?.close).toHaveBeenCalledTimes(1);
  });

  it('updates the selected project from the dropdown', () => {
    render(<MenuBar />);

    fireEvent.click(screen.getByRole('button', { name: /select project/i }));
    fireEvent.click(screen.getByRole('button', { name: /git repo/i }));

    expect(screen.getByRole('button', { name: /git repo/i })).toBeInTheDocument();
  });
});