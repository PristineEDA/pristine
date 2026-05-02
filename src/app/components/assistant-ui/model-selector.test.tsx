import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SparklesIcon } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ModelSelector,
  filterProvidersByQuery,
  findModelSelection,
  getFirstModelId,
} from './model-selector';
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
    expect(within(trigger).queryByTestId('openrouter-provider-icon')).not.toBeInTheDocument();
    expect(trigger.querySelector('.text-muted-foreground')).toBeNull();

    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalledTimes(1);
    });
    expect(mocks.register.mock.calls[0]?.[0].getModelContext()).toEqual({
      config: { modelName: 'openrouter/openrouter/free' },
    });

    await user.click(trigger);

    expect(
      screen.getByRole('textbox', { name: 'Search providers' }),
    ).toHaveAttribute('placeholder', 'Search providers...');

    const providerTrigger = getClosestSlot(
      screen.getByRole('menuitem', { name: /OpenRouter\s*2/ }),
      'model-selector-provider',
    );
    expect(providerTrigger).toHaveTextContent('OpenRouter');
    expect(providerTrigger).toHaveTextContent('2');
    expect(providerTrigger).toHaveClass('text-[12px]');
    expect(within(providerTrigger).getByTestId('openrouter-provider-icon')).toBeInTheDocument();
    expect(getClosestSlot(providerTrigger, 'model-selector-content')).toHaveClass('w-52', 'min-w-52');

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

  it('filters providers from the search field while preserving submenu selection', async () => {
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
    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalledTimes(1);
    });

    await user.click(trigger);
    const searchInput = screen.getByRole('textbox', { name: 'Search providers' });

    await user.click(searchInput);
    await user.keyboard('a');

    await waitFor(() => {
      expect(searchInput).toHaveFocus();
    });
    expect(searchInput).toHaveValue('a');

    const firstMatchedProvider = getClosestSlot(
      screen.getByRole('menuitem', { name: /Anthropic\s*1/ }),
      'model-selector-provider',
    );
    expect(firstMatchedProvider).toHaveAttribute('data-search-selected', 'true');
    expect(firstMatchedProvider).toHaveClass('bg-accent', 'text-accent-foreground');
    expect(searchInput).toHaveAttribute('aria-activedescendant', 'model-selector-provider-anthropic');

    await user.keyboard('nthropic');

    await waitFor(() => {
      expect(searchInput).toHaveFocus();
    });
    expect(searchInput).toHaveValue('anthropic');

    expect(screen.queryByRole('menuitem', { name: /OpenRouter\s*2/ })).not.toBeInTheDocument();

    const providerTrigger = getClosestSlot(
      screen.getByRole('menuitem', { name: /Anthropic\s*1/ }),
      'model-selector-provider',
    );
    expect(providerTrigger).toHaveAttribute('data-search-selected', 'true');

    await user.hover(providerTrigger);
    const modelItem = getClosestSlot(
      await screen.findByText('claude-sonnet-4.6'),
      'model-selector-item',
    );

    fireEvent.click(modelItem);

    await waitFor(() => {
      expect(trigger).toHaveTextContent(/^Claude Sonnet 4\.6$/);
      expect(mocks.register).toHaveBeenCalledTimes(2);
    });
    expect(mocks.register.mock.calls[1]?.[0].getModelContext()).toEqual({
      config: { modelName: 'anthropic/claude-sonnet-4.6' },
    });
  });

  it('moves the active matched provider with ArrowUp and ArrowDown while search focus stays in the input', async () => {
    const user = userEvent.setup();

    render(
      <ModelSelector
        providers={providers}
        defaultValue="openrouter/openrouter/free"
        variant="ghost"
        size="sm"
      />,
    );

    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button'));

    const searchInput = screen.getByRole('textbox', { name: 'Search providers' });
    await user.click(searchInput);
    await user.keyboard('r');

    const getOpenRouterProvider = () => getClosestSlot(
      screen.getByRole('menuitem', { name: /OpenRouter\s*2/ }),
      'model-selector-provider',
    );
    const getAnthropicProvider = () => getClosestSlot(
      screen.getByRole('menuitem', { name: /Anthropic\s*1/ }),
      'model-selector-provider',
    );

    await waitFor(() => {
      expect(searchInput).toHaveFocus();
      expect(searchInput).toHaveAttribute('aria-activedescendant', 'model-selector-provider-openrouter');
    });
    expect(getOpenRouterProvider()).toHaveAttribute('data-search-selected', 'true');
    expect(getAnthropicProvider()).toHaveAttribute('data-search-selected', 'false');

    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(searchInput).toHaveFocus();
      expect(searchInput).toHaveAttribute('aria-activedescendant', 'model-selector-provider-anthropic');
    });
    expect(getOpenRouterProvider()).toHaveAttribute('data-search-selected', 'false');
    expect(getAnthropicProvider()).toHaveAttribute('data-search-selected', 'true');

    await user.keyboard('{ArrowUp}');

    await waitFor(() => {
      expect(searchInput).toHaveFocus();
      expect(searchInput).toHaveAttribute('aria-activedescendant', 'model-selector-provider-openrouter');
    });
    expect(getOpenRouterProvider()).toHaveAttribute('data-search-selected', 'true');
    expect(getAnthropicProvider()).toHaveAttribute('data-search-selected', 'false');
  });

  it('keeps model lookup helpers deterministic for provider groups', () => {
    expect(getFirstModelId(providers)).toBe('openrouter/openrouter/free');
    expect(filterProvidersByQuery(providers, 'anthropic')).toEqual([providers[1]]);
    expect(filterProvidersByQuery(providers, 'missing')).toEqual([]);
    expect(findModelSelection(providers, 'anthropic/claude-sonnet-4.6')).toMatchObject({
      model: { name: 'Claude Sonnet 4.6' },
      provider: { name: 'Anthropic' },
    });
    expect(findModelSelection(providers, 'missing/model')).toBeUndefined();
  });
});
