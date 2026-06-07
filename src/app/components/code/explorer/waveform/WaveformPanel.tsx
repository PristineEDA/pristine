import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, MousePointer2, RotateCcw, Settings2, SlidersHorizontal, ZoomIn, ZoomOut } from 'lucide-react';

import { Button } from '../../../ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../../ui/resizable';
import { TooltipIconButton } from '../../../ui/tooltip-icon-button';
import {
  fitWaveformViewport,
  formatWaveformValue,
  getWaveformCanvasHeightForData,
  getWaveformDisplayRows,
  getWaveformHorizontalScrollMetrics,
  getInitialWaveformViewport,
  getSignalValueAtTime,
  getWaveformSignalTestId,
  getWaveformViewportForHorizontalScroll,
  getWaveformViewportSpan,
  panWaveformViewport,
  waveformHeaderHeight,
  zoomWaveformViewport,
} from './waveformLayout';
import type { WaveformDataSet, WaveformRenderMetrics, WaveformRendererStatus, WaveformSignal, WaveformViewport } from './waveformTypes';
import type { WaveformSignalDisplayRow } from './waveformLayout';
import type { ElectronGpuDiagnostics, RendererGpuSupportDiagnostics } from '../../../../../../types/electron-gpu';
import { WaveformCanvas } from './WaveformCanvas';
import { useWaveformSession } from './waveformSession';
import { WaveformBinaryValueKind, waveformBinaryFrameSignalTableStride, type ParsedWaveformFrame } from './waveformBinaryFrame';

const zoomButtonFactor = 1.35;
const initialWaveformViewportWidth = 900;
const initialWaveformViewportHeight = 320;

