import path from "node:path";

import { workspaceRoot } from "./config";

export class WorkspacePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspacePathError";
  }
}

export type ResolvedWorkspacePath = {
  absolutePath: string;
  relativePath: string;
};

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function assertInsideWorkspace(absolutePath: string, rootPath = workspaceRoot): void {
  const relativePath = path.relative(rootPath, absolutePath);

  if (relativePath === "") {
    return;
  }

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new WorkspacePathError("Path escapes the configured workspace root.");
  }
}

export function resolveWorkspacePath(inputPath: string, rootPath = workspaceRoot): ResolvedWorkspacePath {
  const trimmedPath = inputPath.trim();

  if (!trimmedPath) {
    throw new WorkspacePathError("Path is required.");
  }

  if (trimmedPath.includes("\0")) {
    throw new WorkspacePathError("Path contains an invalid character.");
  }

  const absolutePath = path.isAbsolute(trimmedPath) ? path.resolve(trimmedPath) : path.resolve(rootPath, trimmedPath);
  assertInsideWorkspace(absolutePath, rootPath);

  return {
    absolutePath,
    relativePath: toPosixPath(path.relative(rootPath, absolutePath)),
  };
}
