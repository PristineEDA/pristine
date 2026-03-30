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

export function createTerminalTheme(styles: StyleReader | null = getRootThemeStyles()): TerminalThemePalette {
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