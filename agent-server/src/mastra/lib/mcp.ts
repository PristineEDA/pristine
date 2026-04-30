import { pathToFileURL } from "node:url";

import { MCPClient, type MastraMCPServerDefinition } from "@mastra/mcp";
import type { Tool } from "@mastra/core/tools";

import { mcpServersJson, workspaceRoot } from "./config";

type RawMcpServerDefinition = Record<string, unknown>;

function parseMcpServers(): Record<string, MastraMCPServerDefinition> {
  let parsedValue: Record<string, RawMcpServerDefinition>;

  try {
    parsedValue = JSON.parse(mcpServersJson) as Record<string, RawMcpServerDefinition>;
  } catch {
    parsedValue = {};
  }

  const workspaceRootEntry = { uri: pathToFileURL(workspaceRoot).href, name: "Pristine" };

  return Object.fromEntries(
    Object.entries(parsedValue).map(([serverName, rawDefinition]) => {
      const normalizedDefinition = { ...rawDefinition } as RawMcpServerDefinition;

      if (typeof normalizedDefinition.url === "string") {
        normalizedDefinition.url = new URL(normalizedDefinition.url);
      }

      if (!normalizedDefinition.roots) {
        normalizedDefinition.roots = [workspaceRootEntry];
      }

      if (normalizedDefinition.requireToolApproval === undefined) {
        normalizedDefinition.requireToolApproval = true;
      }

      return [serverName, normalizedDefinition as MastraMCPServerDefinition];
    }),
  );
}

export const mcpServers = parseMcpServers();
export const mcpClient = Object.keys(mcpServers).length > 0
  ? new MCPClient({ id: "pristine-agent-mcp", servers: mcpServers, timeout: 60_000 })
  : undefined;

export async function listMcpTools(): Promise<Record<string, Tool<any, any, any, any>>> {
  if (!mcpClient) {
    return {};
  }

  return mcpClient.listTools();
}

export async function listMcpToolNames(): Promise<string[]> {
  const tools = await listMcpTools();
  return Object.keys(tools);
}
