import { promises as fs } from "node:fs";
import path from "node:path";

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { pendingFileChangeStore } from "../lib/pending-file-changes";
import { pendingShellCommandStore } from "../lib/pending-shell-commands";
import { resolveWorkspacePath, toPosixPath } from "../lib/path-safety";
import { workspaceRoot } from "../lib/config";
import { pristineWorkspace } from "../lib/workspace";

const ignoredDirectoryNames = new Set([".git", ".pristine-agent", "binaries", "coverage", "dist", "dist-electron", "node_modules", "perf-results", "release", "test-results"]);

const fileChangeKindSchema = z.enum(["create", "update", "delete", "rename"]);

async function collectFiles(directoryPath: string, limit: number, files: string[]): Promise<void> {
  if (files.length >= limit) {
    return;
  }

  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (files.length >= limit) {
      return;
    }

    if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(absolutePath, limit, files);
      continue;
    }

    if (entry.isFile()) {
      files.push(toPosixPath(path.relative(workspaceRoot, absolutePath)));
    }
  }
}

async function readTextFile(absolutePath: string, maxBytes: number): Promise<string> {
  const stat = await fs.stat(absolutePath);

  if (stat.size > maxBytes) {
    throw new Error(`File is larger than ${maxBytes} bytes.`);
  }

  return fs.readFile(absolutePath, "utf8");
}

export const readProjectFileTool = createTool({
  id: "read_project_file",
  description: "Read a UTF-8 text file inside the Pristine workspace.",
  inputSchema: z.object({
    path: z.string().describe("Workspace-relative path to read."),
    maxBytes: z.number().int().positive().max(1_000_000).default(200_000),
  }),
  outputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  execute: async ({ path: inputPath, maxBytes }) => {
    const resolvedPath = resolveWorkspacePath(inputPath);
    const content = await readTextFile(resolvedPath.absolutePath, maxBytes ?? 200_000);

    return { path: resolvedPath.relativePath, content };
  },
});

export const listProjectFilesTool = createTool({
  id: "list_project_files",
  description: "List files in the Pristine workspace, skipping generated and dependency directories.",
  inputSchema: z.object({
    path: z.string().default(".").describe("Workspace-relative directory to list."),
    limit: z.number().int().positive().max(2_000).default(300),
  }),
  outputSchema: z.object({
    root: z.string(),
    files: z.array(z.string()),
    truncated: z.boolean(),
  }),
  execute: async ({ path: inputPath, limit }) => {
    const fileLimit = limit ?? 300;
    const resolvedPath = resolveWorkspacePath(inputPath ?? ".");
    const files: string[] = [];
    await collectFiles(resolvedPath.absolutePath, fileLimit + 1, files);

    return {
      root: resolvedPath.relativePath || ".",
      files: files.slice(0, fileLimit),
      truncated: files.length > fileLimit,
    };
  },
});

export const searchProjectFilesTool = createTool({
  id: "search_project_files",
  description: "Search UTF-8 workspace files by plain text or regular expression.",
  inputSchema: z.object({
    query: z.string().min(1),
    path: z.string().default("."),
    regex: z.boolean().default(false),
    limit: z.number().int().positive().max(100).default(40),
  }),
  outputSchema: z.object({
    matches: z.array(z.object({ path: z.string(), line: z.number(), preview: z.string() })),
    truncated: z.boolean(),
  }),
  execute: async ({ query, path: inputPath, regex, limit }) => {
    const matchLimit = limit ?? 40;
    const resolvedPath = resolveWorkspacePath(inputPath ?? ".");
    const files: string[] = [];
    await collectFiles(resolvedPath.absolutePath, 5_000, files);

    const matcher = regex ? new RegExp(query, "u") : undefined;
    const matches: Array<{ path: string; line: number; preview: string }> = [];

    for (const relativeFilePath of files) {
      if (matches.length > matchLimit) {
        break;
      }

      const absolutePath = resolveWorkspacePath(relativeFilePath).absolutePath;

      try {
        const content = await readTextFile(absolutePath, 500_000);
        const lines = content.split(/\r?\n/u);

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
          const line = lines[lineIndex] ?? "";
          const found = matcher ? matcher.test(line) : line.toLowerCase().includes(query.toLowerCase());

          if (found) {
            matches.push({ path: relativeFilePath, line: lineIndex + 1, preview: line.trim().slice(0, 240) });
          }

          if (matches.length > matchLimit) {
            break;
          }
        }
      } catch {
        continue;
      }
    }

    return { matches: matches.slice(0, matchLimit), truncated: matches.length > matchLimit };
  },
});

