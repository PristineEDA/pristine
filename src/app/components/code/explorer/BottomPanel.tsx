import { Fragment, Suspense, lazy, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Terminal, X, Plus,
  AlertCircle, AlertTriangle, Info, Lightbulb,
  Bug, Square, Logs, Workflow, CircuitBoard, Activity, Maximize, Minimize2, Network,
  SquareSplitHorizontal, Trash2, PackageOpen, FileText, Boxes,
} from 'lucide-react';
import { summarizeLspProblems, useLspProblems } from '../../../lsp/lspProblems';
import { TerminalPanel } from './TerminalPanel';
import { DebugConsole } from './DebugConsole';
import { terminateAllTerminalSessions, terminateTerminalSession } from './terminalSessionStore';
import { Button } from '../../ui/button';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../ui/resizable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
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
const WaveformPanel = lazy(() => import('./waveform/WaveformPanel').then((module) => ({ default: module.WaveformPanel })));
const SynthesisPanel = lazy(() => import('./SynthesisPanel').then((module) => ({ default: module.SynthesisPanel })));

type BottomPanelTabId = 'terminal' | 'output' | 'problems' | 'debug' | 'lsp' | 'schematic' | 'waveform' | 'synthesis';
type BottomPaneContent =
  | { kind: 'tab'; tab: BottomPanelTabId }
  | { kind: 'empty' }
  | { kind: 'placeholder'; label: string; icon: 'file' | 'boxes' };

interface BottomPanelPane {
  id: string;
  content: BottomPaneContent;
  size: number;
}

const MIN_SPLIT_PANE_WIDTH_PX = 260;
const SPLIT_HANDLE_GAP_PX = 4;
const createInitialPane = (): BottomPanelPane => ({
  id: 'bottom-pane-1',
  content: { kind: 'tab', tab: 'terminal' },
  size: 100,
});

const normalizePaneSizes = (panes: BottomPanelPane[]) => {
  const total = panes.reduce((sum, pane) => sum + pane.size, 0);
  if (total <= 0) {
    const fallbackSize = 100 / panes.length;
    return panes.map((pane) => ({ ...pane, size: fallbackSize }));
  }

  return panes.map((pane) => ({ ...pane, size: (pane.size / total) * 100 }));
};

const BOTTOM_PANEL_TAB_ITEMS = [
  { value: 'terminal', label: 'Terminal', icon: Terminal, testId: 'bottom-panel-tab-terminal' },
  { value: 'output', label: 'Output', icon: Logs, testId: 'bottom-panel-tab-output' },
  { value: 'problems', label: 'Problems', icon: AlertCircle, testId: 'bottom-panel-tab-problems' },
  { value: 'debug', label: 'Debug Console', icon: Bug, testId: 'bottom-panel-tab-debug' },
  { value: 'lsp', label: 'LSP', icon: Workflow, testId: 'bottom-panel-tab-lsp' },
  { value: 'schematic', label: 'Schematic', icon: CircuitBoard, testId: 'bottom-panel-tab-schematic' },
  { value: 'waveform', label: 'Waveform', icon: Activity, testId: 'bottom-panel-tab-waveform' },
  { value: 'synthesis', label: 'Synthesis', icon: Network, testId: 'bottom-panel-tab-synthesis' },
] as const satisfies readonly IconTabToggleGroupItem[];

interface BottomPanelProps {
  isMaximized?: boolean;
  layoutVersion?: string;
  onClose?: () => void;
  onMaximizeToggle?: () => void;
}

