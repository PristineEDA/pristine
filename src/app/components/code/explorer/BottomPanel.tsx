import { Suspense, lazy, useMemo, useState, type ReactNode } from 'react';
import {
  Terminal, X, Plus,
  AlertCircle, AlertTriangle, Info, Lightbulb,
  Bug, Square, Logs, Workflow,
} from 'lucide-react';
import { summarizeLspProblems, useLspProblems } from '../../../lsp/lspProblems';
import { TerminalPanel } from './TerminalPanel';
import { DebugConsole } from './DebugConsole';
import { terminateTerminalSession } from './terminalSessionStore';
import { Button } from '../../ui/button';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';
import { IconTabToggleGroup, type IconTabToggleGroupItem } from '../shared/IconTabToggleGroup';
import { useCodeViewerLayout } from '../../../context/CodeViewerLayoutContext';
import { getBottomPanelClassName, getBottomPanelTabBarClassName } from '../shared/codeViewerLayoutStyles';

const OutputPanel = lazy(() => import('./OutputPanel').then((module) => ({ default: module.OutputPanel })));
const ProblemsTabPanel = lazy(() => import('./ProblemsTabPanel').then((module) => ({ default: module.ProblemsTabPanel })));
const LspPanel = lazy(() => import('./LspPanel').then((module) => ({ default: module.LspPanel })));

type BottomPanelTabId = 'terminal' | 'output' | 'problems' | 'debug' | 'lsp';

const BOTTOM_PANEL_TAB_ITEMS = [
  { value: 'terminal', label: 'Terminal', icon: Terminal, testId: 'bottom-panel-tab-terminal' },
  { value: 'output', label: 'Output', icon: Logs, testId: 'bottom-panel-tab-output' },
  { value: 'problems', label: 'Problems', icon: AlertCircle, testId: 'bottom-panel-tab-problems' },
  { value: 'debug', label: 'Debug Console', icon: Bug, testId: 'bottom-panel-tab-debug' },
  { value: 'lsp', label: 'LSP', icon: Workflow, testId: 'bottom-panel-tab-lsp' },
] as const satisfies readonly IconTabToggleGroupItem[];

interface BottomPanelProps {
  layoutVersion?: string;
  onClose?: () => void;
}

export function BottomPanel({ layoutVersion, onClose }: BottomPanelProps) {
  const { layoutMode } = useCodeViewerLayout();
  const [tab, setTab] = useState<BottomPanelTabId>('terminal');
  const problemsList = useLspProblems();
  const problemCounts = useMemo(() => summarizeLspProblems(problemsList), [problemsList]);

  const handleClose = () => {
    void terminateTerminalSession().finally(() => {
      onClose?.();
    });
  };

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
    <div data-code-viewer-layout-mode={layoutMode} className={getBottomPanelClassName(layoutMode)}>
      {/* Tab bar */}
      <div data-testid="bottom-panel-tab-bar" className={getBottomPanelTabBarClassName(layoutMode)}>
        <IconTabToggleGroup
          items={BOTTOM_PANEL_TAB_ITEMS}
          value={tab}
          onValueChange={(nextValue) => setTab(nextValue as BottomPanelTabId)}
          groupLabel="Bottom panel tabs"
          groupTestId="bottom-panel-tab-group"
          tooltipSide="top"
          className="shrink-0"
          itemClassName="h-7 w-7 rounded-md"
          iconSize={12}
        />

        <div className="ml-auto flex items-center gap-1">
          <TooltipIconButton content="New Terminal">
            <Button
              variant="ghost"
              size="icon-xs"
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
              size="icon-xs"
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
