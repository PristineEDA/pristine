import { describe, expect, it } from 'vitest';

import {
  PRISTINE_CONTEXT_WINDOW,
  mockPristineContextUsage,
} from './pristineAssistantContext';

describe('pristine assistant context mock data', () => {
  it('provides frontend-only token usage for ContextDisplay', () => {
    expect(PRISTINE_CONTEXT_WINDOW).toBe(128_000);
    expect(mockPristineContextUsage).toEqual({
      totalTokens: 53_760,
      inputTokens: 42_180,
      cachedInputTokens: 8_400,
      outputTokens: 9_920,
      reasoningTokens: 1_660,
    });
  });
});