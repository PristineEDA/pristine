import { getRootThemeStyles, resolveDraculaPalette, type StyleReader } from './themeSource';

function stripHash(color: string) {
  return color.replace(/^#/, '');
}

export function createDraculaThemeDefinition(styles: StyleReader | null = getRootThemeStyles()) {
  const palette = resolveDraculaPalette(styles);

  return {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: stripHash(palette.pink), fontStyle: 'bold' },
      { token: 'keyword.control', foreground: stripHash(palette.pink) },
      { token: 'support.function', foreground: stripHash(palette.green) },
      { token: 'support.function.shell', foreground: stripHash(palette.green) },
      { token: 'comment', foreground: stripHash(palette.comment), fontStyle: 'italic' },
      { token: 'string', foreground: stripHash(palette.yellow) },
      { token: 'string.invalid', foreground: stripHash(palette.red) },
      { token: 'number', foreground: stripHash(palette.purple) },
      { token: 'identifier', foreground: stripHash(palette.foreground) },
      { token: 'variable', foreground: stripHash(palette.orange) },
      { token: 'variable.automatic', foreground: stripHash(palette.orange), fontStyle: 'bold' },
      { token: 'variable.shell', foreground: stripHash(palette.cyan) },
      { token: 'delimiter', foreground: stripHash(palette.foreground) },
      { token: 'operator', foreground: stripHash(palette.pink) },
      { token: 'operator.assignment.immediate', foreground: stripHash(palette.pink), fontStyle: 'bold' },
      { token: 'operator.assignment.append', foreground: stripHash(palette.green), fontStyle: 'bold' },
      { token: 'operator.assignment.conditional', foreground: stripHash(palette.purple), fontStyle: 'bold' },
      { token: 'operator.assignment.recursive', foreground: stripHash(palette.orange), fontStyle: 'bold' },
      { token: 'meta.recipe', foreground: stripHash(palette.comment) },
      { token: 'type', foreground: stripHash(palette.cyan), fontStyle: 'italic' },
    ],
    colors: {
      'editor.background': palette.background,
      'editor.foreground': palette.foreground,
      'editorLineNumber.foreground': palette.comment,
      'editorLineNumber.activeForeground': palette.foreground,
      'editor.selectionBackground': palette.selection,
      'editor.inactiveSelectionBackground': `${palette.selection}88`,
      'editor.lineHighlightBackground': `${palette.selection}55`,
      'editorCursor.foreground': palette.foreground,
      'editorWhitespace.foreground': palette.selection,
      'editorWidget.background': palette.surface,
      'editorWidget.border': palette.comment,
      'editorSuggestWidget.background': palette.surface,
      'editorSuggestWidget.border': palette.comment,
      'editorSuggestWidget.selectedBackground': palette.selection,
      'editorGutter.background': palette.background,
      'editorError.foreground': palette.red,
      'editorWarning.foreground': palette.orange,
      'editorIndentGuide.background1': palette.selection,
      'editorIndentGuide.activeBackground1': palette.comment,
      'editorBracketMatch.background': palette.selection,
      'editorBracketMatch.border': palette.foreground,
      'scrollbar.shadow': palette.surface,
      'scrollbarSlider.background': `${palette.selection}88`,
      'scrollbarSlider.hoverBackground': `${palette.selection}cc`,
      'scrollbarSlider.activeBackground': palette.comment,
    },
  } as const;
}

export const draculaThemeDefinition = createDraculaThemeDefinition(null);

export function defineDraculaTheme(monaco: any): void {
  if (!monaco) {
    return;
  }

  monaco.editor.defineTheme('dracula', createDraculaThemeDefinition() as any);
}