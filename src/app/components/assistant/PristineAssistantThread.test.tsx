import { fireEvent, render, screen } from '@testing-library/react';
import type {
  ChangeEventHandler,
  CompositionEventHandler,
  KeyboardEventHandler,
  ReactElement,
  ReactNode,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PRISTINE_CONTEXT_WINDOW,
  mockPristineContextUsage,
} from './pristineAssistantContext';
import {
  PRISTINE_DEFAULT_MODEL_ID,
  pristineModelProviders,
} from './pristineAssistantModels';
import {
  mockPristineMentionCategories,
  mockPristineSlashCommands,
} from './pristineAssistantTriggers';
import { PristineAssistantThread } from './PristineAssistantThread';

const mocks = vi.hoisted(() => ({
  applyChange: vi.fn(),
  composerTriggerPopover: vi.fn(),
  composerModeSelector: vi.fn(),
  composerInputChange: vi.fn(),
  composerInputCompositionEnd: vi.fn(),
  composerInputCompositionStart: vi.fn(),
  composerInputKeyDown: vi.fn(),
  contextDisplayRing: vi.fn(),
  discardChange: vi.fn(),
  discardCommand: vi.fn(),
  makeAssistantToolUI: vi.fn(),
  modelSelector: vi.fn(),
  quoteBlock: vi.fn(),
  refreshApprovals: vi.fn(),
  runCommand: vi.fn(),
  toolPropsByName: {} as Record<string, unknown>,
  useAgentApprovals: vi.fn(),
  useAssistantInstructions: vi.fn(),
  useMentionAdapter: vi.fn(),
  useSlashCommandAdapter: vi.fn(),
}));

type MessagePartComponents = {
  File?: { displayName?: string; name?: string };
  Image?: { displayName?: string; name?: string };
  Reasoning?: { displayName?: string; name?: string };
  ReasoningGroup?: { displayName?: string; name?: string };
  Source?: { displayName?: string; name?: string };
  Text?: unknown;
  ToolGroup?: { displayName?: string; name?: string };
  tools?: {
    Fallback?: { displayName?: string; name?: string };
  };
};

type ComposerInputMockProps = {
  asChild?: boolean;
  children?: ReactNode;
  className?: string;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  onCompositionEnd?: CompositionEventHandler<HTMLTextAreaElement>;
  onCompositionStart?: CompositionEventHandler<HTMLTextAreaElement>;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  submitMode?: string;
  value?: string;
  'aria-label'?: string;
};

function getComponentName(component: unknown) {
  if (!component || (typeof component !== 'function' && typeof component !== 'object')) {
    return '';
  }

  const namedComponent = component as { displayName?: string; name?: string };
  return namedComponent.displayName ?? namedComponent.name;
}

