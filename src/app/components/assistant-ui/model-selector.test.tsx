import { render, screen, waitFor } from '@testing-library/react';
import { SparklesIcon } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelSelector } from './model-selector';

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

const models = [
  {
    id: 'pristine-fast',
    name: 'Pristine Fast',
    description: 'Quick coding passes',
    icon: <SparklesIcon className="size-4" />,
  },
  {
    id: 'pristine-hdl',
    name: 'Pristine HDL',
    description: 'RTL-aware default',
  },
];

describe('ModelSelector', () => {
  beforeEach(() => {
    mocks.modelContext.mockReturnValue({ register: mocks.register });
    mocks.register.mockReturnValue(mocks.unregister);
    mocks.register.mockClear();
    mocks.unregister.mockClear();
  });

  it('renders the selected mock model with sm ghost trigger styling', async () => {
    render(
      <ModelSelector
        models={models}
        defaultValue="pristine-fast"
        variant="ghost"
        size="sm"
      />,
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('data-slot', 'model-selector-trigger');
    expect(trigger).toHaveAttribute('data-variant', 'ghost');
    expect(trigger).toHaveAttribute('data-size', 'sm');
    expect(trigger).toHaveTextContent('Pristine Fast');

    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalledTimes(1);
    });

    const provider = mocks.register.mock.calls[0]?.[0];
    expect(provider.getModelContext()).toEqual({
      config: { modelName: 'pristine-fast' },
    });
  });
});
