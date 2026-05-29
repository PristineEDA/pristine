import { Suspense, lazy, useMemo, useState, type ReactNode } from 'react';
import {
  Terminal, X, Plus,
  AlertCircle, AlertTriangle, Info, Lightbulb,
  Bug, Square, Logs, Workflow, CircuitBoard, Maximize, Minimize2,
} from 'lucide-react';
import { summarizeLspProblems, useLspProblems } from '../../../lsp/lspProblems';
import { TerminalPanel } from './TerminalPanel';
import { DebugConsole } from './DebugConsole';
import { terminateTerminalSession } from './terminalSessionStore';
import { Button } from '../../ui/button';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';
import {
  compactIconTabToggleIconSize,
  compactIconTabToggleItemClassName,
  IconTabToggleGroup,
  type IconTabToggleGroupItem,
} from '../shared/IconTabToggleGroup';
import { useCodeViewerLayout } from '../../../context/CodeViewerLayoutContext';
import { getBottomPanelClassName, getBottomPanelTabBarClassName } from '../shared/codeViewerLayoutStyles';

const OutputPanel = lazy(() => import('./OutputPanel').then((module) => ({ default: module.OutputPanel })));
const ProblemsTabPanel = lazy(() => import('./ProblemsTabPanel').then((module) => ({ default: module.ProblemsTabPanel })));
const LspPanel = lazy(() => import('./LspPanel').then((module) => ({ default: module.LspPanel })));
const AsicSchematicPanel = lazy(() => import('./schematic/AsicSchematicPanel').then((module) => ({ default: module.AsicSchematicPanel })));

type BottomPanelTabId = 'terminal' | 'output' | 'problems' | 'debug' | 'lsp' | 'schematic';

const BOTTOM_PANEL_TAB_ITEMS = [
  { value: 'terminal', label: 'Terminal', icon: Terminal, testId: 'bottom-panel-tab-terminal' },
  { value: 'output', label: 'Output', icon: Logs, testId: 'bottom-panel-tab-output' },
  { value: 'problems', label: 'Problems', icon: AlertCircle, testId: 'bottom-panel-tab-problems' },
  { value: 'debug', label: 'Debug Console', icon: Bug, testId: 'bottom-panel-tab-debug' },
  { value: 'lsp', label: 'LSP', icon: Workflow, testId: 'bottom-panel-tab-lsp' },
  { value: 'schematic', label: 'Schematic', icon: CircuitBoard, testId: 'bottom-panel-tab-schematic' },
] as const satisfies readonly IconTabToggleGroupItem[];

interface BottomPanelProps {
  isMaximized?: boolean;
  layoutVersion?: string;
  onClose?: () => void;
  onMaximizeToggle?: () => void;
}

export function BottomPanel({ isMaximized = false, layoutVersion, onClose, onMaximizeToggle }: BottomPanelProps) {
  const { layoutMode } = useCodeViewerLayout();
  const [tab, setTab] = useState<BottomPanelTabId>('terminal');
  const problemsList = useLspProblems();
  const problemCounts = useMemo(() => summarizeLspProblems(problemsList), [problemsList]);
  const maximizeLabel = isMaximized ? 'Restore Panel' : 'Maximize Panel';
  const MaximizeIcon = isMaximized ? Minimize2 : Maximize;

  const handleClose = () => {
    void terminateTerminalSession().finally(() => {
      onClose?.();
    });
  };

  const panelContent = useMemo<Record<BottomPanelTabId, ReactNode>>(() => ({
    terminal: <TerminalPanel layoutVersion={layoutVersion} />,
    output: (
      <Suspense fallback={<div className="flex h-full items-center justify-center text-ide-text-muted text-[12px]">Loading output...</div>}>
        <OutputPanel />
      </Suspense>
    ),
    problems: (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 px-3 py-1 border-b border-ide-border shrink-0">
          <AlertCircle size={11} className="text-ide-error" />
          <span className="text-ide-error text-[11px]">{problemCounts.errorCount} errors</span>
          <AlertTriangle size={11} className="text-ide-warning" />
          <span className="text-ide-warning text-[11px]">{problemCounts.warningCount} warnings</span>
          <Info size={11} className="text-ide-info" />
          <span className="text-ide-info text-[11px]">{problemCounts.infoCount} infos</span>
          <Lightbulb size={11} className="text-ide-success" />
          <span className="text-ide-success text-[11px]">{problemCounts.hintCount} hints</span>
        </div>
        <Suspense fallback={<div className="flex h-full items-center justify-center text-ide-text-muted text-[12px]">Loading problems...</div>}>
          <ProblemsTabPanel problems={problemsList} />
        </Suspense>
      </div>
    ),
    debug: (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 px-3 py-1 border-b border-ide-border shrink-0">
          <Button size="xs" className="text-[11px]">
            <Bug size={11} />
            Start Debugging
          </Button>
          <Button variant="ghost" size="xs" className="text-ide-text-muted hover:text-ide-text text-[11px]">
            <Square size={11} />
            Stop
          </Button>
        </div>
        <DebugConsole />
      </div>
    ),
    lsp: (
      <Suspense fallback={<div className="flex h-full items-center justify-center text-ide-text-muted text-[12px]">Loading LSP events...</div>}>
        <LspPanel />
      </Suspense>
    ),
    schematic: (
      <Suspense fallback={<div className="flex h-full items-center justify-center text-ide-text-muted text-[12px]">Loading schematic...</div>}>
        <AsicSchematicPanel />
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
          itemClassName={compactIconTabToggleItemClassName}
          iconSize={compactIconTabToggleIconSize}
        />

        <div className="ml-auto flex items-center gap-1">
          <TooltipIconButton content="New Terminal">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="New Terminal"
              className="text-ide-text-muted hover:text-ide-text"
              onClick={() => setTab('terminal')}
            >
              <Plus size={13} />
            </Button>
          </TooltipIconButton>
          {onMaximizeToggle && (
            <TooltipIconButton content={maximizeLabel}>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={maximizeLabel}
                data-testid="bottom-panel-maximize"
                className="text-ide-text-muted hover:text-ide-text"
                onClick={onMaximizeToggle}
              >
                <MaximizeIcon size={13} />
              </Button>
            </TooltipIconButton>
          )}
          <TooltipIconButton content="Close Panel">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Close Panel"
              className="text-ide-text-muted hover:text-ide-text"
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