export function BottomPanel({ isMaximized = false, layoutVersion, onClose, onMaximizeToggle }: BottomPanelProps) {
  const { layoutMode } = useCodeViewerLayout();
  const [panes, setPanes] = useState<BottomPanelPane[]>(() => [createInitialPane()]);
  const [focusedPaneId, setFocusedPaneId] = useState('bottom-pane-1');
  const [focusedPaneMeasuredWidth, setFocusedPaneMeasuredWidth] = useState(Number.POSITIVE_INFINITY);
  const paneRefs = useRef(new Map<string, HTMLDivElement>());
  const nextPaneIndexRef = useRef(2);
  const problemsList = useLspProblems();
  const problemCounts = useMemo(() => summarizeLspProblems(problemsList), [problemsList]);
  const maximizeLabel = isMaximized ? 'Restore Panel' : 'Maximize Panel';
  const MaximizeIcon = isMaximized ? Minimize2 : Maximize;
  const focusedPane = panes.find((pane) => pane.id === focusedPaneId) ?? panes[0];
  const focusedTab = focusedPane?.content.kind === 'tab' ? focusedPane.content.tab : '';
  const canRemoveFocusedPane = panes.length > 1;
  const focusedPaneWidth = focusedPane ? focusedPaneMeasuredWidth : 0;
  const canSplitFocusedPane = focusedPaneWidth >= (MIN_SPLIT_PANE_WIDTH_PX * 2 + SPLIT_HANDLE_GAP_PX);

  const handleClose = () => {
    void terminateAllTerminalSessions().finally(() => {
      onClose?.();
    });
  };

  const updatePaneContent = useCallback((paneId: string, content: BottomPaneContent) => {
    setPanes((currentPanes) => currentPanes.map((pane) => (
      pane.id === paneId ? { ...pane, content } : pane
    )));
    setFocusedPaneId(paneId);
    setFocusedPaneMeasuredWidth(paneRefs.current.get(paneId)?.getBoundingClientRect().width ?? Number.POSITIVE_INFINITY);
  }, []);

  const setFocusedPaneTab = useCallback((tab: BottomPanelTabId) => {
    updatePaneContent(focusedPaneId, { kind: 'tab', tab });
  }, [focusedPaneId, updatePaneContent]);

  const handleSplitFocusedPane = useCallback(() => {
    const targetPane = paneRefs.current.get(focusedPaneId);
    const targetWidth = targetPane?.getBoundingClientRect().width ?? Number.POSITIVE_INFINITY;

    if (targetWidth < (MIN_SPLIT_PANE_WIDTH_PX * 2 + SPLIT_HANDLE_GAP_PX)) {
      return;
    }

    const nextPaneId = `bottom-pane-${nextPaneIndexRef.current}`;
    nextPaneIndexRef.current += 1;
    setPanes((currentPanes) => {
      const focusedIndex = currentPanes.findIndex((pane) => pane.id === focusedPaneId);
      if (focusedIndex < 0) {
        return currentPanes;
      }

      const focused = currentPanes[focusedIndex];
      if (!focused) {
        return currentPanes;
      }

      const halfSize = focused.size / 2;
      const nextPanes = [
        ...currentPanes.slice(0, focusedIndex),
        { ...focused, size: halfSize },
        { id: nextPaneId, content: { kind: 'empty' } satisfies BottomPaneContent, size: halfSize },
        ...currentPanes.slice(focusedIndex + 1),
      ] satisfies BottomPanelPane[];

      return normalizePaneSizes(nextPanes);
    });
    setFocusedPaneId(nextPaneId);
    setFocusedPaneMeasuredWidth(Number.POSITIVE_INFINITY);
  }, [focusedPaneId]);

  const handleRemoveFocusedPane = useCallback(() => {
    if (panes.length <= 1) {
      return;
    }

    const focusedIndex = panes.findIndex((pane) => pane.id === focusedPaneId);
    if (focusedIndex < 0) {
      return;
    }

    const removedPane = panes[focusedIndex];
    if (!removedPane) {
      return;
    }

    const nextPanes = normalizePaneSizes(panes.filter((pane) => pane.id !== removedPane.id));
    const nextFocusedPane = nextPanes[Math.min(focusedIndex, nextPanes.length - 1)] ?? nextPanes[0];
    if (!nextFocusedPane) {
      return;
    }

    if (removedPane.content.kind === 'tab' && removedPane.content.tab === 'terminal') {
      void terminateTerminalSession(removedPane.id);
    }

    setPanes(nextPanes);
    setFocusedPaneId(nextFocusedPane.id);
    setFocusedPaneMeasuredWidth(paneRefs.current.get(nextFocusedPane.id)?.getBoundingClientRect().width ?? Number.POSITIVE_INFINITY);
  }, [focusedPaneId, panes]);

  const handlePaneSizeChange = useCallback((paneId: string, size: number) => {
    setPanes((currentPanes) => {
      const pane = currentPanes.find((currentPane) => currentPane.id === paneId);
      if (!pane || Math.abs(pane.size - size) < 0.001) {
        return currentPanes;
      }

      return currentPanes.map((currentPane) => (
        currentPane.id === paneId ? { ...currentPane, size } : currentPane
      ));
    });
  }, []);

  const renderTabContent = useCallback((paneId: string, tab: BottomPanelTabId): ReactNode => ({
    terminal: <TerminalPanel layoutVersion={layoutVersion} sessionKey={paneId} testId={paneId === 'bottom-pane-1' ? 'terminal-host' : `terminal-host-${paneId}`} />,
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
    waveform: (
      <Suspense fallback={<div className="flex h-full items-center justify-center text-ide-text-muted text-[12px]">Loading waveform...</div>}>
        <WaveformPanel />
      </Suspense>
    ),
    synthesis: (
      <Suspense fallback={<div className="flex h-full items-center justify-center text-ide-text-muted text-[12px]">Loading synthesis data...</div>}>
        <SynthesisPanel />
      </Suspense>
    ),
  }[tab]), [layoutVersion, problemCounts.errorCount, problemCounts.hintCount, problemCounts.infoCount, problemCounts.warningCount, problemsList]);

  const renderEmptyPane = (pane: BottomPanelPane) => (
    <div className="flex h-full min-h-0 items-center justify-center bg-ide-bg">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="gap-2 rounded-md border border-ide-border bg-ide-tab-bg px-3 text-ide-text-muted hover:text-ide-text"
            data-testid={`bottom-panel-open-pane-${pane.id}`}
          >
            <PackageOpen size={15} />
            Open
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-44">
          <DropdownMenuItem
            className="gap-2"
            data-testid={`bottom-panel-open-terminal-${pane.id}`}
            onSelect={() => updatePaneContent(pane.id, { kind: 'tab', tab: 'terminal' })}
          >
            <Terminal size={13} />
            Terminal
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            data-testid={`bottom-panel-open-placeholder-a-${pane.id}`}
            onSelect={() => updatePaneContent(pane.id, { kind: 'placeholder', label: 'Placeholder A', icon: 'file' })}
          >
            <FileText size={13} />
            Placeholder A
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            data-testid={`bottom-panel-open-placeholder-b-${pane.id}`}
            onSelect={() => updatePaneContent(pane.id, { kind: 'placeholder', label: 'Placeholder B', icon: 'boxes' })}
          >
            <Boxes size={13} />
            Placeholder B
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const renderPlaceholderPane = (content: Extract<BottomPaneContent, { kind: 'placeholder' }>) => {
    const PlaceholderIcon = content.icon === 'file' ? FileText : Boxes;

    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-ide-bg text-ide-text-muted">
        <div className="flex flex-col items-center gap-2 text-[12px]">
          <PlaceholderIcon size={18} />
          <span>{content.label}</span>
        </div>
      </div>
    );
  };

  const renderPaneContent = (pane: BottomPanelPane) => {
    if (pane.content.kind === 'empty') {
      return renderEmptyPane(pane);
    }

    if (pane.content.kind === 'placeholder') {
      return renderPlaceholderPane(pane.content);
    }

    return renderTabContent(pane.id, pane.content.tab);
  };

  return (
    <div data-code-viewer-layout-mode={layoutMode} className={getBottomPanelClassName(layoutMode)}>
      {/* Tab bar */}
      <div data-testid="bottom-panel-tab-bar" className={getBottomPanelTabBarClassName(layoutMode)}>
        <IconTabToggleGroup
          items={BOTTOM_PANEL_TAB_ITEMS}
          value={focusedTab}
          onValueChange={(nextValue) => setFocusedPaneTab(nextValue as BottomPanelTabId)}
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
              onClick={() => setFocusedPaneTab('terminal')}
            >
              <Plus size={13} />
            </Button>
          </TooltipIconButton>
          <TooltipIconButton content={canSplitFocusedPane ? 'Split Panel' : 'Split Panel Unavailable'}>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Split Panel"
              data-testid="bottom-panel-split"
              className="text-ide-text-muted hover:text-ide-text disabled:opacity-40"
              disabled={!canSplitFocusedPane}
              onClick={handleSplitFocusedPane}
            >
              <SquareSplitHorizontal size={13} />
            </Button>
          </TooltipIconButton>
          <TooltipIconButton content={canRemoveFocusedPane ? 'Remove Split' : 'Remove Split Unavailable'}>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Remove Split"
              data-testid="bottom-panel-remove-split"
              className="text-ide-text-muted hover:text-ide-text disabled:opacity-40"
              disabled={!canRemoveFocusedPane}
              onClick={handleRemoveFocusedPane}
            >
              <Trash2 size={13} />
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
        <ResizablePanelGroup
          orientation="horizontal"
          layoutGapPx={SPLIT_HANDLE_GAP_PX}
          className="h-full min-h-0 min-w-0"
          data-testid="bottom-panel-split-group"
        >
          {panes.map((pane, index) => (
            <Fragment key={pane.id}>
              <ResizablePanel
                id={`bottom-panel-split-pane-${pane.id}`}
                defaultSize={pane.size}
                minSizePx={MIN_SPLIT_PANE_WIDTH_PX}
                onSizeChange={(size) => handlePaneSizeChange(pane.id, size)}
              >
                <div
                  ref={(node) => {
                    if (node) {
                      paneRefs.current.set(pane.id, node);
                    } else {
                      paneRefs.current.delete(pane.id);
                    }
                  }}
                  data-testid={`bottom-panel-pane-${pane.id}`}
                  data-focused={focusedPaneId === pane.id ? 'true' : 'false'}
                  className="h-full min-h-0 min-w-0 overflow-hidden bg-ide-bg outline-none focus-visible:ring-1 focus-visible:ring-ide-accent/60 data-[focused=true]:ring-1 data-[focused=true]:ring-ide-accent/35"
                  tabIndex={0}
                  onFocus={() => {
                    setFocusedPaneId(pane.id);
                    setFocusedPaneMeasuredWidth(paneRefs.current.get(pane.id)?.getBoundingClientRect().width ?? Number.POSITIVE_INFINITY);
                  }}
                  onPointerDown={() => {
                    setFocusedPaneId(pane.id);
                    setFocusedPaneMeasuredWidth(paneRefs.current.get(pane.id)?.getBoundingClientRect().width ?? Number.POSITIVE_INFINITY);
                  }}
                >
                  {renderPaneContent(pane)}
                </div>
              </ResizablePanel>
              {index < panes.length - 1 && (
                <ResizableHandle
                  data-testid={`bottom-panel-split-handle-${index}`}
                  className="bg-ide-border/80 hover:bg-ide-accent/45"
                />
              )}
            </Fragment>
          ))}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
