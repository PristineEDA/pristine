import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';

import { waveformLayerNames } from './createWaveformScene';
import {
  getWaveformDigitalPulseFillCount,
  getWaveformDisplayRows,
  getWaveformFirstSignalLaneY,
  getWaveformSignalLaneY,
  getWaveformViewportSpan,
  waveformLaneHeight,
} from './waveformLayout';
import type { ParsedWaveformFrame } from './waveformBinaryFrame';
import type { WaveformDataSet, WaveformRenderMetrics, WaveformRendererStatus, WaveformViewport } from './waveformTypes';
import { WaveformPanel } from './WaveformPanel';
import { createWaveformFixtureFrame } from './waveformTestFixtures';

vi.mock('./WaveformCanvas', () => ({
  WaveformCanvas: ({
    cursorTime,
    data,
    frame,
    interactionFrameRequestCount,
    preparedRangeHitCount,
    preparedRangeMissCount,
    selectedSignalId,
    verticalScrollTop,
    viewport,
    onMetricsChange,
    onRendererChange,
    onCursorTimeChange,
  }: {
    cursorTime: number;
    data: WaveformDataSet;
    frame?: ParsedWaveformFrame | null;
    interactionFrameRequestCount?: number;
    onMetricsChange?: (metrics: WaveformRenderMetrics) => void;
    onRendererChange?: (renderer: WaveformRendererStatus) => void;
    selectedSignalId: string | null;
    preparedRangeHitCount?: number;
    preparedRangeMissCount?: number;
    viewport: WaveformViewport;
    onCursorTimeChange: (time: number) => void;
    verticalScrollTop: number;
  }) => {
    const displayRows = getWaveformDisplayRows(data);
    const firstSignalLaneY = getWaveformFirstSignalLaneY(data);
    const selectedSignalLaneY = getWaveformSignalLaneY(data, selectedSignalId);

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
        data-bus-hexagon-count="12"
        data-bus-fold-only-count="2"
        data-bus-full-hexagon-count="12"
        data-bus-special-state-hexagon-count="2"
        data-bus-special-state-label-count="2"
        data-bus-special-state-width-aligned-label-count="2"
        data-bus-truncated-label-count="3"
        data-bus-label-dot-replacement-count="5"
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
        data-interaction-frame-request-count={interactionFrameRequestCount ?? 0}
        data-label-pool-size="8"
        data-mesh-buffer-update-ms="1.250"
        data-mesh-vertex-count="512"
        data-pulse-fill-count={getWaveformDigitalPulseFillCount(data, viewport)}
        data-row-count={displayRows.length}
        data-row-height={waveformLaneHeight}
        data-prepared-range-end={frame?.preparedRange?.endTime.toFixed(2) ?? ''}
        data-prepared-range-hit-count={preparedRangeHitCount ?? 0}
        data-prepared-range-miss-count={preparedRangeMissCount ?? 0}
        data-prepared-range-start={frame?.preparedRange?.startTime.toFixed(2) ?? ''}
        data-ruler-scroll-indicator-color="#8e8e8e"
        data-ruler-scroll-indicator-height="22.00"
        data-ruler-scroll-indicator-left="0.00"
        data-ruler-scroll-indicator-radius="3.00"
        data-ruler-scroll-indicator-scrollable="false"
        data-ruler-scroll-indicator-width="900.00"
        data-selected-signal-id={selectedSignalId ?? ''}
        data-selected-signal-lane-y={selectedSignalLaneY?.toFixed(2) ?? ''}
        data-selected-signal-visible-y={selectedSignalLaneY === null ? '' : (selectedSignalLaneY - verticalScrollTop).toFixed(2)}
        data-signal-count={data.signals.length}
        data-waveform-empty-visible-signal-count="0"
        data-waveform-frame-protocol-version={frame?.version ?? ''}
        data-waveform-frame-segment-count={frame?.segmentCount ?? 0}
        data-waveform-frame-truncated={String(frame?.truncated ?? false)}
        data-waveform-frame-version={frame?.version ?? ''}
        data-skipped-horizontal-segment-count="12"
        data-testid="waveform-canvas"
        className="cursor-default"
        data-vertical-scroll-top={verticalScrollTop.toFixed(2)}
        data-visible-window-end={viewport.endTime.toFixed(2)}
        data-visible-window-start={viewport.startTime.toFixed(2)}
        data-waveform-header-height="22.00"
        data-x-state-count="3"
        data-x-state-block-count="3"
        data-z-state-block-count="3"
        data-z-state-count="3"
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
  it('waits for the first binary frame before mounting the Pixi canvas', async () => {
    const waveformFrame = vi.mocked(window.electronAPI!.lsp.waveformFrame);
    let resolveFrame: () => void = () => undefined;

    waveformFrame.mockImplementationOnce((options) => new Promise<ArrayBuffer>((resolve) => {
      resolveFrame = () => resolve(createWaveformFixtureFrame(
        {
          startTime: options.startTime,
          endTime: options.endTime,
        },
        options.width,
        options.signalIds,
      ));
    }));

    render(<WaveformPanel />);

    const panel = screen.getByTestId('waveform-panel');

    await waitFor(() => expect(panel).toHaveAttribute('data-waveform-session-status', 'ready'));
    await waitFor(() => expect(waveformFrame).toHaveBeenCalled());

    expect(waveformFrame.mock.calls[0]?.[0]).toMatchObject({
      startTime: 0,
      endTime: 200,
      maxSegments: 0,
      preparedEndTime: 200,
      preparedStartTime: 0,
      protocolVersion: 2,
      viewportEndTime: 200,
      viewportStartTime: 0,
      width: 900,
    });
    expect(screen.queryByTestId('waveform-canvas')).not.toBeInTheDocument();
    expect(screen.getByTestId('waveform-loading-state')).toHaveTextContent('Loading waveform data...');
    expect(screen.getByTestId('waveform-signal-value-tb_top_module1-clk')).toHaveTextContent('-');
    expect(screen.getByTestId('waveform-toolbar-cursor-value')).toHaveTextContent('-');

    resolveFrame();

    await waitFor(() => expect(screen.getByTestId('waveform-canvas')).toBeInTheDocument());
    expect(panel).toHaveAttribute('data-waveform-frame-version', '2');
    expect(panel).toHaveAttribute('data-waveform-frame-truncated', 'false');
    expect(panel).toHaveAttribute('data-waveform-empty-visible-signal-count', '0');
    expect(Number(panel.getAttribute('data-waveform-frame-segment-count'))).toBeGreaterThan(0);
    expect(screen.getByTestId('waveform-signal-value-tb_top_module1-clk')).not.toHaveTextContent(/^x$/i);
  }, 20000);

  it('renders binary waveform signals, selection state, and cursor values', async () => {
    render(<WaveformPanel />);

    const panel = screen.getByTestId('waveform-panel');

    await waitFor(() => expect(panel).toHaveAttribute('data-waveform-session-status', 'ready'));
    await waitFor(() => expect(screen.getByTestId('waveform-canvas')).toBeInTheDocument());

    expect(panel).toHaveAttribute('data-signal-count', '168');
    expect(panel).toHaveAttribute('data-waveform-source', 'lsp-binary');
    expect(panel).toHaveAttribute('data-waveform-frame-version', '2');
    expect(panel).toHaveAttribute('data-waveform-frame-protocol-version', '2');
    expect(panel).toHaveAttribute('data-waveform-frame-truncated', 'false');
    expect(panel).toHaveAttribute('data-waveform-empty-visible-signal-count', '0');
    expect(panel).toHaveAttribute('data-prepared-range-start', '0.00');
    expect(panel).toHaveAttribute('data-prepared-range-end', '200.00');
    expect(Number(panel.getAttribute('data-interaction-frame-request-count'))).toBeGreaterThan(0);
    expect(Number(panel.getAttribute('data-prepared-range-miss-count'))).toBeGreaterThan(0);
    expect(Number(panel.getAttribute('data-waveform-frame-request-count'))).toBeGreaterThan(0);
    expect(Number(panel.getAttribute('data-waveform-frame-segment-count'))).toBeGreaterThan(0);
    expect(screen.getByText('tb_top_module1')).toBeInTheDocument();
    expect(screen.getByText('u_top_module1')).toBeInTheDocument();
    expect(screen.getByText('dense_test_signals')).toBeInTheDocument();
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-layer-names', 'background,content,status,operation');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-waveform-frame-version', '2');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-waveform-frame-protocol-version', '2');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-waveform-frame-truncated', 'false');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-waveform-empty-visible-signal-count', '0');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-prepared-range-start', '0.00');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-prepared-range-end', '200.00');
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-mesh-buffer-update-ms'))).toBeGreaterThanOrEqual(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-mesh-vertex-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-label-pool-size'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-waveform-frame-segment-count'))).toBeGreaterThan(0);
    const toolbar = screen.getByTestId('waveform-toolbar');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-row-count', '171');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-canvas-height', '320.00');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-canvas-width', '900.00');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-first-signal-lane-y', '52.00');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-header-background', 'opaque');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-ruler-scroll-indicator-color', '#8e8e8e');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-ruler-scroll-indicator-height', '22.00');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-ruler-scroll-indicator-radius', '3.00');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-ruler-scroll-indicator-scrollable', 'false');
    expect(screen.getByTestId('waveform-canvas')).toHaveClass('cursor-default');
    expect(screen.getByTestId('waveform-canvas')).not.toHaveClass('cursor-crosshair');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-waveform-header-height', '22.00');
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-hexagon-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-full-hexagon-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-fold-only-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-vertical-fallback-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-special-state-hexagon-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-special-state-label-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-special-state-width-aligned-label-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-truncated-label-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-bus-label-dot-replacement-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-collapsed-segment-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-drawn-horizontal-segment-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-drawn-transition-edge-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-skipped-horizontal-segment-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-x-state-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-x-state-block-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-z-state-block-count'))).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('waveform-canvas').getAttribute('data-z-state-count'))).toBeGreaterThan(0);
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-pulse-fill-count');
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
    expect(screen.getByTestId('waveform-signal-row-u_top_module1-counting')).toHaveClass('items-end');
    expect(screen.getByTestId('waveform-signal-row-u_top_module1-counting')).toHaveClass('pb-1');
    expect(screen.getByTestId('waveform-toolbar-actions')).toBeInTheDocument();
    expect(screen.getByTestId('waveform-signal-primary-u_top_module1-counting')).toHaveClass('items-center');
    expect(screen.getByTestId('waveform-signal-value-u_top_module1-counting')).toHaveClass('h-[14px]');
    expect(screen.getByTestId('waveform-signal-value-u_top_module1-counting')).toHaveClass('items-end');
    expect(screen.getByTestId('waveform-signal-value-u_top_module1-counting')).toHaveClass('justify-end');
    expect(screen.getByText('counting')).toHaveClass('leading-[14px]');
    expect(screen.getByText('[3:0]')).toHaveClass('leading-none');
    expect(toolbar.innerHTML.indexOf('waveform-toolbar-metrics')).toBeLessThan(toolbar.innerHTML.indexOf('waveform-toolbar-cursor-info'));

    fireEvent.click(screen.getByTestId('waveform-signal-row-u_top_module1-counting'));

    expect(panel).toHaveAttribute('data-selected-signal-id', 'u_top_module1-counting');
    expect(screen.getByTestId('waveform-signal-row-u_top_module1-counting')).toHaveAttribute('data-row-index', '9');
    expect(screen.getByTestId('waveform-signal-row-u_top_module1-counting')).toHaveAttribute('data-lane-y', '292.00');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-selected-signal-lane-y', '292.00');
    expect(screen.getByText('[3:0]')).toBeInTheDocument();
    expect(screen.getByTestId('waveform-toolbar-cursor-time')).toHaveTextContent('84.0ns');
    expect(screen.getByTestId('waveform-toolbar-cursor-signal')).toHaveTextContent('counting');
    expect(screen.getByTestId('waveform-toolbar-cursor-value')).toHaveTextContent('2');
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('waveform-signal-row-dense-signal-40'));

    expect(panel).toHaveAttribute('data-selected-signal-id', 'dense-signal-40');
    expect(screen.getByTestId('waveform-signal-row-dense-signal-40')).toHaveAttribute('data-row-index', '50');
    expect(screen.getByTestId('waveform-signal-row-dense-signal-40')).toHaveAttribute('data-lane-y', '1522.00');
    expect(screen.getByTestId('waveform-canvas')).toHaveAttribute('data-selected-signal-lane-y', '1522.00');

    fireEvent.click(screen.getByTestId('waveform-canvas'));

    await waitFor(() => expect(panel).toHaveAttribute('data-cursor-time', '128.00'));
    expect(screen.getByTestId('waveform-toolbar-cursor-time')).toHaveTextContent('128.0ns');
    expect(screen.getByTestId('waveform-toolbar-cursor-value')).toHaveTextContent('-');
  }, 20000);

  it('updates viewport controls and toggles auxiliary panels', async () => {
    render(<WaveformPanel />);

    const panel = screen.getByTestId('waveform-panel');

    await waitFor(() => expect(panel).toHaveAttribute('data-waveform-session-status', 'ready'));
    await waitFor(() => expect(screen.getByTestId('waveform-canvas')).toBeInTheDocument());

    const initialZoom = Number(panel.getAttribute('data-zoom'));

    fireEvent.click(screen.getByRole('button', { name: /zoom in waveform/i }));

    await waitFor(() => expect(Number(panel.getAttribute('data-zoom'))).toBeGreaterThan(initialZoom));
    expect(Number(screen.getByTestId('waveform-horizontal-scrollbar').getAttribute('data-horizontal-scroll-range'))).toBeGreaterThanOrEqual(0);

    fireEvent.click(screen.getByRole('button', { name: /fit waveform/i }));

    await waitFor(() => expect(panel).toHaveAttribute('data-zoom', '1.00'));

    fireEvent.click(screen.getByRole('button', { name: /waveform settings/i }));
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
