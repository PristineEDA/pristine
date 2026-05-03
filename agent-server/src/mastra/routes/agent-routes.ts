import { registerApiRoute } from "@mastra/core/server";
import { convertMessages } from "@mastra/core/agent";
import type { Memory as PristineAgentMemory } from "@mastra/memory";

import { pristineAgent } from "../agents/pristine-agent";
import { agentModelId, workspaceRoot } from "../lib/config";
import { listMcpToolNames, mcpServers } from "../lib/mcp";
import { pendingFileChangeStore } from "../lib/pending-file-changes";
import { pendingShellCommandStore } from "../lib/pending-shell-commands";
import { pristineWorkspace } from "../lib/workspace";

type AgentThreadMetadata = Record<string, unknown> & {
  pristine?: {
    archived?: boolean;
    workspaceResourceId?: string;
    workspaceRoot?: string;
  };
};

type AgentThread = {
  id: string;
  title?: string;
  resourceId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: AgentThreadMetadata;
};

const normalizedWorkspaceRoot = normalizeWorkspaceRoot(workspaceRoot);
export const workspaceThreadResourceId = `pristine:workspace:${normalizedWorkspaceRoot}`;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function normalizeWorkspaceRoot(value: string): string {
  return value.replace(/\\/gu, "/").replace(/\/+$/u, "").toLowerCase();
}

async function getAgentMemory(): Promise<PristineAgentMemory> {
  const memory = await pristineAgent.getMemory({});

  if (!memory) {
    throw new Error("Pristine Agent memory is not configured.");
  }

  return memory as PristineAgentMemory;
}

function getThreadMetadata(thread: AgentThread): AgentThreadMetadata {
  if (!thread.metadata || typeof thread.metadata !== "object") {
    return {};
  }

  return thread.metadata;
}

function getThreadWorkspaceResourceId(thread: AgentThread): string | undefined {
  const metadata = getThreadMetadata(thread);
  const metadataWorkspaceResourceId = metadata.pristine?.workspaceResourceId;

  if (typeof metadataWorkspaceResourceId === "string" && metadataWorkspaceResourceId.trim()) {
    return metadataWorkspaceResourceId;
  }

  return typeof thread.resourceId === "string" && thread.resourceId.trim()
    ? thread.resourceId
    : undefined;
}

function isLegacyThread(thread: AgentThread): boolean {
  const resourceId = getThreadWorkspaceResourceId(thread);
  return !resourceId || !resourceId.startsWith("pristine:workspace:");
}

function isAccessibleThread(thread: AgentThread): boolean {
  const resourceId = getThreadWorkspaceResourceId(thread);

  if (!resourceId) {
    return true;
  }

  if (resourceId === workspaceThreadResourceId) {
    return true;
  }

  return isLegacyThread(thread);
}

function getThreadStatus(thread: AgentThread): "regular" | "archived" {
  return getThreadMetadata(thread).pristine?.archived ? "archived" : "regular";
}

function serializeThread(thread: AgentThread) {
  return {
    id: thread.id,
    title: thread.title,
    resourceId: getThreadWorkspaceResourceId(thread) ?? null,
    status: getThreadStatus(thread),
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    isLegacy: isLegacyThread(thread),
  };
}

function withPristineThreadMetadata(
  thread: AgentThread,
  updater: (metadata: NonNullable<AgentThreadMetadata["pristine"]>) => NonNullable<AgentThreadMetadata["pristine"]>,
): Record<string, unknown> {
  const metadata = getThreadMetadata(thread);
  const pristineMetadata = updater({
    archived: metadata.pristine?.archived,
    workspaceResourceId: metadata.pristine?.workspaceResourceId ?? workspaceThreadResourceId,
    workspaceRoot: metadata.pristine?.workspaceRoot ?? normalizedWorkspaceRoot,
  });

  return {
    ...metadata,
    pristine: pristineMetadata,
  };
}

async function getAccessibleThread(threadId: string): Promise<AgentThread | null> {
  const memory = await getAgentMemory();
  const thread = await memory.getThreadById({ threadId }) as AgentThread | null;

  if (!thread || !isAccessibleThread(thread)) {
    return null;
  }

  return thread;
}

