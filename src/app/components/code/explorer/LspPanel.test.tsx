import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LspDebugEvent } from '../../../../../types/systemverilog-lsp';

const { mockedGetDebugEvents, mockedSubscribeToDebugEvents } = vi.hoisted(() => ({
  mockedGetDebugEvents: vi.fn(),
  mockedSubscribeToDebugEvents: vi.fn(),
}));

vi.mock('../../../lsp/systemVerilogLspBridge', () => ({
  systemVerilogLspBridge: {
    getDebugEvents: () => mockedGetDebugEvents(),
    subscribeToDebugEvents: (listener: () => void) => mockedSubscribeToDebugEvents(listener),
  },
}));

import { LspPanel } from './LspPanel';

let mockEvents: LspDebugEvent[] = [];

function queryJsonSnippet(snippet: string) {
  return screen.queryByText((_, element) => {
    return element?.tagName.toLowerCase() === 'pre' && (element.textContent ?? '').includes(snippet);
  });
}

describe('LspPanel', () => {
  beforeEach(() => {
    mockEvents = [];
    mockedGetDebugEvents.mockReset();
    mockedSubscribeToDebugEvents.mockReset();
    mockedGetDebugEvents.mockImplementation(() => mockEvents);
    mockedSubscribeToDebugEvents.mockImplementation(() => vi.fn());
  });

  it('renders paired request and response payloads behind a collapsible entry', () => {
    mockEvents = [
      {
        sequence: 1,
        timestamp: '2026-01-01T12:00:00.000Z',
        direction: 'client->server',
        kind: 'request',
        requestId: 7,
        method: 'textDocument/definition',
        filePath: 'rtl/core/cpu_top.sv',
        payload: { line: 3, character: 2 },
      },
      {
        sequence: 2,
        timestamp: '2026-01-01T12:00:01.000Z',
        direction: 'server->client',
        kind: 'response',
        requestId: 7,
        method: 'textDocument/definition',
        filePath: 'rtl/core/alu.sv',
        payload: { targetUri: 'rtl/core/alu.sv' },
      },
    ];

    render(<LspPanel />);

    expect(screen.getByRole('button', { name: /textDocument\/definition/i })).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(queryJsonSnippet('"targetUri": "rtl/core/alu.sv"')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /textDocument\/definition/i }));

    expect(screen.getByText('Request payload')).toBeInTheDocument();
    expect(screen.getByText('Response payload')).toBeInTheDocument();
    expect(screen.getByText((_, element) => {
      return element?.tagName.toLowerCase() === 'pre' && (element.textContent ?? '').includes('"targetUri": "rtl/core/alu.sv"');
    })).toBeInTheDocument();
  });

  it('filters diagnostics separately from paired responses', () => {
    mockEvents = [
      {
        sequence: 1,
        timestamp: '2026-01-01T12:00:00.000Z',
        direction: 'client->server',
        kind: 'request',
        requestId: 9,
        method: 'textDocument/definition',
        filePath: 'rtl/core/cpu_top.sv',
        payload: { line: 3, character: 2 },
      },
      {
        sequence: 2,
        timestamp: '2026-01-01T12:00:01.000Z',
        direction: 'server->client',
        kind: 'response',
        requestId: 9,
        method: 'textDocument/definition',
        filePath: 'rtl/core/alu.sv',
        payload: { targetUri: 'rtl/core/alu.sv' },
      },
      {
        sequence: 3,
        timestamp: '2026-01-01T12:00:02.000Z',
        direction: 'server->client',
        kind: 'notification',
        method: 'textDocument/publishDiagnostics',
        filePath: 'rtl/core/cpu_top.sv',
        payload: {
          diagnostics: [
            {
              message: 'Undriven signal',
              severity: 1,
              range: {
                start: { line: 3, character: 4 },
                end: { line: 3, character: 14 },
              },
            },
          ],
        },
      },
    ];

    render(<LspPanel />);

    fireEvent.click(screen.getByTestId('lsp-filter-diagnostic'));

    expect(screen.getByRole('button', { name: /textDocument\/publishDiagnostics/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /textDocument\/definition/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /textDocument\/publishDiagnostics/i }));
    expect(screen.getByText('Undriven signal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('lsp-filter-response'));

    expect(screen.getByRole('button', { name: /textDocument\/definition/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /textDocument\/publishDiagnostics/i })).not.toBeInTheDocument();
  });
});