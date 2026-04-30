import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PRISTINE_CONTEXT_WINDOW,
  mockPristineContextUsage,
} from './pristineAssistantContext';
import {
  mockPristineMentionCategories,
  mockPristineSlashCommands,
} from './pristineAssistantTriggers';
import { PristineAssistantThread } from './PristineAssistantThread';

const mocks = vi.hoisted(() => ({
  composerTriggerPopover: vi.fn(),
  contextDisplayBar: vi.fn(),
  makeAssistantToolUI: vi.fn(),
  useAssistantInstructions: vi.fn(),
  useMentionAdapter: vi.fn(),
  useSlashCommandAdapter: vi.fn(),
}));

type MessagePartComponents = {
  File?: { displayName?: string; name?: string };
  Image?: { displayName?: string; name?: string };
  Text?: unknown;
};

function getComponentName(component: unknown) {
  if (!component || (typeof component !== 'function' && typeof component !== 'object')) {
    return '';
  }

  const namedComponent = component as { displayName?: string; name?: string };
  return namedComponent.displayName ?? namedComponent.name;
}

vi.mock('@assistant-ui/react', () => {
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
      Input: ({ submitMode: _submitMode, ...props }: { placeholder?: string; 'aria-label'?: string; submitMode?: string }) => <textarea {...props} />,
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
          data-has-text-component={String(Boolean(components?.Text))}
          data-image-component={getComponentName(components?.Image)}
        />
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
    unstable_useMentionAdapter: mocks.useMentionAdapter,
    unstable_useSlashCommandAdapter: mocks.useSlashCommandAdapter,
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
    Bar: (props: unknown) => {
      mocks.contextDisplayBar(props);
      return <div data-testid="context-display-bar" />;
    },
  },
}));

vi.mock('@/app/components/assistant-ui/markdown-text', () => ({
  MarkdownText: () => <span>markdown text</span>,
}));

vi.mock('@/app/components/assistant-ui/tooltip-icon-button', () => ({
  TooltipIconButton: ({ children, ...props }: { children?: ReactNode }) => (
    <button type="button" {...props}>{children}</button>
  ),
}));

describe('PristineAssistantThread', () => {
  beforeEach(() => {
    mocks.composerTriggerPopover.mockClear();
    mocks.contextDisplayBar.mockClear();
    mocks.makeAssistantToolUI.mockClear();
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
    expect(screen.getByTestId('context-display-bar')).toBeInTheDocument();
    expect(mocks.contextDisplayBar).toHaveBeenCalledWith(
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

    const messageParts = screen.getAllByTestId('message-parts');
    expect(messageParts).toHaveLength(2);
    for (const part of messageParts) {
      expect(part).toHaveAttribute('data-has-text-component', 'true');
      expect(part).toHaveAttribute('data-has-file-component', 'true');
      expect(part).toHaveAttribute('data-file-component', 'File');
      expect(part).toHaveAttribute('data-has-image-component', 'true');
      expect(part).toHaveAttribute('data-image-component', 'PristineMessageImage');
    }
  });
});
