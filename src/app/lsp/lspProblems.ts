import { useMemo, useSyncExternalStore } from 'react';
import type { LspDiagnostic } from '../../../types/systemverilog-lsp';
import { getWorkspaceBaseName, normalizeWorkspacePath } from '../workspace/workspaceFiles';
import { systemVerilogLspBridge } from './systemVerilogLspBridge';

export type LspProblemSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface LspProblem {
  id: string;
  file: string;
  fileId: string;
  line: number;
  column: number;
  severity: LspProblemSeverity;
  message: string;
  code?: string | number;
  source?: string;
}

export interface LspProblemCounts {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hintCount: number;
  totalCount: number;
}

const severityOrder: Record<LspProblemSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
  hint: 3,
};

function toProblemSeverity(severity?: number): LspProblemSeverity {
  switch (severity) {
    case 1:
      return 'error';
    case 2:
      return 'warning';
    case 4:
      return 'hint';
    default:
      return 'info';
  }
}

function toProblemId(filePath: string, diagnostic: LspDiagnostic, index: number) {
  return [
    filePath,
    diagnostic.range.start.line,
    diagnostic.range.start.character,
    diagnostic.range.end.line,
    diagnostic.range.end.character,
    diagnostic.code ?? index,
    diagnostic.message,
  ].join(':');
}

function toProblem(filePath: string, diagnostic: LspDiagnostic, index: number): LspProblem {
  const normalizedFilePath = normalizeWorkspacePath(filePath);

  return {
    id: toProblemId(normalizedFilePath, diagnostic, index),
    file: getWorkspaceBaseName(normalizedFilePath),
    fileId: normalizedFilePath,
    line: diagnostic.range.start.line + 1,
    column: diagnostic.range.start.character + 1,
    severity: toProblemSeverity(diagnostic.severity),
    message: diagnostic.message,
    code: diagnostic.code,
    source: diagnostic.source,
  };
}

export function mapDiagnosticsToProblems(
  diagnosticsByFile: ReadonlyMap<string, readonly LspDiagnostic[]>,
  fileId?: string | null,
): LspProblem[] {
  if (fileId === '') {
    return [];
  }

  const normalizedFileId = fileId ? normalizeWorkspacePath(fileId) : null;
  const problems: LspProblem[] = [];

  for (const [diagnosticFilePath, diagnostics] of diagnosticsByFile.entries()) {
    if (normalizedFileId && normalizeWorkspacePath(diagnosticFilePath) !== normalizedFileId) {
      continue;
    }

    diagnostics.forEach((diagnostic, index) => {
      problems.push(toProblem(diagnosticFilePath, diagnostic, index));
    });
  }

  return problems.sort((left, right) => {
    const severityDelta = severityOrder[left.severity] - severityOrder[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const fileDelta = left.fileId.localeCompare(right.fileId, undefined, { numeric: true, sensitivity: 'base' });
    if (fileDelta !== 0) {
      return fileDelta;
    }

    if (left.line !== right.line) {
      return left.line - right.line;
    }

    if (left.column !== right.column) {
      return left.column - right.column;
    }

    return left.message.localeCompare(right.message);
  });
}

export function summarizeLspProblems(problems: readonly LspProblem[]): LspProblemCounts {
  const counts: LspProblemCounts = {
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
    hintCount: 0,
    totalCount: problems.length,
  };

  for (const problem of problems) {
    if (problem.severity === 'error') {
      counts.errorCount += 1;
      continue;
    }

    if (problem.severity === 'warning') {
      counts.warningCount += 1;
      continue;
    }

    if (problem.severity === 'hint') {
      counts.hintCount += 1;
      continue;
    }

    counts.infoCount += 1;
  }

  return counts;
}

export function useLspProblems(fileId?: string | null): LspProblem[] {
  const diagnosticsSnapshot = useSyncExternalStore(
    (listener) => systemVerilogLspBridge.subscribeToDiagnosticsChanges(listener),
    () => systemVerilogLspBridge.getDiagnosticsSnapshot(),
    () => systemVerilogLspBridge.getDiagnosticsSnapshot(),
  );

  return useMemo(() => mapDiagnosticsToProblems(diagnosticsSnapshot, fileId), [diagnosticsSnapshot, fileId]);
}