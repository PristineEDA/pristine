import {
  RuntimeAdapterProvider,
  useAssistantApi,
  useAssistantState,
  useRemoteThreadListRuntime,
  type MessageFormatAdapter,
  type MessageFormatItem,
  type MessageFormatRepository,
  type RemoteThreadListAdapter,
  type ThreadHistoryAdapter,
  type ThreadMessage,
} from '@assistant-ui/react';
import { AssistantChatTransport, useAISDKRuntime } from '@assistant-ui/react-ai-sdk';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { useEffect, useMemo, useRef, type FC, type PropsWithChildren } from 'react';

import {
  archiveAgentThread,
  deleteAgentThread,
  getAgentThread,
  getAgentThreadMessages,
  listAgentThreads,
  renameAgentThread,
  type AgentThread,
  unarchiveAgentThread,
} from './agentApi';

const MAX_THREAD_TITLE_LENGTH = 60;
const OPTIMISTIC_THREAD_ID_PREFIX = '__optimistic__';

type TitleAssistantStreamChunk =
  | {
      readonly type: 'part-start';
      readonly part: { readonly type: 'text' };
      readonly path: readonly number[];
    }
  | {
      readonly type: 'text-delta';
      readonly textDelta: string;
      readonly path: readonly number[];
    }
  | {
      readonly type: 'part-finish';
      readonly path: readonly number[];
    };

function createTitleAssistantStream(title?: string) {
  return new ReadableStream({
    start(controller: ReadableStreamDefaultController<TitleAssistantStreamChunk>) {
      if (title) {
        controller.enqueue({
          type: 'part-start',
          part: { type: 'text' },
          path: [],
        });
        controller.enqueue({
          type: 'text-delta',
          textDelta: title,
          path: [0],
        });
        controller.enqueue({
          type: 'part-finish',
          path: [0],
        });
      }

      controller.close();
    },
  });
}

function toRemoteThreadMetadata(thread: AgentThread) {
  return {
    remoteId: thread.id,
    externalId: thread.id,
    status: thread.status,
    title: thread.title,
    custom: {
      isLegacy: thread.isLegacy,
      resourceId: thread.resourceId,
    },
  } as const;
}

