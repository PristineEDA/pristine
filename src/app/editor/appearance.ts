import { getRootThemeStyles, IDE_MONO_FONT_FAMILY, resolveDraculaPalette, type StyleReader } from './themeSource';
import { getColorThemePreview } from '../theme/colorThemePreview';
import type { ResolvedColorTheme } from '../theme/colorThemeTypes';

export interface TerminalThemePalette {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export { IDE_MONO_FONT_FAMILY };

const lightTerminalTheme: TerminalThemePalette = {
  background: '#ffffff',
  foreground: '#1f2937',
  cursor: '#1f2937',
  selectionBackground: '#dbeafe',
  black: '#1f2937',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#ca8a04',
  blue: '#2563eb',
  magenta: '#9333ea',
  cyan: '#0891b2',
  white: '#f3f4f6',
  brightBlack: '#6b7280',
  brightRed: '#ef4444',
  brightGreen: '#22c55e',
  brightYellow: '#eab308',
  brightBlue: '#3b82f6',
  brightMagenta: '#a855f7',
  brightCyan: '#06b6d4',
  brightWhite: '#ffffff',
};

export function createTerminalTheme(theme: 'light' | 'dark' = 'dark', styles: StyleReader | null = getRootThemeStyles()): TerminalThemePalette {
  if (theme === 'light') return lightTerminalTheme;

  const palette = resolveDraculaPalette(styles);

  return {
    background: palette.background,
    foreground: palette.foreground,
    cursor: palette.foreground,
    selectionBackground: palette.selection,
    black: palette.surface,
    red: palette.red,
    green: palette.green,
    yellow: palette.yellow,
    blue: palette.cyan,
    magenta: palette.pink,
    cyan: palette.cyan,
    white: palette.foreground,
    brightBlack: palette.comment,
    brightRed: palette.red,
    brightGreen: palette.green,
    brightYellow: palette.yellow,
    brightBlue: palette.cyan,
    brightMagenta: palette.purple,
    brightCyan: palette.cyan,
    brightWhite: palette.brightForeground,
  };
}

function pickThemeColor(theme: ResolvedColorTheme, ids: readonly string[], fallback: string): string {
  for (const id of ids) {
    const value = theme.colors[id];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return fallback;
}

export function createTerminalThemeFromColorTheme(theme: ResolvedColorTheme): TerminalThemePalette {
  const preview = getColorThemePreview(theme);
  const darkFallbackTheme = createTerminalTheme('dark', null);
  const fallbackTheme = theme.kind === 'light'
    ? lightTerminalTheme
    : {
        ...darkFallbackTheme,
        background: preview.background,
        foreground: preview.foreground,
        cursor: preview.brightForeground,
        selectionBackground: preview.selection,
        black: preview.surface,
        red: preview.red,
        green: preview.green,
        yellow: preview.yellow,
        blue: preview.cyan,
        magenta: preview.pink,
        cyan: preview.cyan,
        white: preview.foreground,
        brightBlack: preview.comment,
        brightRed: preview.red,
        brightGreen: preview.green,
        brightYellow: preview.yellow,
        brightBlue: preview.cyan,
        brightMagenta: preview.purple,
        brightCyan: preview.cyan,
        brightWhite: preview.brightForeground,
      };

  return {
    background: pickThemeColor(theme, ['terminal.background', 'editor.background', 'panel.background'], fallbackTheme.background),
    foreground: pickThemeColor(theme, ['terminal.foreground', 'editor.foreground', 'foreground'], fallbackTheme.foreground),
    cursor: pickThemeColor(theme, ['terminalCursor.foreground', 'editorCursor.foreground'], fallbackTheme.cursor),
    selectionBackground: pickThemeColor(theme, ['terminal.selectionBackground', 'editor.selectionBackground'], fallbackTheme.selectionBackground),
    black: pickThemeColor(theme, ['terminal.ansiBlack'], fallbackTheme.black),
    red: pickThemeColor(theme, ['terminal.ansiRed'], fallbackTheme.red),
    green: pickThemeColor(theme, ['terminal.ansiGreen'], fallbackTheme.green),
    yellow: pickThemeColor(theme, ['terminal.ansiYellow'], fallbackTheme.yellow),
    blue: pickThemeColor(theme, ['terminal.ansiBlue'], fallbackTheme.blue),
    magenta: pickThemeColor(theme, ['terminal.ansiMagenta'], fallbackTheme.magenta),
    cyan: pickThemeColor(theme, ['terminal.ansiCyan'], fallbackTheme.cyan),
    white: pickThemeColor(theme, ['terminal.ansiWhite'], fallbackTheme.white),
    brightBlack: pickThemeColor(theme, ['terminal.ansiBrightBlack'], fallbackTheme.brightBlack),
    brightRed: pickThemeColor(theme, ['terminal.ansiBrightRed'], fallbackTheme.brightRed),
    brightGreen: pickThemeColor(theme, ['terminal.ansiBrightGreen'], fallbackTheme.brightGreen),
    brightYellow: pickThemeColor(theme, ['terminal.ansiBrightYellow'], fallbackTheme.brightYellow),
    brightBlue: pickThemeColor(theme, ['terminal.ansiBrightBlue'], fallbackTheme.brightBlue),
    brightMagenta: pickThemeColor(theme, ['terminal.ansiBrightMagenta'], fallbackTheme.brightMagenta),
    brightCyan: pickThemeColor(theme, ['terminal.ansiBrightCyan'], fallbackTheme.brightCyan),
    brightWhite: pickThemeColor(theme, ['terminal.ansiBrightWhite'], fallbackTheme.brightWhite),
  };
}