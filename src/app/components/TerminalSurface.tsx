import { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { createTerminalTheme, IDE_MONO_FONT_FAMILY } from '../editor/appearance';
import { useTheme } from '../context/ThemeContext';
import {
  ensureTerminalSession,
  getTerminalSessionSnapshot,
  resizeTerminalSession,
  subscribeTerminalSession,
  writeTerminalSession,
} from './terminalSessionStore';

export function TerminalSurface() {
  const [sessionState, setSessionState] = useState(() => getTerminalSessionSnapshot());
  const isE2E = window.electronAPI?.isE2E === true;
  const { theme } = useTheme();
  const terminalTheme = useMemo(() => createTerminalTheme(theme), [theme]);
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const renderedBufferRef = useRef(0);

  const syncE2EState = (buffer: string, pid: number | null) => {
    const host = hostRef.current;
    if (!host || !isE2E) {
      return;
    }

    host.dataset['terminalText'] = buffer.slice(-8000);
    if (pid) {
      host.dataset['terminalPid'] = String(pid);
      return;
    }

    delete host.dataset['terminalPid'];
  };

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const snapshot = getTerminalSessionSnapshot();
    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: IDE_MONO_FONT_FAMILY,
      fontSize: 12,
      theme: terminalTheme,
    });
    const fitAddon = new FitAddon();
    renderedBufferRef.current = 0;

    terminalRef.current = term;
    term.loadAddon(fitAddon);
    term.open(host);
    term.focus();
    if (snapshot.buffer) {
      term.write(snapshot.buffer);
      renderedBufferRef.current = snapshot.buffer.length;
    }
    syncE2EState(snapshot.buffer, snapshot.pid);

    const syncSize = () => {
      fitAddon.fit();
      void resizeTerminalSession(term.cols, term.rows);
    };

    const syncFromStore = () => {
      const next = getTerminalSessionSnapshot();
      setSessionState(next);

      if (next.buffer.length < renderedBufferRef.current) {
        term.reset();
        renderedBufferRef.current = 0;
      }

      if (next.buffer.length > renderedBufferRef.current) {
        term.write(next.buffer.slice(renderedBufferRef.current));
        renderedBufferRef.current = next.buffer.length;
      }
      syncE2EState(next.buffer, next.pid);
    };

    const unsubscribe = subscribeTerminalSession(syncFromStore);
    const inputSubscription = term.onData((data) => {
      void writeTerminalSession(data);
    });

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => syncSize())
      : null;
    resizeObserver?.observe(host);

    window.requestAnimationFrame(syncSize);

    void ensureTerminalSession({ cols: term.cols, rows: term.rows }).then(() => {
      syncFromStore();
      syncSize();
    });

    return () => {
      resizeObserver?.disconnect();
      unsubscribe();
      inputSubscription.dispose();

      term.dispose();
      terminalRef.current = null;
    };
  }, [isE2E, terminalTheme]);

  return (
    <div
      className="relative flex h-full cursor-text overflow-hidden"
      style={{ backgroundColor: terminalTheme.background }}
    >
      <div
        ref={hostRef}
        data-testid="terminal-host"
        className="h-full w-full px-2 py-1"
        onClick={() => terminalRef.current?.focus()}
      />
      {sessionState.error && (
        <div
          className="absolute inset-0 flex items-center justify-center px-6 text-center"
          style={{ backgroundColor: `${terminalTheme.background}e6` }}
        >
          <div>
            <div className="text-sm font-medium text-destructive">Terminal failed to start</div>
            <div className="mt-2 text-xs text-muted-foreground">{sessionState.error}</div>
          </div>
        </div>
      )}
      {!sessionState.error && sessionState.isStarting && (
        <div className="pointer-events-none absolute right-3 top-2 text-[11px] text-muted-foreground">
          Starting {sessionState.shellLabel}...
        </div>
      )}
    </div>
  );
}