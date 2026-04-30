import type { ThreadTokenUsage } from '@assistant-ui/react-ai-sdk';

export const PRISTINE_CONTEXT_WINDOW = 128_000;

export const mockPristineContextUsage = {
  totalTokens: 53_760,
  inputTokens: 42_180,
  cachedInputTokens: 8_400,
  outputTokens: 9_920,
  reasoningTokens: 1_660,
} satisfies ThreadTokenUsage;