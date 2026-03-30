export const IDE_MONO_FONT_FAMILY = '"JetBrains Mono", "Cascadia Code", "Fira Code", Consolas, monospace';

export type StyleReader = Pick<CSSStyleDeclaration, 'getPropertyValue'>;

export interface DraculaPalette {
  surface: string;
  background: string;
  input: string;
  selection: string;
  comment: string;
  foreground: string;
  brightForeground: string;
  pink: string;
  purple: string;
  cyan: string;
  green: string;
  yellow: string;
  red: string;
  orange: string;
}

const draculaPaletteFallback: DraculaPalette = {
  surface: '#21222c',
  background: '#282a36',
  input: '#2d2f3e',
  selection: '#44475a',
  comment: '#6272a4',
  foreground: '#f8f8f2',
  brightForeground: '#fcfcfc',
  pink: '#ff79c6',
  purple: '#bd93f9',
  cyan: '#8be9fd',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  red: '#ff5555',
  orange: '#ffb86c',
};

const draculaPaletteVariables: Record<keyof DraculaPalette, string> = {
  surface: '--ide-dracula-surface',
  background: '--ide-dracula-background',
  input: '--ide-dracula-input',
  selection: '--ide-dracula-selection',
  comment: '--ide-dracula-comment',
  foreground: '--ide-dracula-foreground',
  brightForeground: '--ide-dracula-bright-foreground',
  pink: '--ide-dracula-pink',
  purple: '--ide-dracula-purple',
  cyan: '--ide-dracula-cyan',
  green: '--ide-dracula-green',
  yellow: '--ide-dracula-yellow',
  red: '--ide-dracula-red',
  orange: '--ide-dracula-orange',
};

function readThemeValue(styles: StyleReader, variableName: string, fallback: string) {
  const value = styles.getPropertyValue(variableName).trim();
  return value || fallback;
}

export function getRootThemeStyles(): StyleReader | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  return window.getComputedStyle(document.documentElement);
}

export function resolveDraculaPalette(styles: StyleReader | null = getRootThemeStyles()): DraculaPalette {
  if (!styles) {
    return { ...draculaPaletteFallback };
  }

  return {
    surface: readThemeValue(styles, draculaPaletteVariables.surface, draculaPaletteFallback.surface),
    background: readThemeValue(styles, draculaPaletteVariables.background, draculaPaletteFallback.background),
    input: readThemeValue(styles, draculaPaletteVariables.input, draculaPaletteFallback.input),
    selection: readThemeValue(styles, draculaPaletteVariables.selection, draculaPaletteFallback.selection),
    comment: readThemeValue(styles, draculaPaletteVariables.comment, draculaPaletteFallback.comment),
    foreground: readThemeValue(styles, draculaPaletteVariables.foreground, draculaPaletteFallback.foreground),
    brightForeground: readThemeValue(styles, draculaPaletteVariables.brightForeground, draculaPaletteFallback.brightForeground),
    pink: readThemeValue(styles, draculaPaletteVariables.pink, draculaPaletteFallback.pink),
    purple: readThemeValue(styles, draculaPaletteVariables.purple, draculaPaletteFallback.purple),
    cyan: readThemeValue(styles, draculaPaletteVariables.cyan, draculaPaletteFallback.cyan),
    green: readThemeValue(styles, draculaPaletteVariables.green, draculaPaletteFallback.green),
    yellow: readThemeValue(styles, draculaPaletteVariables.yellow, draculaPaletteFallback.yellow),
    red: readThemeValue(styles, draculaPaletteVariables.red, draculaPaletteFallback.red),
    orange: readThemeValue(styles, draculaPaletteVariables.orange, draculaPaletteFallback.orange),
  };
}