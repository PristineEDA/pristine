import { useEffect, useMemo, useRef, useState } from 'react';

import {
  parseWaveformBinaryFrame,
  waveformBinaryFrameSignalTableStride,
  waveformBinaryFrameVersionV2,
  type ParsedWaveformFrame,
} from './waveformBinaryFrame';
import {
  getInitialWaveformViewport,
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
  frameParseMs: number;
  frameRequestCount: number;
  interactionFrameRequestCount: number;
  loading: boolean;
  pipeRoundtripMs: number;
  preparedRangeHitCount: number;
  preparedRangeMissCount: number;
  sessionId: string | null;
  status: 'loading' | 'ready' | 'error' | 'unavailable';
}

type WaveformFrameRequest =
  | { covered: true; key: string }
  | {
    covered: false;
    endTime: number;
    headerHeight: number;
    height: number;
    laneHeight: number;
    maxSegments: number;
    preparedEndTime: number;
    preparedStartTime: number;
    protocolVersion: 2;
    sessionId: string;
    signalIds: string[];
    startTime: number;
    viewportEndTime: number;
    viewportStartTime: number;
    width: number;
  };

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
    frameParseMs: 0,
    frameRequestCount: 0,
    interactionFrameRequestCount: 0,
    loading: true,
    pipeRoundtripMs: 0,
    preparedRangeHitCount: 0,
    preparedRangeMissCount: 0,
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
        frameParseMs: 0,
        frameRequestCount: 0,
        interactionFrameRequestCount: 0,
        loading: false,
        pipeRoundtripMs: 0,
        preparedRangeHitCount: 0,
        preparedRangeMissCount: 0,
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
        frame: null,
        frameParseMs: 0,
        frameRequestCount: 0,
        interactionFrameRequestCount: 0,
        loading: false,
        pipeRoundtripMs: 0,
        preparedRangeHitCount: 0,
        preparedRangeMissCount: 0,
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
        frameParseMs: 0,
        frameRequestCount: 0,
        interactionFrameRequestCount: 0,
        loading: false,
        pipeRoundtripMs: 0,
        preparedRangeHitCount: 0,
        preparedRangeMissCount: 0,
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

  const requestViewport = useMemo(() => {
    if (!state.data) {
      return null;
    }

    return viewport ?? getInitialWaveformViewport(state.data);
  }, [state.data, viewport]);

  const frameRequest = useMemo<WaveformFrameRequest | null>(() => {
    if (!state.data || !state.sessionId || !requestViewport || canvasWidth <= 0 || canvasHeight <= 0) {
      return null;
    }

    const rows = getWaveformDisplayRows(state.data);
    const visibleSignalRows = getVisibleWaveformRows(rows, verticalScrollTop, canvasHeight).rows
      .filter((row) => row.kind === 'signal')
      .map((row) => ({ id: row.signal.id, signalIndex: row.signalIndex }));
    const visibleSignalIds = visibleSignalRows.map((row) => row.id);

    if (
      state.frame?.version === waveformBinaryFrameVersionV2
      && state.frame.preparedRange
      && isViewportInsidePreparedRange(requestViewport, state.frame.preparedRange)
      && doesFrameCoverVisibleRows(state.frame, visibleSignalRows.map((row) => row.signalIndex))
    ) {
      return {
        covered: true,
        key: [
          state.sessionId,
          requestViewport.startTime.toFixed(6),
          requestViewport.endTime.toFixed(6),
          canvasWidth,
          canvasHeight,
          verticalScrollTop.toFixed(2),
          visibleSignalIds.join(','),
        ].join('|'),
      };
    }

    const preparedRange = getPreparedWaveformRange(state.data, requestViewport);

    return {
      covered: false,
      endTime: preparedRange.endTime,
      headerHeight: waveformHeaderHeight,
      height: canvasHeight,
      laneHeight: waveformLaneHeight,
      maxSegments: 0,
      preparedEndTime: preparedRange.endTime,
      preparedStartTime: preparedRange.startTime,
      protocolVersion: 2,
      sessionId: state.sessionId,
      signalIds: visibleSignalIds,
      startTime: preparedRange.startTime,
      viewportEndTime: requestViewport.endTime,
      viewportStartTime: requestViewport.startTime,
      width: canvasWidth,
    };
  }, [
    canvasHeight,
    canvasWidth,
    requestViewport?.endTime,
    requestViewport?.startTime,
    state.data,
    state.frame,
    state.sessionId,
    verticalScrollTop,
  ]);

  const coveredFrameRequestKey = frameRequest?.covered ? frameRequest.key : null;

  useEffect(() => {
    if (coveredFrameRequestKey) {
      setState((current) => ({
        ...current,
        preparedRangeHitCount: current.preparedRangeHitCount + 1,
      }));
    }
  }, [coveredFrameRequestKey]);

  useEffect(() => {
    const lsp = window.electronAPI?.lsp;
    if (!frameRequest || frameRequest.covered || !lsp?.waveformFrame) {
      return;
    }

    let cancelled = false;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const requestStartedAt = performance.now();

    void lsp.waveformFrame(frameRequest).then((buffer) => {
      if (cancelled || requestId !== requestIdRef.current) {
        return;
      }

      const pipeRoundtripMs = Math.max(0, performance.now() - requestStartedAt);
      const parseStartedAt = performance.now();
      const frame = parseWaveformBinaryFrame(buffer);
      const frameParseMs = Math.max(0, performance.now() - parseStartedAt);
      setState((current) => ({
        ...current,
        frame,
        frameParseMs,
        frameRequestCount: current.frameRequestCount + 1,
        interactionFrameRequestCount: current.interactionFrameRequestCount + 1,
        pipeRoundtripMs,
        preparedRangeMissCount: current.preparedRangeMissCount + 1,
      }));
    }).catch((error: unknown) => {
      if (cancelled || requestId !== requestIdRef.current) {
        return;
      }

      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : String(error),
        status: 'error',
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [frameRequest]);

  return state;
}

function getPreparedWaveformRange(data: WaveformDataSet, viewport: WaveformViewport): WaveformViewport {
  const span = Math.max(1, viewport.endTime - viewport.startTime);
  const duration = Math.max(span, data.duration);
  const requestedSpan = Math.min(duration, span * 6);

  if (requestedSpan >= duration) {
    return { startTime: 0, endTime: duration };
  }

  const centerTime = viewport.startTime + span / 2;
  const startTime = Math.max(0, Math.min(duration - requestedSpan, centerTime - requestedSpan / 2));

  return {
    startTime,
    endTime: startTime + requestedSpan,
  };
}

function isViewportInsidePreparedRange(viewport: WaveformViewport, preparedRange: WaveformViewport) {
  const epsilon = 0.000001;
  return viewport.startTime >= preparedRange.startTime - epsilon && viewport.endTime <= preparedRange.endTime + epsilon;
}

function doesFrameCoverVisibleRows(frame: ParsedWaveformFrame, signalIndices: readonly number[]) {
  if (signalIndices.length === 0) {
    return true;
  }

  const coveredSignalIndices = new Set<number>();
  for (let tableEntryIndex = 0; tableEntryIndex < frame.signalCount; tableEntryIndex += 1) {
    const tableIndex = tableEntryIndex * waveformBinaryFrameSignalTableStride;
    const signalIndex = frame.signalTable[tableIndex];
    const segmentCount = frame.signalTable[tableIndex + 2] ?? 0;

    if (signalIndex !== undefined && segmentCount > 0) {
      coveredSignalIndices.add(signalIndex);
    }
  }

  return signalIndices.every((signalIndex) => coveredSignalIndices.has(signalIndex));
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
