import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { Server } from 'lucide-react';
import { useMemo } from 'react';

import { PristineAssistantThread } from '../../assistant/PristineAssistantThread';
import {
  getPristineAgentBaseUrl,
  normalizeAgentBaseUrl,
} from './agentApi';

type AIAgentPanelProps = {
  baseUrl?: string;
};

export function AIAgentPanel({ baseUrl = getPristineAgentBaseUrl() }: AIAgentPanelProps) {
  const normalizedBaseUrl = useMemo(() => normalizeAgentBaseUrl(baseUrl), [baseUrl]);
  const transport = useMemo(() => new AssistantChatTransport({
    api: `${normalizedBaseUrl}/chat/pristineAgent`,
  }), [normalizedBaseUrl]);
  const runtime = useChatRuntime({ transport });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Server className="size-3.5" />
          </div>
          <span className="text-xs font-semibold">Pristine Agent</span>
        </div>
        <PristineAssistantThread agentBaseUrl={normalizedBaseUrl} />
      </div>
    </AssistantRuntimeProvider>
  );
}