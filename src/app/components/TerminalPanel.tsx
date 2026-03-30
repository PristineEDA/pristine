import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export function TerminalPanel() {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [shellLabel, setShellLabel] = useState<string>('shell');
  const isE2E = window.electronAPI?.isE2E === true;
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const shellLabelRef = useRef<string>('shell');

  const appendMirrorText = (chunk: string) => {
    const host = hostRef.current;
    if (!host || !isE2E) {
      return;
    }

    const existing = host.dataset['terminalText'] ?? '';
    host.dataset['terminalText'] = `${existing}${chunk}`.slice(-8000);
  };

  const resetE2EState = () => {
    const host = hostRef.current;
    if (!host || !isE2E) {
      return;
    }

    host.dataset['terminalText'] = '';
    delete host.dataset['terminalPid'];
  };

  useEffect(() => {
    const api = window.electronAPI?.terminal;
    const host = hostRef.current;

    if (!api || !host) {
      setError('Terminal backend is unavailable.');
      return;
    }

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        selectionBackground: '#264f78',
        black: '#1e1e1e',
        red: '#f14c4c',
        green: '#23d18b',
        yellow: '#f5f543',
        blue: '#3b8eea',
        magenta: '#d670d6',
        cyan: '#29b8db',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
    });
    const fitAddon = new FitAddon();
    let disposed = false;

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;
    resetE2EState();
    term.loadAddon(fitAddon);
    term.open(host);
    term.focus();

    const syncSize = () => {
      fitAddon.fit();

      const sessionId = sessionIdRef.current;
      if (!sessionId) {
        return;
      }

      void api.resize(sessionId, term.cols, term.rows);
    };

    const dataSubscription = api.onData((payload) => {
      if (payload.id === sessionIdRef.current) {
        term.write(payload.data);
        appendMirrorText(payload.data);
      }
    });
    const exitSubscription = api.onExit((payload) => {
      if (payload.id !== sessionIdRef.current) {
        return;
      }

      const exitMessage = `\r\n[${shellLabelRef.current} exited with code ${payload.exitCode}]\r\n`;
      term.write(exitMessage);
      appendMirrorText(exitMessage);
      sessionIdRef.current = null;
      setIsStarting(false);
    });
    const inputSubscription = term.onData((data) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) {
        return;
      }

      void api.write(sessionId, data);
    });

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => syncSize())
      : null;
    resizeObserver?.observe(host);

    window.requestAnimationFrame(syncSize);

    void api.create({ cols: term.cols, rows: term.rows }).then((session) => {
      if (disposed) {
        void api.kill(session.id);
        return;
      }

      sessionIdRef.current = session.id;
      if (isE2E) {
        host.dataset['terminalPid'] = String(session.pid);
      }
      shellLabelRef.current = session.shell;
      setShellLabel(session.shell);
      setIsStarting(false);
      syncSize();
    }).catch((reason: unknown) => {
      const message = reason instanceof Error ? reason.message : 'Failed to start terminal session.';
      setError(message);
      setIsStarting(false);
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      dataSubscription();
      exitSubscription();
      inputSubscription.dispose();

      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sessionId) {
        void api.kill(sessionId);
      }

      resetE2EState();

      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [isE2E]);

  return (
    <div className="relative flex h-full bg-ide-bg cursor-text overflow-hidden">
      <div
        ref={hostRef}
        data-testid="terminal-host"
        className="h-full w-full px-2 py-1"
        onClick={() => terminalRef.current?.focus()}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-ide-bg/90 px-6 text-center">
          <div>
            <div className="text-sm font-medium text-ide-error">Terminal failed to start</div>
            <div className="mt-2 text-xs text-ide-text-muted">{error}</div>
          </div>
        </div>
      )}
      {!error && isStarting && (
        <div className="pointer-events-none absolute right-3 top-2 text-[11px] text-ide-text-muted">
          Starting {shellLabel}...
        </div>
      )}
    </div>
  );
}
