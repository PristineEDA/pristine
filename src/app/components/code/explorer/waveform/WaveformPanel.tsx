import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, MousePointer2, RotateCcw, Settings2, SlidersHorizontal, ZoomIn, ZoomOut } from 'lucide-react';

import { Button } from '../../../ui/button';
import { TooltipIconButton } from '../../../ui/tooltip-icon-button';
import {
  fitWaveformViewport,
  formatWaveformValue,
  getWaveformDisplayRows,
  getInitialWaveformViewport,
  getSignalValueAtTime,
  getWaveformSignalTestId,
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
  const waveformScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
  const selectedSignal = useMemo(
    () => data.signals.find((signal) => signal.id === selectedSignalId) ?? data.signals[0] ?? null,
    [data.signals, selectedSignalId],
  );
  const displayRows = useMemo(() => getWaveformDisplayRows(data), [data]);
  const selectedValue = selectedSignal ? getSignalValueAtTime(selectedSignal, cursorTime) : '-';
  const zoomLevel = data.duration / getWaveformViewportSpan(viewport);

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

  function syncVerticalScroll(source: HTMLDivElement | null, target: HTMLDivElement | null) {
    if (!source || !target || syncingScrollRef.current) {
      return;
    }

    syncingScrollRef.current = true;
    target.scrollTop = source.scrollTop;
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[280px] min-w-[220px] max-w-[38%] shrink-0 flex-col border-r border-ide-border bg-ide-sidebar-bg">
          <div className="grid h-[30px] shrink-0 grid-cols-[1fr_56px] items-center border-b border-ide-border px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-ide-text-muted">
            <span>Signal</span>
            <span className="text-right">Value</span>
          </div>
          <div
            ref={signalScrollRef}
            className="bottom-panel-scrollbar min-h-0 flex-1 overflow-auto"
            onScroll={() => syncVerticalScroll(signalScrollRef.current, waveformScrollRef.current)}
          >
            {displayRows.map((row) => (
              row.kind === 'group' ? (
                <div
                  className="flex h-[30px] items-center border-b border-ide-border bg-ide-sidebar-bg/95 px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-ide-text-muted"
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
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col bg-[#111111]">
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
          <div
            ref={waveformScrollRef}
            className="bottom-panel-scrollbar min-h-0 flex-1 overflow-auto"
            onScroll={() => syncVerticalScroll(waveformScrollRef.current, signalScrollRef.current)}
          >
            <WaveformCanvas
              cursorTime={cursorTime}
              data={data}
              selectedSignalId={selectedSignalId}
              viewport={viewport}
              onCursorTimeChange={setCursorTime}
              onRendererChange={setRenderer}
              onViewportChange={setViewport}
            />
          </div>
        </main>
      </div>
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
      className={`grid h-[30px] w-full grid-cols-[1fr_56px] items-center gap-2 border-b border-ide-border/70 px-3 text-left text-[11px] transition-colors ${selected ? 'bg-ide-accent/15 text-ide-text' : 'text-ide-text-muted hover:bg-ide-tab-hover hover:text-ide-text'}`}
      data-lane-y={row.y.toFixed(2)}
      data-row-index={row.rowIndex}
      data-testid={getWaveformSignalTestId(signal.id)}
      type="button"
      onClick={onSelect}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: signal.color }} />
        <span className="min-w-0 truncate font-mono">{signal.name}</span>
        {signal.width && <span className="shrink-0 rounded border border-ide-border px-1 text-[10px] text-ide-text-muted">[{signal.width - 1}:0]</span>}
      </span>
      <span className="truncate text-right font-mono text-ide-text">{formatWaveformValue(value)}</span>
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
