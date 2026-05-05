import { Suspense, lazy, useState } from "react";

import { Skeleton } from "../../ui/skeleton";
import { ASSISTANT_THREAD_LIST_DEFAULT_WIDTH_PX } from "./assistantPanelLayout";

const AIAgentPanel = lazy(() => import('./AIAgentPanel').then((module) => ({ default: module.AIAgentPanel })));
const StaticCheckPanel = lazy(() => import('./StaticCheckPanel').then((module) => ({ default: module.StaticCheckPanel })));
const ReferencesPanel = lazy(() => import('./ReferencesPanel').then((module) => ({ default: module.ReferencesPanel })));

function AssistantPanelSkeleton() {
  return (
    <div
      data-testid="assistant-panel-suspense-skeleton"
      aria-busy="true"
      aria-label="Loading assistant panel"
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
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
        <div className="ml-auto w-full max-w-[72%] space-y-2 rounded-md border border-border/60 px-3 py-2">
          <Skeleton className="ml-auto h-3 w-20" />
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <div className="shrink-0 border-t border-border/60 p-2">
        <div className="rounded-md border border-border bg-background p-2">
          <Skeleton className="mb-2 h-3 w-2/3" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  );
}

interface RightSidePanelProps {
  onFileOpen: (fileId: string, fileName: string) => void;
  onLineJump: (line: number) => void;
  onThreadListExpandedChange?: (expanded: boolean) => void;
  onThreadListWidthChange?: (width: number) => void;
}

export function RightSidePanel({
  onFileOpen,
  onLineJump,
  onThreadListExpandedChange,
  onThreadListWidthChange,
}: RightSidePanelProps) {
  const [tab, setTab] = useState<
    "ai" | "static" | "references"
  >("ai");
  const [threadListExpanded, setThreadListExpanded] = useState(false);
  const [threadListWidth, setThreadListWidth] = useState(ASSISTANT_THREAD_LIST_DEFAULT_WIDTH_PX);

  const tabs = [
    { id: "ai", label: "AI Assistant" },
    { id: "static", label: "Static Check" },
    { id: "references", label: "References" },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-muted/40 overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 transition-colors border-b-2 ${
              tab === t.id
                ? "text-[11px] font-semibold text-foreground border-primary"
                : "text-[11px] text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
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
          <Suspense fallback={<div className="flex h-full items-center justify-center text-muted-foreground text-[12px]">Loading checks...</div>}>
            <StaticCheckPanel
              onFileOpen={onFileOpen}
              onLineJump={onLineJump}
            />
          </Suspense>
        )}
        {tab === "references" && (
          <Suspense fallback={<div className="flex h-full items-center justify-center text-muted-foreground text-[12px]">Loading references...</div>}>
            <ReferencesPanel
              onFileOpen={onFileOpen}
              onLineJump={onLineJump}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
