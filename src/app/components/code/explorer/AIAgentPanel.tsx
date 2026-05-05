import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { GripVertical, Server } from 'lucide-react';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import { PristineAssistantThread } from '../../assistant/PristineAssistantThread';
import { ThreadList } from '../../assistant-ui/thread-list';
import { Toggle } from '../../ui/toggle';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import {
  getPristineAgentBaseUrl,
  normalizeAgentBaseUrl,
} from './agentApi';
import { usePristineAgentRuntime } from './pristineThreadRuntime';

const ACTIVE_THREAD_CONFIG_KEY = 'explorer.aiAssistant.activeThreadId';
const THREAD_LIST_WIDTH_CONFIG_KEY = 'explorer.aiAssistant.threadListWidth';
const MIN_THREAD_LIST_WIDTH = 140;
const DEFAULT_THREAD_LIST_WIDTH = MIN_THREAD_LIST_WIDTH;
const MAX_THREAD_LIST_WIDTH = 420;
const THREAD_LIST_TOGGLE_CLASS_NAME = [
  'h-7 w-8 rounded-none border-0 px-0 text-muted-foreground',
  'data-[state=on]:text-foreground',
  'hover:cursor-pointer hover:text-foreground hover:bg-accent',
].join(' ');

type AIAgentPanelProps = {
  baseUrl?: string;
  initialThreadListExpanded?: boolean;
  initialThreadListWidth?: number;
  onThreadListExpandedChange?: (expanded: boolean) => void;
  onThreadListWidthChange?: (width: number) => void;
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

function PanelRightIcon({ size = 15, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {filled ? <rect x="12" y="3" width="9" height="18" rx="2" fill="currentColor" stroke="none" /> : null}
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M12 3v18" />
    </svg>
  );
}

export function AIAgentPanel({
  baseUrl = getPristineAgentBaseUrl(),
  initialThreadListExpanded = false,
  initialThreadListWidth,
  onThreadListExpandedChange,
  onThreadListWidthChange,
}: AIAgentPanelProps) {
  const normalizedBaseUrl = useMemo(() => normalizeAgentBaseUrl(baseUrl), [baseUrl]);
  const initialThreadId = useMemo(() => readStoredThreadId(), []);
  const [isThreadListExpanded, setIsThreadListExpanded] = useState(initialThreadListExpanded);
  const [threadListWidth, setThreadListWidth] = useState(() => (
    initialThreadListWidth === undefined
      ? normalizeThreadListWidth(window.electronAPI?.config.get(THREAD_LIST_WIDTH_CONFIG_KEY))
      : normalizeThreadListWidth(initialThreadListWidth)
  ));
  const currentThreadListWidthRef = useRef(threadListWidth);
  const runtime = usePristineAgentRuntime({
    baseUrl: normalizedBaseUrl,
    initialThreadId,
  });
  const resizeStartPointerXRef = useRef<number | null>(null);
  const lastPersistedThreadIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    setIsThreadListExpanded(initialThreadListExpanded);
  }, [initialThreadListExpanded]);

  useEffect(() => {
    if (initialThreadListWidth === undefined) {
      return;
    }

    setThreadListWidth(normalizeThreadListWidth(initialThreadListWidth));
  }, [initialThreadListWidth]);

  useEffect(() => {
    currentThreadListWidthRef.current = threadListWidth;
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

  const updateThreadListWidth = useEffectEvent((nextWidth: number) => {
    const normalizedWidth = normalizeThreadListWidth(nextWidth);

    setThreadListWidth((currentWidth) => {
      if (currentWidth === normalizedWidth) {
        return currentWidth;
      }

      currentThreadListWidthRef.current = normalizedWidth;
      onThreadListWidthChange?.(normalizedWidth);
      return normalizedWidth;
    });
  });

  const endResize = useEffectEvent((pointerId?: number, target?: EventTarget | null) => {
    if (resizeStartPointerXRef.current === null) {
      return;
    }

    resizeStartPointerXRef.current = null;
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
    void window.electronAPI?.config.set(THREAD_LIST_WIDTH_CONFIG_KEY, currentThreadListWidthRef.current);

    if (target instanceof HTMLElement && pointerId !== undefined) {
      target.releasePointerCapture?.(pointerId);
    }
  });

  const handleResizePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    resizeStartPointerXRef.current = event.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleThreadListExpandedChange = (nextExpanded: boolean) => {
    setIsThreadListExpanded(nextExpanded);
    onThreadListExpandedChange?.(nextExpanded);
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div
        data-testid="assistant-panel-root"
        className="flex h-full min-h-0 min-w-0 bg-background text-foreground"
      >
        <div className={[
          'flex min-w-0 flex-1 flex-col bg-background',
          isThreadListExpanded ? 'border-r border-border' : '',
        ].join(' ')} data-testid="assistant-main-panel">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Server className="size-3.5" />
              </div>
              <span className="truncate text-xs font-semibold">Pristine Agent</span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle
                    aria-label="Toggle chat list sidebar"
                    data-testid="assistant-thread-list-toggle"
                    pressed={isThreadListExpanded}
                    className={THREAD_LIST_TOGGLE_CLASS_NAME}
                    onPressedChange={handleThreadListExpandedChange}
                  >
                    <PanelRightIcon size={15} filled={isThreadListExpanded} />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>Toggle chat list</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <PristineAssistantThread agentBaseUrl={normalizedBaseUrl} />
        </div>
        {isThreadListExpanded ? (
          <>
            <button
              type="button"
              aria-label="Resize chat list"
              data-testid="assistant-thread-list-resize-handle"
              onPointerDown={handleResizePointerDown}
              onPointerMove={(event) => {
                if (resizeStartPointerXRef.current === null) {
                  return;
                }

                const deltaPixels = resizeStartPointerXRef.current - event.clientX;
                updateThreadListWidth(currentThreadListWidthRef.current + deltaPixels);
                resizeStartPointerXRef.current = event.clientX;
              }}
              onPointerUp={(event) => endResize(event.pointerId, event.currentTarget)}
              onPointerCancel={(event) => endResize(event.pointerId, event.currentTarget)}
              className="group relative flex w-2 shrink-0 cursor-col-resize items-center justify-center bg-border/40 transition-colors hover:bg-primary/20 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1"
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
                  Chats
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <ThreadList />
              </div>
            </aside>
          </>
        ) : null}
      </div>
    </AssistantRuntimeProvider>
  );
}