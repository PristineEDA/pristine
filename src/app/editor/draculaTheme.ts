export const draculaThemeDefinition = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
    { token: 'keyword.control', foreground: 'ff79c6' },
    { token: 'support.function', foreground: '50fa7b' },
    { token: 'support.function.shell', foreground: '50fa7b' },
    { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
    { token: 'string', foreground: 'f1fa8c' },
    { token: 'string.invalid', foreground: 'ff5555' },
    { token: 'number', foreground: 'bd93f9' },
    { token: 'identifier', foreground: 'f8f8f2' },
    { token: 'variable', foreground: 'ffb86c' },
    { token: 'variable.automatic', foreground: 'ffb86c', fontStyle: 'bold' },
    { token: 'variable.shell', foreground: '8be9fd' },
    { token: 'delimiter', foreground: 'f8f8f2' },
    { token: 'operator', foreground: 'ff79c6' },
    { token: 'operator.assignment.immediate', foreground: 'ff79c6', fontStyle: 'bold' },
    { token: 'operator.assignment.append', foreground: '50fa7b', fontStyle: 'bold' },
    { token: 'operator.assignment.conditional', foreground: 'bd93f9', fontStyle: 'bold' },
    { token: 'operator.assignment.recursive', foreground: 'ffb86c', fontStyle: 'bold' },
    { token: 'meta.recipe', foreground: '6272a4' },
    { token: 'type', foreground: '8be9fd', fontStyle: 'italic' },
  ],
  colors: {
    'editor.background': '#282a36',
    'editor.foreground': '#f8f8f2',
    'editorLineNumber.foreground': '#6272a4',
    'editorLineNumber.activeForeground': '#f8f8f2',
    'editor.selectionBackground': '#44475a',
    'editor.inactiveSelectionBackground': '#44475a88',
    'editor.lineHighlightBackground': '#44475a55',
    'editorCursor.foreground': '#f8f8f2',
    'editorWhitespace.foreground': '#44475a',
    'editorWidget.background': '#21222c',
    'editorWidget.border': '#6272a4',
    'editorSuggestWidget.background': '#21222c',
    'editorSuggestWidget.border': '#6272a4',
    'editorSuggestWidget.selectedBackground': '#44475a',
    'editorGutter.background': '#282a36',
    'editorError.foreground': '#ff5555',
    'editorWarning.foreground': '#ffb86c',
    'editorIndentGuide.background1': '#44475a',
    'editorIndentGuide.activeBackground1': '#6272a4',
    'editorBracketMatch.background': '#44475a',
    'editorBracketMatch.border': '#f8f8f2',
    'scrollbar.shadow': '#21222c',
    'scrollbarSlider.background': '#44475a88',
    'scrollbarSlider.hoverBackground': '#44475acc',
    'scrollbarSlider.activeBackground': '#6272a4',
  },
} as const;

export function defineDraculaTheme(monaco: any): void {
  if (!monaco) {
    return;
  }

  monaco.editor.defineTheme('dracula', draculaThemeDefinition as any);
}