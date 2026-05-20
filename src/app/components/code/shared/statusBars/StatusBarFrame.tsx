import type { CSSProperties, ReactNode } from 'react';
import { useCodeViewerLayout } from '../../../../context/CodeViewerLayoutContext';

interface StatusBarFrameProps {
  left: ReactNode;
  right?: ReactNode;
  statusBarId: string;
}

export function StatusBarFrame({ left, right, statusBarId }: StatusBarFrameProps) {
  const { layoutMode } = useCodeViewerLayout();
  const isMinimalLayout = layoutMode === 'minimal';
  const statusBarStyle = {
    '--status-bar-item-hover': isMinimalLayout ? 'var(--ide-unified-chrome-hover)' : 'var(--ide-statusbar-hover)',
  } as CSSProperties;

  return (
    <div
      className={isMinimalLayout
        ? 'flex h-6 shrink-0 select-none items-center overflow-hidden bg-ide-unified-chrome-bg text-ide-unified-chrome-fg'
        : 'flex h-6 shrink-0 select-none items-center overflow-hidden border-t border-ide-statusbar-border bg-ide-statusbar-bg text-ide-statusbar-fg'}
      data-code-viewer-layout-mode={layoutMode}
      data-status-bar-id={statusBarId}
      data-testid="status-bar"
      style={statusBarStyle}
    >
      <div className="flex h-full items-center">{left}</div>
      <div className="flex-1" />
      <div className="flex h-full items-center">{right}</div>
    </div>
  );
}
