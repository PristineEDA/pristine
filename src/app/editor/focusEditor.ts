export const MONACO_TEXT_INPUT_SELECTOR = [
  'textarea.inputarea',
  '.inputarea',
  '.native-edit-context',
  'textarea',
  '[contenteditable="true"]',
].join(', ');

export function isMonacoTextInputElement(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('.monaco-editor')
    && target.closest(MONACO_TEXT_INPUT_SELECTOR),
  );
}

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

  return isMonacoTextInputElement(document.activeElement);
}
