import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('renders paired request and response payloads behind a collapsible entry', async () => {
    const user = userEvent.setup();

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

    await user.click(screen.getByRole('button', { name: /textDocument\/definition/i }));

    expect(screen.getByText('Request payload')).toBeInTheDocument();
    expect(screen.getByText('Response payload')).toBeInTheDocument();
    expect(screen.getByText((_, element) => {
      return element?.tagName.toLowerCase() === 'pre' && (element.textContent ?? '').includes('"targetUri": "rtl/core/alu.sv"');
    })).toBeInTheDocument();
  });

  it('filters diagnostics separately from paired responses', async () => {
    const user = userEvent.setup();

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

    await user.click(screen.getByTestId('lsp-filter-diagnostic'));

    expect(screen.getByRole('button', { name: /textDocument\/publishDiagnostics/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /textDocument\/definition/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /textDocument\/publishDiagnostics/i }));
    expect(screen.getByText('Undriven signal')).toBeInTheDocument();

    await user.click(screen.getByTestId('lsp-filter-response'));

    expect(screen.getByRole('button', { name: /textDocument\/definition/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /textDocument\/publishDiagnostics/i })).not.toBeInTheDocument();
  });

  it('renders layout and waveform control-plane requests without pipe binary entries', async () => {
    const user = userEvent.setup();

    mockEvents = [
      {
        sequence: 1,
        timestamp: '2026-01-01T12:00:00.000Z',
        direction: 'client->server',
        kind: 'request',
        requestId: 21,
        method: 'systemverilog/waveform/open',
        payload: { source: 'mock' },
      },
      {
        sequence: 2,
        timestamp: '2026-01-01T12:00:01.000Z',
        direction: 'server->client',
        kind: 'response',
        requestId: 21,
        method: 'systemverilog/waveform/open',
        payload: {
          protocol: 'pristine-waveform-columnar-v1',
          sessionId: 'wave-1',
          title: 'counter_tb',
        },
      },
      {
        sequence: 3,
        timestamp: '2026-01-01T12:00:02.000Z',
        direction: 'client->server',
        kind: 'request',
        requestId: 22,
        method: 'systemverilog/layout/open',
        payload: {
          lefUris: ['file:///C:/workspace/Pristine/sg13g2_stdcell.lef'],
          title: 'sg13g2_stdcell.lef',
        },
      },
      {
        sequence: 4,
        timestamp: '2026-01-01T12:00:03.000Z',
        direction: 'server->client',
        kind: 'response',
        requestId: 22,
        method: 'systemverilog/layout/open',
        payload: {
          protocol: 'pristine-layout-columnar-v3',
          sessionId: 'layout-1',
          title: 'sg13g2_stdcell.lef',
        },
      },
    ];

    render(<LspPanel />);

    expect(screen.getByRole('button', { name: /systemverilog\/waveform\/open/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /systemverilog\/layout\/open/i })).toBeInTheDocument();
    expect(screen.queryByText(/systemverilog\/waveform\/frame/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/systemverilog\/layout\/geometry/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PWF1|PWVF/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /systemverilog\/waveform\/open/i }));
    expect(screen.getByText('Request payload')).toBeInTheDocument();
    expect(queryJsonSnippet('"protocol": "pristine-waveform-columnar-v1"')).toBeInTheDocument();

    await user.click(screen.getByTestId('lsp-filter-request'));
    expect(screen.getByRole('button', { name: /systemverilog\/waveform\/open/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /systemverilog\/layout\/open/i })).toBeInTheDocument();

    await user.click(screen.getByTestId('lsp-filter-response'));
    expect(screen.getByRole('button', { name: /systemverilog\/waveform\/open/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /systemverilog\/layout\/open/i })).toBeInTheDocument();
  });
});
