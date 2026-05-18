import { useMemo } from 'react';
import { AlertCircle, AlertTriangle, Info, Lightbulb, type LucideIcon } from 'lucide-react';
import type { LspProblem } from '../../../lsp/lspProblems';

interface ProblemsTabPanelProps {
  problems: LspProblem[];
}

interface ProblemSectionDefinition {
  label: string;
  severity: LspProblem['severity'];
  icon: LucideIcon;
  className: string;
}

const PROBLEM_SECTION_DEFINITIONS: ProblemSectionDefinition[] = [
  { label: 'Errors', severity: 'error', icon: AlertCircle, className: 'text-ide-error' },
  { label: 'Warnings', severity: 'warning', icon: AlertTriangle, className: 'text-ide-warning' },
  { label: 'Infos', severity: 'info', icon: Info, className: 'text-ide-info' },
  { label: 'Hints', severity: 'hint', icon: Lightbulb, className: 'text-ide-success' },
];

export function ProblemsTabPanel({ problems }: ProblemsTabPanelProps) {
  const sections = useMemo(() => {
    const groupedProblems: Record<LspProblem['severity'], LspProblem[]> = {
      error: [],
      warning: [],
      info: [],
      hint: [],
    };

    for (const problem of problems) {
      groupedProblems[problem.severity].push(problem);
    }

    return PROBLEM_SECTION_DEFINITIONS.map((section) => ({
      ...section,
      items: groupedProblems[section.severity],
    }));
  }, [problems]);

  return (
    <div className="bottom-panel-scrollbar min-h-0 flex-1 overflow-y-auto py-1">
      {problems.length === 0 && (
        <div className="px-4 py-3 text-[12px] text-ide-text-muted" data-testid="problems-tab-empty-state">
          No LSP diagnostics yet.
        </div>
      )}
      {sections.map(({ label, items, icon: Icon, className }) =>
        items.length === 0 ? null : (
          <div key={label}>
            <div className="flex items-center gap-2 px-3 py-1 text-[11px]">
              <Icon size={12} className={className} />
              <span className="text-ide-text">{label}</span>
              <span className="text-ide-text-muted">({items.length})</span>
            </div>
            {items.map((p) => (
              <div key={p.id} className="flex items-start gap-2 px-4 py-1 hover:bg-ide-hover cursor-pointer">
                <Icon size={12} className={`mt-0.5 shrink-0 ${className}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-ide-text truncate text-[12px]">{p.message}</div>
                  <div className="text-ide-text-muted text-[11px]">
                    {p.file} L{p.line}:{p.column}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
