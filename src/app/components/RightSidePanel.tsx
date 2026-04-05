import { Suspense, lazy, useState } from "react";

const AIAssistantPanel = lazy(() => import('./AIAssistantPanel').then((module) => ({ default: module.AIAssistantPanel })));
const StaticCheckPanel = lazy(() => import('./StaticCheckPanel').then((module) => ({ default: module.StaticCheckPanel })));
const ReferencesPanel = lazy(() => import('./ReferencesPanel').then((module) => ({ default: module.ReferencesPanel })));

interface RightSidePanelProps {
  onFileOpen: (fileId: string, fileName: string) => void;
  onLineJump: (line: number) => void;
}

export function RightSidePanel({
  onFileOpen,
  onLineJump,
}: RightSidePanelProps) {
  const [tab, setTab] = useState<
    "ai" | "static" | "references"
  >("ai");

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
          <Suspense fallback={<div className="flex h-full items-center justify-center text-muted-foreground text-[12px]">Loading assistant...</div>}>
            <AIAssistantPanel />
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
