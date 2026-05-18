import { BetweenHorizontalStart, ListTree, ShieldCheck, Sparkles } from 'lucide-react';
import { Suspense, lazy, useState } from "react";

import {
  compactIconTabToggleIconSize,
  compactIconTabToggleItemClassName,
  IconTabToggleGroup,
} from '../shared/IconTabToggleGroup';
import { Skeleton } from "../../ui/skeleton";
import { TooltipProvider } from '../../ui/tooltip';
import { ASSISTANT_THREAD_LIST_DEFAULT_WIDTH_PX } from "./assistantPanelLayout";
import { useCodeViewerLayout } from '../../../context/CodeViewerLayoutContext';
import { getPanelHeaderClassName } from '../shared/codeViewerLayoutStyles';

const AIAgentPanel = lazy(() => import('./AIAgentPanel').then((module) => ({ default: module.AIAgentPanel })));
const FileOutlinePanel = lazy(() => import('./FileOutlinePanel').then((module) => ({ default: module.FileOutlinePanel })));
const StaticCheckPanel = lazy(() => import('./StaticCheckPanel').then((module) => ({ default: module.StaticCheckPanel })));
const ReferencesPanel = lazy(() => import('./ReferencesPanel').then((module) => ({ default: module.ReferencesPanel })));

type RightSidePanelTab = 'ai' | 'static' | 'references' | 'outline';

const rightPanelTabs = [
  { value: 'ai', label: 'AI Assistant', icon: Sparkles, testId: 'right-panel-tab-ai' },
  { value: 'static', label: 'Static Check', icon: ShieldCheck, testId: 'right-panel-tab-static' },
  { value: 'references', label: 'References', icon: BetweenHorizontalStart, testId: 'right-panel-tab-references' },
  { value: 'outline', label: 'Outline', icon: ListTree, testId: 'right-panel-tab-outline' },
] as const;

function AssistantPanelSkeleton() {
  return (
    <div
      data-testid="assistant-panel-suspense-skeleton"
      aria-busy="true"
      aria-label="Loading assistant panel"
      className="flex h-full min-h-0 flex-col bg-ide-bg text-ide-text"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ide-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-6 rounded-md" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-7 w-8 rounded-md" />
      </div>
      <div className="flex-1 space-y-4 overflow-hidden px-3 py-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
        <div className="ml-auto w-full max-w-[72%] space-y-2 rounded-md border border-ide-border/60 px-3 py-2">
          <Skeleton className="ml-auto h-3 w-20" />
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <div className="shrink-0 border-t border-ide-border/60 p-2">
        <div className="rounded-md border border-ide-border bg-ide-bg p-2">
          <Skeleton className="mb-2 h-3 w-2/3" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  );
}

interface RightSidePanelProps {
  currentOutlineId: string;
  onFileOpen: (fileId: string, fileName: string) => void;
  onLineJump: (line: number) => void;
  onThreadListExpandedChange?: (expanded: boolean) => void;
  onThreadListWidthChange?: (width: number) => void;
}

export function RightSidePanel({
  currentOutlineId,
  onFileOpen,
  onLineJump,
  onThreadListExpandedChange,
  onThreadListWidthChange,
}: RightSidePanelProps) {
  const { layoutMode } = useCodeViewerLayout();
  const [tab, setTab] = useState<RightSidePanelTab>('ai');
  const [threadListExpanded, setThreadListExpanded] = useState(false);
  const [threadListWidth, setThreadListWidth] = useState(ASSISTANT_THREAD_LIST_DEFAULT_WIDTH_PX);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col h-full bg-ide-bg text-ide-text overflow-hidden">
        <div
          data-testid="right-panel-header"
          data-code-viewer-layout-mode={layoutMode}
          className={getPanelHeaderClassName(layoutMode)}
        >
          <IconTabToggleGroup
            items={rightPanelTabs}
            value={tab}
            onValueChange={(nextValue) => {
              setTab(nextValue as RightSidePanelTab);
            }}
            groupLabel="Right panel tabs"
            groupTestId="right-panel-tabs"
            tooltipSide="bottom"
            itemClassName={compactIconTabToggleItemClassName}
            iconSize={compactIconTabToggleIconSize}
          />
        </div>

        <div className="flex-1 overflow-hidden">
          {tab === "ai" && (
            <Suspense fallback={<AssistantPanelSkeleton />}>
              <AIAgentPanel
                initialThreadListExpanded={threadListExpanded}
                initialThreadListWidth={threadListWidth}
                onThreadListExpandedChange={(nextExpanded) => {
                  setThreadListExpanded(nextExpanded);
                  onThreadListExpandedChange?.(nextExpanded);
                }}
                onThreadListWidthChange={(nextWidth) => {
                  setThreadListWidth(nextWidth);
                  onThreadListWidthChange?.(nextWidth);
                }}
              />
            </Suspense>
          )}
          {tab === "static" && (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-ide-text-muted text-[12px]">Loading checks...</div>}>
              <StaticCheckPanel
                onFileOpen={onFileOpen}
                onLineJump={onLineJump}
              />
            </Suspense>
          )}
          {tab === "references" && (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-ide-text-muted text-[12px]">Loading references...</div>}>
              <ReferencesPanel
                onFileOpen={onFileOpen}
                onLineJump={onLineJump}
              />
            </Suspense>
          )}
          {tab === 'outline' && (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-ide-text-muted text-[12px]">Loading outline...</div>}>
              <FileOutlinePanel
                currentOutlineId={currentOutlineId}
                onLineJump={onLineJump}
              />
            </Suspense>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
