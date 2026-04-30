import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveWorkspacePath, WorkspacePathError } from "./path-safety";

const workspaceRoot = path.resolve("..");

describe("path-safety", () => {
  it("normalizes paths inside the configured workspace", () => {
    const resolved = resolveWorkspacePath("src/app/App.tsx", workspaceRoot);

    expect(resolved.absolutePath).toBe(path.join(workspaceRoot, "src", "app", "App.tsx"));
    expect(resolved.relativePath).toBe("src/app/App.tsx");
  });

  it("rejects paths that escape the workspace root", () => {
    expect(() => resolveWorkspacePath("../pristine-auth/package.json", workspaceRoot)).toThrow(WorkspacePathError);
  });
});