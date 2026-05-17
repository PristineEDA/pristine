import { useState, type CSSProperties } from 'react';
import { Menu } from 'lucide-react';
import type { AppMenuAction } from '../../../menu/applicationMenu';
import { cn } from '@/lib/utils';
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
  const expanded = locked || hoverExpanded || menuOpen;
  const handleHoverEnter = () => setHoverExpanded(true);
  const handleHoverLeave = () => setHoverExpanded(false);

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
        className="h-full w-8 rounded-none border-0 text-muted-foreground data-[state=on]:bg-accent data-[state=on]:text-foreground hover:cursor-pointer hover:bg-accent hover:text-foreground"
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