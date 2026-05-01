import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { formatShortcutLabel } from '../../../menu/shortcutLabels';

interface ContextMenuItem {
  kind: 'item';
  label: string;
  action: () => void;
  disabled?: boolean;
  shortcut?: string;
  variant?: 'default' | 'destructive';
}

interface ContextMenuSeparatorItem {
  kind: 'separator';
  key: string;
}

export type ExplorerContextMenuEntry = ContextMenuItem | ContextMenuSeparatorItem;

const EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING = 8;

export interface ExplorerContextMenuRequest {
  path: string;
  token: number;
}

function getFirstEnabledContextMenuItemIndex(items: ExplorerContextMenuEntry[]): number | null {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (item?.kind === 'item' && !item.disabled) {
      return index;
    }
  }

  return null;
}

function getLastEnabledContextMenuItemIndex(items: ExplorerContextMenuEntry[]): number | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];

    if (item?.kind === 'item' && !item.disabled) {
      return index;
    }
  }

  return null;
}

function getNextEnabledContextMenuItemIndex(
  items: ExplorerContextMenuEntry[],
  startIndex: number | null,
  direction: 1 | -1,
): number | null {
  const enabledIndices = items.flatMap((item, index) => (
    item.kind === 'item' && !item.disabled ? [index] : []
  ));

  if (enabledIndices.length === 0) {
    return null;
  }

  if (startIndex === null) {
    return direction === 1 ? enabledIndices[0] ?? null : enabledIndices[enabledIndices.length - 1] ?? null;
  }

  const currentPosition = enabledIndices.indexOf(startIndex);

  if (currentPosition === -1) {
    return direction === 1 ? enabledIndices[0] ?? null : enabledIndices[enabledIndices.length - 1] ?? null;
  }

  const nextPosition = (currentPosition + direction + enabledIndices.length) % enabledIndices.length;
  return enabledIndices[nextPosition] ?? null;
}

function getExplorerContextMenuTop(menuHeight: number, y: number, viewportHeight: number): { top: number; side: 'top' | 'bottom' } {
  const maxTop = Math.max(
    EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING,
    viewportHeight - menuHeight - EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING,
  );

  if (y + menuHeight + EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING <= viewportHeight) {
    return {
      top: Math.min(y, maxTop),
      side: 'bottom',
    };
  }

  return {
    top: Math.max(
      EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING,
      Math.min(y - menuHeight, maxTop),
    ),
    side: 'top',
  };
}

function toExplorerContextMenuItemTestId(label: string): string {
  const normalizedLabel = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `explorer-context-menu-item-${normalizedLabel}`;
}

export function createContextMenuSeparator(key: string): ContextMenuSeparatorItem {
  return {
    kind: 'separator',
    key,
  };
}

export function createContextMenuItem({
  action,
  disabled,
  label,
  shortcut,
  variant,
}: {
  action: () => void;
  disabled?: boolean;
  label: string;
  shortcut?: string;
  variant?: 'default' | 'destructive';
}): ContextMenuItem {
  return {
    kind: 'item',
    label,
    action,
    disabled,
    shortcut,
    variant,
  };
}

