import type { CSSProperties } from 'react';
import {
  applicationMenus,
  getApplicationMenuItemAction,
  getApplicationMenuItemShortcut,
  isAppMenuItem,
  type AppMenuAction,
} from '../../../menu/applicationMenu';
import { formatShortcutLabel } from '../../../menu/shortcutLabels';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from '../../ui/menubar';

interface MenuBarApplicationMenuProps {
  menuStyle: CSSProperties;
  onMenuValueChange?: (value: string) => void;
  onSelectAction: (action: AppMenuAction | null) => void;
}

function getMenuItemShortcut(menuLabel: string, itemName: string): string {
  return formatShortcutLabel(getApplicationMenuItemShortcut(menuLabel, itemName));
}

function toMenuItemTestId(menuLabel: string, itemName: string): string {
  const segment = `${menuLabel}-${itemName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `menu-item-${segment}`;
}

export function MenuBarApplicationMenu({
  menuStyle,
  onMenuValueChange,
  onSelectAction,
}: MenuBarApplicationMenuProps) {
  return (
    <Menubar
      className="h-8 border-0 rounded-none bg-transparent p-0 shadow-none"
      data-testid="menu-menubar"
      onValueChange={onMenuValueChange}
      style={menuStyle}
    >
      {applicationMenus.map((menu) => (
        <MenubarMenu key={menu.label} value={menu.label}>
          <MenubarTrigger className="px-2.5 h-6 text-[12px] font-normal rounded-sm">
            {menu.label}
          </MenubarTrigger>
          <MenubarContent align="start" sideOffset={4} className="min-w-36 p-0.5">
            {menu.items.map((item, index) => {
              if (!isAppMenuItem(item)) {
                return <MenubarSeparator key={`${menu.label}-separator-${index}`} className="my-0.5" />;
              }

              const action = getApplicationMenuItemAction(menu.label, item.name);
              const shortcut = getMenuItemShortcut(menu.label, item.name);

              return (
                <MenubarItem
                  key={`${menu.label}-${item.name}`}
                  className="px-2 py-1 text-[12px]"
                  data-testid={toMenuItemTestId(menu.label, item.name)}
                  onSelect={() => onSelectAction(action)}
                >
                  {item.name} <MenubarShortcut>{shortcut}</MenubarShortcut>
                </MenubarItem>
              );
            })}
          </MenubarContent>
        </MenubarMenu>
      ))}
    </Menubar>
  );
}
