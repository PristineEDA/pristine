import { afterEach, describe, expect, it } from 'vitest';
import { isMonacoTextInputKeyboardTarget } from './LeftSidePanelKeyboard';

describe('LeftSidePanelKeyboard', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('recognizes Monaco inputarea targets', () => {
    document.body.innerHTML = '<div class="monaco-editor"><textarea class="inputarea" data-testid="input"></textarea></div>';

    const input = document.querySelector('[data-testid="input"]');

    expect(isMonacoTextInputKeyboardTarget(input)).toBe(true);
  });

  it('recognizes fallback Monaco textarea targets', () => {
    document.body.innerHTML = '<div class="monaco-editor"><textarea data-testid="input"></textarea></div>';

    const input = document.querySelector('[data-testid="input"]');

    expect(isMonacoTextInputKeyboardTarget(input)).toBe(true);
  });

  it('does not treat ordinary textareas as Monaco targets', () => {
    document.body.innerHTML = '<textarea data-testid="input"></textarea>';

    const input = document.querySelector('[data-testid="input"]');

    expect(isMonacoTextInputKeyboardTarget(input)).toBe(false);
  });
});
