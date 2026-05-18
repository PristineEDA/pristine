import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusEditorInstance, isMonacoTextInputElement, isMonacoTextInputFocused } from './focusEditor';

describe('focusEditor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('recognizes the active Monaco textarea even when another editor appears first', () => {
    document.body.innerHTML = `
      <div class="monaco-editor"><textarea class="inputarea"></textarea></div>
      <div class="monaco-editor"><textarea class="inputarea" data-testid="active-input"></textarea></div>
    `;

    const activeInput = document.querySelector('[data-testid="active-input"]') as HTMLTextAreaElement;
    activeInput.focus();

    expect(document.activeElement).toBe(activeInput);
    expect(isMonacoTextInputFocused()).toBe(true);
    expect(isMonacoTextInputElement(activeInput)).toBe(true);
  });

  it('recognizes fallback Monaco textareas without the inputarea class', () => {
    document.body.innerHTML = '<div class="monaco-editor"><textarea data-testid="monaco-input"></textarea></div>';

    const input = document.querySelector('[data-testid="monaco-input"]') as HTMLTextAreaElement;
    input.focus();

    expect(isMonacoTextInputFocused()).toBe(true);
    expect(isMonacoTextInputElement(input)).toBe(true);
  });

  it('focuses the Monaco text input after focusing the editor instance', () => {
    const editorDomNode = document.createElement('div');
    const input = document.createElement('textarea');
    const editorFocus = vi.fn();

    editorDomNode.className = 'monaco-editor';
    input.className = 'inputarea';
    editorDomNode.append(input);
    document.body.append(editorDomNode);

    focusEditorInstance({
      focus: editorFocus,
      getDomNode: () => editorDomNode,
    });

    expect(editorFocus).toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });
});
