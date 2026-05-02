import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  ComposerModeSelector,
  DEFAULT_COMPOSER_MODE,
} from './composer-mode-selector';

function getClosestSlot(element: HTMLElement, slot: string) {
  const match = element.closest(`[data-slot="${slot}"]`);
  expect(match).toBeInstanceOf(HTMLElement);
  return match as HTMLElement;
}

describe('ComposerModeSelector', () => {
  it('renders the default mode trigger and menu content', async () => {
    const user = userEvent.setup();

    render(
      <ComposerModeSelector
        defaultValue={DEFAULT_COMPOSER_MODE}
        variant="ghost"
        size="sm"
      />,
    );

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('data-slot', 'composer-mode-selector-trigger');
    expect(trigger).toHaveAttribute('data-variant', 'ghost');
    expect(trigger).toHaveAttribute('data-size', 'sm');
    expect(trigger).toHaveTextContent(/^Agent$/);

    await user.click(trigger);

    const agentItem = getClosestSlot(
      screen.getByRole('menuitem', { name: /Agent/ }),
      'composer-mode-selector-item',
    );
    const askItem = getClosestSlot(
      screen.getByRole('menuitem', { name: /^Ask$/ }),
      'composer-mode-selector-item',
    );
    const planItem = getClosestSlot(
      screen.getByRole('menuitem', { name: /^Plan$/ }),
      'composer-mode-selector-item',
    );

    expect(getClosestSlot(agentItem, 'composer-mode-selector-content')).toHaveClass('w-48', 'min-w-48');
    expect(agentItem).toHaveAttribute('data-selected', 'true');
    expect(agentItem).toHaveClass('text-[12px]', 'bg-accent', 'text-accent-foreground');
    expect(within(agentItem).getByText('Ctrl+Shift+I')).toBeInTheDocument();
    expect(askItem).toHaveAttribute('data-selected', 'false');
    expect(askItem).toHaveClass('text-[12px]');
    expect(within(askItem).queryByText('Ctrl+Shift+I')).toBeNull();
    expect(planItem).toHaveAttribute('data-selected', 'false');
    expect(planItem).toHaveClass('text-[12px]');
    expect(within(planItem).queryByText('Ctrl+Shift+I')).toBeNull();
  });

  it('updates the trigger label when selecting a different mode', async () => {
    const user = userEvent.setup();

    render(<ComposerModeSelector defaultValue="agent" variant="ghost" size="sm" />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('menuitem', { name: /^Plan$/ }));

    expect(screen.getByRole('button')).toHaveTextContent(/^Plan$/);
    expect(screen.queryByRole('menuitem', { name: /^Plan$/ })).not.toBeInTheDocument();
  });
});