import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ModelProviderLogo,
  getLocalProviderLogoPath,
  normalizeProviderLogoId,
} from './model-provider-logo';

describe('ModelProviderLogo', () => {
  it('normalizes provider ids using the Mastra Studio logo convention', () => {
    expect(normalizeProviderLogoId('openai.chat')).toBe('openai');
    expect(normalizeProviderLogoId('fireworks-ai')).toBe('fireworks');
    expect(normalizeProviderLogoId('provider/name')).toBe('provider-name');
  });

  it('loads provider logos from the local public asset path', () => {
    expect(getLocalProviderLogoPath('openrouter')).toBe(
      '/model-provider-logos/openrouter.svg',
    );

    render(<ModelProviderLogo providerId="openrouter" providerName="OpenRouter" />);

    expect(screen.getByAltText('OpenRouter logo')).toHaveAttribute(
      'src',
      '/model-provider-logos/openrouter.svg',
    );
  });

  it('falls back locally when a logo is unavailable or fails to load', () => {
    render(<ModelProviderLogo providerId="openrouter" providerName="OpenRouter" />);

    fireEvent.error(screen.getByAltText('OpenRouter logo'));

    expect(screen.getByLabelText('OpenRouter logo fallback')).toHaveTextContent('O');
  });
});
