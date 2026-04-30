import { mkdirSync } from "node:fs";
import path from "node:path";

import { chatRoute } from "@mastra/ai-sdk";
import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";

import { pristineAgent } from "./agents/pristine-agent";
import { agentDataDir, agentHost, agentPort } from "./lib/config";
import { agentRoutes } from "./routes/agent-routes";

mkdirSync(agentDataDir, { recursive: true });

export const mastra = new Mastra({
  agents: { pristineAgent },
  storage: new LibSQLStore({
    id: "pristine-agent-storage",
    url: `file:${path.join(agentDataDir, "memory.db").replace(/\\/gu, "/")}`,
  }),
  server: {
    host: agentHost,
    port: agentPort,
    apiRoutes: [
      chatRoute({
        path: "/chat/:agentId",
        version: "v6",
        defaultOptions: {
          maxSteps: 12,
        },
      }),
      ...agentRoutes,
    ],
    build: {
      openAPIDocs: true,
      swaggerUI: true,
    },
  },
});
