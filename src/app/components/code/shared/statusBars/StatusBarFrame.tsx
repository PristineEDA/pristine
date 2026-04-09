import type { ReactNode } from 'react';

interface StatusBarFrameProps {
  left: ReactNode;
  right?: ReactNode;
  statusBarId: string;
}

export function StatusBarFrame({ left, right, statusBarId }: StatusBarFrameProps) {
  return (
    <div
      className="flex h-6 shrink-0 select-none items-center overflow-hidden bg-primary text-primary-foreground"
      data-status-bar-id={statusBarId}
      data-testid="status-bar"
    >
      <div className="flex h-full items-center">{left}</div>
      <div className="flex-1" />
      <div className="flex h-full items-center">{right}</div>
    </div>
  );
}