function createMessageRepository<TMessage>(
  messages: readonly TMessage[],
  formatAdapter: MessageFormatAdapter<TMessage, Record<string, unknown>>,
): MessageFormatRepository<TMessage> {
  if (messages.length === 0) {
    return { messages: [] };
  }

  const items: MessageFormatItem<TMessage>[] = messages.map((message, index) => ({
    parentId: index === 0 ? null : formatAdapter.getId(messages[index - 1]!),
    message,
  }));

  return {
    headId: formatAdapter.getId(messages[messages.length - 1]!),
    messages: items,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptimisticThreadId(id: string | undefined): boolean {
  return typeof id === 'string' && id.startsWith(OPTIMISTIC_THREAD_ID_PREFIX);
}

function isPersistedRemoteThread(threadId: string, remoteId: string | undefined): remoteId is string {
  return Boolean(remoteId) && threadId === remoteId && !isOptimisticThreadId(threadId);
}

type PristineSendMessagesRequestOptions = {
  body?: Record<string, unknown>;
  id: string;
  messageId?: string;
  messages: UIMessage[];
  requestMetadata: unknown;
  trigger: string;
};

export function createPristineChatRequestBody({
  body,
  id,
  messageId,
  messages,
  requestMetadata,
  trigger,
}: PristineSendMessagesRequestOptions) {
  const existingMemory = isRecord(body?.memory) ? body.memory : undefined;

  return {
    ...body,
    messages,
    trigger,
    messageId,
    metadata: requestMetadata,
    memory: {
      ...existingMemory,
      thread: id,
    },
  };
}

export function deriveAgentThreadTitleFromMessages(messages: readonly ThreadMessage[]): string | null {
  for (const message of messages) {
    if (message.role !== 'user') {
      continue;
    }

    const text = message.content
      .filter((part): part is Extract<(typeof message.content)[number], { type: 'text' }> => part.type === 'text')
      .map((part) => part.text)
      .join(' ')
      .replace(/\s+/gu, ' ')
      .trim();

    if (!text) {
      continue;
    }

    if (text.length <= MAX_THREAD_TITLE_LENGTH) {
      return text;
    }

    return `${text.slice(0, MAX_THREAD_TITLE_LENGTH - 3).trimEnd()}...`;
  }

  return null;
}

class PristineThreadHistoryAdapter implements ThreadHistoryAdapter {
  constructor(
    private readonly baseUrl: string,
    private readonly aui: ReturnType<typeof useAssistantApi>,
  ) {}

  async load() {
    return { messages: [] };
  }

  async append() {
    // Messages are already persisted by the Mastra chat route.
  }

  withFormat<TMessage, TStorageFormat extends Record<string, unknown>>(
    formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>,
  ) {
    return {
      append: async (_item: MessageFormatItem<TMessage>) => {
        // Messages are already persisted by the Mastra chat route.
      },
      update: async (_item: MessageFormatItem<TMessage>, _localMessageId: string) => {
        // Messages are already persisted by the Mastra chat route.
      },
      load: async (): Promise<MessageFormatRepository<TMessage>> => {
        const { remoteId } = await this.aui.threadListItem().initialize();
        if (!remoteId) {
          return { messages: [] };
        }

        const response = await getAgentThreadMessages<TMessage>(this.baseUrl, remoteId);
        return createMessageRepository(response.uiMessages, formatAdapter as MessageFormatAdapter<TMessage, Record<string, unknown>>);
      },
    };
  }
}

function createPristineThreadListProvider(baseUrl: string): FC<PropsWithChildren> {
  const Provider: FC<PropsWithChildren> = ({ children }) => {
    const aui = useAssistantApi();
    const history = useMemo(() => new PristineThreadHistoryAdapter(baseUrl, aui), [aui]);
    const adapters = useMemo(() => ({ history }), [history]);

    return <RuntimeAdapterProvider adapters={adapters}>{children}</RuntimeAdapterProvider>;
  };

  return Provider;
}

type PristineThreadMessagesBootstrapOptions = {
  baseUrl: string;
  threadId: string;
  remoteId: string | undefined;
  setMessages: ReturnType<typeof useChat<UIMessage>>['setMessages'];
};

export function usePristineThreadMessagesBootstrap({
  baseUrl,
  threadId,
  remoteId,
  setMessages,
}: PristineThreadMessagesBootstrapOptions) {
  const latestRemoteIdRef = useRef<string | undefined>(remoteId);

  useEffect(() => {
    latestRemoteIdRef.current = remoteId;
  }, [remoteId]);

  useEffect(() => {
    let cancelled = false;

    if (!remoteId) {
      setMessages([]);
      return () => {
        cancelled = true;
      };
    }

    // New threads use assistant-ui optimistic ids until a persisted thread identity exists.
    if (!isPersistedRemoteThread(threadId, remoteId)) {
      return () => {
        cancelled = true;
      };
    }

    setMessages([]);

    void (async () => {
      try {
        const response = await getAgentThreadMessages<UIMessage>(baseUrl, remoteId);

        if (cancelled || latestRemoteIdRef.current !== remoteId) {
          return;
        }

        setMessages(response.uiMessages);
      } catch (error) {
        if (cancelled || latestRemoteIdRef.current !== remoteId) {
          return;
        }

        console.error('Failed to bootstrap persisted thread messages:', error);
        setMessages([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseUrl, remoteId, setMessages, threadId]);
}

export function createPristineThreadListAdapter(baseUrl: string): RemoteThreadListAdapter {
  return {
    unstable_Provider: createPristineThreadListProvider(baseUrl),

    async list() {
      const response = await listAgentThreads(baseUrl);
      return {
        threads: response.threads.map(toRemoteThreadMetadata),
      };
    },

    async initialize(threadId: string) {
      return {
        remoteId: threadId,
        externalId: threadId,
      };
    },

    async fetch(threadId: string) {
      const response = await getAgentThread(baseUrl, threadId);
      return toRemoteThreadMetadata(response.thread);
    },

    async rename(remoteId: string, newTitle: string) {
      await renameAgentThread(baseUrl, remoteId, newTitle);
    },

    async archive(remoteId: string) {
      await archiveAgentThread(baseUrl, remoteId);
    },

    async unarchive(remoteId: string) {
      await unarchiveAgentThread(baseUrl, remoteId);
    },

    async delete(remoteId: string) {
      await deleteAgentThread(baseUrl, remoteId);
    },

    async generateTitle(remoteId: string, messages: readonly ThreadMessage[]) {
      const title = deriveAgentThreadTitleFromMessages(messages);

      if (!title) {
        return createTitleAssistantStream();
      }

      await renameAgentThread(baseUrl, remoteId, title);

      return createTitleAssistantStream(title);
    },
  };
}

type UsePristineAgentRuntimeOptions = {
  baseUrl: string;
  initialThreadId?: string;
};

export function usePristineAgentRuntime({ baseUrl, initialThreadId }: UsePristineAgentRuntimeOptions) {
  const transport = useMemo(
    () => new AssistantChatTransport<UIMessage>({
      api: `${baseUrl}/chat/pristineAgent`,
      prepareSendMessagesRequest: async (options) => ({
        body: createPristineChatRequestBody(options),
      }),
    }),
    [baseUrl],
  );
  const adapter = useMemo(() => createPristineThreadListAdapter(baseUrl), [baseUrl]);

  return useRemoteThreadListRuntime({
    runtimeHook: function RuntimeHook() {
      const id = useAssistantState((state) => state.threadListItem.id);
      const remoteId = useAssistantState((state) => state.threadListItem.remoteId);
      const aui = useAssistantApi();
      const chat = useChat<UIMessage>({
        id,
        transport,
      });

      usePristineThreadMessagesBootstrap({
        baseUrl,
        threadId: id,
        remoteId,
        setMessages: chat.setMessages,
      });

      const runtime = useAISDKRuntime(chat);

      transport.setRuntime(runtime);
      transport.__internal_setGetThreadListItem(() => (
        aui.threadListItem.source ? aui.threadListItem() : undefined
      ));

      return runtime;
    },
    adapter,
    allowNesting: true,
    ...(initialThreadId ? { threadId: initialThreadId } : {}),
  });
}