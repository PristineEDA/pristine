import { useState, type CSSProperties } from 'react';
import { Menu } from 'lucide-react';
import type { AppMenuAction } from '../../../menu/applicationMenu';
import { cn } from '@/lib/utils';
import { useCodeViewerLayout } from '../../../context/CodeViewerLayoutContext';
import { Toggle } from '../../ui/toggle';
import { MenuBarApplicationMenu } from './MenuBarApplicationMenu';

interface MenuBarApplicationMenuCollapsibleProps {
  interactiveStyle: CSSProperties;
  menuStyle: CSSProperties;
  onSelectAction: (action: AppMenuAction | null) => void;
}

export function MenuBarApplicationMenuCollapsible({
  interactiveStyle,
  menuStyle,
  onSelectAction,
}: MenuBarApplicationMenuCollapsibleProps) {
  const [locked, setLocked] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { layoutMode } = useCodeViewerLayout();
  const expanded = locked || hoverExpanded || menuOpen;
  const handleHoverEnter = () => setHoverExpanded(true);
  const handleHoverLeave = () => setHoverExpanded(false);
  const isMinimalLayout = layoutMode === 'minimal';
  const toggleClassName = isMinimalLayout
    ? 'h-full w-8 rounded-none border-0 text-ide-unified-chrome-fg/80 data-[state=on]:bg-ide-unified-chrome-hover data-[state=on]:text-ide-unified-chrome-fg hover:cursor-pointer hover:bg-ide-unified-chrome-hover hover:text-ide-unified-chrome-fg'
    : 'h-full w-8 rounded-none border-0 text-ide-text-muted data-[state=on]:bg-ide-hover data-[state=on]:text-ide-text hover:cursor-pointer hover:bg-ide-hover hover:text-ide-text';

  return (
    <div
      data-testid="menu-menubar-collapsible"
      data-expanded={expanded ? 'true' : 'false'}
      data-locked={locked ? 'true' : 'false'}
      className="flex h-full shrink-0 items-center"
      onMouseEnter={handleHoverEnter}
      onMouseLeave={handleHoverLeave}
      onPointerEnter={handleHoverEnter}
      onPointerLeave={handleHoverLeave}
      style={menuStyle}
    >
      <Toggle
        aria-label={locked ? 'Unlock application menu' : 'Lock application menu'}
        data-testid="menu-menubar-toggle"
        pressed={locked}
        className={toggleClassName}
        onMouseEnter={handleHoverEnter}
        onPointerEnter={handleHoverEnter}
        onPressedChange={setLocked}
        style={interactiveStyle}
      >
        <Menu size={15} />
      </Toggle>

      <div
        data-testid="menu-menubar-shell"
        data-expanded={expanded ? 'true' : 'false'}
        data-locked={locked ? 'true' : 'false'}
        aria-hidden={!expanded}
        className={cn(
          'flex h-full items-center overflow-hidden transition-[max-width,opacity,margin-left] duration-150 ease-out',
          expanded ? 'ml-1 max-w-[180px] opacity-100' : 'ml-0 max-w-0 opacity-0 pointer-events-none',
        )}
      >
        {expanded ? (
          <MenuBarApplicationMenu
            menuStyle={menuStyle}
            onMenuValueChange={(value) => setMenuOpen(Boolean(value))}
            onSelectAction={onSelectAction}
          />
        ) : null}
      </div>
    </div>
  );
}