vi.mock('@assistant-ui/react', async () => {
  const { cloneElement, isValidElement } = await vi.importActual<typeof import('react')>('react');
  const Root = ({
    autoScroll: _autoScroll,
    children,
    className,
    hideWhenRunning: _hideWhenRunning,
    turnAnchor: _turnAnchor,
    ...props
  }: {
    autoScroll?: boolean;
    children?: ReactNode;
    className?: string;
    hideWhenRunning?: boolean;
    turnAnchor?: string;
    [key: string]: unknown;
  }) => <div className={className} {...props}>{children}</div>;

  mocks.makeAssistantToolUI.mockImplementation(({ render, toolName }: { render: (props: unknown) => ReactNode; toolName: string }) => {
    const ToolUI = () => (
      <div data-testid={`tool-ui-${toolName}`}>
        {mocks.toolPropsByName[toolName] ? render(mocks.toolPropsByName[toolName]) : null}
      </div>
    );
    return ToolUI;
  });
  mocks.useMentionAdapter.mockImplementation((options: unknown) => ({
    adapter: { kind: 'mention', options },
    directive: { formatter: { parse: vi.fn(), serialize: vi.fn() } },
  }));
  mocks.useSlashCommandAdapter.mockImplementation((options: unknown) => ({
    adapter: { kind: 'slash', options },
    action: { onExecute: vi.fn() },
  }));

  return {
    AuiIf: ({ children, condition }: { children: ReactNode; condition: (state: { thread: { isRunning: boolean } }) => boolean }) => (
      condition({ thread: { isRunning: false } }) ? <>{children}</> : null
    ),
    ActionBarPrimitive: {
      Root,
      Copy: ({ children, ...props }: { children?: ReactNode; className?: string; 'aria-label'?: string }) => <button type="button" {...props}>{children}</button>,
      Edit: ({ children, ...props }: { children?: ReactNode; className?: string; 'aria-label'?: string }) => <button type="button" {...props}>{children}</button>,
      FeedbackNegative: ({ children, ...props }: { children?: ReactNode; className?: string; 'aria-label'?: string }) => <button type="button" {...props}>{children}</button>,
      FeedbackPositive: ({ children, ...props }: { children?: ReactNode; className?: string; 'aria-label'?: string }) => <button type="button" {...props}>{children}</button>,
      Reload: ({ children, ...props }: { children?: ReactNode; className?: string; 'aria-label'?: string }) => <button type="button" {...props}>{children}</button>,
    },
    BranchPickerPrimitive: {
      Count: () => <span data-testid="branch-picker-count">2</span>,
      Next: ({ children, ...props }: { children?: ReactNode; className?: string; 'aria-label'?: string }) => <button type="button" {...props}>{children}</button>,
      Number: () => <span data-testid="branch-picker-number">1</span>,
      Previous: ({ children, ...props }: { children?: ReactNode; className?: string; 'aria-label'?: string }) => <button type="button" {...props}>{children}</button>,
      Root: ({ 'aria-label': ariaLabel, children, className, hideWhenSingleBranch }: { 'aria-label'?: string; children?: ReactNode; className?: string; hideWhenSingleBranch?: boolean }) => (
        <div
          aria-label={ariaLabel}
          className={className}
          data-hide-when-single-branch={String(Boolean(hideWhenSingleBranch))}
          data-testid="branch-picker"
          role="group"
        >
          {children}
        </div>
      ),
    },
    ComposerPrimitive: {
      AttachmentDropzone: Root,
      Cancel: ({ children }: { children?: ReactNode }) => <div data-testid="composer-cancel">{children}</div>,
      Input: ({ asChild, children, submitMode, ...props }: ComposerInputMockProps) => {
        const inputProps = {
          ...props,
          'data-submit-mode': submitMode,
          value: props.value ?? '',
          onChange: ((event) => {
            mocks.composerInputChange(event);
            props.onChange?.(event);
          }) satisfies ChangeEventHandler<HTMLTextAreaElement>,
          onCompositionEnd: ((event) => {
            mocks.composerInputCompositionEnd(event);
            props.onCompositionEnd?.(event);
          }) satisfies CompositionEventHandler<HTMLTextAreaElement>,
          onCompositionStart: ((event) => {
            mocks.composerInputCompositionStart(event);
            props.onCompositionStart?.(event);
          }) satisfies CompositionEventHandler<HTMLTextAreaElement>,
          onKeyDown: ((event) => {
            mocks.composerInputKeyDown(event);
            props.onKeyDown?.(event);
          }) satisfies KeyboardEventHandler<HTMLTextAreaElement>,
        };

        if (asChild && isValidElement(children)) {
          return cloneElement(children as ReactElement<Partial<ComposerInputMockProps>>, inputProps);
        }

        return <textarea {...inputProps} />;
      },
      Root,
      Send: ({ children }: { children?: ReactNode }) => <div data-testid="composer-send">{children}</div>,
      Unstable_TriggerPopoverRoot: Root,
    },
    ErrorPrimitive: {
      Message: ({ className }: { className?: string }) => (
        <span className={className} data-testid="assistant-error-message">
          Assistant failed to complete the request
        </span>
      ),
      Root: ({ children, className }: { children?: ReactNode; className?: string }) => (
        <div className={className} data-testid="assistant-error-alert" role="alert">
          {children}
        </div>
      ),
    },
    MessagePrimitive: {
      Error: ({ children }: { children?: ReactNode }) => <div data-testid="message-error-slot">{children}</div>,
      Parts: ({ components }: { components?: MessagePartComponents }) => (
        <div
          data-testid="message-parts"
          data-file-component={getComponentName(components?.File)}
          data-has-file-component={String(Boolean(components?.File))}
          data-has-image-component={String(Boolean(components?.Image))}
          data-has-reasoning-component={String(Boolean(components?.Reasoning))}
          data-has-reasoning-group-component={String(Boolean(components?.ReasoningGroup))}
          data-has-source-component={String(Boolean(components?.Source))}
          data-has-text-component={String(Boolean(components?.Text))}
          data-has-tool-fallback-component={String(Boolean(components?.tools?.Fallback))}
          data-has-tool-group-component={String(Boolean(components?.ToolGroup))}
          data-image-component={getComponentName(components?.Image)}
          data-reasoning-component={getComponentName(components?.Reasoning)}
          data-reasoning-group-component={getComponentName(components?.ReasoningGroup)}
          data-source-component={getComponentName(components?.Source)}
          data-tool-fallback-component={getComponentName(components?.tools?.Fallback)}
          data-tool-group-component={getComponentName(components?.ToolGroup)}
        />
      ),
      Quote: ({ children }: { children: (quote: { text: string; messageId: string }) => ReactNode }) => (
        <div data-testid="message-quote">
          {children({ text: 'Selected RTL timing context', messageId: 'assistant-message-1' })}
        </div>
      ),
      Root,
    },
    ThreadPrimitive: {
      Empty: Root,
      Messages: ({ components }: { components: { UserMessage?: () => ReactNode; UserEditComposer?: () => ReactNode; AssistantMessage?: () => ReactNode } }) => (
        <div
          data-testid="thread-messages"
          data-has-user={String(Boolean(components.UserMessage))}
          data-has-user-edit-composer={String(Boolean(components.UserEditComposer))}
          data-has-assistant={String(Boolean(components.AssistantMessage))}
        >
          {components.UserMessage && <components.UserMessage />}
          {components.UserEditComposer && <components.UserEditComposer />}
          {components.AssistantMessage && <components.AssistantMessage />}
        </div>
      ),
      Root,
      ScrollToBottom: Root,
      Suggestion: ({ children, prompt }: { children: ReactNode; prompt: string }) => (
        <button data-prompt={prompt} type="button">{children}</button>
      ),
      Viewport: Root,
    },
    makeAssistantToolUI: mocks.makeAssistantToolUI,
    useAuiState: vi.fn(),
    unstable_useMentionAdapter: mocks.useMentionAdapter,
    unstable_useSlashCommandAdapter: mocks.useSlashCommandAdapter,
    useScrollLock: () => vi.fn(),
    useAssistantInstructions: mocks.useAssistantInstructions,
  };
});

