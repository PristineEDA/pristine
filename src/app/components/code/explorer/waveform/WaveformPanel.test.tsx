import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';

import { waveformLayerNames } from './createWaveformScene';
import {
  getWaveformDigitalPulseFillCount,
  getWaveformDisplayRows,
  getWaveformFirstSignalLaneY,
  getWaveformSignalLaneY,
  getWaveformShapeCounts,
  getWaveformStateCounts,
  getWaveformViewportSpan,
  waveformLaneHeight,
} from './waveformLayout';
import type { WaveformDataSet, WaveformRenderMetrics, WaveformRendererStatus, WaveformViewport } from './waveformTypes';
import { WaveformPanel } from './WaveformPanel';

vi.mock('./WaveformCanvas', () => ({
  WaveformCanvas: ({
    cursorTime,
    data,
    selectedSignalId,
    verticalScrollTop,
    viewport,
    onMetricsChange,
    onRendererChange,
    onCursorTimeChange,
  }: {
    cursorTime: number;
    data: WaveformDataSet;
    onMetricsChange?: (metrics: WaveformRenderMetrics) => void;
    onRendererChange?: (renderer: WaveformRendererStatus) => void;
    selectedSignalId: string | null;
    viewport: WaveformViewport;
    onCursorTimeChange: (time: number) => void;
    verticalScrollTop: number;
  }) => {
    const displayRows = getWaveformDisplayRows(data);
    const firstSignalLaneY = getWaveformFirstSignalLaneY(data);
    const selectedSignalLaneY = getWaveformSignalLaneY(data, selectedSignalId);
    const shapeCounts = getWaveformShapeCounts(data, viewport);
    const stateCounts = getWaveformStateCounts(data);

    useEffect(() => {
      onRendererChange?.('webgpu');
      onMetricsChange?.({
        lastRenderDurationMs: 5.4,
        averageRenderDurationMs: 4.8,
        lastFps: 58.6,
        averageFps: 60.2,
        visiblePrimitiveCount: 1248,
      });
    }, [onMetricsChange, onRendererChange]);

    return (
      <button
        data-cursor-time={cursorTime.toFixed(2)}
        data-bus-hexagon-count={shapeCounts.busHexagonCount}
        data-bus-fold-only-count="2"
        data-bus-full-hexagon-count={shapeCounts.busHexagonCount}
        data-bus-special-state-hexagon-count="2"
        data-bus-special-state-label-count="2"
        data-bus-special-state-width-aligned-label-count="2"
        data-bus-vertical-fallback-count="1"
        data-canvas-height="320.00"
        data-canvas-width="900.00"
        data-collapsed-segment-count="12"
        data-drawn-horizontal-segment-count="148"
        data-drawn-transition-edge-count="64"
        data-first-signal-lane-y={firstSignalLaneY?.toFixed(2) ?? ''}
        data-header-background="opaque"
        data-layer-count={waveformLayerNames.length}
        data-layer-names={waveformLayerNames.join(',')}
        data-pulse-fill-count={getWaveformDigitalPulseFillCount(data, viewport)}
        data-row-count={displayRows.length}
        data-row-height={waveformLaneHeight}
        data-ruler-scroll-indicator-color="#8e8e8e"
        data-ruler-scroll-indicator-height="30.00"
        data-ruler-scroll-indicator-left="0.00"
        data-ruler-scroll-indicator-scrollable="false"
        data-ruler-scroll-indicator-width="900.00"
        data-selected-signal-id={selectedSignalId ?? ''}
        data-selected-signal-lane-y={selectedSignalLaneY?.toFixed(2) ?? ''}
        data-selected-signal-visible-y={selectedSignalLaneY === null ? '' : (selectedSignalLaneY - verticalScrollTop).toFixed(2)}
        data-signal-count={data.signals.length}
        data-skipped-horizontal-segment-count="12"
        data-testid="waveform-canvas"
        data-vertical-scroll-top={verticalScrollTop.toFixed(2)}
        data-visible-window-end={viewport.endTime.toFixed(2)}
        data-visible-window-start={viewport.startTime.toFixed(2)}
        data-x-state-count={stateCounts.xStateCount}
        data-x-state-block-count={shapeCounts.xStateBlockCount}
        data-z-state-block-count={shapeCounts.zStateBlockCount}
        data-z-state-count={stateCounts.zStateCount}
        data-zoom={(data.duration / getWaveformViewportSpan(viewport)).toFixed(2)}
        type="button"
        onClick={() => onCursorTimeChange(128)}
      >
        Mock waveform canvas
      </button>
    );
  },
}));

