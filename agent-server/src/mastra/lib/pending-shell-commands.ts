import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { resolveAgentDataPath, agentShellTimeoutMs } from "./config";
import { readJsonFile, writeJsonFile } from "./json-store";
import { resolveWorkspacePath } from "./path-safety";

export type ShellCommandStatus = "pending" | "running" | "completed" | "failed" | "discarded";

export type PendingShellCommand = {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  summary: string;
  status: ShellCommandStatus;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProposedShellCommandInput = {
  command: string;
  args?: string[];
  cwd?: string;
  summary?: string;
};

const allowedCommands = new Set([
  "bash",
  "cmake",
  "cocotb-config",
  "git",
  "iverilog",
  "make",
  "node",
  "npm",
  "npx",
  "pnpm",
  "python",
  "python3",
  "sh",
  "tsc",
  "verilator",
  "vitest",
  "vvp",
]);

function normalizeCommand(command: string): string {
  return command.trim().toLowerCase().replace(/\.(cmd|exe|bat)$/u, "");
}

function validateCommand(command: string): void {
  const normalizedCommand = normalizeCommand(command);

  if (!normalizedCommand || normalizedCommand.includes("/") || normalizedCommand.includes("\\")) {
    throw new Error("Command must be an executable name, not a path.");
  }

  if (!allowedCommands.has(normalizedCommand)) {
    throw new Error(`Command is not in the agent allowlist: ${command}`);
  }
}

function validateArgs(args: string[]): void {
  for (const argument of args) {
    if (argument.includes("\0")) {
      throw new Error("Command arguments contain an invalid character.");
    }
  }
}

function limitOutput(content: string): string {
  const maxLength = 60_000;
  return content.length > maxLength ? content.slice(-maxLength) : content;
}

export class PendingShellCommandStore {
  private readonly filePath = resolveAgentDataPath("pending-shell-commands.json");

  async list(): Promise<PendingShellCommand[]> {
    return readJsonFile<PendingShellCommand[]>(this.filePath, []);
  }

  async propose(input: ProposedShellCommandInput): Promise<PendingShellCommand> {
    const args = input.args ?? [];
    validateCommand(input.command);
    validateArgs(args);

    const resolvedCwd = resolveWorkspacePath(input.cwd ?? ".");
    const now = new Date().toISOString();
    const pendingCommand: PendingShellCommand = {
      id: randomUUID(),
      command: input.command.trim(),
      args,
      cwd: resolvedCwd.relativePath || ".",
      summary: input.summary?.trim() || `${input.command} ${args.join(" ")}`.trim(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    const commands = await this.list();
    commands.unshift(pendingCommand);
    await writeJsonFile(this.filePath, commands);

    return pendingCommand;
  }

  async discard(commandId: string): Promise<PendingShellCommand> {
    const commands = await this.list();
    const command = commands.find((candidate) => candidate.id === commandId);

    if (!command) {
      throw new Error("Pending shell command was not found.");
    }

    if (command.status !== "pending") {
      throw new Error(`Pending shell command is already ${command.status}.`);
    }

    command.status = "discarded";
    command.updatedAt = new Date().toISOString();
    await writeJsonFile(this.filePath, commands);

    return command;
  }

  async run(commandId: string): Promise<PendingShellCommand> {
    const commands = await this.list();
    const command = commands.find((candidate) => candidate.id === commandId);

    if (!command) {
      throw new Error("Pending shell command was not found.");
    }

    if (command.status !== "pending") {
      throw new Error(`Pending shell command is already ${command.status}.`);
    }

    command.status = "running";
    command.updatedAt = new Date().toISOString();
    await writeJsonFile(this.filePath, commands);

    const result = await this.execute(command);
    command.status = result.exitCode === 0 ? "completed" : "failed";
    command.exitCode = result.exitCode;
    command.stdout = result.stdout;
    command.stderr = result.stderr;
    command.updatedAt = new Date().toISOString();
    await writeJsonFile(this.filePath, commands);

    return command;
  }

  private execute(command: PendingShellCommand): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
    validateCommand(command.command);
    validateArgs(command.args);

    const resolvedCwd = resolveWorkspacePath(command.cwd);

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let finished = false;
      const child = spawn(command.command, command.args, {
        cwd: resolvedCwd.absolutePath,
        env: process.env,
        shell: false,
      });

      const timeout = setTimeout(() => {
        if (finished) {
          return;
        }

        stderr += `\nCommand timed out after ${agentShellTimeoutMs}ms.`;
        child.kill();
      }, agentShellTimeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout = limitOutput(stdout + chunk.toString("utf8"));
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        stderr = limitOutput(stderr + chunk.toString("utf8"));
      });

      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.on("close", (exitCode) => {
        finished = true;
        clearTimeout(timeout);
        resolve({ exitCode, stdout, stderr });
      });
    });
  }
}

export const pendingShellCommandStore = new PendingShellCommandStore();
