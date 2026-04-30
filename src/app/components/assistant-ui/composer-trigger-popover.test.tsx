import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ComposerTriggerPopover } from './composer-trigger-popover';

const primitiveMocks = vi.hoisted(() => ({
  actionProps: [] as unknown[],
  categories: [{ id: 'context', label: 'Context' }],
  directiveProps: [] as unknown[],
  items: [
    {
      id: 'workspace',
      type: 'context',
      label: 'Workspace',
      description: 'Use the current workspace',
      metadata: { icon: 'FileCode2' },
    },
  ],
}));

vi.mock('@assistant-ui/react', () => {
  const TriggerPopover = ({ children, char, className }: { children?: ReactNode; char: string; className?: string }) => (
    <section className={className} data-testid={`trigger-${char}`}>{children}</section>
  );
  TriggerPopover.Directive = (props: unknown) => {
    primitiveMocks.directiveProps.push(props);
    return <div data-testid="directive-behavior" />;
  };
  TriggerPopover.Action = (props: unknown) => {
    primitiveMocks.actionProps.push(props);
    return <div data-testid="action-behavior" />;
  };

  return {
    ComposerPrimitive: {
      Unstable_TriggerPopover: TriggerPopover,
      Unstable_TriggerPopoverBack: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
      Unstable_TriggerPopoverCategories: ({ children }: { children: (categories: typeof primitiveMocks.categories) => ReactNode }) => (
        <>{children(primitiveMocks.categories)}</>
      ),
      Unstable_TriggerPopoverCategoryItem: ({ children, categoryId }: { children?: ReactNode; categoryId: string }) => (
        <button data-testid={`category-${categoryId}`} type="button">{children}</button>
      ),
      Unstable_TriggerPopoverItem: ({ children, item, index }: { children?: ReactNode; item: { id: string }; index: number }) => (
        <button data-index={index} data-testid={`item-${item.id}`} type="button">{children}</button>
      ),
      Unstable_TriggerPopoverItems: ({ children }: { children: (items: typeof primitiveMocks.items) => ReactNode }) => (
        <>{children(primitiveMocks.items)}</>
      ),
    },
  };
});

function ContextIcon() {
  return <span aria-label="context icon" />;
}

function FileIcon() {
  return <span aria-label="file icon" />;
}

function FallbackIcon() {
  return <span aria-label="fallback icon" />;
}

const formatter = {
  parse: vi.fn(() => []),
  serialize: vi.fn(() => ':context[Workspace]{name=workspace}'),
};

describe('ComposerTriggerPopover', () => {
  beforeEach(() => {
    primitiveMocks.actionProps.length = 0;
    primitiveMocks.directiveProps.length = 0;
    primitiveMocks.categories = [{ id: 'context', label: 'Context' }];
    primitiveMocks.items = [
      {
        id: 'workspace',
        type: 'context',
        label: 'Workspace',
        description: 'Use the current workspace',
        metadata: { icon: 'FileCode2' },
      },
    ];
  });

  it('renders categorized directive picker content with configured icons', () => {
    const onInserted = vi.fn();

    render(
      <ComposerTriggerPopover
        char="@"
        adapter={{} as never}
        directive={{ formatter, onInserted }}
        fallbackIcon={FallbackIcon}
        iconMap={{ context: ContextIcon, FileCode2: FileIcon }}
      />,
    );

    expect(screen.getByTestId('trigger-@')).toHaveClass('aui-composer-trigger-popover');
    expect(screen.getByTestId('directive-behavior')).toBeInTheDocument();
    expect(screen.getByTestId('category-context')).toHaveTextContent('Context');
    expect(screen.getByLabelText('context icon')).toBeInTheDocument();
    expect(screen.getByTestId('item-workspace')).toHaveTextContent('Workspace');
    expect(screen.getByTestId('item-workspace')).toHaveTextContent('Use the current workspace');
    expect(screen.getByLabelText('file icon')).toBeInTheDocument();
    expect(primitiveMocks.directiveProps[0]).toMatchObject({ formatter, onInserted });
  });

  it('renders action behavior and empty states for slash commands', () => {
    const onExecute = vi.fn();
    primitiveMocks.categories = [];
    primitiveMocks.items = [];

    render(
      <ComposerTriggerPopover
        char="/"
        adapter={{} as never}
        action={{ formatter, onExecute, removeOnExecute: true }}
        emptyCategoriesLabel="No commands"
        emptyItemsLabel="No matches"
      />,
    );

    expect(screen.getByTestId('trigger-/')).toBeInTheDocument();
    expect(screen.getByTestId('action-behavior')).toBeInTheDocument();
    expect(screen.getByText('No commands')).toBeInTheDocument();
    expect(screen.getByText('No matches')).toBeInTheDocument();
    expect(primitiveMocks.actionProps[0]).toMatchObject({
      formatter,
      onExecute,
      removeOnExecute: true,
    });
  });
});