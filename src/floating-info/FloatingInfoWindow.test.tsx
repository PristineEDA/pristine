import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FloatingInfoWindow } from './FloatingInfoWindow';

describe('FloatingInfoWindow', () => {
  it('renders the floating info shell with the expected status tokens', () => {
    render(<FloatingInfoWindow />);

    expect(screen.getByTestId('floating-info-window')).toBeInTheDocument();
    expect(screen.getByTestId('floating-info-percent')).toHaveTextContent('68%');
    expect(screen.getByTestId('floating-info-text')).toHaveTextContent('SYNC');
  });

  it('renders the expected outer shell and bordered inner frame', () => {
    const { container } = render(<FloatingInfoWindow />);
    const shell = container.firstChild as HTMLElement | null;

    expect(shell).toHaveClass('h-screen', 'w-screen', 'overflow-hidden');
    expect(screen.getByTestId('floating-info-window')).toHaveClass('border');
  });
});