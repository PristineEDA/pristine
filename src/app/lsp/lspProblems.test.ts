import { describe, expect, it } from 'vitest';
import type { LspDiagnostic } from '../../../types/systemverilog-lsp';
import { mapDiagnosticsToProblems, summarizeLspProblems } from './lspProblems';

describe('lspProblems', () => {
  it('maps diagnostics to sorted problems and preserves per-file filtering', () => {
    const diagnosticsByFile = new Map<string, readonly LspDiagnostic[]>([
      [
        'rtl/core/cpu_top.sv',
        [
          {
            message: 'Potential latch inferred',
            severity: 2,
            range: {
              start: { line: 10, character: 4 },
              end: { line: 10, character: 12 },
            },
          },
          {
            message: 'Undriven signal',
            severity: 1,
            range: {
              start: { line: 3, character: 2 },
              end: { line: 3, character: 9 },
            },
            code: 'E001',
            source: 'slang',
          },
        ],
      ],
      [
        'rtl/core/alu.sv',
        [
          {
            message: 'Inline temporary variable',
            severity: 4,
            range: {
              start: { line: 8, character: 1 },
              end: { line: 8, character: 5 },
            },
          },
        ],
      ],
    ]);

    const workspaceProblems = mapDiagnosticsToProblems(diagnosticsByFile);
    expect(workspaceProblems).toHaveLength(3);
    expect(workspaceProblems[0]).toEqual(expect.objectContaining({
      severity: 'error',
      fileId: 'rtl/core/cpu_top.sv',
      file: 'cpu_top.sv',
      line: 4,
      column: 3,
      code: 'E001',
      source: 'slang',
    }));
    expect(workspaceProblems[1]).toEqual(expect.objectContaining({
      severity: 'warning',
      line: 11,
      column: 5,
    }));
    expect(workspaceProblems[2]).toEqual(expect.objectContaining({
      severity: 'hint',
      fileId: 'rtl/core/alu.sv',
    }));

    const singleFileProblems = mapDiagnosticsToProblems(diagnosticsByFile, 'rtl/core/cpu_top.sv');
    expect(singleFileProblems).toHaveLength(2);
    expect(singleFileProblems.every((problem) => problem.fileId === 'rtl/core/cpu_top.sv')).toBe(true);
  });

  it('returns no problems for an explicitly empty active file id and summarizes counts', () => {
    const diagnosticsByFile = new Map<string, readonly LspDiagnostic[]>([
      [
        'rtl/core/cpu_top.sv',
        [
          {
            message: 'Undriven signal',
            severity: 1,
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 2 },
            },
          },
          {
            message: 'Unused output',
            severity: 2,
            range: {
              start: { line: 1, character: 0 },
              end: { line: 1, character: 2 },
            },
          },
          {
            message: 'Can be simplified',
            severity: 3,
            range: {
              start: { line: 2, character: 0 },
              end: { line: 2, character: 2 },
            },
          },
          {
            message: 'Inline variable',
            severity: 4,
            range: {
              start: { line: 3, character: 0 },
              end: { line: 3, character: 2 },
            },
          },
        ],
      ],
    ]);

    expect(mapDiagnosticsToProblems(diagnosticsByFile, '')).toEqual([]);
    expect(summarizeLspProblems(mapDiagnosticsToProblems(diagnosticsByFile))).toEqual({
      errorCount: 1,
      warningCount: 1,
      infoCount: 1,
      hintCount: 1,
      totalCount: 4,
    });
  });
});
