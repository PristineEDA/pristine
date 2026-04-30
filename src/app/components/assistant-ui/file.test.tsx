import { render, screen } from '@testing-library/react';
import {
  BracesIcon,
  FileIcon as LucideFileIcon,
  FileTextIcon,
  ImageIcon,
  MusicIcon,
  VideoIcon,
} from 'lucide-react';
import { describe, expect, it } from 'vitest';

import {
  File,
  formatFileSize,
  getBase64Size,
  getMimeTypeIcon,
} from './file';

describe('File', () => {
  it('selects MIME type icons for common assistant file parts', () => {
    expect(getMimeTypeIcon('image/png')).toBe(ImageIcon);
    expect(getMimeTypeIcon('application/pdf')).toBe(FileTextIcon);
    expect(getMimeTypeIcon('application/json')).toBe(BracesIcon);
    expect(getMimeTypeIcon('text/plain')).toBe(FileTextIcon);
    expect(getMimeTypeIcon('audio/wav')).toBe(MusicIcon);
    expect(getMimeTypeIcon('video/mp4')).toBe(VideoIcon);
    expect(getMimeTypeIcon('application/octet-stream')).toBe(LucideFileIcon);
  });

  it('renders a downloadable mock file part with size metadata', () => {
    const { container } = render(
      <File
        type="file"
        filename="waveform.json"
        data="SGVsbG8="
        mimeType="application/json"
        status={{ type: 'complete' }}
      />,
    );

    expect(screen.getByText('waveform.json')).toBeInTheDocument();
    expect(screen.getByText('5 B')).toBeInTheDocument();

    const root = container.querySelector('[data-slot="file-root"]');
    expect(root).toHaveClass('border', 'text-sm');
    expect(container.querySelector('[data-slot="file-icon"] svg')).toBeInTheDocument();

    const download = container.querySelector('[data-slot="file-download"]');
    expect(download).toHaveAttribute('href', 'data:application/json;base64,SGVsbG8=');
    expect(download).toHaveAttribute('download', 'waveform.json');
  });

  it('formats base64 payload sizes for mock file data', () => {
    expect(getBase64Size('data:text/plain;base64,SGVsbG8=')).toBe(5);
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1_572_864)).toBe('1.5 MB');
  });
});
