import { Minus, Square, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCodeViewerLayout } from '../../../context/CodeViewerLayoutContext';

interface MenuBarWindowControlsProps {
  interactiveStyle: CSSProperties;
  onRequestClose: () => void;
}

export function MenuBarWindowControls({
  interactiveStyle,
  onRequestClose,
}: MenuBarWindowControlsProps) {
  const { layoutMode } = useCodeViewerLayout();
  const isMinimalLayout = layoutMode === 'minimal';
  const controlClassName = isMinimalLayout
    ? 'w-9 h-full flex items-center justify-center text-ide-unified-chrome-fg/80 hover:text-ide-unified-chrome-fg hover:bg-ide-unified-chrome-hover transition-colors'
    : 'w-9 h-full flex items-center justify-center text-ide-text-muted hover:text-ide-text hover:bg-ide-hover transition-colors';

  return (
    <>
      <button
        data-testid="window-control-minimize"
        className={controlClassName}
        style={interactiveStyle}
        onClick={() => window.electronAPI?.minimize()}
      >
        <Minus size={14} />
      </button>
      <button
        data-testid="window-control-maximize"
        className={controlClassName}
        style={interactiveStyle}
        onClick={() => window.electronAPI?.maximize()}
      >
        <Square size={12} />
      </button>
      <button
        data-testid="window-control-close"
        className="w-9 h-full flex items-center justify-center text-ide-close hover:text-primary-foreground hover:bg-ide-close transition-colors"
        style={interactiveStyle}
        onClick={onRequestClose}
      >
        <X size={14} />
      </button>
    </>
  );
}