export const proposeFileChangeTool = createTool({
  id: "propose_file_change",
  description: "Create a pending file change for the user to review and apply later. This never writes to disk.",
  inputSchema: z.object({
    kind: fileChangeKindSchema,
    path: z.string(),
    targetPath: z.string().optional(),
    content: z.string().optional(),
    summary: z.string().optional(),
  }),
  outputSchema: z.object({
    id: z.string(),
    kind: fileChangeKindSchema,
    path: z.string(),
    targetPath: z.string().optional(),
    summary: z.string(),
    unifiedDiff: z.string(),
    status: z.string(),
  }),
  execute: async (input) => pendingFileChangeStore.propose(input),
});

export const listPendingFileChangesTool = createTool({
  id: "list_pending_file_changes",
  description: "List pending file changes created by the agent.",
  outputSchema: z.object({
    changes: z.array(z.object({
      id: z.string(),
      kind: fileChangeKindSchema,
      path: z.string(),
      targetPath: z.string().optional(),
      summary: z.string(),
      unifiedDiff: z.string(),
      status: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })),
  }),
  execute: async () => ({ changes: await pendingFileChangeStore.list() }),
});

export const proposeShellCommandTool = createTool({
  id: "propose_shell_command",
  description: "Create a pending shell command for user approval. This never executes the command.",
  inputSchema: z.object({
    command: z.string(),
    args: z.array(z.string()).default([]),
    cwd: z.string().default("."),
    summary: z.string().optional(),
  }),
  outputSchema: z.object({
    id: z.string(),
    command: z.string(),
    args: z.array(z.string()),
    cwd: z.string(),
    summary: z.string(),
    status: z.string(),
  }),
  execute: async (input) => pendingShellCommandStore.propose(input),
});

export const listPendingShellCommandsTool = createTool({
  id: "list_pending_shell_commands",
  description: "List pending shell commands created by the agent.",
  outputSchema: z.object({
    commands: z.array(z.object({
      id: z.string(),
      command: z.string(),
      args: z.array(z.string()),
      cwd: z.string(),
      summary: z.string(),
      status: z.string(),
      exitCode: z.number().nullable().optional(),
      stdout: z.string().optional(),
      stderr: z.string().optional(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })),
  }),
  execute: async () => ({ commands: await pendingShellCommandStore.list() }),
});

export const listSkillsTool = createTool({
  id: "list_skills",
  description: "List local SKILL.md skills available to the Pristine agent.",
  outputSchema: z.object({
    skills: z.array(z.object({
      name: z.string(),
      path: z.string(),
      description: z.string(),
    })),
  }),
  execute: async () => ({ skills: await (pristineWorkspace.skills?.list() ?? Promise.resolve([])) }),
});

export const readSkillTool = createTool({
  id: "read_skill",
  description: "Read a local SKILL.md skill by name or path.",
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    skill: z.object({
      name: z.string(),
      path: z.string(),
      description: z.string(),
      instructions: z.string(),
    }).nullable(),
  }),
  execute: async ({ name }) => ({ skill: await (pristineWorkspace.skills?.get(name) ?? Promise.resolve(null)) }),
});

export const pristineAgentTools = {
  read_project_file: readProjectFileTool,
  list_project_files: listProjectFilesTool,
  search_project_files: searchProjectFilesTool,
  propose_file_change: proposeFileChangeTool,
  list_pending_file_changes: listPendingFileChangesTool,
  propose_shell_command: proposeShellCommandTool,
  list_pending_shell_commands: listPendingShellCommandsTool,
  list_skills: listSkillsTool,
  read_skill: readSkillTool,
};
