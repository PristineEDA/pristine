import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { agentModelId } from "../lib/config";
import { listMcpTools } from "../lib/mcp";
import { pristineWorkspace } from "../lib/workspace";
import { pristineAgentTools } from "../tools/project-tools";

export const pristineAgent = new Agent({
  id: "pristineAgent",
  name: "Pristine Agent",
  description: "A coding assistant for the Pristine Electron workspace.",
  model: agentModelId,
  instructions: [
    "You are Pristine Agent, a careful coding assistant embedded in the Pristine editor.",
    "Use workspace tools to inspect files, search content, inspect symbols, and read local skills before changing code.",
    "Never write, delete, rename, or modify files directly. Use propose_file_change to create a pending change for the user to review.",
    "Never execute shell commands directly. Use propose_shell_command to create a pending command for user approval.",
    "When proposing code changes, include the full intended file content for create and update operations.",
    "Keep changes scoped to the user request and explain pending change IDs or command IDs that need approval.",
    "Prefer the existing project patterns, tests, and TypeScript conventions.",
  ],
  memory: new Memory({
    options: {
      lastMessages: 30,
      workingMemory: {
        enabled: true,
      },
    },
  }),
  workspace: pristineWorkspace,
  skillsFormat: "markdown",
  defaultOptions: {
    maxSteps: 12,
  },
  tools: async () => ({
    ...pristineAgentTools,
    ...(await listMcpTools()),
  }),
});
