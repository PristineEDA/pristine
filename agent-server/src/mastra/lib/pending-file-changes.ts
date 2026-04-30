import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { createUnifiedDiff } from "./diff";
import { resolveAgentDataPath } from "./config";
import { readJsonFile, writeJsonFile } from "./json-store";
import { resolveWorkspacePath } from "./path-safety";

export type PendingChangeKind = "create" | "update" | "delete" | "rename";
export type PendingChangeStatus = "pending" | "applied" | "discarded";

export type PendingFileChange = {
  id: string;
  kind: PendingChangeKind;
  path: string;
  targetPath?: string;
  summary: string;
  content?: string;
  originalContent?: string;
  unifiedDiff: string;
  status: PendingChangeStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProposedFileChangeInput = {
  kind: PendingChangeKind;
  path: string;
  targetPath?: string;
  content?: string;
  summary?: string;
};

export class PendingFileChangeStore {
  private readonly filePath = resolveAgentDataPath("pending-file-changes.json");

  async list(): Promise<PendingFileChange[]> {
    return readJsonFile<PendingFileChange[]>(this.filePath, []);
  }

  async get(changeId: string): Promise<PendingFileChange | undefined> {
    const changes = await this.list();
    return changes.find((change) => change.id === changeId);
  }

  async propose(input: ProposedFileChangeInput): Promise<PendingFileChange> {
    const now = new Date().toISOString();
    const resolvedSource = resolveWorkspacePath(input.path);
    const targetPath = input.targetPath ? resolveWorkspacePath(input.targetPath) : undefined;
    const originalContent = await this.readExistingContent(input.kind, resolvedSource.absolutePath);
    const nextContent = input.content ?? "";

    if ((input.kind === "create" || input.kind === "update") && input.content === undefined) {
      throw new Error("File content is required for create and update changes.");
    }

    if (input.kind === "rename" && !targetPath) {
      throw new Error("targetPath is required for rename changes.");
    }

    if (input.kind === "rename" && targetPath) {
      await this.assertFileDoesNotExist(targetPath.absolutePath);
    }

    const unifiedDiff = this.buildDiff(input.kind, resolvedSource.relativePath, targetPath?.relativePath, originalContent, nextContent);
    const pendingChange: PendingFileChange = {
      id: randomUUID(),
      kind: input.kind,
      path: resolvedSource.relativePath,
      targetPath: targetPath?.relativePath,
      summary: input.summary?.trim() || `${input.kind} ${resolvedSource.relativePath}`,
      content: input.kind === "create" || input.kind === "update" ? nextContent : undefined,
      originalContent,
      unifiedDiff,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    const changes = await this.list();
    changes.unshift(pendingChange);
    await writeJsonFile(this.filePath, changes);

    return pendingChange;
  }

  async apply(changeId: string): Promise<PendingFileChange> {
    const changes = await this.list();
    const change = changes.find((candidate) => candidate.id === changeId);

    if (!change) {
      throw new Error("Pending file change was not found.");
    }

    if (change.status !== "pending") {
      throw new Error(`Pending file change is already ${change.status}.`);
    }

    await this.applyChange(change);
    change.status = "applied";
    change.updatedAt = new Date().toISOString();
    await writeJsonFile(this.filePath, changes);

    return change;
  }

  async discard(changeId: string): Promise<PendingFileChange> {
    const changes = await this.list();
    const change = changes.find((candidate) => candidate.id === changeId);

    if (!change) {
      throw new Error("Pending file change was not found.");
    }

    if (change.status !== "pending") {
      throw new Error(`Pending file change is already ${change.status}.`);
    }

    change.status = "discarded";
    change.updatedAt = new Date().toISOString();
    await writeJsonFile(this.filePath, changes);

    return change;
  }

  private async readExistingContent(kind: PendingChangeKind, absolutePath: string): Promise<string | undefined> {
    try {
      const content = await fs.readFile(absolutePath, "utf8");

      if (kind === "create") {
        throw new Error("Cannot create a file that already exists.");
      }

      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      if (kind === "update" || kind === "delete" || kind === "rename") {
        throw new Error("The requested source file does not exist.");
      }

      return undefined;
    }
  }

  private async assertFileDoesNotExist(absolutePath: string): Promise<void> {
    try {
      await fs.access(absolutePath);
      throw new Error("The target file already exists.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }

      throw error;
    }
  }

  private buildDiff(kind: PendingChangeKind, sourcePath: string, targetPath: string | undefined, originalContent: string | undefined, nextContent: string): string {
    if (kind === "delete") {
      return createUnifiedDiff(originalContent ?? "", "", sourcePath);
    }

    if (kind === "rename") {
      return [`rename from ${sourcePath}`, `rename to ${targetPath ?? ""}`].join("\n");
    }

    return createUnifiedDiff(originalContent ?? "", nextContent, sourcePath);
  }

  private async applyChange(change: PendingFileChange): Promise<void> {
    const source = resolveWorkspacePath(change.path);
    const target = change.targetPath ? resolveWorkspacePath(change.targetPath) : undefined;

    if (change.kind === "create") {
      await this.assertFileDoesNotExist(source.absolutePath);
      await fs.mkdir(path.dirname(source.absolutePath), { recursive: true });
      await fs.writeFile(source.absolutePath, change.content ?? "", "utf8");
      return;
    }

    const currentContent = await fs.readFile(source.absolutePath, "utf8");
    if (currentContent !== (change.originalContent ?? "")) {
      throw new Error("The file changed after this proposal was created. Review and regenerate the pending change.");
    }

    if (change.kind === "update") {
      await fs.writeFile(source.absolutePath, change.content ?? "", "utf8");
      return;
    }

    if (change.kind === "delete") {
      await fs.unlink(source.absolutePath);
      return;
    }

    if (change.kind === "rename" && target) {
      await this.assertFileDoesNotExist(target.absolutePath);
      await fs.mkdir(path.dirname(target.absolutePath), { recursive: true });
      await fs.rename(source.absolutePath, target.absolutePath);
      return;
    }

    throw new Error("Unsupported pending file change kind.");
  }
}

export const pendingFileChangeStore = new PendingFileChangeStore();
