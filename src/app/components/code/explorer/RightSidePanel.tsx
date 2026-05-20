import { Suspense, lazy, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '../../ui/skeleton';
import { TooltipProvider } from '../../ui/tooltip';
import { ASSISTANT_THREAD_LIST_DEFAULT_WIDTH_PX } from './assistantPanelLayout';
import { RightPanelTabs, type RightSidePanelTab } from './RightSidePanelChrome';
import { SPLIT_PANEL_CONTENT_TRANSITION_STYLE, useAnimatedSplitPanelPresence } from './useAnimatedSplitPanelPresence';
import { useCodeViewerLayout } from '../../../context/CodeViewerLayoutContext';
import {
  getCodeWorkspacePanelFrameClassName,
  getCodeWorkspacePanelGroupLayoutGapPx,
  getCodeWorkspaceResizeHandleClassName,
  getPanelHeaderClassName,
} from '../shared/codeViewerLayoutStyles';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../ui/resizable';

const AIAgentPanel = lazy(() => import('./AIAgentPanel').then((module) => ({ default: module.AIAgentPanel })));
const FileOutlinePanel = lazy(() => import('./FileOutlinePanel').then((module) => ({ default: module.FileOutlinePanel })));
const StaticCheckPanel = lazy(() => import('./StaticCheckPanel').then((module) => ({ default: module.StaticCheckPanel })));
const ReferencesPanel = lazy(() => import('./ReferencesPanel').then((module) => ({ default: module.ReferencesPanel })));

const RIGHT_PANEL_SECONDARY_TITLE = 'Details';
const RIGHT_PANEL_SECONDARY_PLACEHOLDER = 'Details is empty';

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
  onSplitPanelVisibleChange?: (isVisible: boolean) => void;
  onThreadListExpandedChange?: (expanded: boolean) => void;
  onThreadListWidthChange?: (width: number) => void;
}

export function RightSidePanel({
  currentOutlineId,
  onFileOpen,
  onLineJump,
  onSplitPanelVisibleChange,
  onThreadListExpandedChange,
  onThreadListWidthChange,
}: RightSidePanelProps) {
  const { layoutMode } = useCodeViewerLayout();
  const [tab, setTab] = useState<RightSidePanelTab>('ai');
  const [isSplitPanelVisible, setIsSplitPanelVisible] = useState(false);
  const splitPanelPresence = useAnimatedSplitPanelPresence(isSplitPanelVisible);
  const [threadListExpanded, setThreadListExpanded] = useState(false);
  const [threadListWidth, setThreadListWidth] = useState(ASSISTANT_THREAD_LIST_DEFAULT_WIDTH_PX);
  const splitPanelFrameClassName = getCodeWorkspacePanelFrameClassName(layoutMode, 'flex h-full flex-col bg-ide-bg text-ide-text');

  useEffect(() => {
    onSplitPanelVisibleChange?.(splitPanelPresence.shouldRender);
  }, [onSplitPanelVisibleChange, splitPanelPresence.shouldRender]);

  const primaryPanelContent = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {tab === 'ai' && (
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
      {tab === 'static' && (
        <Suspense fallback={<div className="flex h-full items-center justify-center text-ide-text-muted text-[12px]">Loading checks...</div>}>
          <StaticCheckPanel
            onFileOpen={onFileOpen}
            onLineJump={onLineJump}
          />
        </Suspense>
      )}
      {tab === 'references' && (
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
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div
        data-testid="right-panel-root"
        className={cn(
          'flex h-full min-h-0 flex-col text-ide-text overflow-hidden',
          !(layoutMode === 'minimal' && splitPanelPresence.shouldRender) && 'bg-ide-bg',
        )}
      >
        {!splitPanelPresence.shouldRender && (
          <>
            <RightPanelTabs
              activeTab={tab}
              isSplitPanelVisible={isSplitPanelVisible}
              onTabChange={setTab}
              onToggleSplitPanel={() => {
                setIsSplitPanelVisible((current) => !current);
              }}
            />

            <div data-testid="right-panel-primary-panel" className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {primaryPanelContent}
            </div>
          </>
        )}

        {splitPanelPresence.shouldRender && (
          <ResizablePanelGroup
            data-testid="right-panel-split-group"
            className="flex-1"
            orientation="vertical"
            layoutGapPx={getCodeWorkspacePanelGroupLayoutGapPx(layoutMode)}
          >
            <ResizablePanel id="right-panel-primary" defaultSize={50} minSize={25} minSizePx={120}>
              <section data-testid="right-panel-primary-panel" className={splitPanelFrameClassName}>
                <RightPanelTabs
                  activeTab={tab}
                  isSplitPanelVisible={isSplitPanelVisible}
                  onTabChange={setTab}
                  onToggleSplitPanel={() => {
                    setIsSplitPanelVisible((current) => !current);
                  }}
                />

                {primaryPanelContent}
              </section>
            </ResizablePanel>

            <ResizableHandle
              data-testid="right-panel-split-resize-handle"
              hidden={!splitPanelPresence.isExpanded}
              className={getCodeWorkspaceResizeHandleClassName(layoutMode)}
            />

            <ResizablePanel id="right-panel-secondary" defaultSize={50} minSize={25} minSizePx={120} collapsed={!splitPanelPresence.isExpanded}>
              <RightPanelSecondaryPanel isExpanded={splitPanelPresence.isExpanded} />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </TooltipProvider>
  );
}

function RightPanelSecondaryPanel({ isExpanded }: { isExpanded: boolean }) {
  const { layoutMode } = useCodeViewerLayout();
  const splitPanelFrameClassName = getCodeWorkspacePanelFrameClassName(layoutMode, 'flex h-full flex-col bg-ide-bg text-ide-text');

  return (
    <section
      data-testid="right-panel-secondary-panel"
      className={splitPanelFrameClassName}
      style={{
        ...SPLIT_PANEL_CONTENT_TRANSITION_STYLE,
        opacity: isExpanded ? 1 : 0,
      }}
    >
      <div
        data-testid="right-panel-secondary-header"
        data-code-viewer-layout-mode={layoutMode}
        className={getPanelHeaderClassName(layoutMode)}
      >
        {RIGHT_PANEL_SECONDARY_TITLE}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div data-testid="right-panel-secondary-placeholder" className="px-4 py-3 text-ide-text-muted text-[12px]">
          {RIGHT_PANEL_SECONDARY_PLACEHOLDER}
        </div>
      </div>
    </section>
  );
}
