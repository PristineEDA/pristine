import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Image } from './image';

const mockImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

describe('Image', () => {
  it('renders mock image content in outline sm format', () => {
    const { container } = render(
      <Image.Root size="sm" variant="outline">
        <Image.Zoom src={mockImage} alt="timing-diagram.png">
          <Image.Preview src={mockImage} alt="timing-diagram.png" />
        </Image.Zoom>
        <Image.Filename>timing-diagram.png</Image.Filename>
      </Image.Root>,
    );

    const root = container.querySelector('[data-slot="image-root"]');
    expect(root).toHaveAttribute('data-variant', 'outline');
    expect(root).toHaveAttribute('data-size', 'sm');
    expect(root).toHaveClass('border', 'max-w-64');

    const preview = screen.getByAltText('timing-diagram.png');
    expect(preview).toHaveAttribute('src', mockImage);
    expect(screen.getByText('timing-diagram.png')).toHaveAttribute('data-slot', 'image-filename');

    fireEvent.load(preview);
    expect(preview).not.toHaveClass('invisible');
  });

  it('opens a zoom overlay from mock image content', async () => {
    render(
      <Image.Root size="sm" variant="outline">
        <Image.Zoom src={mockImage} alt="schematic-preview.png">
          <Image.Preview src={mockImage} alt="schematic-preview.png" />
        </Image.Zoom>
      </Image.Root>,
    );

    const zoomTrigger = screen.getByRole('button', { name: 'Click to zoom image' });
    fireEvent.click(zoomTrigger);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Close zoomed image' })).toBeInTheDocument();
    });

    expect(screen.getAllByAltText('schematic-preview.png')).toHaveLength(2);
  });
});
