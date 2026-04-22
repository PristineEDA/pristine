function formatShortcutKeyToken(token: string): string {
  const normalizedToken = token.toLowerCase();

  if (/^f\d{1,2}$/i.test(token)) {
    return token.toUpperCase();
  }

  if (normalizedToken === 'delete') {
    return 'Delete';
  }

  if (normalizedToken === 'escape') {
    return 'Esc';
  }

  if (normalizedToken === 'backspace') {
    return 'Backspace';
  }

  if (normalizedToken === 'enter') {
    return 'Enter';
  }

  if (normalizedToken === 'tab') {
    return 'Tab';
  }

  if (token.length === 1) {
    return token.toUpperCase();
  }

  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function isMacOSPlatform(): boolean {
  return typeof window !== 'undefined' && window.electronAPI?.platform === 'darwin';
}

export function formatShortcutLabel(shortcut?: string): string {
  if (!shortcut) {
    return '';
  }

  const isMacOS = isMacOSPlatform();
  const tokens = shortcut.split('+');
  const keyToken = formatShortcutKeyToken(tokens[tokens.length - 1] ?? '');
  const modifierTokens = tokens.slice(0, -1);

  if (isMacOS) {
    const macModifiers = modifierTokens.map((token) => {
      if (token === 'Mod') {
        return '⌘';
      }

      if (token === 'Shift') {
        return '⇧';
      }

      if (token === 'Alt') {
        return '⌥';
      }

      if (token === 'Ctrl') {
        return '⌃';
      }

      return formatShortcutKeyToken(token);
    });

    return [...macModifiers, keyToken].join('');
  }

  const nonMacModifierOrder = ['Mod', 'Ctrl', 'Alt', 'Shift'];
  const nonMacModifiers = [...modifierTokens]
    .sort((leftToken, rightToken) => {
      const leftOrder = nonMacModifierOrder.indexOf(leftToken);
      const rightOrder = nonMacModifierOrder.indexOf(rightToken);

      if (leftOrder === -1 && rightOrder === -1) {
        return leftToken.localeCompare(rightToken);
      }

      if (leftOrder === -1) {
        return 1;
      }

      if (rightOrder === -1) {
        return -1;
      }

      return leftOrder - rightOrder;
    })
    .map((token) => {
      if (token === 'Mod') {
        return 'Ctrl';
      }

      if (token === 'Ctrl') {
        return 'Ctrl';
      }

      if (token === 'Shift') {
        return 'Shift';
      }

      if (token === 'Alt') {
        return 'Alt';
      }

      return formatShortcutKeyToken(token);
    });

  return [...nonMacModifiers, keyToken].join('+');
}