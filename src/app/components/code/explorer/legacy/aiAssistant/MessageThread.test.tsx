import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AIMessage } from '../../../data/mockData';
import { MessageThread } from './MessageThread';

function createDomRect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    toJSON: () => ({}),
  } as DOMRect;
}

function renderMessageThread(message: AIMessage) {
  render(
    <MessageThread
      bottomRef={{ current: null }}
      isTyping={false}
      messages={[message]}
    />,
  );
}

function getUserBubbleElement(messageText: string) {
  const textNode = screen.getByText(messageText);
  return textNode.parentElement?.parentElement?.parentElement;
}

describe('MessageThread', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps single-line user messages right-aligned', async () => {
    const messageText = 'Short user prompt';

    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () => ({ lineHeight: '16px' } as CSSStyleDeclaration),
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mockRect(this: HTMLElement) {
      if (this.textContent?.includes(messageText)) {
        return createDomRect(120, 16);
      }

      return createDomRect(0, 0);
    });

    renderMessageThread({
      content: messageText,
      id: 'user-1',
      role: 'user',
      timestamp: '10:00 AM',
    });

    await waitFor(() => {
      expect(getUserBubbleElement(messageText)).toHaveClass('ml-auto', 'w-fit', 'text-right');
      expect(getUserBubbleElement(messageText)).not.toHaveClass('text-left');
    });
  });

  it('left-aligns user messages once they wrap beyond one line', async () => {
    const messageText = 'This user message should wrap to a second rendered line';

    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () => ({ lineHeight: '16px' } as CSSStyleDeclaration),
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mockRect(this: HTMLElement) {
      if (this.textContent?.includes(messageText)) {
        return createDomRect(180, 40);
      }

      return createDomRect(0, 0);
    });

    renderMessageThread({
      content: messageText,
      id: 'user-2',
      role: 'user',
      timestamp: '10:01 AM',
    });

    await waitFor(() => {
      expect(getUserBubbleElement(messageText)).toHaveClass('w-full', 'text-left');
      expect(getUserBubbleElement(messageText)).not.toHaveClass('ml-auto');
    });
  });
});