function readTitlePayload(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("title" in payload)) {
    throw new Error("Thread title is required.");
  }

  const { title } = payload;
  if (typeof title !== "string" || !title.trim()) {
    throw new Error("Thread title is required.");
  }

  return title.trim();
}

export const agentRoutes = [
  registerApiRoute("/agent/status", {
    method: "GET",
    handler: async (context) => {
      const pendingFileChanges = (await pendingFileChangeStore.list()).filter((change) => change.status === "pending");
      const pendingShellCommands = (await pendingShellCommandStore.list()).filter((command) => command.status === "pending");

      return context.json({
        agentId: "pristineAgent",
        chatPath: "/chat/pristineAgent",
        model: agentModelId,
        workspaceRoot,
        pendingFileChanges: pendingFileChanges.length,
        pendingShellCommands: pendingShellCommands.length,
        providers: {
          openrouter: Boolean(process.env.OPENROUTER_API_KEY),
          openai: Boolean(process.env.OPENAI_API_KEY),
          anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
          google: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
        },
        mcpServers: Object.keys(mcpServers),
      });
    },
  }),
  registerApiRoute("/agent/pending-changes", {
    method: "GET",
    handler: async (context) => context.json({ changes: await pendingFileChangeStore.list() }),
  }),
  registerApiRoute("/agent/pending-changes/:id", {
    method: "GET",
    handler: async (context) => {
      const change = await pendingFileChangeStore.get(context.req.param("id"));

      if (!change) {
        return context.json({ error: "Pending file change was not found." }, 404);
      }

      return context.json({ change });
    },
  }),
  registerApiRoute("/agent/pending-changes/:id/apply", {
    method: "POST",
    handler: async (context) => {
      try {
        return context.json({ change: await pendingFileChangeStore.apply(context.req.param("id")) });
      } catch (error) {
        return context.json({ error: getErrorMessage(error) }, 400);
      }
    },
  }),
  registerApiRoute("/agent/pending-changes/:id/discard", {
    method: "POST",
    handler: async (context) => {
      try {
        return context.json({ change: await pendingFileChangeStore.discard(context.req.param("id")) });
      } catch (error) {
        return context.json({ error: getErrorMessage(error) }, 400);
      }
    },
  }),
  registerApiRoute("/agent/shell-commands", {
    method: "GET",
    handler: async (context) => context.json({ commands: await pendingShellCommandStore.list() }),
  }),
  registerApiRoute("/agent/shell-commands/:id/run", {
    method: "POST",
    handler: async (context) => {
      try {
        return context.json({ command: await pendingShellCommandStore.run(context.req.param("id")) });
      } catch (error) {
        return context.json({ error: getErrorMessage(error) }, 400);
      }
    },
  }),
  registerApiRoute("/agent/shell-commands/:id/discard", {
    method: "POST",
    handler: async (context) => {
      try {
        return context.json({ command: await pendingShellCommandStore.discard(context.req.param("id")) });
      } catch (error) {
        return context.json({ error: getErrorMessage(error) }, 400);
      }
    },
  }),
  registerApiRoute("/agent/threads", {
    method: "GET",
    handler: async (context) => {
      try {
        const memory = await getAgentMemory();
        const result = await memory.listThreads({
          page: 0,
          perPage: false,
          orderBy: { field: "updatedAt", direction: "DESC" },
        });

        const threads = (result.threads as AgentThread[])
          .filter(isAccessibleThread)
          .map(serializeThread);

        return context.json({
          resourceId: workspaceThreadResourceId,
          threads,
        });
      } catch (error) {
        return context.json({ error: getErrorMessage(error) }, 500);
      }
    },
  }),
  registerApiRoute("/agent/threads/:id/messages", {
    method: "GET",
    handler: async (context) => {
      try {
        const thread = await getAccessibleThread(context.req.param("id"));

        if (!thread) {
          return context.json({ error: "Thread was not found." }, 404);
        }

        const memory = await getAgentMemory();
        const recallResult = await memory.recall({
          threadId: thread.id,
          resourceId: getThreadWorkspaceResourceId(thread),
          page: 0,
          perPage: false,
        });

        return context.json({
          thread: serializeThread(thread),
          messages: recallResult.messages,
          uiMessages: convertMessages(recallResult.messages).to("AIV6.UI"),
          total: recallResult.total,
        });
      } catch (error) {
        return context.json({ error: getErrorMessage(error) }, 500);
      }
    },
  }),
  registerApiRoute("/agent/threads/:id/archive", {
    method: "POST",
    handler: async (context) => {
      try {
        const memory = await getAgentMemory();
        const thread = await getAccessibleThread(context.req.param("id"));

        if (!thread) {
          return context.json({ error: "Thread was not found." }, 404);
        }

        const updatedThread = await memory.updateThread({
          id: thread.id,
          title: thread.title ?? "",
          metadata: withPristineThreadMetadata(thread, (metadata) => ({
            ...metadata,
            archived: true,
          })),
        }) as AgentThread;

        return context.json({ thread: serializeThread(updatedThread) });
      } catch (error) {
        return context.json({ error: getErrorMessage(error) }, 400);
      }
    },
  }),
  registerApiRoute("/agent/threads/:id/unarchive", {
    method: "POST",
    handler: async (context) => {
      try {
        const memory = await getAgentMemory();
        const thread = await getAccessibleThread(context.req.param("id"));

        if (!thread) {
          return context.json({ error: "Thread was not found." }, 404);
        }

        const updatedThread = await memory.updateThread({
          id: thread.id,
          title: thread.title ?? "",
          metadata: withPristineThreadMetadata(thread, (metadata) => ({
            ...metadata,
            archived: false,
          })),
        }) as AgentThread;

        return context.json({ thread: serializeThread(updatedThread) });
      } catch (error) {
        return context.json({ error: getErrorMessage(error) }, 400);
      }
    },
  }),
  registerApiRoute("/agent/threads/:id", {
    method: "GET",
    handler: async (context) => {
      try {
        const thread = await getAccessibleThread(context.req.param("id"));

        if (!thread) {
          return context.json({ error: "Thread was not found." }, 404);
        }

        return context.json({ thread: serializeThread(thread) });
      } catch (error) {
        return context.json({ error: getErrorMessage(error) }, 500);
      }
    },
  }),
  registerApiRoute("/agent/threads/:id", {
    method: "PUT",
    handler: async (context) => {
      try {
        const memory = await getAgentMemory();
        const thread = await getAccessibleThread(context.req.param("id"));

        if (!thread) {
          return context.json({ error: "Thread was not found." }, 404);
        }

        const title = readTitlePayload(await context.req.json());
        const updatedThread = await memory.updateThread({
          id: thread.id,
          title,
          metadata: withPristineThreadMetadata(thread, (metadata) => metadata),
        }) as AgentThread;

        return context.json({ thread: serializeThread(updatedThread) });
      } catch (error) {
        return context.json({ error: getErrorMessage(error) }, 400);
      }
    },
  }),
  registerApiRoute("/agent/threads/:id", {
    method: "DELETE",
    handler: async (context) => {
      try {
        const memory = await getAgentMemory();
        const thread = await getAccessibleThread(context.req.param("id"));

        if (!thread) {
          return context.json({ error: "Thread was not found." }, 404);
        }

        await memory.deleteThread(thread.id);

        return context.json({ deleted: true, threadId: thread.id });
      } catch (error) {
        return context.json({ error: getErrorMessage(error) }, 400);
      }
    },
  }),
  registerApiRoute("/agent/skills", {
    method: "GET",
    handler: async (context) => context.json({ skills: await (pristineWorkspace.skills?.list() ?? Promise.resolve([])) }),
  }),
  registerApiRoute("/agent/mcp", {
    method: "GET",
    handler: async (context) => context.json({ servers: Object.keys(mcpServers), tools: await listMcpToolNames() }),
  }),
];