describe('WaveformPanel', () => {
  it('renders mock signals, selection state, and cursor values', async () => {
    const user = userEvent.setup();

    render(<WaveformPanel />);

    const panel = screen.getByTestId('waveform-panel');

    expect(panel).toHaveAttribute('data-signal-count', '168');
    expect(screen.getByText('tb_top_module1')).toBeInTheDocument();
    expect(screen.getByText('u_top_module1')).toBeInTheDocument();
    expect(screen.getByText('dense_test_signals')).toBeInTheDocument();
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-layer-names', 'background,content,status,operation');
    const toolbar = screen.getByTestId('waveform-toolbar');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-row-count', '171');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-canvas-height', '320.00');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-canvas-width', '900.00');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-first-signal-lane-y', '60.00');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-header-background', 'opaque');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-ruler-scroll-indicator-color', '#8e8e8e');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-ruler-scroll-indicator-height', '30.00');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-ruler-scroll-indicator-scrollable', 'false');
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-hexagon-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-full-hexagon-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-fold-only-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-vertical-fallback-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-special-state-hexagon-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-special-state-label-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-special-state-width-aligned-label-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-collapsed-segment-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-drawn-horizontal-segment-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-drawn-transition-edge-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-skipped-horizontal-segment-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-x-state-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-x-state-block-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-z-state-block-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-z-state-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-pulse-fill-count'))).toBeGreaterThan(0);
    expect(screen.getByTestId('waveform-signal-list-resize-handle')).toBeInTheDocument();
    expect(screen.getByTestId('panel-waveform-signal-list')).toHaveAttribute('data-default-size', '10');
    expect(screen.getByTestId('waveform-toolbar-metrics')).toBeInTheDocument();
    expect(screen.getByTestId('waveform-toolbar-metrics-render-last')).toHaveTextContent('5.4');
    expect(screen.getByTestId('waveform-toolbar-metrics-render-avg')).toHaveTextContent('4.8');
    expect(screen.getByTestId('waveform-toolbar-metrics-fps-last')).toHaveTextContent('58.6');
    expect(screen.getByTestId('waveform-toolbar-metrics-fps-avg')).toHaveTextContent('60.2');
    expect(screen.getByTestId('waveform-toolbar-metrics-primitives-value')).toHaveTextContent('1248');
    expect(screen.getByTestId('waveform-toolbar-cursor-info')).toBeInTheDocument();
    expect(screen.getByTestId('waveform-toolbar-cursor-time')).toHaveTextContent('84.0ns');
    expect(panel).toHaveAttribute('data-renderer', 'webgpu');
    expect(panel).toHaveAttribute('data-ready', 'true');
    expect(panel).toHaveAttribute('data-last-render-ms', '5.40');
    expect(panel).toHaveAttribute('data-average-render-ms', '4.80');
    expect(panel).toHaveAttribute('data-last-fps', '58.60');
    expect(panel).toHaveAttribute('data-average-fps', '60.20');
    expect(panel).toHaveAttribute('data-visible-primitive-count', '1248');
    await waitFor(() => expect(panel).toHaveAttribute('data-gpu-hardware-acceleration', 'true'));
    expect(panel).toHaveAttribute('data-gpu-feature-gpu-compositing', 'enabled');
    expect(panel).toHaveAttribute('data-gpu-feature-webgl', 'enabled');
    expect(panel).toHaveAttribute('data-gpu-feature-webgpu', 'enabled');
    expect(panel).toHaveAttribute('data-gpu-active-device-count', '1');
    expect(screen.getByTestId('waveform-signal-list-bottom-spacer')).toHaveClass('h-3');
    expect(screen.getByTestId('waveform-horizontal-scrollbar')).toBeInTheDocument();
    expect(screen.getByTestId('waveform-group-row-u_top_module1')).toHaveAttribute('data-row-index', '5');
    expect(screen.getByTestId('waveform-group-row-dense_test_signals')).toHaveAttribute('data-row-index', '10');
    expect(screen.getByTestId('waveform-signal-row-u_top_module1-counting')).toHaveClass('items-center');
    expect(screen.getByTestId('waveform-signal-row-u_top_module1-counting')).toHaveClass('pb-1');
    expect(screen.getByTestId('waveform-toolbar-actions')).toBeInTheDocument();
    expect(screen.getByTestId('waveform-signal-primary-u_top_module1-counting')).toHaveClass('items-center');
    expect(screen.getByTestId('waveform-signal-primary-u_top_module1-counting')).not.toHaveClass('items-baseline');
    expect(screen.getByText('counting')).toHaveClass('leading-[14px]');
    expect(screen.getByText('[3:0]')).toHaveClass('leading-none');
    expect(toolbar.innerHTML.indexOf('waveform-toolbar-metrics')).toBeLessThan(toolbar.innerHTML.indexOf('waveform-toolbar-cursor-info'));

    await user.click(screen.getByTestId('waveform-signal-row-u_top_module1-counting'));

    expect(panel).toHaveAttribute('data-selected-signal-id', 'u_top_module1-counting');
    expect(screen.getByTestId('waveform-signal-row-u_top_module1-counting')).toHaveAttribute('data-row-index', '9');
    expect(screen.getByTestId('waveform-signal-row-u_top_module1-counting')).toHaveAttribute('data-lane-y', '300.00');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-selected-signal-lane-y', '300.00');
    expect(screen.getByText('[3:0]')).toBeInTheDocument();
    expect(screen.getByTestId('waveform-toolbar-cursor-time')).toHaveTextContent('84.0ns');
    expect(screen.getByTestId('waveform-toolbar-cursor-signal')).toHaveTextContent('counting');
    expect(screen.getByTestId('waveform-toolbar-cursor-value')).toHaveTextContent('2');
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);

    await user.click(screen.getByTestId('waveform-signal-row-dense-signal-40'));

    expect(panel).toHaveAttribute('data-selected-signal-id', 'dense-signal-40');
    expect(screen.getByTestId('waveform-signal-row-dense-signal-40')).toHaveAttribute('data-row-index', '50');
    expect(screen.getByTestId('waveform-signal-row-dense-signal-40')).toHaveAttribute('data-lane-y', '1530.00');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-selected-signal-lane-y', '1530.00');

    await user.click(screen.getByTestId('waveform-canvas'));

    await waitFor(() => expect(panel).toHaveAttribute('data-cursor-time', '128.00'));
    expect(screen.getByTestId('waveform-toolbar-cursor-time')).toHaveTextContent('128.0ns');
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  it('updates viewport controls and toggles auxiliary panels', async () => {
    const user = userEvent.setup();

    render(<WaveformPanel />);

    const panel = screen.getByTestId('waveform-panel');
    const initialZoom = Number(panel.getAttribute('data-zoom'));

    await user.click(screen.getByRole('button', { name: /zoom in waveform/i }));

    await waitFor(() => expect(Number(panel.getAttribute('data-zoom'))).toBeGreaterThan(initialZoom));
    expect(Number(screen.getByTestId('waveform-horizontal-scrollbar').getAttribute('data-horizontal-scroll-range'))).toBeGreaterThanOrEqual(0);

    await user.click(screen.getByRole('button', { name: /fit waveform/i }));

    await waitFor(() => expect(panel).toHaveAttribute('data-zoom', '1.00'));

    await user.click(screen.getByRole('button', { name: /waveform settings/i }));
    expect(screen.getByTestId('waveform-settings-popover')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('waveform-gpu-hardware-acceleration')).toHaveTextContent('true'));
    expect(screen.getByTestId('waveform-gpu-compositing-status')).toHaveTextContent('enabled');
    expect(screen.getByTestId('waveform-gpu-webgpu-status')).toHaveTextContent('enabled');
    expect(screen.getByTestId('waveform-gpu-webgl-status')).toHaveTextContent('enabled');
    expect(screen.getByTestId('waveform-gpu-active-device-count')).toHaveTextContent('1');
    expect(screen.queryByRole('button', { name: /add signals/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('waveform-signal-picker')).not.toBeInTheDocument();
  }, 20000);
});
