import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { getWaveformViewportSpan } from './waveformLayout';
import type { WaveformDataSet, WaveformViewport } from './waveformTypes';
import { WaveformPanel } from './WaveformPanel';

vi.mock('./WaveformCanvas', () => ({
  WaveformCanvas: ({
    cursorTime,
    data,
    selectedSignalId,
    viewport,
    onCursorTimeChange,
  }: {
    cursorTime: number;
    data: WaveformDataSet;
    selectedSignalId: string | null;
    viewport: WaveformViewport;
    onCursorTimeChange: (time: number) => void;
  }) => (
    <button
      data-cursor-time={cursorTime.toFixed(2)}
      data-selected-signal-id={selectedSignalId ?? ''}
      data-signal-count={data.signals.length}
      data-testid="waveform-canvas"
      data-visible-window-end={viewport.endTime.toFixed(2)}
      data-visible-window-start={viewport.startTime.toFixed(2)}
      data-zoom={(data.duration / getWaveformViewportSpan(viewport)).toFixed(2)}
      type="button"
      onClick={() => onCursorTimeChange(128)}
    >
      Mock waveform canvas
    </button>
  ),
}));

describe('WaveformPanel', () => {
  it('renders mock signals, selection state, and cursor values', async () => {
    const user = userEvent.setup();

    render(<WaveformPanel />);

    const panel = screen.getByTestId('waveform-panel');

    expect(panel).toHaveAttribute('data-signal-count', '8');
    expect(screen.getByText('tb_top_module1')).toBeInTheDocument();
    expect(screen.getByText('u_top_module1')).toBeInTheDocument();

    await user.click(screen.getByTestId('waveform-signal-row-u_top_module1-counting'));

    expect(panel).toHaveAttribute('data-selected-signal-id', 'u_top_module1-counting');
    expect(screen.getByText('[3:0]')).toBeInTheDocument();
    expect(screen.getByText('84.0ns')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);

    await user.click(screen.getByTestId('waveform-canvas'));

    await waitFor(() => expect(panel).toHaveAttribute('data-cursor-time', '128.00'));
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  it('updates viewport controls and toggles auxiliary panels', async () => {
    const user = userEvent.setup();

    render(<WaveformPanel />);

    const panel = screen.getByTestId('waveform-panel');
    const initialZoom = Number(panel.getAttribute('data-zoom'));

    await user.click(screen.getByRole('button', { name: /zoom in waveform/i }));

    await waitFor(() => expect(Number(panel.getAttribute('data-zoom'))).toBeGreaterThan(initialZoom));

    await user.click(screen.getByRole('button', { name: /fit waveform/i }));

    await waitFor(() => expect(panel).toHaveAttribute('data-zoom', '1.00'));

    await user.click(screen.getByRole('button', { name: /waveform settings/i }));
    expect(screen.getByTestId('waveform-settings-popover')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add signals/i }));
    expect(screen.getByTestId('waveform-signal-picker')).toBeInTheDocument();
  });
});
