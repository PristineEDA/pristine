import { Suspense, lazy } from 'react';

const TerminalSurface = lazy(() => import('./TerminalSurface').then((module) => ({ default: module.TerminalSurface })));

interface TerminalPanelProps {
  layoutVersion?: string;
}

export function TerminalPanel({ layoutVersion }: TerminalPanelProps) {
  return (
    <Suspense
      fallback={(
        <div className="flex h-full items-center justify-center bg-background text-muted-foreground text-[12px]">
          Initializing terminal...
        </div>
      )}
    >
      <TerminalSurface layoutVersion={layoutVersion} />
    </Suspense>
  );
}
