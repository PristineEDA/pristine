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
    id: 'openai',
    name: 'OpenAI',
    models: [
      {
        id: 'openai/gpt-4.1',
        name: 'GPT 4.1',
        description: 'gpt-4.1',
      },
    ],
  },
  {
    id: 'llama',
    name: 'Llama',
    models: [
      {
        id: 'llama/llama-4-scout',
        name: 'Llama 4 Scout',
        description: 'llama-4-scout',
      },
    ],
  },
  {
    id: 'alibaba',
    name: 'Alibaba',
    models: [
      {
        id: 'alibaba/qwen3-32b',
        name: 'Qwen3 32B',
        description: 'qwen3-32b',
      },
    ],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    models: [
      {
        id: 'minimax/minimax-m2',
        name: 'MiniMax M2',
        description: 'minimax-m2',
      },
    ],
  },
  {
    id: 'mastra',
    name: 'Mastra Gateway',
    models: [
      {
        id: 'mastra/openai/gpt-4.1-mini',
        name: 'GPT 4.1 Mini',
        description: 'openai/gpt-4.1-mini',
      },
    ],
  },
] satisfies ModelProviderOption[];

function getClosestSlot(element: HTMLElement, slot: string) {
  const match = element.closest(`[data-slot="${slot}"]`);
  expect(match).toBeInstanceOf(HTMLElement);
  return match as HTMLElement;
}

