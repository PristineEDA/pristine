import { useEffect, useMemo, useRef, useState } from 'react';

import { parseWaveformBinaryFrame, type ParsedWaveformFrame } from './waveformBinaryFrame';
import {
  getWaveformDisplayRows,
  getVisibleWaveformRows,
  waveformHeaderHeight,
  waveformLaneHeight,
} from './waveformLayout';
import type { WaveformDataSet, WaveformSignalKind, WaveformViewport } from './waveformTypes';

type WaveformLspApi = NonNullable<typeof window.electronAPI>['lsp'];

export interface WaveformSessionState {
  data: WaveformDataSet | null;
  error: string | null;
  frame: ParsedWaveformFrame | null;
  frameRequestCount: number;
  loading: boolean;
  sessionId: string | null;
  status: 'loading' | 'ready' | 'error' | 'unavailable';
}

interface UseWaveformSessionOptions {
  canvasHeight: number;
  canvasWidth: number;
  viewport: WaveformViewport | null;
  verticalScrollTop: number;
}

export function useWaveformSession({
  canvasHeight,
  canvasWidth,
  viewport,
  verticalScrollTop,
}: UseWaveformSessionOptions): WaveformSessionState {
  const [state, setState] = useState<WaveformSessionState>({
    data: null,
    error: null,
    frame: null,
    frameRequestCount: 0,
    loading: true,
    sessionId: null,
    status: 'loading',
  });
  const requestIdRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const lsp = window.electronAPI?.lsp;
    if (!lsp?.waveformOpen || !lsp.waveformClose) {
      setState({
        data: null,
        error: 'Waveform LSP client is unavailable.',
        frame: null,
        frameRequestCount: 0,
        loading: false,
        sessionId: null,
        status: 'unavailable',
      });
      return;
    }

    let cancelled = false;

    setState((current) => ({
      ...current,
      error: null,
      loading: true,
      status: 'loading',
    }));

    void lsp.waveformOpen().then((result) => {
      if (cancelled) {
        void lsp.waveformClose(result.sessionId).catch(() => undefined);
        return;
      }

      const data = mapWaveformOpenResult(result);
      sessionIdRef.current = result.sessionId;
      setState((current) => ({
        ...current,
        data,
        error: null,
        loading: false,
        sessionId: result.sessionId,
        status: 'ready',
      }));
    }).catch((error: unknown) => {
      if (cancelled) {
        return;
      }

      setState({
        data: null,
        error: error instanceof Error ? error.message : String(error),
        frame: null,
        frameRequestCount: 0,
        loading: false,
        sessionId: null,
        status: 'error',
      });
    });

    return () => {
      cancelled = true;
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;

      if (sessionId) {
        void lsp.waveformClose(sessionId).catch(() => undefined);
      }
    };
  }, []);

  const frameRequest = useMemo(() => {
    if (!state.data || !state.sessionId || !viewport || canvasWidth <= 0 || canvasHeight <= 0) {
      return null;
    }

    const rows = getWaveformDisplayRows(state.data);
    const visibleRows = getVisibleWaveformRows(rows, verticalScrollTop, canvasHeight).rows
      .filter((row) => row.kind === 'signal')
      .map((row) => row.signal.id);

    return {
      endTime: viewport.endTime,
      headerHeight: waveformHeaderHeight,
      height: canvasHeight,
      laneHeight: waveformLaneHeight,
      maxSegments: Math.max(512, visibleRows.length * 96),
      sessionId: state.sessionId,
      signalIds: visibleRows,
      startTime: viewport.startTime,
      width: canvasWidth,
    };
  }, [canvasHeight, canvasWidth, state.data, state.sessionId, verticalScrollTop, viewport]);

  useEffect(() => {
    const lsp = window.electronAPI?.lsp;
    if (!frameRequest || !lsp?.waveformFrame) {
      return;
    }

    let cancelled = false;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    void lsp.waveformFrame(frameRequest).then((buffer) => {
      if (cancelled || requestId !== requestIdRef.current) {
        return;
      }

      const frame = parseWaveformBinaryFrame(buffer);
      setState((current) => ({
        ...current,
        frame,
        frameRequestCount: current.frameRequestCount + 1,
      }));
    }).catch((error: unknown) => {
      if (cancelled || requestId !== requestIdRef.current) {
        return;
      }

      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : String(error),
        frame: null,
        status: 'error',
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [frameRequest]);

  return state;
}

function mapWaveformOpenResult(result: Awaited<ReturnType<WaveformLspApi['waveformOpen']>>): WaveformDataSet {
  return {
    id: result.id ?? result.sessionId,
    title: result.title,
    timescaleUnit: result.timescaleUnit,
    duration: result.duration,
    cursorTime: result.cursorTime,
    source: 'lsp-binary',
    groups: result.groups,
    signals: result.signals.map((signal) => ({
      id: signal.id,
      groupId: signal.groupId,
      name: signal.name,
      path: signal.path,
      kind: signal.kind as WaveformSignalKind,
      color: signal.color,
      width: signal.width,
    })),
  };
}
