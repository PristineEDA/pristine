const MONACO_TEXT_INPUT_SELECTOR = 'textarea.inputarea, .inputarea, .native-edit-context';

export function focusEditorInstance(editor: any) {
  const editorDomNode = editor?.getDomNode?.();
  const textInput = editorDomNode?.querySelector?.(MONACO_TEXT_INPUT_SELECTOR);

  editorDomNode?.focus?.();
  editor?.focus?.();
  textInput?.focus?.();
}

export function isMonacoTextInputFocused() {
  if (typeof document === 'undefined') {
    return false;
  }

  const textInput = document.querySelector(`.monaco-editor ${MONACO_TEXT_INPUT_SELECTOR}`);
  return Boolean(textInput && document.activeElement === textInput);
}