function getProviderOrder(section: HTMLElement) {
  return Array.from(section.querySelectorAll('[data-slot="model-selector-provider"]')).map(
    (provider) => provider.getAttribute('data-testid'),
  );
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
        className="!px-1.5 !text-[10px] [&>svg]:!size-3"
      />,
    );

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('data-slot', 'model-selector-trigger');
    expect(trigger).toHaveAttribute('data-variant', 'ghost');
    expect(trigger).toHaveAttribute('data-size', 'sm');
    expect(trigger).toHaveClass('!px-1.5', '!text-[10px]', '[&>svg]:!size-3');
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

    const searchInput = screen.getByRole('textbox', { name: 'Search providers' });
    expect(searchInput).toHaveAttribute('placeholder', 'Search providers...');
    expect(searchInput).toHaveAttribute('data-slot', 'command-input');
    expect(searchInput).toHaveAttribute('spellcheck', 'false');
    expect(searchInput).toHaveClass('pristine-command-search-input');
    expect(searchInput).toHaveStyle('color: var(--ide-text)');

    const searchFrame = getClosestSlot(searchInput, 'command-input-wrapper');
    expect(searchFrame).toHaveClass('flex', 'h-8', 'items-center', 'gap-2', 'px-2.5', 'bg-muted/60');
    expect(searchFrame.querySelector('[data-slot="command-input-icon"]')).toHaveClass(
      'size-3.5',
      'text-ide-text-muted',
    );

    const officialSection = screen.getByTestId('model-selector-section-official');
    const gatewaySection = screen.getByTestId('model-selector-section-gateway');

    expect(officialSection).toHaveTextContent('Official');
    expect(gatewaySection).toHaveTextContent('Gateway');
    expect(getProviderOrder(officialSection)).toEqual([
      'model-selector-provider-alibaba',
      'model-selector-provider-minimax',
      'model-selector-provider-openai',
      'model-selector-provider-llama',
    ]);
    expect(getProviderOrder(gatewaySection)).toEqual([
      'model-selector-provider-openrouter',
    ]);
    expect(within(gatewaySection).getByTestId('model-selector-provider-more')).toBeInTheDocument();
    expect(screen.queryByTestId('model-selector-provider-mastra')).not.toBeInTheDocument();

    const providerTrigger = getClosestSlot(
      screen.getByRole('menuitem', { name: /OpenRouter\s*2/ }),
      'model-selector-provider',
    );
    expect(providerTrigger).toHaveTextContent('OpenRouter');
    expect(providerTrigger).toHaveTextContent('2');
    expect(providerTrigger).toHaveClass('text-[12px]');
    expect(within(providerTrigger).getByTestId('openrouter-provider-icon')).toBeInTheDocument();
    expect(getClosestSlot(providerTrigger, 'model-selector-content')).toHaveClass('w-52', 'min-w-52');

    await user.hover(screen.getByTestId('model-selector-provider-more'));
    const overflowProvider = await screen.findByTestId('model-selector-provider-mastra');
    expect(overflowProvider).toHaveTextContent('Mastra Gateway');

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
    await user.keyboard('mastra');

    await waitFor(() => {
      expect(searchInput).toHaveFocus();
    });
    expect(searchInput).toHaveValue('mastra');

    const gatewaySection = screen.getByTestId('model-selector-section-gateway');
    expect(screen.queryByTestId('model-selector-section-official')).not.toBeInTheDocument();
    expect(screen.queryByTestId('model-selector-provider-more')).not.toBeInTheDocument();

    const firstMatchedProvider = screen.getByTestId('model-selector-provider-mastra');
    expect(firstMatchedProvider).toHaveAttribute('data-search-selected', 'true');
    expect(firstMatchedProvider).toHaveClass('bg-accent', 'text-accent-foreground');
    expect(searchInput).toHaveAttribute('aria-activedescendant', 'model-selector-provider-mastra');
    expect(gatewaySection).toHaveTextContent('Gateway');
    expect(screen.queryByTestId('model-selector-provider-openrouter')).not.toBeInTheDocument();

    await user.hover(firstMatchedProvider);
    const modelItem = getClosestSlot(
      await screen.findByText('openai/gpt-4.1-mini'),
      'model-selector-item',
    );

    fireEvent.click(modelItem);

    await waitFor(() => {
      expect(trigger).toHaveTextContent(/^GPT 4\.1 Mini$/);
      expect(mocks.register).toHaveBeenCalledTimes(2);
    });
    expect(mocks.register.mock.calls[1]?.[0].getModelContext()).toEqual({
      config: { modelName: 'mastra/openai/gpt-4.1-mini' },
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
    await user.keyboard('o');

    const getOpenRouterProvider = () => getClosestSlot(
      screen.getByRole('menuitem', { name: /OpenRouter\s*2/ }),
      'model-selector-provider',
    );
    const getOpenAiProvider = () => getClosestSlot(
      screen.getByRole('menuitem', { name: /OpenAI\s*1/ }),
      'model-selector-provider',
    );

    await waitFor(() => {
      expect(searchInput).toHaveFocus();
      expect(searchInput).toHaveAttribute('aria-activedescendant', 'model-selector-provider-openai');
    });
    expect(getOpenAiProvider()).toHaveAttribute('data-search-selected', 'true');
    expect(getOpenRouterProvider()).toHaveAttribute('data-search-selected', 'false');

    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(searchInput).toHaveFocus();
      expect(searchInput).toHaveAttribute('aria-activedescendant', 'model-selector-provider-openrouter');
    });
    expect(getOpenAiProvider()).toHaveAttribute('data-search-selected', 'false');
    expect(getOpenRouterProvider()).toHaveAttribute('data-search-selected', 'true');

    await user.keyboard('{ArrowUp}');

    await waitFor(() => {
      expect(searchInput).toHaveFocus();
      expect(searchInput).toHaveAttribute('aria-activedescendant', 'model-selector-provider-openai');
    });
    expect(getOpenAiProvider()).toHaveAttribute('data-search-selected', 'true');
    expect(getOpenRouterProvider()).toHaveAttribute('data-search-selected', 'false');
  });

  it('keeps model lookup helpers deterministic for provider groups', () => {
    expect(getFirstModelId(providers)).toBe('openrouter/openrouter/free');
    expect(filterProvidersByQuery(providers, 'openai')).toEqual([providers[1]]);
    expect(filterProvidersByQuery(providers, 'missing')).toEqual([]);
    expect(findModelSelection(providers, 'openai/gpt-4.1')).toMatchObject({
      model: { name: 'GPT 4.1' },
      provider: { name: 'OpenAI' },
    });
    expect(findModelSelection(providers, 'missing/model')).toBeUndefined();
  });
});