export function WaveformPanel() {
  const [viewport, setViewport] = useState<WaveformViewport | null>(null);
  const [cursorTime, setCursorTime] = useState(0);
  const [renderMetrics, setRenderMetrics] = useState<WaveformRenderMetrics>(() => createEmptyWaveformRenderMetrics());
  const [gpuDiagnostics, setGpuDiagnostics] = useState<ElectronGpuDiagnostics | null>(null);
  const [gpuDiagnosticsStatus, setGpuDiagnosticsStatus] = useState<'pending' | 'ready' | 'unavailable'>('pending');
  const [renderer, setRenderer] = useState<WaveformRendererStatus>('initializing');
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rendererGpuSupport] = useState<RendererGpuSupportDiagnostics>(() => detectRendererGpuSupport());
  const signalScrollRef = useRef<HTMLDivElement | null>(null);
  const waveformViewportRef = useRef<HTMLDivElement | null>(null);
  const horizontalScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
  const syncingHorizontalScrollRef = useRef(false);
  const [verticalScrollTop, setVerticalScrollTop] = useState(0);
  const [waveformViewportWidth, setWaveformViewportWidth] = useState(initialWaveformViewportWidth);
  const [waveformViewportHeight, setWaveformViewportHeight] = useState(initialWaveformViewportHeight);
  const session = useWaveformSession({
    canvasHeight: waveformViewportHeight,
    canvasWidth: waveformViewportWidth,
    verticalScrollTop,
    viewport,
  });
  const data = session.data;
  const selectedSignal = useMemo(
    () => data?.signals.find((signal) => signal.id === selectedSignalId) ?? data?.signals[0] ?? null,
    [data, selectedSignalId],
  );
  const displayRows = useMemo(() => data ? getWaveformDisplayRows(data) : [], [data]);
  const activeViewport = viewport ?? (data ? getInitialWaveformViewport(data) : { startTime: 0, endTime: 8 });
  const selectedValue = selectedSignal
    ? getSignalDisplayValue(session.frame, data, selectedSignal, cursorTime, activeViewport)
    : '-';
  const emptyVisibleSignalCount = getWaveformEmptyVisibleSignalCount(session.frame);
  const waitForInitialBinaryFrame = data?.source === 'lsp-binary' && !session.frame;
  const canRenderWaveformCanvas = Boolean(data) && !waitForInitialBinaryFrame;
  const loadingMessage = session.status === 'error' || session.status === 'unavailable'
    ? session.error ?? 'Waveform unavailable.'
    : data?.source === 'lsp-binary'
      ? 'Loading waveform data...'
      : 'Loading waveform...';
  const zoomLevel = data ? data.duration / getWaveformViewportSpan(activeViewport) : 1;
  const waveformCanvasHeight = data ? getWaveformCanvasHeightForData(data) : 0;
  const horizontalMetrics = data ? getWaveformHorizontalScrollMetrics(activeViewport, data.duration, waveformViewportWidth) : {
    contentWidth: waveformViewportWidth,
    maxScrollLeft: 0,
    maxStartTime: 0,
    scrollLeft: 0,
  };

  useEffect(() => {
    if (!data) {
      return;
    }

    setViewport(getInitialWaveformViewport(data));
    setCursorTime(data.cursorTime);
    setSelectedSignalId(data.signals[0]?.id ?? null);
    setVerticalScrollTop(0);
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    const getDiagnostics = window.electronAPI?.gpu?.getDiagnostics;

    if (!getDiagnostics) {
      setGpuDiagnosticsStatus('unavailable');
      return;
    }

    void getDiagnostics().then((nextDiagnostics) => {
      if (cancelled) {
        return;
      }

      setGpuDiagnostics(nextDiagnostics);
      setGpuDiagnosticsStatus('ready');
    }).catch(() => {
      if (!cancelled) {
        setGpuDiagnosticsStatus('unavailable');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const viewportElement = waveformViewportRef.current;

    if (!viewportElement) {
      return;
    }

    function updateSize() {
      const nextWidth = Math.floor(viewportElement?.clientWidth ?? 0);
      const nextHeight = Math.floor(viewportElement?.clientHeight ?? 0);

      if (nextWidth > 0) {
        setWaveformViewportWidth(nextWidth);
      }

      if (nextHeight > 0) {
        setWaveformViewportHeight(nextHeight);
      }
    }

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(viewportElement);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const horizontalScrollElement = horizontalScrollRef.current;

    if (!horizontalScrollElement) {
      return;
    }

    syncingHorizontalScrollRef.current = true;
    horizontalScrollElement.scrollLeft = horizontalMetrics.scrollLeft;
    window.requestAnimationFrame(() => {
      syncingHorizontalScrollRef.current = false;
    });
  }, [horizontalMetrics.contentWidth, horizontalMetrics.scrollLeft]);

  function handleZoomIn() {
    if (!data) {
      return;
    }

    setViewport((currentViewport) => zoomWaveformViewport(currentViewport ?? getInitialWaveformViewport(data), cursorTime, zoomButtonFactor, data.duration));
  }

  function handleZoomOut() {
    if (!data) {
      return;
    }

    setViewport((currentViewport) => zoomWaveformViewport(currentViewport ?? getInitialWaveformViewport(data), cursorTime, 1 / zoomButtonFactor, data.duration));
  }

  function handlePanLeft() {
    if (!data) {
      return;
    }

    setViewport((currentViewport) => {
      const safeViewport = currentViewport ?? getInitialWaveformViewport(data);
      return panWaveformViewport(safeViewport, -getWaveformViewportSpan(safeViewport) * 0.18, data.duration);
    });
  }

  function handlePanRight() {
    if (!data) {
      return;
    }

    setViewport((currentViewport) => {
      const safeViewport = currentViewport ?? getInitialWaveformViewport(data);
      return panWaveformViewport(safeViewport, getWaveformViewportSpan(safeViewport) * 0.18, data.duration);
    });
  }

  function handleFit() {
    if (!data) {
      return;
    }

    setViewport(fitWaveformViewport(data));
    setCursorTime(data.cursorTime);
  }

  function handleReset() {
    if (!data) {
      return;
    }

    setViewport(getInitialWaveformViewport(data));
    setCursorTime(data.cursorTime);
    setSelectedSignalId(data.signals[0]?.id ?? null);
  }

  function syncVerticalScroll(source: HTMLDivElement | null) {
    if (!source || syncingScrollRef.current) {
      return;
    }

    syncingScrollRef.current = true;
    setVerticalScrollTop(clampVerticalScrollTop(source.scrollTop));
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }

  function handleCanvasVerticalScrollDelta(delta: number) {
    setVerticalScrollTop((current) => {
      const next = clampVerticalScrollTop(current + delta);

      if (signalScrollRef.current) {
        const signalScrollElement = signalScrollRef.current;
        window.requestAnimationFrame(() => {
          signalScrollElement.scrollTop = next;
        });
      }

      return next;
    });
  }

  function handleHorizontalScroll() {
    const horizontalScrollElement = horizontalScrollRef.current;

    if (!horizontalScrollElement || syncingHorizontalScrollRef.current) {
      return;
    }

    if (!data) {
      return;
    }

    setViewport(getWaveformViewportForHorizontalScroll(activeViewport, data.duration, waveformViewportWidth, horizontalScrollElement.scrollLeft));
  }

  function clampVerticalScrollTop(scrollTop: number) {
    const maxScrollTop = signalScrollRef.current
      ? Math.max(0, signalScrollRef.current.scrollHeight - signalScrollRef.current.clientHeight)
      : Math.max(0, waveformCanvasHeight);

    return Math.min(Math.max(0, scrollTop), maxScrollTop);
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-ide-bg text-ide-text"
      data-average-fps={formatOptionalMetricNumber(renderMetrics.averageFps)}
      data-average-render-ms={formatOptionalMetricNumber(renderMetrics.averageRenderDurationMs)}
      data-browser-webgl={String(rendererGpuSupport.webgl)}
      data-browser-webgl2={String(rendererGpuSupport.webgl2)}
      data-browser-webgpu={String(rendererGpuSupport.webgpu)}
      data-cursor-time={cursorTime.toFixed(2)}
      data-gpu-active-device-count={getElectronGpuDeviceCount(gpuDiagnostics)}
      data-gpu-feature-gpu-compositing={formatGpuFeatureValue(gpuDiagnosticsStatus, gpuDiagnostics?.featureStatus['gpu_compositing'])}
      data-gpu-feature-webgl={formatGpuFeatureValue(gpuDiagnosticsStatus, gpuDiagnostics?.featureStatus['webgl'])}
      data-gpu-feature-webgpu={formatGpuFeatureValue(gpuDiagnosticsStatus, gpuDiagnostics?.featureStatus['webgpu'])}
      data-gpu-hardware-acceleration={formatGpuBooleanValue(gpuDiagnosticsStatus, gpuDiagnostics?.hardwareAccelerationEnabled)}
      data-gpu-info-error={gpuDiagnostics?.infoError ?? ''}
      data-last-fps={formatOptionalMetricNumber(renderMetrics.lastFps)}
      data-last-render-ms={formatOptionalMetricNumber(renderMetrics.lastRenderDurationMs)}
      data-ready={renderer !== 'initializing' ? 'true' : 'false'}
      data-renderer={renderer}
      data-selected-signal-id={selectedSignalId ?? ''}
      data-signal-count={data?.signals.length ?? 0}
      data-waveform-error={session.error ?? ''}
      data-waveform-empty-visible-signal-count={emptyVisibleSignalCount}
      data-interaction-frame-request-count={session.interactionFrameRequestCount}
      data-prepared-range-end={session.frame?.preparedRange?.endTime.toFixed(2) ?? ''}
      data-prepared-range-hit-count={session.preparedRangeHitCount}
      data-prepared-range-miss-count={session.preparedRangeMissCount}
      data-prepared-range-start={session.frame?.preparedRange?.startTime.toFixed(2) ?? ''}
      data-waveform-frame-request-count={session.frameRequestCount}
      data-waveform-frame-protocol-version={session.frame?.version ?? ''}
      data-waveform-frame-segment-count={session.frame?.segmentCount ?? 0}
      data-waveform-frame-truncated={String(session.frame?.truncated ?? false)}
      data-waveform-frame-version={session.frame?.version ?? ''}
      data-waveform-session-status={session.status}
      data-waveform-source={data?.source ?? ''}
      data-testid="waveform-panel"
      data-visible-window-end={activeViewport.endTime.toFixed(2)}
      data-visible-primitive-count={renderMetrics.visiblePrimitiveCount}
      data-visible-window-start={activeViewport.startTime.toFixed(2)}
      data-zoom={zoomLevel.toFixed(2)}
    >
      <div className="flex min-h-8 shrink-0 items-center gap-2 border-b border-ide-border bg-ide-tab-bg px-3 py-1.5" data-testid="waveform-toolbar">
        <div className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal size={13} className="text-ide-accent" />
          <span className="truncate text-[12px] font-medium text-ide-text">Waveform</span>
          <span className="hidden rounded border border-ide-border bg-ide-bg px-1.5 py-0.5 text-[10px] text-ide-text-muted sm:inline-flex">
            {data?.title ?? 'Loading'}
          </span>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <WaveformMetricInfo metrics={renderMetrics} />
          <WaveformCursorInfo
            cursorTime={cursorTime}
            signalName={selectedSignal?.name ?? '-'}
            timescaleUnit={data?.timescaleUnit ?? ''}
            value={formatWaveformValue(selectedValue)}
          />
          <div className="flex shrink-0 items-center gap-1" data-testid="waveform-toolbar-actions">
          <ToolbarIconButton label="Pan waveform left" onClick={handlePanLeft}>
            <ChevronLeft size={13} />
          </ToolbarIconButton>
          <ToolbarIconButton label="Pan waveform right" onClick={handlePanRight}>
            <ChevronRight size={13} />
          </ToolbarIconButton>
          <ToolbarIconButton label="Zoom in waveform" onClick={handleZoomIn} testId="waveform-zoom-in">
            <ZoomIn size={13} />
          </ToolbarIconButton>
          <ToolbarIconButton label="Zoom out waveform" onClick={handleZoomOut} testId="waveform-zoom-out">
            <ZoomOut size={13} />
          </ToolbarIconButton>
          <ToolbarIconButton label="Fit waveform" onClick={handleFit} testId="waveform-fit">
            <Maximize2 size={13} />
          </ToolbarIconButton>
          <ToolbarIconButton label="Reset waveform view" onClick={handleReset} testId="waveform-reset">
            <RotateCcw size={13} />
          </ToolbarIconButton>
          <ToolbarIconButton label="Waveform settings" onClick={() => setSettingsOpen((current) => !current)} testId="waveform-settings">
            <Settings2 size={13} />
          </ToolbarIconButton>
          </div>
        </div>
      </div>

      <ResizablePanelGroup orientation="horizontal" layoutGapPx={4} className="min-h-0 flex-1 overflow-hidden">
        <ResizablePanel defaultSize={10} minSizePx={160} maxSizePx={420} id="waveform-signal-list">
          <aside className="flex h-full min-w-0 flex-col border-r border-ide-border bg-ide-sidebar-bg">
            <div
              className="grid shrink-0 grid-cols-[minmax(0,1fr)_56px] items-end gap-2 border-b border-ide-border px-3 pb-1 text-[10px] font-medium uppercase leading-[14px] tracking-[0.08em] text-ide-text-muted"
              style={{ height: waveformHeaderHeight }}
            >
              <span>Signal</span>
              <span className="text-right">Value</span>
            </div>
            <div
              ref={signalScrollRef}
              className="bottom-panel-scrollbar min-h-0 flex-1 overflow-auto"
              onScroll={() => syncVerticalScroll(signalScrollRef.current)}
            >
              {displayRows.map((row) => (
                row.kind === 'group' ? (
                  <div
                    className="flex h-[30px] items-end border-b border-ide-border bg-ide-sidebar-bg/95 px-3 pb-1 text-[10px] font-medium uppercase leading-[14px] tracking-[0.08em] text-ide-text-muted"
                    data-lane-y={row.y.toFixed(2)}
                    data-row-index={row.rowIndex}
                    data-testid={`waveform-group-row-${row.group.id}`}
                    key={row.id}
                  >
                    {row.group.label}
                  </div>
                ) : (
                  <SignalRow
                    cursorTime={cursorTime}
                    data={data}
                    frame={session.frame}
                    key={row.id}
                    row={row}
                    selected={row.signal.id === selectedSignalId}
                    viewport={activeViewport}
                    onSelect={() => setSelectedSignalId(row.signal.id)}
                  />
                )
              ))}
            </div>
            <div aria-hidden="true" className="h-3 shrink-0 border-t border-ide-border bg-ide-sidebar-bg" data-testid="waveform-signal-list-bottom-spacer" />
          </aside>
        </ResizablePanel>

        <ResizableHandle
          className="bg-ide-border/80 hover:bg-ide-accent/70"
          data-testid="waveform-signal-list-resize-handle"
        />

        <ResizablePanel defaultSize={74} minSize={45} id="waveform-renderer">
          <main className="relative flex h-full w-full min-w-0 flex-1 flex-col bg-[#111111]">
            {settingsOpen && (
              <div className="absolute right-3 top-10 z-20 w-52 rounded border border-ide-border bg-ide-bg p-2 text-[11px] text-ide-text shadow-xl" data-testid="waveform-settings-popover">
                <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
                  <span className="text-ide-text-muted">Timescale</span>
                  <span>{data?.timescaleUnit ?? '-'}</span>
                  <span className="text-ide-text-muted">Window</span>
                  <span>{getWaveformViewportSpan(activeViewport).toFixed(0)}{data?.timescaleUnit ?? ''}</span>
                  <span className="text-ide-text-muted">Renderer</span>
                  <span className="uppercase">{renderer}</span>
                  <span className="text-ide-text-muted">HW accel</span>
                  <span data-testid="waveform-gpu-hardware-acceleration">{formatGpuBooleanValue(gpuDiagnosticsStatus, gpuDiagnostics?.hardwareAccelerationEnabled)}</span>
                  <span className="text-ide-text-muted">Compositing</span>
                  <span data-testid="waveform-gpu-compositing-status">{formatGpuFeatureValue(gpuDiagnosticsStatus, gpuDiagnostics?.featureStatus['gpu_compositing'])}</span>
                  <span className="text-ide-text-muted">Electron WebGPU</span>
                  <span data-testid="waveform-gpu-webgpu-status">{formatGpuFeatureValue(gpuDiagnosticsStatus, gpuDiagnostics?.featureStatus['webgpu'])}</span>
                  <span className="text-ide-text-muted">Electron WebGL</span>
                  <span data-testid="waveform-gpu-webgl-status">{formatGpuFeatureValue(gpuDiagnosticsStatus, gpuDiagnostics?.featureStatus['webgl'])}</span>
                  <span className="text-ide-text-muted">Browser WebGPU</span>
                  <span data-testid="waveform-browser-webgpu-status">{formatRendererSupportValue(rendererGpuSupport.webgpu)}</span>
                  <span className="text-ide-text-muted">Browser WebGL2</span>
                  <span data-testid="waveform-browser-webgl2-status">{formatRendererSupportValue(rendererGpuSupport.webgl2)}</span>
                  <span className="text-ide-text-muted">Active GPU(s)</span>
                  <span data-testid="waveform-gpu-active-device-count">{getElectronGpuDeviceCount(gpuDiagnostics)}</span>
                  {gpuDiagnostics?.infoError && (
                    <>
                      <span className="text-ide-text-muted">GPU info</span>
                      <span data-testid="waveform-gpu-info-error">{gpuDiagnostics.infoError}</span>
                    </>
                  )}
                </div>
              </div>
            )}
            <div ref={waveformViewportRef} className="relative min-h-0 w-full flex-1 overflow-hidden" data-testid="waveform-viewport">
              {canRenderWaveformCanvas && data ? (
                <WaveformCanvas
                  cursorTime={cursorTime}
                  data={data}
                  frame={session.frame}
                  interactionFrameRequestCount={session.interactionFrameRequestCount}
                  preparedRangeHitCount={session.preparedRangeHitCount}
                  preparedRangeMissCount={session.preparedRangeMissCount}
                  selectedSignalId={selectedSignalId}
                  verticalScrollTop={verticalScrollTop}
                  viewport={activeViewport}
                  onCursorTimeChange={setCursorTime}
                  onMetricsChange={setRenderMetrics}
                  onRendererChange={setRenderer}
                  onVerticalScrollDelta={handleCanvasVerticalScrollDelta}
                  onViewportChange={(nextViewport) => setViewport(nextViewport)}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[12px] text-ide-text-muted" data-testid="waveform-loading-state">
                  {loadingMessage}
                </div>
              )}
            </div>
            <div
              ref={horizontalScrollRef}
              className="bottom-panel-scrollbar h-3 shrink-0 overflow-x-auto overflow-y-hidden border-t border-ide-border bg-[#0c0c0c]"
              data-horizontal-content-width={horizontalMetrics.contentWidth.toFixed(2)}
              data-horizontal-scroll-left={horizontalMetrics.scrollLeft.toFixed(2)}
              data-horizontal-scroll-range={horizontalMetrics.maxScrollLeft.toFixed(2)}
              data-testid="waveform-horizontal-scrollbar"
              onScroll={handleHorizontalScroll}
            >
              <div aria-hidden="true" className="h-px" style={{ width: horizontalMetrics.contentWidth }} />
            </div>
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

interface SignalRowProps {
  cursorTime: number;
  data: ReturnType<typeof useWaveformSession>['data'];
  frame: ReturnType<typeof useWaveformSession>['frame'];
  row: WaveformSignalDisplayRow;
  selected: boolean;
  viewport: WaveformViewport;
  onSelect: () => void;
}

function SignalRow({ cursorTime, data, frame, selected, row, viewport, onSelect }: SignalRowProps) {
  const signal = row.signal;
  const value = getSignalDisplayValue(frame, data, signal, cursorTime, viewport);

  return (
    <button
      className={`grid h-[30px] w-full grid-cols-[minmax(0,1fr)_56px] items-end gap-2 border-b border-ide-border/70 px-3 pb-1 text-left text-[11px] leading-[14px] transition-colors ${selected ? 'bg-ide-accent/15 text-ide-text' : 'text-ide-text-muted hover:bg-ide-tab-hover hover:text-ide-text'}`}
      data-lane-y={row.y.toFixed(2)}
      data-row-index={row.rowIndex}
      data-testid={getWaveformSignalTestId(signal.id)}
      type="button"
      onClick={onSelect}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: signal.color }} />
        <span className="flex min-w-0 items-center gap-2" data-testid={`waveform-signal-primary-${signal.id}`}>
          <span className="min-w-0 truncate font-mono leading-[14px]">{signal.name}</span>
          {signal.width && (
            <span className="inline-flex h-[14px] shrink-0 items-center rounded border border-ide-border px-1 text-[10px] leading-none text-ide-text-muted">
              [{signal.width - 1}:0]
            </span>
          )}
        </span>
      </span>
      <span
        className="flex h-[14px] min-w-0 items-end justify-end text-right font-mono text-ide-text"
        data-testid={`waveform-signal-value-${signal.id}`}
      >
        <span className="min-w-0 max-w-full truncate leading-none">{formatWaveformValue(value)}</span>
      </span>
    </button>
  );
}

interface WaveformCursorInfoProps {
  cursorTime: number;
  signalName: string;
  timescaleUnit: string;
  value: string;
}

interface WaveformMetricInfoProps {
  metrics: WaveformRenderMetrics;
}

function WaveformMetricInfo({ metrics }: WaveformMetricInfoProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-3 rounded border border-ide-border bg-ide-bg/90 px-2 py-1 text-[11px] text-ide-text shadow-sm"
      data-testid="waveform-toolbar-metrics"
    >
      <div className="flex items-center gap-1" data-testid="waveform-toolbar-metrics-render">
        <span className="text-ide-text-muted">Render</span>
        <span className="font-mono text-ide-text" data-testid="waveform-toolbar-metrics-render-last">{formatMetricValue(metrics.lastRenderDurationMs, 1)}</span>
        <span className="text-ide-text-muted">/</span>
        <span className="font-mono text-ide-accent" data-testid="waveform-toolbar-metrics-render-avg">{formatMetricValue(metrics.averageRenderDurationMs, 1)}</span>
        <span className="text-ide-text-muted">ms</span>
      </div>
      <div className="flex items-center gap-1" data-testid="waveform-toolbar-metrics-fps">
        <span className="text-ide-text-muted">FPS</span>
        <span className="font-mono text-ide-text" data-testid="waveform-toolbar-metrics-fps-last">{formatMetricValue(metrics.lastFps, 1)}</span>
        <span className="text-ide-text-muted">/</span>
        <span className="font-mono text-ide-accent" data-testid="waveform-toolbar-metrics-fps-avg">{formatMetricValue(metrics.averageFps, 1)}</span>
      </div>
      <div className="flex items-center gap-1" data-testid="waveform-toolbar-metrics-primitives">
        <span className="text-ide-text-muted">Prim</span>
        <span className="font-mono text-ide-accent" data-testid="waveform-toolbar-metrics-primitives-value">{metrics.visiblePrimitiveCount}</span>
      </div>
    </div>
  );
}

function WaveformCursorInfo({ cursorTime, signalName, timescaleUnit, value }: WaveformCursorInfoProps) {
  return (
    <div
      className="flex min-w-0 max-w-[360px] items-center gap-2 rounded border border-ide-border bg-ide-bg/90 px-2 py-1 text-[11px] text-ide-text shadow-sm"
      data-testid="waveform-toolbar-cursor-info"
    >
      <MousePointer2 size={12} className="shrink-0 text-ide-accent" />
      <span className="shrink-0" data-testid="waveform-toolbar-cursor-time">{cursorTime.toFixed(1)}{timescaleUnit}</span>
      <span className="min-w-0 truncate text-ide-text-muted" data-testid="waveform-toolbar-cursor-signal">{signalName}</span>
      <span className="shrink-0 font-mono text-ide-accent" data-testid="waveform-toolbar-cursor-value">{value}</span>
    </div>
  );
}

interface ToolbarIconButtonProps {
  children: ReactNode;
  label: string;
  testId?: string;
  onClick: () => void;
}

function ToolbarIconButton({ children, label, testId, onClick }: ToolbarIconButtonProps) {
  return (
    <TooltipIconButton content={label}>
      <Button
        aria-label={label}
        className="text-ide-text-muted hover:text-ide-text"
        data-testid={testId}
        size="icon-xs"
        type="button"
        variant="ghost"
        onClick={onClick}
      >
        {children}
      </Button>
    </TooltipIconButton>
  );
}

function createEmptyWaveformRenderMetrics(): WaveformRenderMetrics {
  return {
    lastRenderDurationMs: null,
    averageRenderDurationMs: null,
    lastFps: null,
    averageFps: null,
    visiblePrimitiveCount: 0,
  };
}

function formatMetricValue(value: number | null, digits: number) {
  return value === null ? '--' : value.toFixed(digits);
}

function formatOptionalMetricNumber(value: number | null) {
  return value === null ? '' : value.toFixed(2);
}

function detectRendererGpuSupport(): RendererGpuSupportDiagnostics {
  if (typeof document === 'undefined') {
    return { webgpu: false, webgl2: false, webgl: false };
  }

  const canvas = document.createElement('canvas');
  const maybeNavigator = navigator as Navigator & { gpu?: unknown };

  return {
    webgpu: typeof maybeNavigator.gpu !== 'undefined',
    webgl2: tryGetCanvasContext(canvas, 'webgl2'),
    webgl: tryGetCanvasContext(canvas, 'webgl') || tryGetCanvasContext(canvas, 'experimental-webgl'),
  };
}

function tryGetCanvasContext(canvas: HTMLCanvasElement, contextId: 'experimental-webgl' | 'webgl' | 'webgl2') {
  try {
    return canvas.getContext(contextId) !== null;
  } catch {
    return false;
  }
}

function formatGpuBooleanValue(status: 'pending' | 'ready' | 'unavailable', value: boolean | undefined) {
  if (status === 'pending') {
    return 'pending';
  }

  if (status === 'unavailable' || typeof value === 'undefined') {
    return 'unavailable';
  }

  return value ? 'true' : 'false';
}

function formatGpuFeatureValue(status: 'pending' | 'ready' | 'unavailable', value: string | undefined) {
  if (status === 'pending') {
    return 'pending';
  }

  if (status === 'unavailable') {
    return 'unavailable';
  }

  return value ?? 'unknown';
}

function formatRendererSupportValue(value: boolean) {
  return value ? 'available' : 'unavailable';
}

function getElectronGpuDeviceCount(gpuDiagnostics: ElectronGpuDiagnostics | null) {
  const gpuDevice = gpuDiagnostics?.info && 'gpuDevice' in gpuDiagnostics.info
    ? gpuDiagnostics.info.gpuDevice
    : null;

  return Array.isArray(gpuDevice) ? gpuDevice.length : 0;
}

function getSignalValueFromFrame(
  frame: ReturnType<typeof useWaveformSession>['frame'],
  data: ReturnType<typeof useWaveformSession>['data'],
  signalId: string,
  cursorTime: number,
  viewport: WaveformViewport,
) {
  if (!frame || !data) {
    return null;
  }

  const signalIndex = data.signals.findIndex((signal) => signal.id === signalId);
  if (signalIndex < 0) {
    return null;
  }

  const tableEntry = getFrameSignalTableEntry(frame, signalIndex);
  if (!tableEntry || tableEntry.segmentCount === 0) {
    return null;
  }

  const xRange = getFrameSignalXRange(frame, tableEntry.firstSegment, tableEntry.segmentCount);
  const viewportSpan = Math.max(1, getWaveformViewportSpan(viewport));
  const relativeTime = Math.min(1, Math.max(0, (cursorTime - viewport.startTime) / viewportSpan));
  const cursorX = xRange.minX + relativeTime * Math.max(1, xRange.maxX - xRange.minX);
  const end = Math.min(frame.segmentCount, tableEntry.firstSegment + tableEntry.segmentCount);

  for (let index = tableEntry.firstSegment; index < end; index += 1) {
    const x0 = frame.x0[index] ?? 0;
    const x1 = frame.x1[index] ?? x0;
    const left = Math.min(x0, x1);
    const right = Math.max(x0, x1);
    const isLastSegment = index === end - 1;

    if (cursorX >= left && (cursorX < right || isLastSegment)) {
      return getFrameValue(frame, index);
    }
  }

  return null;
}

function getSignalDisplayValue(
  frame: ReturnType<typeof useWaveformSession>['frame'],
  data: WaveformDataSet | null,
  signal: WaveformSignal,
  cursorTime: number,
  viewport: WaveformViewport,
) {
  const frameValue = getSignalValueFromFrame(frame, data, signal.id, cursorTime, viewport);

  if (frameValue !== null) {
    return frameValue;
  }

  return data?.source === 'lsp-binary' ? '-' : getSignalValueAtTime(signal, cursorTime);
}

function getWaveformEmptyVisibleSignalCount(frame: ParsedWaveformFrame | null) {
  if (!frame) {
    return 0;
  }

  let emptySignalCount = 0;

  for (let tableEntryIndex = 0; tableEntryIndex < frame.signalCount; tableEntryIndex += 1) {
    const segmentCount = frame.signalTable[tableEntryIndex * waveformBinaryFrameSignalTableStride + 2] ?? 0;
    if (segmentCount === 0) {
      emptySignalCount += 1;
    }
  }

  return emptySignalCount;
}

function getFrameSignalTableEntry(frame: NonNullable<ReturnType<typeof useWaveformSession>['frame']>, signalIndex: number) {
  for (let tableEntryIndex = 0; tableEntryIndex < frame.signalCount; tableEntryIndex += 1) {
    const tableIndex = tableEntryIndex * waveformBinaryFrameSignalTableStride;
    if (frame.signalTable[tableIndex] !== signalIndex) {
      continue;
    }

    const firstSegment = frame.signalTable[tableIndex + 1];
    const segmentCount = frame.signalTable[tableIndex + 2];
    if (firstSegment === undefined || segmentCount === undefined) {
      return null;
    }

    return { firstSegment, segmentCount };
  }

  return null;
}

function getFrameSignalXRange(frame: NonNullable<ReturnType<typeof useWaveformSession>['frame']>, firstSegment: number, segmentCount: number) {
  const end = Math.min(frame.segmentCount, firstSegment + segmentCount);
  let minX = Number.POSITIVE_INFINITY;
  let maxX = 0;

  for (let index = firstSegment; index < end; index += 1) {
    minX = Math.min(minX, frame.x0[index] ?? 0);
    maxX = Math.max(maxX, frame.x1[index] ?? 0);
  }

  return {
    maxX: Math.max(1, maxX),
    minX: Number.isFinite(minX) ? minX : 0,
  };
}

function getFrameValue(frame: NonNullable<ReturnType<typeof useWaveformSession>['frame']>, segmentIndex: number) {
  const valueKind = frame.valueKind[segmentIndex];

  if (valueKind === WaveformBinaryValueKind.Low) {
    return '0';
  }

  if (valueKind === WaveformBinaryValueKind.High) {
    return '1';
  }

  if (valueKind === WaveformBinaryValueKind.Unknown) {
    return 'x';
  }

  if (valueKind === WaveformBinaryValueKind.HighImpedance) {
    return 'z';
  }

  return frame.getLabel(segmentIndex) ?? '0';
}
