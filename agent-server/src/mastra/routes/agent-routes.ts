import { registerApiRoute } from "@mastra/core/server";

import { agentModelId, workspaceRoot } from "../lib/config";
import { listMcpToolNames, mcpServers } from "../lib/mcp";
import { pendingFileChangeStore } from "../lib/pending-file-changes";
import { pendingShellCommandStore } from "../lib/pending-shell-commands";
import { pristineWorkspace } from "../lib/workspace";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
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
  registerApiRoute("/agent/skills", {
    method: "GET",
    handler: async (context) => context.json({ skills: await (pristineWorkspace.skills?.list() ?? Promise.resolve([])) }),
  }),
  registerApiRoute("/agent/mcp", {
    method: "GET",
    handler: async (context) => context.json({ servers: Object.keys(mcpServers), tools: await listMcpToolNames() }),
  }),
];
