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
  mockPristineModelOptions,
} from './pristineAssistantModels';
import {
  mockPristineMentionCategories,
  mockPristineSlashCommands,
} from './pristineAssistantTriggers';
import { PristineAssistantThread } from './PristineAssistantThread';

const mocks = vi.hoisted(() => ({
  composerTriggerPopover: vi.fn(),
  composerInputChange: vi.fn(),
  composerInputCompositionEnd: vi.fn(),
  composerInputCompositionStart: vi.fn(),
  composerInputKeyDown: vi.fn(),
  contextDisplayRing: vi.fn(),
  makeAssistantToolUI: vi.fn(),
  modelSelector: vi.fn(),
  quoteBlock: vi.fn(),
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
  const Root = ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  );

  mocks.makeAssistantToolUI.mockImplementation(({ toolName }: { toolName: string }) => {
    const ToolUI = () => <div data-testid={`tool-ui-${toolName}`} />;
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
      Copy: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
      Reload: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
    },
    ComposerPrimitive: {
      AttachmentDropzone: Root,
      Cancel: ({ children }: { children?: ReactNode }) => <>{children}</>,
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
      Send: ({ children }: { children?: ReactNode }) => <>{children}</>,
      Unstable_TriggerPopoverRoot: Root,
    },
    MessagePrimitive: {
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
      Messages: ({ components }: { components: { UserMessage?: () => ReactNode; AssistantMessage?: () => ReactNode } }) => (
        <div
          data-testid="thread-messages"
          data-has-user={String(Boolean(components.UserMessage))}
          data-has-assistant={String(Boolean(components.AssistantMessage))}
        >
          {components.UserMessage && <components.UserMessage />}
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

vi.mock('@/app/components/assistant-ui/model-selector', () => ({
  ModelSelector: (props: {
    defaultValue?: string;
    models: unknown[];
    size?: string;
    variant?: string;
  }) => {
    mocks.modelSelector(props);
    return (
      <div
        data-testid="model-selector"
        data-default-value={props.defaultValue}
        data-model-count={props.models.length}
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
    mocks.composerInputChange.mockClear();
    mocks.composerInputCompositionEnd.mockClear();
    mocks.composerInputCompositionStart.mockClear();
    mocks.composerInputKeyDown.mockClear();
    mocks.composerTriggerPopover.mockClear();
    mocks.contextDisplayRing.mockClear();
    mocks.makeAssistantToolUI.mockClear();
    mocks.modelSelector.mockClear();
    mocks.quoteBlock.mockClear();
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
    expect(screen.getByTestId('thread-messages')).toHaveAttribute('data-has-assistant', 'true');
    expect(screen.getByTestId('model-selector')).toHaveAttribute('data-size', 'sm');
    expect(screen.getByTestId('model-selector')).toHaveAttribute('data-variant', 'ghost');
    expect(screen.getByTestId('model-selector')).toHaveAttribute('data-default-value', PRISTINE_DEFAULT_MODEL_ID);
    expect(screen.getByTestId('model-selector')).toHaveAttribute('data-model-count', String(mockPristineModelOptions.length));
    expect(screen.getByTestId('composer-quote-preview')).toBeInTheDocument();
    expect(screen.getByTestId('selection-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('quote-block')).toHaveTextContent('Selected RTL timing context');
    expect(mocks.quoteBlock).toHaveBeenCalledWith({
      messageId: 'assistant-message-1',
      text: 'Selected RTL timing context',
    });

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

    fireEvent.change(input, { target: { value: '你' } });
    fireEvent.compositionEnd(input);
    expect(input.value).toBe('你');
    expect(mocks.composerInputCompositionEnd).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { code: 'Enter', key: 'Enter' });
    expect(mocks.composerInputKeyDown).toHaveBeenCalledTimes(1);
  });
});
