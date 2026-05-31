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
  zoomWaveformViewport,
} from './waveformLayout';
import { mockWaveformData } from './waveformMockData';
import type { WaveformRendererStatus, WaveformViewport } from './waveformTypes';
import type { WaveformSignalDisplayRow } from './waveformLayout';
import { WaveformCanvas } from './WaveformCanvas';

const zoomButtonFactor = 1.35;

export function WaveformPanel() {
  const data = mockWaveformData;
  const [viewport, setViewport] = useState<WaveformViewport>(() => getInitialWaveformViewport(data));
  const [cursorTime, setCursorTime] = useState(data.cursorTime);
  const [renderer, setRenderer] = useState<WaveformRendererStatus>('initializing');
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(data.signals[0]?.id ?? null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const signalScrollRef = useRef<HTMLDivElement | null>(null);
  const waveformViewportRef = useRef<HTMLDivElement | null>(null);
  const horizontalScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
  const syncingHorizontalScrollRef = useRef(false);
  const [verticalScrollTop, setVerticalScrollTop] = useState(0);
  const [waveformViewportWidth, setWaveformViewportWidth] = useState(0);
  const selectedSignal = useMemo(
    () => data.signals.find((signal) => signal.id === selectedSignalId) ?? data.signals[0] ?? null,
    [data.signals, selectedSignalId],
  );
  const displayRows = useMemo(() => getWaveformDisplayRows(data), [data]);
  const selectedValue = selectedSignal ? getSignalValueAtTime(selectedSignal, cursorTime) : '-';
  const zoomLevel = data.duration / getWaveformViewportSpan(viewport);
  const waveformCanvasHeight = getWaveformCanvasHeightForData(data);
  const horizontalMetrics = getWaveformHorizontalScrollMetrics(viewport, data.duration, waveformViewportWidth);

  useEffect(() => {
    const viewportElement = waveformViewportRef.current;

    if (!viewportElement) {
      return;
    }

    function updateWidth() {
      setWaveformViewportWidth(Math.max(0, Math.floor(viewportElement?.clientWidth ?? 0)));
    }

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(updateWidth);
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
    setViewport((currentViewport) => zoomWaveformViewport(currentViewport, cursorTime, zoomButtonFactor, data.duration));
  }

  function handleZoomOut() {
    setViewport((currentViewport) => zoomWaveformViewport(currentViewport, cursorTime, 1 / zoomButtonFactor, data.duration));
  }

  function handlePanLeft() {
    setViewport((currentViewport) => panWaveformViewport(currentViewport, -getWaveformViewportSpan(currentViewport) * 0.18, data.duration));
  }

  function handlePanRight() {
    setViewport((currentViewport) => panWaveformViewport(currentViewport, getWaveformViewportSpan(currentViewport) * 0.18, data.duration));
  }

  function handleFit() {
    setViewport(fitWaveformViewport(data));
    setCursorTime(data.cursorTime);
  }

  function handleReset() {
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

    setViewport(getWaveformViewportForHorizontalScroll(viewport, data.duration, waveformViewportWidth, horizontalScrollElement.scrollLeft));
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
      data-cursor-time={cursorTime.toFixed(2)}
      data-ready={renderer !== 'initializing' ? 'true' : 'false'}
      data-renderer={renderer}
      data-selected-signal-id={selectedSignalId ?? ''}
      data-signal-count={data.signals.length}
      data-testid="waveform-panel"
      data-visible-window-end={viewport.endTime.toFixed(2)}
      data-visible-window-start={viewport.startTime.toFixed(2)}
      data-zoom={zoomLevel.toFixed(2)}
    >
      <div className="flex min-h-8 shrink-0 items-center gap-2 border-b border-ide-border bg-ide-tab-bg px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal size={13} className="text-ide-accent" />
          <span className="truncate text-[12px] font-medium text-ide-text">Waveform</span>
          <span className="hidden rounded border border-ide-border bg-ide-bg px-1.5 py-0.5 text-[10px] text-ide-text-muted sm:inline-flex">
            {data.title}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
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

      <ResizablePanelGroup orientation="horizontal" layoutGapPx={4} className="min-h-0 flex-1 overflow-hidden">
        <ResizablePanel defaultSize={12} minSizePx={160} maxSizePx={420} id="waveform-signal-list">
          <aside className="flex h-full min-w-0 flex-col border-r border-ide-border bg-ide-sidebar-bg">
            <div className="grid h-[30px] shrink-0 grid-cols-[minmax(0,1fr)_56px] items-end gap-2 border-b border-ide-border px-3 pb-[5px] text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-ide-text-muted">
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
                    className="flex h-[30px] items-end border-b border-ide-border bg-ide-sidebar-bg/95 px-3 pb-[5px] text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-ide-text-muted"
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
                    key={row.id}
                    row={row}
                    selected={row.signal.id === selectedSignalId}
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
            <div className="pointer-events-none absolute right-3 top-2 z-10 flex max-w-[52%] items-center gap-2 rounded border border-ide-border bg-ide-bg/90 px-2 py-1 text-[11px] text-ide-text shadow-sm">
              <MousePointer2 size={12} className="text-ide-accent" />
              <span className="truncate">{cursorTime.toFixed(1)}{data.timescaleUnit}</span>
              <span className="text-ide-text-muted">{selectedSignal?.name ?? '-'}</span>
              <span className="font-mono text-ide-accent">{formatWaveformValue(selectedValue)}</span>
            </div>
            {settingsOpen && (
              <div className="absolute right-3 top-10 z-20 w-52 rounded border border-ide-border bg-ide-bg p-2 text-[11px] text-ide-text shadow-xl" data-testid="waveform-settings-popover">
                <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
                  <span className="text-ide-text-muted">Timescale</span>
                  <span>{data.timescaleUnit}</span>
                  <span className="text-ide-text-muted">Window</span>
                  <span>{getWaveformViewportSpan(viewport).toFixed(0)}{data.timescaleUnit}</span>
                  <span className="text-ide-text-muted">Renderer</span>
                  <span className="uppercase">{renderer}</span>
                </div>
              </div>
            )}
            <div ref={waveformViewportRef} className="relative min-h-0 w-full flex-1 overflow-hidden" data-testid="waveform-viewport">
              <WaveformCanvas
                cursorTime={cursorTime}
                data={data}
                selectedSignalId={selectedSignalId}
                verticalScrollTop={verticalScrollTop}
                viewport={viewport}
                onCursorTimeChange={setCursorTime}
                onRendererChange={setRenderer}
                onVerticalScrollDelta={handleCanvasVerticalScrollDelta}
                onViewportChange={setViewport}
              />
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
  row: WaveformSignalDisplayRow;
  selected: boolean;
  onSelect: () => void;
}

function SignalRow({ cursorTime, selected, row, onSelect }: SignalRowProps) {
  const signal = row.signal;
  const value = getSignalValueAtTime(signal, cursorTime);

  return (
    <button
      className={`grid h-[30px] w-full grid-cols-[minmax(0,1fr)_56px] items-end gap-2 border-b border-ide-border/70 px-3 pb-[5px] text-left text-[11px] leading-none transition-colors ${selected ? 'bg-ide-accent/15 text-ide-text' : 'text-ide-text-muted hover:bg-ide-tab-hover hover:text-ide-text'}`}
      data-lane-y={row.y.toFixed(2)}
      data-row-index={row.rowIndex}
      data-testid={getWaveformSignalTestId(signal.id)}
      type="button"
      onClick={onSelect}
    >
      <span className="flex min-w-0 items-baseline gap-2 leading-[11px]">
        <span className="mb-px h-2 w-2 shrink-0 self-end rounded-sm" style={{ backgroundColor: signal.color }} />
        <span className="min-w-0 truncate font-mono leading-[11px]">{signal.name}</span>
        {signal.width && <span className="shrink-0 translate-y-px rounded border border-ide-border px-1 text-[10px] leading-[10px] text-ide-text-muted">[{signal.width - 1}:0]</span>}
      </span>
      <span className="min-w-0 truncate text-right font-mono leading-[11px] text-ide-text">{formatWaveformValue(value)}</span>
    </button>
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
