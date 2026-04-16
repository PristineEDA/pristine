import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { LspDebugEvent, LspDiagnostic } from '../../../../../types/systemverilog-lsp';
import { systemVerilogLspBridge } from '../../../lsp/systemVerilogLspBridge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible';

type LspPanelFilter = 'all' | 'request' | 'response' | 'diagnostic';

type LspPanelEntry =
  | {
      id: string;
      type: 'request-pair';
      request: LspDebugEvent;
      response?: LspDebugEvent;
      latestSequence: number;
    }
  | {
      id: string;
      type: 'event';
      event: LspDebugEvent;
      latestSequence: number;
    };

const filterOptions: Array<{ id: LspPanelFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'request', label: 'Requests' },
  { id: 'response', label: 'Responses' },
  { id: 'diagnostic', label: 'Diagnostics' },
];

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

function isDebugObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDiagnosticsEvent(event: LspDebugEvent) {
  return event.method === 'textDocument/publishDiagnostics';
}

function hasResponseError(response: LspDebugEvent | undefined) {
  return Boolean(response && isDebugObject(response.payload) && 'error' in response.payload);
}

function getResponseState(response: LspDebugEvent | undefined) {
  if (!response) {
    return 'pending';
  }

  return hasResponseError(response) ? 'error' : 'completed';
}

function formatCount(count: number, label: string) {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function parseDiagnostic(value: unknown): LspDiagnostic | null {
  if (!isDebugObject(value)) {
    return null;
  }

  const { message, range, severity, code, source } = value;
  if (typeof message !== 'string' || !isDebugObject(range)) {
    return null;
  }

  const start = range.start;
  const end = range.end;
  if (!isDebugObject(start) || !isDebugObject(end)) {
    return null;
  }

  const startLine = start.line;
  const startCharacter = start.character;
  const endLine = end.line;
  const endCharacter = end.character;
  if (
    typeof startLine !== 'number' ||
    typeof startCharacter !== 'number' ||
    typeof endLine !== 'number' ||
    typeof endCharacter !== 'number'
  ) {
    return null;
  }

  return {
    message,
    range: {
      start: { line: startLine, character: startCharacter },
      end: { line: endLine, character: endCharacter },
    },
    severity: typeof severity === 'number' ? severity : undefined,
    code: typeof code === 'string' || typeof code === 'number' ? code : undefined,
    source: typeof source === 'string' ? source : undefined,
  };
}

function getDiagnosticsFromEvent(event: LspDebugEvent) {
  if (!isDiagnosticsEvent(event) || !isDebugObject(event.payload)) {
    return [] as LspDiagnostic[];
  }

  const diagnostics = event.payload.diagnostics;
  if (!Array.isArray(diagnostics)) {
    return [] as LspDiagnostic[];
  }

  return diagnostics
    .map((value) => parseDiagnostic(value))
    .filter((diagnostic): diagnostic is LspDiagnostic => diagnostic !== null);
}

function formatDiagnosticsSummary(diagnostics: LspDiagnostic[]) {
  if (diagnostics.length === 0) {
    return 'No diagnostics in payload.';
  }

  const counts = {
    error: 0,
    warning: 0,
    info: 0,
    hint: 0,
  };

  for (const diagnostic of diagnostics) {
    switch (diagnostic.severity) {
      case 1:
        counts.error += 1;
        break;
      case 2:
        counts.warning += 1;
        break;
      case 3:
        counts.info += 1;
        break;
      case 4:
        counts.hint += 1;
        break;
      default:
        counts.info += 1;
        break;
    }
  }

  const parts = [
    counts.error > 0 ? formatCount(counts.error, 'error') : null,
    counts.warning > 0 ? formatCount(counts.warning, 'warning') : null,
    counts.info > 0 ? formatCount(counts.info, 'info') : null,
    counts.hint > 0 ? formatCount(counts.hint, 'hint') : null,
  ].filter((value): value is string => value !== null);

  return parts.length > 0 ? parts.join(', ') : formatCount(diagnostics.length, 'diagnostic');
}

function getDiagnosticSeverityLabel(severity: number | undefined) {
  switch (severity) {
    case 1:
      return 'ERROR';
    case 2:
      return 'WARNING';
    case 4:
      return 'HINT';
    default:
      return 'INFO';
  }
}

function getDiagnosticSeverityClass(severity: number | undefined) {
  switch (severity) {
    case 1:
      return 'text-destructive';
    case 2:
      return 'text-amber-500';
    case 4:
      return 'text-emerald-500';
    default:
      return 'text-sky-500';
  }
}

function formatDiagnosticLocation(diagnostic: LspDiagnostic) {
  return `L${diagnostic.range.start.line + 1}:${diagnostic.range.start.character + 1}`;
}

function buildPanelEntries(events: LspDebugEvent[]) {
  const requests = new Map<number, LspDebugEvent>();
  const responses = new Map<number, LspDebugEvent>();

  for (const event of events) {
    if (event.kind === 'request' && event.requestId !== undefined) {
      requests.set(event.requestId, event);
    }

    if (event.kind === 'response' && event.requestId !== undefined) {
      responses.set(event.requestId, event);
    }
  }

  const consumedSequences = new Set<number>();
  const entries: LspPanelEntry[] = [];

  for (const [requestId, request] of requests.entries()) {
    const response = responses.get(requestId);
    consumedSequences.add(request.sequence);
    if (response) {
      consumedSequences.add(response.sequence);
    }

    entries.push({
      id: `request-${requestId}`,
      type: 'request-pair',
      request,
      response,
      latestSequence: response ? Math.max(request.sequence, response.sequence) : request.sequence,
    });
  }

  for (const event of events) {
    if (consumedSequences.has(event.sequence)) {
      continue;
    }

    entries.push({
      id: `event-${event.sequence}`,
      type: 'event',
      event,
      latestSequence: event.sequence,
    });
  }

  return entries.sort((left, right) => right.latestSequence - left.latestSequence);
}

function matchesFilter(entry: LspPanelEntry, filter: LspPanelFilter) {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'request') {
    return entry.type === 'request-pair';
  }

  if (filter === 'response') {
    return entry.type === 'request-pair'
      ? Boolean(entry.response)
      : entry.event.kind === 'response';
  }

  return entry.type === 'event' && isDiagnosticsEvent(entry.event);
}