vi.mock('@/app/components/code/explorer/useAgentApprovals', () => ({
  useAgentApprovals: mocks.useAgentApprovals,
}));

vi.mock('@/app/components/assistant-ui/attachment', () => ({
  ComposerAddAttachment: () => <button type="button">Attach</button>,
  ComposerAttachments: () => <div data-testid="composer-attachments" />,
  UserMessageAttachments: () => <div data-testid="user-message-attachments" />,
}));

vi.mock('@/app/components/assistant-ui/composer-trigger-popover', () => ({
  ComposerTriggerPopover: (props: { char: string; directive?: unknown; action?: unknown }) => {
    mocks.composerTriggerPopover(props);
    return (
      <div
        data-testid={`trigger-popover-${props.char}`}
        data-behavior={props.directive ? 'directive' : 'action'}
      />
    );
  },
}));

vi.mock('@/app/components/assistant-ui/context-display', () => ({
  ContextDisplay: {
    Ring: (props: unknown) => {
      mocks.contextDisplayRing(props);
      return <div data-testid="context-display-ring" />;
    },
  },
}));

vi.mock('@/app/components/assistant-ui/composer-mode-selector', () => ({
  ComposerModeSelector: (props: {
    defaultValue?: string;
    size?: string;
    variant?: string;
  }) => {
    mocks.composerModeSelector(props);
    return (
      <div
        data-testid="composer-mode-selector"
        data-default-value={props.defaultValue}
        data-size={props.size}
        data-variant={props.variant}
      />
    );
  },
}));

