import { useEffect, useMemo, useState } from 'react';
import { systemVerilogLspBridge } from '../../../lsp/systemVerilogLspBridge';

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatPayload(payload: unknown) {
  if (payload === undefined) {
    return '';
  }

  return JSON.stringify(payload, null, 2);
}

export function LspPanel() {
  const [events, setEvents] = useState(() => systemVerilogLspBridge.getDebugEvents());

  useEffect(() => {
    return systemVerilogLspBridge.subscribeToDebugEvents(() => {
      setEvents(systemVerilogLspBridge.getDebugEvents());
    });
  }, []);

  const orderedEvents = useMemo(() => [...events].reverse(), [events]);
  const latestLifecycle = useMemo(
    () => orderedEvents.find((event) => event.kind === 'lifecycle'),
    [orderedEvents],
  );

  return (
    <div data-testid="lsp-panel" className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-3 py-1 text-[11px] text-muted-foreground shrink-0">
        <span>{events.length} events</span>
        <span>Mode: JSON-RPC payload</span>
        <span>Status: {latestLifecycle?.status ?? 'idle'}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 font-mono text-[11px]">
        {orderedEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No LSP debug events yet.
          </div>
        ) : (
          orderedEvents.map((event) => {
            const title = event.method ?? event.status ?? event.kind;
            const payloadText = formatPayload(event.payload);

            return (
              <div
                key={event.sequence}
                data-testid="lsp-event-item"
                className="mb-2 rounded border border-border/60 bg-muted/20 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  <span>{formatTimestamp(event.timestamp)}</span>
                  <span>{event.direction}</span>
                  <span>{event.kind}</span>
                  {event.requestId !== undefined && <span>req {event.requestId}</span>}
                  {event.filePath && <span>{event.filePath}</span>}
                </div>
                <div className="mt-1 text-[12px] text-foreground">{title}</div>
                {event.text && <div className="mt-1 whitespace-pre-wrap break-all text-[11px] text-muted-foreground">{event.text}</div>}
                {payloadText && (
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded bg-background/80 px-2 py-2 text-[11px] text-foreground">
                    {payloadText}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}