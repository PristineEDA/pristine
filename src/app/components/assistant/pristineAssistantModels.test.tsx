import { describe, expect, it } from 'vitest';

import {
  PRISTINE_DEFAULT_MODEL_ID,
  pristineModelProviders,
} from './pristineAssistantModels';

describe('pristineAssistantModels', () => {
  it('adapts the full Mastra Studio provider catalog for the frontend selector', () => {
    expect(pristineModelProviders.length).toBeGreaterThan(4);

    const providersById = new Map(
      pristineModelProviders.map((provider) => [provider.id, provider]),
    );

    for (const providerId of ['anthropic', 'google', 'mastra', 'openai', 'openrouter']) {
      expect(providersById.get(providerId)?.models.length).toBeGreaterThan(0);
    }

    const allModelIds = pristineModelProviders.flatMap((provider) =>
      provider.models.map((model) => model.id),
    );

    expect(allModelIds).toContain(PRISTINE_DEFAULT_MODEL_ID);
    expect(new Set(allModelIds).size).toBe(allModelIds.length);
  });
});
