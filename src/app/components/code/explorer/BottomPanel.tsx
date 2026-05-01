import { Suspense, lazy, useMemo, useState, type ReactNode } from 'react';
import {
  Terminal, X, Plus,
  AlertCircle, AlertTriangle, Info, Lightbulb,
  Bug, Square,
} from 'lucide-react';
import { summarizeLspProblems, useLspProblems } from '../../../lsp/lspProblems';
import { TerminalPanel } from './TerminalPanel';
import { DebugConsole } from './DebugConsole';
import { terminateTerminalSession } from './terminalSessionStore';
import { Button } from '../../ui/button';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';

const OutputPanel = lazy(() => import('./OutputPanel').then((module) => ({ default: module.OutputPanel })));
const ProblemsTabPanel = lazy(() => import('./ProblemsTabPanel').then((module) => ({ default: module.ProblemsTabPanel })));
const LspPanel = lazy(() => import('./LspPanel').then((module) => ({ default: module.LspPanel })));

type BottomPanelTabId = 'terminal' | 'output' | 'problems' | 'debug' | 'lsp';

interface BottomPanelProps {
  layoutVersion?: string;
  onClose?: () => void;
}

export function BottomPanel({ layoutVersion, onClose }: BottomPanelProps) {
  const [tab, setTab] = useState<BottomPanelTabId>('terminal');
  const problemsList = useLspProblems();
  const problemCounts = useMemo(() => summarizeLspProblems(problemsList), [problemsList]);

  const handleClose = () => {
    void terminateTerminalSession().finally(() => {
      onClose?.();
    });
  };

  const tabs = [
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'output', label: 'Output', icon: null },
    { id: 'problems', label: `Problems (${problemCounts.totalCount})`, icon: null },
    { id: 'debug', label: 'Debug Console', icon: Bug },
    { id: 'lsp', label: 'LSP', icon: null },
  ] as const;

  const panelContent = useMemo<Record<BottomPanelTabId, ReactNode>>(() => ({
    terminal: <TerminalPanel layoutVersion={layoutVersion} />,
    output: (
      <Suspense fallback={<div className="flex h-full items-center justify-center text-muted-foreground text-[12px]">Loading output...</div>}>
        <OutputPanel />
      </Suspense>
    ),
    problems: (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 px-3 py-1 border-b border-border shrink-0">
          <AlertCircle size={11} className="text-destructive" />
          <span className="text-destructive text-[11px]">{problemCounts.errorCount} errors</span>
          <AlertTriangle size={11} className="text-amber-500" />
          <span className="text-amber-500 text-[11px]">{problemCounts.warningCount} warnings</span>
          <Info size={11} className="text-sky-500" />
          <span className="text-sky-500 text-[11px]">{problemCounts.infoCount} infos</span>
          <Lightbulb size={11} className="text-emerald-500" />
          <span className="text-emerald-500 text-[11px]">{problemCounts.hintCount} hints</span>
        </div>
        <Suspense fallback={<div className="flex h-full items-center justify-center text-muted-foreground text-[12px]">Loading problems...</div>}>
          <ProblemsTabPanel problems={problemsList} />
        </Suspense>
      </div>
    ),
    debug: (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 px-3 py-1 border-b border-border shrink-0">
          <Button size="xs" className="text-[11px]">
            <Bug size={11} />
            Start Debugging
          </Button>
          <Button variant="ghost" size="xs" className="text-muted-foreground hover:text-foreground text-[11px]">
            <Square size={11} />
            Stop
          </Button>
        </div>
        <DebugConsole />
      </div>
    ),
    lsp: (
      <Suspense fallback={<div className="flex h-full items-center justify-center text-muted-foreground text-[12px]">Loading LSP events...</div>}>
        <LspPanel />
      </Suspense>
    ),
  }), [layoutVersion, problemCounts.errorCount, problemCounts.hintCount, problemCounts.infoCount, problemCounts.warningCount, problemsList]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-t border-border bg-background">
      {/* Tab bar */}
      <div className="flex items-center h-8 bg-muted/40 border-b border-border shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 h-full transition-colors border-b-2 ${
              tab === t.id
                ? 'text-[12px] font-semibold text-foreground border-primary'
                : 'text-[12px] text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {t.id === 'problems' && problemCounts.errorCount > 0 && (
              <AlertCircle size={11} className="text-destructive" />
            )}
            {t.label}
          </button>
        ))}

        <div className="flex items-center gap-1 ml-auto pr-2">
          <TooltipIconButton content="New Terminal">
            <Button
              variant="ghost"
              size="icon"
              aria-label="New Terminal"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setTab('terminal')}
            >
              <Plus size={13} />
            </Button>
          </TooltipIconButton>
          <TooltipIconButton content="Close Panel">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close Panel"
              className="text-muted-foreground hover:text-foreground"
              onClick={handleClose}
            >
              <X size={13} />
            </Button>
          </TooltipIconButton>
        </div>
      </div>

      {/* Panel content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {panelContent[tab]}
      </div>
    </div>
  );
}