function renderMetaRow(event: LspDebugEvent, fallbackFilePath?: string) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
      <span>{formatTimestamp(event.timestamp)}</span>
      <span>{event.direction}</span>
      <span>{event.kind}</span>
      {event.requestId !== undefined && <span>req {event.requestId}</span>}
      {(fallbackFilePath ?? event.filePath) && <span>{fallbackFilePath ?? event.filePath}</span>}
    </div>
  );
}

function renderPayloadBlock(title: string, payloadText: string) {
  return (
    <div className="grid gap-1">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{title}</div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-background/80 px-2 py-2 text-[11px] text-foreground">
        {payloadText}
      </pre>
    </div>
  );
}

export function LspPanel() {
  const [events, setEvents] = useState(() => systemVerilogLspBridge.getDebugEvents());
  const [filter, setFilter] = useState<LspPanelFilter>('all');

  useEffect(() => {
    return systemVerilogLspBridge.subscribeToDebugEvents(() => {
      setEvents(systemVerilogLspBridge.getDebugEvents());
    });
  }, []);

  const entries = useMemo(() => buildPanelEntries(events), [events]);
  const filteredEntries = useMemo(
    () => entries.filter((entry) => matchesFilter(entry, filter)),
    [entries, filter],
  );
  const latestLifecycle = useMemo(
    () => [...events].reverse().find((event) => event.kind === 'lifecycle'),
    [events],
  );

  return (
    <div data-testid="lsp-panel" className="flex h-full flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-1 text-[11px] text-muted-foreground shrink-0">
        <span>{events.length} events</span>
        <span>Mode: paired request/response</span>
        <span>Status: {latestLifecycle?.status ?? 'idle'}</span>
        <div className="ml-auto flex items-center gap-1">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`lsp-filter-${option.id}`}
              onClick={() => setFilter(option.id)}
              className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                filter === option.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 font-mono text-[11px]">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No LSP debug events yet.
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No matching LSP events for the current filter.
          </div>
        ) : (
          filteredEntries.map((entry) => {
            if (entry.type === 'request-pair') {
              const responseState = getResponseState(entry.response);
              const requestPayloadText = formatPayload(entry.request.payload);
              const responsePayloadText = formatPayload(entry.response?.payload);
              const responseStateLabel =
                responseState === 'pending'
                  ? 'Pending'
                  : responseState === 'error'
                  ? 'Error'
                  : 'Completed';
              const responseStateClass =
                responseState === 'pending'
                  ? 'text-amber-500'
                  : responseState === 'error'
                  ? 'text-destructive'
                  : 'text-emerald-500';
              const summaryText =
                responseState === 'pending'
                  ? 'Waiting for a server response.'
                  : responseState === 'error'
                  ? entry.response?.text ?? 'Response returned an error.'
                  : 'Request and response have been paired.';

              return (
                <Collapsible
                  key={entry.id}
                  data-testid="lsp-event-item"
                  defaultOpen={false}
                  className="group/lsp-entry mb-2 rounded border border-border/60 bg-muted/20"
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      aria-label={entry.request.method ?? `request ${entry.request.requestId ?? entry.request.sequence}`}
                      className="w-full px-3 py-2 text-left"
                    >
                      {renderMetaRow(entry.response ?? entry.request, entry.response?.filePath ?? entry.request.filePath)}
                      <div className="mt-1 flex items-start gap-2">
                        <ChevronRight className="mt-0.5 size-3 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/lsp-entry:rotate-90" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] text-foreground">
                            {entry.request.method ?? `request ${entry.request.requestId ?? entry.request.sequence}`}
                          </div>
                          <div className="mt-1 whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                            {summaryText}
                          </div>
                        </div>
                        <span className={`text-[10px] uppercase tracking-[0.08em] ${responseStateClass}`}>
                          {responseStateLabel}
                        </span>
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-border/60 px-3 py-3">
                    <div className="grid gap-3">
                      {requestPayloadText && renderPayloadBlock('Request payload', requestPayloadText)}
                      {entry.response ? (
                        responsePayloadText ? (
                          renderPayloadBlock('Response payload', responsePayloadText)
                        ) : (
                          <div className="text-[11px] text-muted-foreground">Response payload is empty.</div>
                        )
                      ) : (
                        <div className="text-[11px] text-muted-foreground">No response has been received yet.</div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            }

            const diagnostics = getDiagnosticsFromEvent(entry.event);
            const payloadText = formatPayload(entry.event.payload);
            const title = entry.event.method ?? entry.event.status ?? entry.event.kind;
            const summaryText = isDiagnosticsEvent(entry.event)
              ? formatDiagnosticsSummary(diagnostics)
              : entry.event.text ?? (payloadText ? 'Expand to inspect payload.' : 'No payload attached.');

            return (
              <Collapsible
                key={entry.id}
                data-testid="lsp-event-item"
                defaultOpen={false}
                className="group/lsp-entry mb-2 rounded border border-border/60 bg-muted/20"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    aria-label={title}
                    className="w-full px-3 py-2 text-left"
                  >
                    {renderMetaRow(entry.event)}
                    <div className="mt-1 flex items-start gap-2">
                      <ChevronRight className="mt-0.5 size-3 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/lsp-entry:rotate-90" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-foreground">{title}</div>
                        <div className="mt-1 whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                          {summaryText}
                        </div>
                      </div>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t border-border/60 px-3 py-3">
                  <div className="grid gap-3">
                    {diagnostics.length > 0 && (
                      <div className="grid gap-2">
                        <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          Diagnostics
                        </div>
                        {diagnostics.map((diagnostic, index) => (
                          <div
                            key={`${entry.id}-${index}`}
                            className="rounded border border-border/60 bg-background/60 px-2 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                              <span className={getDiagnosticSeverityClass(diagnostic.severity)}>
                                {getDiagnosticSeverityLabel(diagnostic.severity)}
                              </span>
                              <span>{formatDiagnosticLocation(diagnostic)}</span>
                              {diagnostic.source && <span>{diagnostic.source}</span>}
                              {diagnostic.code !== undefined && <span>code {diagnostic.code}</span>}
                            </div>
                            <div className="mt-1 text-[11px] text-foreground">{diagnostic.message}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {entry.event.text && !isDiagnosticsEvent(entry.event) && (
                      <div className="whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                        {entry.event.text}
                      </div>
                    )}
                    {payloadText && renderPayloadBlock('Raw payload', payloadText)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })
        )}
      </div>
    </div>
  );
}