vi.mock('@/app/components/assistant-ui/model-selector', () => ({
  ModelSelector: (props: {
    defaultValue?: string;
    providers: unknown[];
    size?: string;
    variant?: string;
  }) => {
    mocks.modelSelector(props);
    return (
      <div
        data-testid="model-selector"
        data-default-value={props.defaultValue}
        data-provider-count={props.providers.length}
        data-size={props.size}
        data-variant={props.variant}
      />
    );
  },
}));

vi.mock('@/app/components/assistant-ui/markdown-text', () => ({
  MarkdownText: () => <span>markdown text</span>,
}));

vi.mock('@/app/components/assistant-ui/quote', () => ({
  ComposerQuotePreview: () => <div data-testid="composer-quote-preview" />,
  QuoteBlock: (props: { messageId: string; text: string }) => {
    mocks.quoteBlock(props);
    return <div data-testid="quote-block">{props.text}</div>;
  },
  SelectionToolbar: () => <div data-testid="selection-toolbar" />,
}));

vi.mock('@/app/components/assistant-ui/tooltip-icon-button', () => ({
  TooltipIconButton: ({ children, ...props }: { children?: ReactNode }) => (
    <button type="button" {...props}>{children}</button>
  ),
}));

describe('PristineAssistantThread', () => {
  beforeEach(() => {
    mocks.applyChange.mockClear();
    mocks.composerModeSelector.mockClear();
    mocks.composerInputChange.mockClear();
    mocks.composerInputCompositionEnd.mockClear();
    mocks.composerInputCompositionStart.mockClear();
    mocks.composerInputKeyDown.mockClear();
    mocks.composerTriggerPopover.mockClear();
    mocks.contextDisplayRing.mockClear();
    mocks.discardChange.mockClear();
    mocks.discardCommand.mockClear();
    mocks.makeAssistantToolUI.mockClear();
    mocks.modelSelector.mockClear();
    mocks.quoteBlock.mockClear();
    mocks.refreshApprovals.mockClear();
    mocks.runCommand.mockClear();
    for (const toolName of Object.keys(mocks.toolPropsByName)) {
      delete mocks.toolPropsByName[toolName];
    }
    mocks.useAgentApprovals.mockReset();
    mocks.useAgentApprovals.mockReturnValue({
      applyChange: mocks.applyChange,
      busyActionId: null,
      discardChange: mocks.discardChange,
      discardCommand: mocks.discardCommand,
      refresh: mocks.refreshApprovals,
      runCommand: mocks.runCommand,
      snapshot: {
        commands: [],
        changes: [],
        error: null,
        isLoading: false,
        status: null,
      },
    });
    mocks.useAssistantInstructions.mockClear();
    mocks.useMentionAdapter.mockClear();
    mocks.useSlashCommandAdapter.mockClear();
  });

  it('wires assistant instructions, tool UIs, and composer trigger adapters', () => {
    render(<PristineAssistantThread className="custom-thread" />);

    expect(mocks.useAssistantInstructions).toHaveBeenCalledWith(
      expect.stringContaining('Pristine IDE right sidebar'),
    );
    expect(screen.getByTestId('tool-ui-propose_file_change')).toBeInTheDocument();
    expect(screen.getByTestId('tool-ui-propose_shell_command')).toBeInTheDocument();

    expect(mocks.useMentionAdapter).toHaveBeenCalledWith({
      categories: mockPristineMentionCategories,
    });
    expect(mocks.useSlashCommandAdapter).toHaveBeenCalledWith({
      commands: mockPristineSlashCommands,
    });

    expect(screen.getByPlaceholderText('Type @ for context, / for commands...')).toBeInTheDocument();
    expect(screen.getByTestId('context-display-ring')).toBeInTheDocument();
    expect(mocks.contextDisplayRing).toHaveBeenCalledWith(
      expect.objectContaining({
        modelContextWindow: PRISTINE_CONTEXT_WINDOW,
        usage: mockPristineContextUsage,
        side: 'top',
      }),
    );
    expect(screen.getByTestId('trigger-popover-@')).toHaveAttribute('data-behavior', 'directive');
    expect(screen.getByTestId('trigger-popover-/')).toHaveAttribute('data-behavior', 'action');
    expect(screen.getByTestId('thread-messages')).toHaveAttribute('data-has-user', 'true');
    expect(screen.getByTestId('thread-messages')).toHaveAttribute('data-has-user-edit-composer', 'true');
    expect(screen.getByTestId('thread-messages')).toHaveAttribute('data-has-assistant', 'true');
    const viewport = screen.getByTestId('thread-messages').parentElement;
    expect(viewport).toHaveClass('pristine-assistant-scrollbar', 'overflow-y-auto');
    expect(screen.getByLabelText('Scroll to latest message')).toHaveClass('absolute', '-top-10', 'right-2', 'z-10');
    const composerModeSelectorProps = mocks.composerModeSelector.mock.calls[0]?.[0];
    expect(composerModeSelectorProps.className).toContain('!h-7');
    expect(composerModeSelectorProps.className).toContain('!gap-1');
    expect(composerModeSelectorProps.className).toContain('!px-1.5');
    expect(composerModeSelectorProps.className).toContain('!text-[10px]');
    expect(composerModeSelectorProps.className).toContain('[&>svg]:!size-3');
    const modelSelectorProps = mocks.modelSelector.mock.calls[0]?.[0];
    expect(modelSelectorProps.className).toContain('!h-7');
    expect(modelSelectorProps.className).toContain('!gap-1');
    expect(modelSelectorProps.className).toContain('!px-1.5');
    expect(modelSelectorProps.className).toContain('!text-[10px]');
    expect(modelSelectorProps.className).toContain('[&>svg]:!size-3');
    expect(screen.getByTestId('composer-mode-selector')).toHaveAttribute('data-size', 'sm');
    expect(screen.getByTestId('composer-mode-selector')).toHaveAttribute('data-variant', 'ghost');
    expect(screen.getByTestId('composer-mode-selector')).toHaveAttribute('data-default-value', 'agent');
    expect(screen.getByTestId('composer-mode-selector').parentElement).toHaveClass('gap-0.5');
    expect(screen.getByTestId('composer-mode-selector').nextElementSibling).toBe(screen.getByTestId('model-selector'));
    expect(screen.getByTestId('model-selector')).toHaveAttribute('data-size', 'sm');
    expect(screen.getByTestId('model-selector')).toHaveAttribute('data-variant', 'ghost');
    expect(screen.getByTestId('model-selector')).toHaveAttribute('data-default-value', PRISTINE_DEFAULT_MODEL_ID);
    expect(screen.getByTestId('model-selector')).toHaveAttribute('data-provider-count', String(pristineModelProviders.length));
    expect(screen.getByTestId('composer-quote-preview')).toBeInTheDocument();
    expect(screen.getByTestId('selection-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('quote-block')).toHaveTextContent('Selected RTL timing context');
    expect(mocks.quoteBlock).toHaveBeenCalledWith({
      messageId: 'assistant-message-1',
      text: 'Selected RTL timing context',
    });

    const assistantContainer = screen.getByTestId('assistant-message-container');
    expect(assistantContainer).toHaveClass('w-full');
    expect(assistantContainer).not.toHaveClass('max-w-[92%]');
    const assistantSurface = screen.getByTestId('assistant-message-surface');
    expect(assistantSurface).toHaveClass('rounded-md', 'bg-background');
    expect(assistantSurface).not.toHaveClass('border', 'border-border', 'shadow-xs');
    expect(assistantSurface).toContainElement(screen.getByTestId('message-error-slot'));
    expect(screen.getByRole('alert')).toHaveTextContent('Assistant failed to complete the request');
    expect(screen.getByTestId('assistant-error-alert')).toHaveClass(
      'border-destructive',
      'bg-destructive/10',
      'text-[12px]',
      'text-destructive',
    );
    expect(screen.getByTestId('assistant-error-message')).toHaveClass('line-clamp-2');
    expect(screen.getByTestId('user-message-attachments').nextElementSibling).toHaveClass('border', 'border-primary/20');
    const branchPickers = screen.getAllByTestId('branch-picker');
    expect(branchPickers).toHaveLength(2);
    for (const branchPicker of branchPickers) {
      expect(branchPicker).toHaveAttribute('data-hide-when-single-branch', 'true');
    }
    expect(screen.getByRole('group', { name: 'user message branch' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'assistant response branch' })).toBeInTheDocument();
    expect(screen.getAllByTestId('branch-picker-number')).toHaveLength(2);
    expect(screen.getAllByTestId('branch-picker-count')).toHaveLength(2);
    expect(screen.getByTestId('user-message-edit-action')).toHaveClass('absolute', 'right-full', 'top-1', 'mr-1');
    expect(screen.getByTestId('user-message-edit-action')).not.toHaveClass('shrink-0');
    expect(screen.getByTestId('user-message-branch-action')).toHaveClass('absolute', 'right-0', 'top-full', 'z-10');
    expect(screen.getByTestId('user-message-branch-action')).not.toHaveClass('w-full');
    expect(screen.getByTestId('assistant-message-action')).toHaveClass('absolute', 'left-0', 'top-full', 'z-10');
    expect(screen.getByRole('button', { name: 'Edit message' })).toBeInTheDocument();
    expect(screen.getByTestId('user-edit-composer-root')).toHaveClass('justify-end');
    expect(screen.getByTestId('user-edit-composer')).toHaveClass('max-w-[88%]', 'border-primary/20', 'bg-primary');
    expect(screen.getByLabelText('Edit message input')).toHaveClass('text-primary-foreground');
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getAllByTestId('composer-cancel')).toHaveLength(1);
    expect(screen.getAllByTestId('composer-send')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Previous user message branch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next user message branch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous assistant response branch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next assistant response branch' })).toBeInTheDocument();

    const messageParts = screen.getAllByTestId('message-parts');
    expect(messageParts).toHaveLength(2);
    for (const part of messageParts) {
      expect(part).toHaveAttribute('data-has-text-component', 'true');
      expect(part).toHaveAttribute('data-has-file-component', 'true');
      expect(part).toHaveAttribute('data-file-component', 'File');
      expect(part).toHaveAttribute('data-has-image-component', 'true');
      expect(part).toHaveAttribute('data-image-component', 'PristineMessageImage');
    }

    expect(messageParts[0]).toHaveAttribute('data-has-reasoning-component', 'false');
    expect(messageParts[0]).toHaveAttribute('data-has-reasoning-group-component', 'false');
    expect(messageParts[0]).toHaveAttribute('data-has-source-component', 'false');
    expect(messageParts[0]).toHaveAttribute('data-has-tool-fallback-component', 'false');
    expect(messageParts[0]).toHaveAttribute('data-has-tool-group-component', 'false');
    expect(messageParts[1]).toHaveAttribute('data-has-reasoning-component', 'true');
    expect(messageParts[1]).toHaveAttribute('data-reasoning-component', 'Reasoning');
    expect(messageParts[1]).toHaveAttribute('data-has-reasoning-group-component', 'true');
    expect(messageParts[1]).toHaveAttribute('data-reasoning-group-component', 'PristineReasoningGroup');
    expect(messageParts[1]).toHaveAttribute('data-has-source-component', 'true');
    expect(messageParts[1]).toHaveAttribute('data-source-component', 'PristineMessageSource');
    expect(messageParts[1]).toHaveAttribute('data-has-tool-fallback-component', 'true');
    expect(messageParts[1]).toHaveAttribute('data-tool-fallback-component', 'ToolFallback');
    expect(messageParts[1]).toHaveAttribute('data-has-tool-group-component', 'true');
    expect(messageParts[1]).toHaveAttribute('data-tool-group-component', 'ToolGroup');
  });

  it('renders file change approvals inside the proposal tool UI', () => {
    mocks.toolPropsByName['propose_file_change'] = {
      args: {
        kind: 'update',
        path: 'src/foo.ts',
        summary: 'Fallback summary',
      },
      result: {
        id: 'change-1',
        kind: 'update',
        path: 'src/foo.ts',
        status: 'pending',
        summary: 'Fallback summary',
        unifiedDiff: 'fallback diff',
      },
      status: { type: 'complete' },
    };
    mocks.useAgentApprovals.mockReturnValue({
      applyChange: mocks.applyChange,
      busyActionId: null,
      discardChange: mocks.discardChange,
      discardCommand: mocks.discardCommand,
      refresh: mocks.refreshApprovals,
      runCommand: mocks.runCommand,
      snapshot: {
        commands: [],
        changes: [
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            id: 'change-1',
            kind: 'update',
            path: 'src/foo.ts',
            status: 'pending',
            summary: 'Update foo helper',
            unifiedDiff: '--- src/foo.ts\n+++ src/foo.ts\n@@\n-old\n+new',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        error: null,
        isLoading: false,
        status: null,
      },
    });

    render(<PristineAssistantThread agentBaseUrl="http://localhost:4111" />);

    expect(mocks.useAgentApprovals).toHaveBeenCalledWith('http://localhost:4111');
    expect(screen.getByTestId('tool-ui-propose_file_change')).toHaveTextContent('Update foo helper');
  expect(screen.getByTestId('tool-ui-propose_file_change').firstElementChild).toHaveClass('text-[12px]', 'leading-relaxed');
    expect(screen.getByText('src/foo.ts')).toBeInTheDocument();
    expect(screen.getByText(/\+new/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply file change' }));
    expect(mocks.applyChange).toHaveBeenCalledWith('change-1');

    fireEvent.click(screen.getByRole('button', { name: 'Discard file change' }));
    expect(mocks.discardChange).toHaveBeenCalledWith('change-1');
  });

  it('renders shell command approvals inside the proposal tool UI', () => {
    mocks.toolPropsByName['propose_shell_command'] = {
      args: {
        args: ['typecheck'],
        command: 'pnpm',
        cwd: '.',
        summary: 'Fallback command summary',
      },
      result: {
        args: ['typecheck'],
        command: 'pnpm',
        cwd: '.',
        id: 'command-1',
        status: 'pending',
        summary: 'Fallback command summary',
      },
      status: { type: 'complete' },
    };
    mocks.useAgentApprovals.mockReturnValue({
      applyChange: mocks.applyChange,
      busyActionId: null,
      discardChange: mocks.discardChange,
      discardCommand: mocks.discardCommand,
      refresh: mocks.refreshApprovals,
      runCommand: mocks.runCommand,
      snapshot: {
        commands: [
          {
            args: ['typecheck'],
            command: 'pnpm',
            createdAt: '2026-01-01T00:00:00.000Z',
            cwd: '.',
            id: 'command-1',
            status: 'pending',
            summary: 'Run typecheck',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        changes: [],
        error: null,
        isLoading: false,
        status: null,
      },
    });

    render(<PristineAssistantThread agentBaseUrl="http://localhost:4111" />);

    expect(screen.getByTestId('tool-ui-propose_shell_command')).toHaveTextContent('Run typecheck');
    expect(screen.getByText('pnpm typecheck')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Run shell command' }));
    expect(mocks.runCommand).toHaveBeenCalledWith('command-1');

    fireEvent.click(screen.getByRole('button', { name: 'Discard shell command' }));
    expect(mocks.discardCommand).toHaveBeenCalledWith('command-1');
  });

  it('shows a shadcn skeleton while persisted thread messages are loading', () => {
    render(<PristineAssistantThread isThreadLoading />);

    expect(screen.getByTestId('assistant-thread-loading-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('thread-messages')).not.toBeInTheDocument();
  });

  it('renders completed shell command output from the latest approval snapshot', () => {
    mocks.toolPropsByName['propose_shell_command'] = {
      args: {
        args: ['test:unit'],
        command: 'pnpm',
        cwd: '.',
      },
      result: {
        args: ['test:unit'],
        command: 'pnpm',
        cwd: '.',
        id: 'command-2',
        status: 'pending',
        summary: 'Run unit tests',
      },
      status: { type: 'complete' },
    };
    mocks.useAgentApprovals.mockReturnValue({
      applyChange: mocks.applyChange,
      busyActionId: null,
      discardChange: mocks.discardChange,
      discardCommand: mocks.discardCommand,
      refresh: mocks.refreshApprovals,
      runCommand: mocks.runCommand,
      snapshot: {
        commands: [
          {
            args: ['test:unit'],
            command: 'pnpm',
            createdAt: '2026-01-01T00:00:00.000Z',
            cwd: '.',
            exitCode: 0,
            id: 'command-2',
            status: 'completed',
            stdout: '90 files passed',
            summary: 'Run unit tests',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        changes: [],
        error: null,
        isLoading: false,
        status: null,
      },
    });

    render(<PristineAssistantThread agentBaseUrl="http://localhost:4111" />);

    expect(screen.getByTestId('tool-ui-propose_shell_command')).toHaveTextContent('completed');
    expect(screen.getByTestId('tool-ui-propose_shell_command')).toHaveTextContent('exit 0');
    expect(screen.getByText('90 files passed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run shell command' })).not.toBeInTheDocument();
  });

  it('keeps Chinese IME draft text across composer rerenders', () => {
    const { rerender } = render(<PristineAssistantThread className="custom-thread" />);
    let input = screen.getByLabelText('Message input') as HTMLTextAreaElement;

    expect(input).toHaveAttribute('data-submit-mode', 'enter');

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'ni' } });
    expect(input.value).toBe('ni');

    rerender(<PristineAssistantThread className="custom-thread" />);
    input = screen.getByLabelText('Message input') as HTMLTextAreaElement;
    expect(input.value).toBe('ni');

    fireEvent.keyDown(input, { code: 'Enter', key: 'Enter' });
    expect(mocks.composerInputKeyDown).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'final draft' } });
    fireEvent.compositionEnd(input);
    expect(input.value).toBe('final draft');
    expect(mocks.composerInputCompositionEnd).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { code: 'Enter', key: 'Enter' });
    expect(mocks.composerInputKeyDown).toHaveBeenCalledTimes(1);
  });

  it('keeps Chinese IME draft text across user edit composer rerenders', () => {
    const { rerender } = render(<PristineAssistantThread className="custom-thread" />);
    let input = screen.getByLabelText('Edit message input') as HTMLTextAreaElement;

    expect(input).toHaveAttribute('data-submit-mode', 'enter');

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'ni' } });
    expect(input.value).toBe('ni');

    rerender(<PristineAssistantThread className="custom-thread" />);
    input = screen.getByLabelText('Edit message input') as HTMLTextAreaElement;
    expect(input.value).toBe('ni');

    fireEvent.keyDown(input, { code: 'Enter', key: 'Enter' });
    expect(mocks.composerInputKeyDown).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'final edit' } });
    fireEvent.compositionEnd(input);
    expect(input.value).toBe('final edit');
    expect(mocks.composerInputCompositionEnd).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { code: 'Enter', key: 'Enter' });
    expect(mocks.composerInputKeyDown).toHaveBeenCalledTimes(1);
  });
});
