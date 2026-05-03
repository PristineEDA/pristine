import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { GripVertical, Server } from 'lucide-react';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import { PristineAssistantThread } from '../../assistant/PristineAssistantThread';
import { ThreadList } from '../../assistant-ui/thread-list';
import {
  getPristineAgentBaseUrl,
  normalizeAgentBaseUrl,
} from './agentApi';
import { usePristineAgentRuntime } from './pristineThreadRuntime';

const ACTIVE_THREAD_CONFIG_KEY = 'explorer.aiAssistant.activeThreadId';
const THREAD_LIST_WIDTH_CONFIG_KEY = 'explorer.aiAssistant.threadListWidth';
const DEFAULT_THREAD_LIST_WIDTH = 280;
const MIN_THREAD_LIST_WIDTH = 220;
const MAX_THREAD_LIST_WIDTH = 420;
const MIN_CHAT_PANEL_WIDTH = 320;

type AIAgentPanelProps = {
  baseUrl?: string;
};

function readStoredThreadId(): string | undefined {
  const value = window.electronAPI?.config.get(ACTIVE_THREAD_CONFIG_KEY);

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

export function normalizeThreadListWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_THREAD_LIST_WIDTH;
  }

  return Math.min(MAX_THREAD_LIST_WIDTH, Math.max(MIN_THREAD_LIST_WIDTH, Math.round(value)));
}

function clampThreadListWidth(nextWidth: number, containerWidth: number): number {
  const maxWidth = Math.min(
    MAX_THREAD_LIST_WIDTH,
    Math.max(MIN_THREAD_LIST_WIDTH, Math.round(containerWidth) - MIN_CHAT_PANEL_WIDTH),
  );

  return Math.min(maxWidth, Math.max(MIN_THREAD_LIST_WIDTH, Math.round(nextWidth)));
}

export function AIAgentPanel({ baseUrl = getPristineAgentBaseUrl() }: AIAgentPanelProps) {
  const normalizedBaseUrl = useMemo(() => normalizeAgentBaseUrl(baseUrl), [baseUrl]);
  const initialThreadId = useMemo(() => readStoredThreadId(), []);
  const [threadListWidth, setThreadListWidth] = useState(() => (
    normalizeThreadListWidth(window.electronAPI?.config.get(THREAD_LIST_WIDTH_CONFIG_KEY))
  ));
  const runtime = usePristineAgentRuntime({
    baseUrl: normalizedBaseUrl,
    initialThreadId,
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isResizingRef = useRef(false);
  const currentWidthRef = useRef(threadListWidth);
  const lastPersistedThreadIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    currentWidthRef.current = threadListWidth;
  }, [threadListWidth]);

  const persistActiveThreadId = useEffectEvent(() => {
    const remoteId = runtime.threads.mainItem.getState().remoteId ?? null;

    if (lastPersistedThreadIdRef.current === remoteId) {
      return;
    }

    lastPersistedThreadIdRef.current = remoteId;
    void window.electronAPI?.config.set(ACTIVE_THREAD_CONFIG_KEY, remoteId);
  });

  useEffect(() => {
    persistActiveThreadId();
    return runtime.threads.subscribe(() => {
      persistActiveThreadId();
    });
  }, [persistActiveThreadId, runtime]);

  const handlePointerMove = useEffectEvent((event: PointerEvent) => {
    if (!isResizingRef.current || !containerRef.current) {
      return;
    }

    const bounds = containerRef.current.getBoundingClientRect();
    const nextWidth = clampThreadListWidth(bounds.right - event.clientX, bounds.width);

    if (nextWidth !== currentWidthRef.current) {
      setThreadListWidth(nextWidth);
    }
  });

  const handlePointerUp = useEffectEvent(() => {
    if (!isResizingRef.current) {
      return;
    }

    isResizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    void window.electronAPI?.config.set(THREAD_LIST_WIDTH_CONFIG_KEY, currentWidthRef.current);
  });

  useEffect(() => {
    const handleWindowPointerMove = (event: PointerEvent) => {
      handlePointerMove(event);
    };
    const handleWindowPointerUp = () => {
      handlePointerUp();
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const handleResizePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div
        ref={containerRef}
        data-testid="assistant-panel-root"
        className="flex h-full min-h-0 min-w-0 bg-background text-foreground"
      >
        <div className="flex min-w-0 flex-1 flex-col border-r border-border bg-background">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Server className="size-3.5" />
            </div>
            <span className="text-xs font-semibold">Pristine Agent</span>
          </div>
          <PristineAssistantThread agentBaseUrl={normalizedBaseUrl} />
        </div>
        <button
          type="button"
          aria-label="Resize thread list"
          data-testid="assistant-thread-list-resize-handle"
          onPointerDown={handleResizePointerDown}
          className="group flex w-2 shrink-0 cursor-col-resize items-center justify-center bg-border/30 transition-colors hover:bg-primary/20"
        >
          <GripVertical className="size-3 text-muted-foreground transition-colors group-hover:text-foreground" />
        </button>
        <aside
          data-testid="assistant-thread-list-panel"
          className="flex h-full shrink-0 flex-col bg-muted/20"
          style={{ width: threadListWidth }}
        >
          <div className="flex shrink-0 items-center border-b border-border px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Threads
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <ThreadList />
          </div>
        </aside>
      </div>
    </AssistantRuntimeProvider>
  );
}