export function ExplorerContextMenu({
  items,
  onClose,
  onRequestTreeFocus,
  x,
  y,
}: {
  items: ExplorerContextMenuEntry[];
  onClose: () => void;
  onRequestTreeFocus?: () => void;
  x: number;
  y: number;
}) {
  const itemRefs = useRef(new Map<number, HTMLDivElement | null>());
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(() => getFirstEnabledContextMenuItemIndex(items));
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number; side: 'top' | 'bottom' }>({
    left: x,
    top: y,
    side: 'bottom',
  });

  const focusMenuItem = useCallback((index: number | null) => {
    setFocusedItemIndex(index);

    if (index === null) {
      return;
    }

    itemRefs.current.get(index)?.focus();
  }, []);

  const restoreTreeFocus = useCallback((deferUntilAfterAction: boolean) => {
    if (!onRequestTreeFocus) {
      return;
    }

    if (deferUntilAfterAction) {
      requestAnimationFrame(() => {
        const activeElement = document.activeElement;

        if (!activeElement || activeElement === document.body) {
          onRequestTreeFocus();
        }
      });
      return;
    }

    onRequestTreeFocus();
  }, [onRequestTreeFocus]);

  const closeMenu = useCallback((deferFocusRestore = false) => {
    onClose();
    restoreTreeFocus(deferFocusRestore);
  }, [onClose, restoreTreeFocus]);

  const activateMenuItem = useCallback((index: number) => {
    const item = items[index];

    if (!item || item.kind !== 'item' || item.disabled) {
      return;
    }

    item.action();
    closeMenu(true);
  }, [closeMenu, items]);

  const handleMenuKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(getNextEnabledContextMenuItemIndex(items, focusedItemIndex, 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(getNextEnabledContextMenuItemIndex(items, focusedItemIndex, -1));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(getFirstEnabledContextMenuItemIndex(items));
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(getLastEnabledContextMenuItemIndex(items));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      if (focusedItemIndex === null) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      activateMenuItem(focusedItemIndex);
      return;
    }

    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
    }
  }, [activateMenuItem, closeMenu, focusMenuItem, focusedItemIndex, items]);

  useLayoutEffect(() => {
    const firstEnabledItemIndex = getFirstEnabledContextMenuItemIndex(items);
    setFocusedItemIndex(firstEnabledItemIndex);

    if (firstEnabledItemIndex === null) {
      return;
    }

    itemRefs.current.get(firstEnabledItemIndex)?.focus();
  }, [items]);

  useLayoutEffect(() => {
    const menuElement = menuRef.current;

    if (!menuElement) {
      return;
    }

    const { height } = menuElement.getBoundingClientRect();
    const { top, side } = getExplorerContextMenuTop(height, y, window.innerHeight);

    setMenuPosition((current) => {
      if (current.left === x && current.top === top && current.side === side) {
        return current;
      }

      return {
        left: x,
        top,
        side,
      };
    });
  }, [items, x, y]);

  return (
    <>
      <div className="fixed inset-0 z-40" data-testid="explorer-context-menu-backdrop" onClick={() => closeMenu()} />
      <div
        ref={menuRef}
        role="menu"
        aria-orientation="vertical"
        data-testid="explorer-context-menu"
        data-slot="context-menu-content"
        data-side={menuPosition.side}
        className="fixed z-50 min-w-36 overflow-hidden rounded-md border bg-popover p-0.5 text-popover-foreground shadow-md"
        style={{ left: menuPosition.left, top: menuPosition.top }}
        onKeyDown={handleMenuKeyDown}
      >
        {items.map((item, index) =>
          item.kind === 'separator' ? (
            <div
              key={item.key}
              role="separator"
              data-slot="context-menu-separator"
              className="-mx-1 my-0.5 h-px bg-border"
            />
          ) : (
            <div
              key={item.label}
              ref={(node) => {
                itemRefs.current.set(index, node);
              }}
              role="menuitem"
              tabIndex={focusedItemIndex === index ? 0 : -1}
              data-testid={toExplorerContextMenuItemTestId(item.label)}
              data-slot="context-menu-item"
              data-variant={item.variant ?? 'default'}
              data-disabled={item.disabled ? '' : undefined}
              aria-disabled={item.disabled ? 'true' : undefined}
              className={`relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1 text-[12px] outline-hidden select-none focus:bg-accent focus:text-accent-foreground ${
                item.disabled
                  ? 'pointer-events-none opacity-50'
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
              onFocus={() => {
                if (!item.disabled) {
                  setFocusedItemIndex(index);
                }
              }}
              onMouseEnter={() => {
                if (!item.disabled) {
                  focusMenuItem(index);
                }
              }}
              onClick={() => {
                if (item.disabled) {
                  return;
                }

                activateMenuItem(index);
              }}
            >
              {item.label}
              {item.shortcut ? (
                <span
                  aria-hidden="true"
                  data-slot="context-menu-shortcut"
                  className="ml-auto text-xs tracking-widest text-muted-foreground"
                >
                  {formatShortcutLabel(item.shortcut)}
                </span>
              ) : null}
            </div>
          )
        )}
      </div>
    </>
  );
}
