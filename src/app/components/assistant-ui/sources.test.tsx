import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Source, Sources } from './sources';

describe('Sources', () => {
  it('renders URL source message parts with an outline badge style', () => {
    const { container } = render(
      <Source href="https://github.com/pristine/sim" variant="outline">
        <Sources.Icon url="https://github.com/pristine/sim" />
        <Sources.Title>Pristine Simulation Notes</Sources.Title>
      </Source>,
    );

    const source = screen.getByRole('link', { name: 'Pristine Simulation Notes' });
    expect(source).toHaveAttribute('data-slot', 'source');
    expect(source).toHaveAttribute('href', 'https://github.com/pristine/sim');
    expect(source).toHaveClass('border', 'border-input', 'bg-transparent');
    expect(container.querySelector('[data-slot="source-icon"]')).toBeInTheDocument();
  });

  it('uses the message part title and URL for mock source data', () => {
    render(
      <Sources
        type="source"
        id="source-1"
        sourceType="url"
        title="SystemVerilog LRM"
        url="https://ieeexplore.ieee.org/document/8299595"
        status={{ type: 'complete' }}
      />,
    );

    const source = screen.getByRole('link', { name: 'SystemVerilog LRM' });
    expect(source).toHaveAttribute('href', 'https://ieeexplore.ieee.org/document/8299595');
    expect(screen.getByText('SystemVerilog LRM')).toHaveAttribute('data-slot', 'source-title');
  });

  it('falls back to the source domain initial when the favicon fails', () => {
    const { container } = render(
      <Sources
        type="source"
        id="source-2"
        sourceType="url"
        url="https://react.dev/reference/react"
        status={{ type: 'complete' }}
      />,
    );

    const icon = container.querySelector('[data-slot="source-icon"]');
    expect(icon).toBeInTheDocument();
    fireEvent.error(icon as Element);

    expect(container.querySelector('[data-slot="source-icon-fallback"]')).toHaveTextContent('R');
    expect(screen.getByText('react.dev')).toHaveAttribute('data-slot', 'source-title');
  });
});