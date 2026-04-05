import { getRootThemeStyles, IDE_MONO_FONT_FAMILY, resolveDraculaPalette, type StyleReader } from './themeSource';

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