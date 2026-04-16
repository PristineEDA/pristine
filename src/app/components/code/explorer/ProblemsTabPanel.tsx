import { AlertCircle, AlertTriangle, Info, Lightbulb } from 'lucide-react';
import type { LspProblem } from '../../../lsp/lspProblems';

interface ProblemsTabPanelProps {
  problems: LspProblem[];
}

export function ProblemsTabPanel({ problems }: ProblemsTabPanelProps) {
  const problemsList = problems;
  const errors = problemsList.filter((p) => p.severity === 'error');
  const warnings = problemsList.filter((p) => p.severity === 'warning');
  const infos = problemsList.filter((p) => p.severity === 'info');
  const hints = problemsList.filter((p) => p.severity === 'hint');

  const sections = [
    { label: 'Errors', items: errors, icon: AlertCircle, color: '#f48771' },
    { label: 'Warnings', items: warnings, icon: AlertTriangle, color: '#cca700' },
    { label: 'Infos', items: infos, icon: Info, color: '#75beff' },
    { label: 'Hints', items: hints, icon: Lightbulb, color: '#2fbf71' },
  ];

  return (
    <div className="flex-1 overflow-y-auto py-1">
      {problemsList.length === 0 && (
        <div className="px-4 py-3 text-[12px] text-muted-foreground" data-testid="problems-tab-empty-state">
          No LSP diagnostics yet.
        </div>
      )}
      {sections.map(({ label, items, icon: Icon, color }) =>
        items.length === 0 ? null : (
          <div key={label}>
            <div className="flex items-center gap-2 px-3 py-1 text-[11px]">
              <Icon size={12} style={{ color }} />
              <span className="text-foreground">{label}</span>
              <span className="text-muted-foreground">({items.length})</span>
            </div>
            {items.map((p) => (
              <div key={p.id} className="flex items-start gap-2 px-4 py-1 hover:bg-accent cursor-pointer">
                <Icon size={12} style={{ color }} className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-foreground truncate text-[12px]">{p.message}</div>
                  <div className="text-muted-foreground text-[11px]">
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
