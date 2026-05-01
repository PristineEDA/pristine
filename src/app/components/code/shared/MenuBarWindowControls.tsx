import { Minus, Square, X } from 'lucide-react';
import type { CSSProperties } from 'react';

interface MenuBarWindowControlsProps {
  interactiveStyle: CSSProperties;
  onRequestClose: () => void;
}

export function MenuBarWindowControls({
  interactiveStyle,
  onRequestClose,
}: MenuBarWindowControlsProps) {
  return (
    <>
      <button
        data-testid="window-control-minimize"
        className="w-9 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        style={interactiveStyle}
        onClick={() => window.electronAPI?.minimize()}
      >
        <Minus size={14} />
      </button>
      <button
        data-testid="window-control-maximize"
        className="w-9 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        style={interactiveStyle}
        onClick={() => window.electronAPI?.maximize()}
      >
        <Square size={12} />
      </button>
      <button
        data-testid="window-control-close"
        className="w-9 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-destructive/80 transition-colors"
        style={interactiveStyle}
        onClick={onRequestClose}
      >
        <X size={14} />
      </button>
    </>
  );
}
