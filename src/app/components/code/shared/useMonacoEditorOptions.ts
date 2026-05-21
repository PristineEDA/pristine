import { useMemo } from 'react';
import { useEditorSettings } from '../../../context/EditorSettingsContext';
import { getEditorFontFamilyStack } from '../../../editor/editorSettings';

export function useMonacoEditorOptions() {
  const {
    cursorBlinking,
    bracketPairGuides,
    fontFamily,
    fontLigatures,
    fontSize,
    foldingStrategy,
    glyphMargin,
    indentGuides,
    lineNumbers,
    minimapEnabled,
    renderControlCharacters,
    renderWhitespace,
    scrollBeyondLastLine,
    smoothScrolling,
    tabSize,
    wordWrap,
  } = useEditorSettings();
  const editorFontFamily = getEditorFontFamilyStack(fontFamily);
  const editorBehaviorOptions = useMemo(() => ({
    cursorBlinking,
    fontFamily: editorFontFamily,
    fontLigatures,
    fontSize,
    foldingStrategy,
    glyphMargin,
    guides: {
      bracketPairs: bracketPairGuides,
      indentation: indentGuides,
    },
    lineNumbers,
    minimap: { enabled: minimapEnabled, scale: 1, showSlider: 'mouseover' as const },
    renderControlCharacters,
    renderWhitespace,
    scrollBeyondLastLine,
    smoothScrolling,
    tabSize,
    wordWrap,
  }), [
    bracketPairGuides,
    cursorBlinking,
    editorFontFamily,
    foldingStrategy,
    fontLigatures,
    fontSize,
    glyphMargin,
    indentGuides,
    lineNumbers,
    minimapEnabled,
    renderControlCharacters,
    renderWhitespace,
    scrollBeyondLastLine,
    smoothScrolling,
    tabSize,
    wordWrap,
  ]);
  const editorOptions = useMemo(() => ({
    ...editorBehaviorOptions,
    lineNumbersMinChars: 4,
    folding: true,
    automaticLayout: false,
    insertSpaces: true,
    rulers: [80, 120],
    bracketPairColorization: { enabled: true },
    suggest: { showKeywords: true, showSnippets: true },
    quickSuggestions: { other: true, comments: false, strings: false },
    parameterHints: { enabled: true },
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
    padding: { top: 8 },
  }), [editorBehaviorOptions]);

  return {
    editorBehaviorOptions,
    editorFontFamily,
    editorOptions,
  };
}
