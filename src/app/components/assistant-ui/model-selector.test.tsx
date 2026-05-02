import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SparklesIcon } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelSelector, findModelSelection, getFirstModelId } from './model-selector';
import type { ModelProviderOption } from './model-selector';

const mocks = vi.hoisted(() => ({
  modelContext: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
}));

vi.mock('@assistant-ui/react', () => ({
  useAssistantApi: () => ({
    modelContext: mocks.modelContext,
  }),
}));

const providers = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Gateway models',
    icon: (
      <span data-testid="openrouter-provider-icon">
        <SparklesIcon className="size-4" />
      </span>
    ),
    models: [
      {
        id: 'openrouter/openrouter/free',
        name: 'OpenRouter Free',
        description: 'openrouter/free',
      },
      {
        id: 'openrouter/openai/gpt-4.1-mini',
        name: 'GPT 4.1 Mini',
        description: 'openai/gpt-4.1-mini',
      },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      {
        id: 'anthropic/claude-sonnet-4.6',
        name: 'Claude Sonnet 4.6',
        description: 'claude-sonnet-4.6',
      },
    ],
  },
] satisfies ModelProviderOption[];

function getClosestSlot(element: HTMLElement, slot: string) {
  const match = element.closest(`[data-slot="${slot}"]`);
  expect(match).toBeInstanceOf(HTMLElement);
  return match as HTMLElement;
}

describe('ModelSelector', () => {
  beforeEach(() => {
    mocks.modelContext.mockReturnValue({ register: mocks.register });
    mocks.register.mockReturnValue(mocks.unregister);
    mocks.modelContext.mockClear();
    mocks.register.mockClear();
    mocks.unregister.mockClear();
  });

  it('renders a provider submenu selector and registers the selected model context', async () => {
    const user = userEvent.setup();

    render(
      <ModelSelector
        providers={providers}
        defaultValue="openrouter/openrouter/free"
        variant="ghost"
        size="sm"
      />,
    );

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('data-slot', 'model-selector-trigger');
    expect(trigger).toHaveAttribute('data-variant', 'ghost');
    expect(trigger).toHaveAttribute('data-size', 'sm');
    expect(trigger).toHaveTextContent(/^OpenRouter Free$/);
    expect(screen.queryByTestId('openrouter-provider-icon')).not.toBeInTheDocument();
    expect(trigger.querySelector('.text-muted-foreground')).toBeNull();

    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalledTimes(1);
    });
    expect(mocks.register.mock.calls[0]?.[0].getModelContext()).toEqual({
      config: { modelName: 'openrouter/openrouter/free' },
    });

    await user.click(trigger);

    const providerTrigger = getClosestSlot(
      screen.getByRole('menuitem', { name: /OpenRouter\s*\(2\)/ }),
      'model-selector-provider',
    );
    expect(providerTrigger).toHaveTextContent('OpenRouter (2)');
    expect(providerTrigger).toHaveClass('text-[12px]');
    expect(screen.queryByTestId('openrouter-provider-icon')).not.toBeInTheDocument();
    expect(getClosestSlot(providerTrigger, 'model-selector-content')).toHaveClass('!w-24', '!min-w-24');

    await user.hover(providerTrigger);
    const nextModel = await screen.findByText('openai/gpt-4.1-mini');
    const nextModelItem = getClosestSlot(nextModel, 'model-selector-item');
    expect(nextModelItem).toHaveClass('text-[12px]');
    expect(nextModelItem).toHaveTextContent('openai/gpt-4.1-mini');
    expect(nextModelItem).not.toHaveTextContent('GPT 4.1 Mini');
    expect(getClosestSlot(nextModel, 'model-selector-models')).toHaveClass('w-50', 'min-w-50');

    fireEvent.click(nextModelItem);

    await waitFor(() => {
      expect(trigger).toHaveTextContent(/^GPT 4\.1 Mini$/);
      expect(mocks.register).toHaveBeenCalledTimes(2);
    });
    expect(trigger.querySelector('.text-muted-foreground')).toBeNull();
    expect(mocks.unregister).toHaveBeenCalledTimes(1);
    expect(mocks.register.mock.calls[1]?.[0].getModelContext()).toEqual({
      config: { modelName: 'openrouter/openai/gpt-4.1-mini' },
    });
  });

  it('keeps model lookup helpers deterministic for provider groups', () => {
    expect(getFirstModelId(providers)).toBe('openrouter/openrouter/free');
    expect(findModelSelection(providers, 'anthropic/claude-sonnet-4.6')).toMatchObject({
      model: { name: 'Claude Sonnet 4.6' },
      provider: { name: 'Anthropic' },
    });
    expect(findModelSelection(providers, 'missing/model')).toBeUndefined();
  });
});
