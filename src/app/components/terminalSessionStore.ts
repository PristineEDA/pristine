type TerminalApi = NonNullable<typeof window.electronAPI>['terminal'];

export interface TerminalSessionSnapshot {
  buffer: string;
  error: string | null;
  isStarting: boolean;
  pid: number | null;
  sessionId: string | null;
  shellLabel: string;
}

const BUFFER_LIMIT = 50000;

const defaultSnapshot = (): TerminalSessionSnapshot => ({
  buffer: '',
  error: null,
  isStarting: false,
  pid: null,
  sessionId: null,
  shellLabel: 'shell',
});

let snapshot = defaultSnapshot();
let createPromise: Promise<void> | null = null;
let unsubscribeData: (() => void) | null = null;
let unsubscribeExit: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setSnapshot(next: Partial<TerminalSessionSnapshot>) {
  snapshot = { ...snapshot, ...next };
  notify();
}

function appendBuffer(chunk: string) {
  snapshot = {
    ...snapshot,
    buffer: `${snapshot.buffer}${chunk}`.slice(-BUFFER_LIMIT),
  };
  notify();
}

function getTerminalApi(): TerminalApi | null {
  return window.electronAPI?.terminal ?? null;
}

function ensureBridge(api: TerminalApi) {
  if (!unsubscribeData) {
    unsubscribeData = api.onData((payload) => {
      if (payload.id !== snapshot.sessionId) {
        return;
      }

      appendBuffer(payload.data);
    });
  }

  if (!unsubscribeExit) {
    unsubscribeExit = api.onExit((payload) => {
      if (payload.id !== snapshot.sessionId) {
        return;
      }

      const exitMessage = `\r\n[${snapshot.shellLabel} exited with code ${payload.exitCode}]\r\n`;
      snapshot = {
        ...snapshot,
        buffer: `${snapshot.buffer}${exitMessage}`.slice(-BUFFER_LIMIT),
        isStarting: false,
        pid: null,
        sessionId: null,
      };
      notify();
    });
  }
}

export function getTerminalSessionSnapshot() {
  return snapshot;
}

export function subscribeTerminalSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function ensureTerminalSession(options?: { cwd?: string; cols?: number; rows?: number }) {
  const api = getTerminalApi();

  if (!api) {
    setSnapshot({ error: 'Terminal backend is unavailable.', isStarting: false });
    return;
  }

  ensureBridge(api);

  if (snapshot.sessionId || createPromise) {
    await createPromise;
    return;
  }

  setSnapshot({ error: null, isStarting: true });

  createPromise = api.create(options).then((session) => {
    snapshot = {
      ...snapshot,
      error: null,
      isStarting: false,
      pid: session.pid,
      sessionId: session.id,
      shellLabel: session.shell,
    };
    notify();
  }).catch((reason: unknown) => {
    const message = reason instanceof Error ? reason.message : 'Failed to start terminal session.';
    setSnapshot({ error: message, isStarting: false });
  }).finally(() => {
    createPromise = null;
  });

  await createPromise;
}

export async function writeTerminalSession(data: string) {
  const api = getTerminalApi();
  if (!api || !snapshot.sessionId) {
    return false;
  }

  return api.write(snapshot.sessionId, data);
}

export async function resizeTerminalSession(cols: number, rows: number) {
  const api = getTerminalApi();
  if (!api || !snapshot.sessionId) {
    return false;
  }

  return api.resize(snapshot.sessionId, cols, rows);
}

export async function terminateTerminalSession() {
  const api = getTerminalApi();

  if (createPromise) {
    await createPromise;
  }

  const sessionId = snapshot.sessionId;

  if (api && sessionId) {
    await api.kill(sessionId);
  }

  snapshot = defaultSnapshot();
  notify();
}

export function resetTerminalSessionStoreForTests() {
  unsubscribeData?.();
  unsubscribeExit?.();
  unsubscribeData = null;
  unsubscribeExit = null;
  createPromise = null;
  snapshot = defaultSnapshot();
  listeners.clear();
}