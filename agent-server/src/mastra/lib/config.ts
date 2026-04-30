import path from "node:path";
import { fileURLToPath } from "node:url";

function resolvePackageRoot(): string {
  const currentDirectory = process.cwd();

  if (path.basename(currentDirectory) === "agent-server") {
    return currentDirectory;
  }

  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

function readIntegerEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function normalizeModelId(modelId: string): string {
  const trimmedModelId = modelId.trim();

  if (trimmedModelId === "openrouter/free") {
    return "openrouter/openrouter/free";
  }

  return trimmedModelId || "openrouter/openrouter/free";
}

export const agentServerRoot = resolvePackageRoot();
export const workspaceRoot = path.resolve(agentServerRoot, process.env.PRISTINE_WORKSPACE_ROOT ?? "..");
export const agentDataDir = path.resolve(agentServerRoot, process.env.PRISTINE_AGENT_DATA_DIR ?? ".pristine-agent");
export const agentModelId = normalizeModelId(process.env.PRISTINE_AGENT_MODEL ?? "openrouter/openrouter/free");
export const agentHost = process.env.PRISTINE_AGENT_HOST ?? "localhost";
export const agentPort = readIntegerEnv("PRISTINE_AGENT_PORT", 4111);
export const agentShellTimeoutMs = readIntegerEnv("PRISTINE_AGENT_SHELL_TIMEOUT_MS", 120_000);
export const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
export const mcpServersJson = process.env.MCP_SERVERS_JSON ?? "{}";

export function resolveAgentDataPath(fileName: string): string {
  return path.join(agentDataDir, fileName);
}
