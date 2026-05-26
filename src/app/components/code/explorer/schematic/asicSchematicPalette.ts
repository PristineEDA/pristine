export interface AsicSchematicPalette {
  background: number;
  grid: number;
  panel: number;
  panelMuted: number;
  border: number;
  text: number;
  textMuted: number;
  accent: number;
  info: number;
  warning: number;
  success: number;
  danger: number;
  wire: number;
  clock: number;
  reset: number;
  selected: number;
}

export function readAsicSchematicPalette(root: Element = document.documentElement): AsicSchematicPalette {
  const style = getComputedStyle(root);

  return {
    background: readCssColor(style, '--ide-bg', 0x111827),
    grid: readCssColor(style, '--ide-border', 0x263241),
    panel: readCssColor(style, '--ide-panel-bg', 0x1f2937),
    panelMuted: readCssColor(style, '--ide-hover', 0x273244),
    border: readCssColor(style, '--ide-border', 0x475569),
    text: readCssColor(style, '--ide-text', 0xe5e7eb),
    textMuted: readCssColor(style, '--ide-text-muted', 0x94a3b8),
    accent: readCssColor(style, '--ide-accent', 0x60a5fa),
    info: readCssColor(style, '--ide-info', 0x38bdf8),
    warning: readCssColor(style, '--ide-warning', 0xf59e0b),
    success: readCssColor(style, '--ide-success', 0x22c55e),
    danger: readCssColor(style, '--ide-error', 0xef4444),
    wire: readCssColor(style, '--ide-text-muted', 0x94a3b8),
    clock: readCssColor(style, '--ide-info', 0x38bdf8),
    reset: readCssColor(style, '--ide-warning', 0xf59e0b),
    selected: readCssColor(style, '--ide-accent', 0x60a5fa),
  };
}

function readCssColor(style: CSSStyleDeclaration, name: string, fallback: number) {
  return parseColor(style.getPropertyValue(name).trim()) ?? fallback;
}

function parseColor(value: string) {
  if (!value) {
    return null;
  }

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const hexValue = hex[1];

    if (!hexValue) {
      return null;
    }

    const normalized = hexValue.length === 3
      ? hexValue.split('').map((character) => character + character).join('')
      : hexValue;
    return Number.parseInt(normalized, 16);
  }

  const rgb = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgb) {
    return (Number(rgb[1]) << 16) + (Number(rgb[2]) << 8) + Number(rgb[3]);
  }

  return null;
}
