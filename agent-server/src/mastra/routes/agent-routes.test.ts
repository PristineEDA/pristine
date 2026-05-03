import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const memory = {
    getThreadById: vi.fn(),
    recall: vi.fn(),
  };

  return {
    memory,
    getMemory: vi.fn(async () => memory),
    convertMessages: vi.fn(() => ({
      to: vi.fn(() => [{ id: "ui-message-1" }]),
    })),
    pendingFileChangesList: vi.fn(async () => []),
    pendingShellCommandsList: vi.fn(async () => []),
  };
});

vi.mock("@mastra/core/agent", () => ({
  convertMessages: mocks.convertMessages,
}));

vi.mock("../agents/pristine-agent", () => ({
  pristineAgent: {
    getMemory: mocks.getMemory,
  },
}));

vi.mock("../lib/config", () => ({
  agentModelId: "test-model",
  workspaceRoot: "C:/Workspace/Pristine",
}));

vi.mock("../lib/mcp", () => ({
  listMcpToolNames: vi.fn(() => []),
  mcpServers: {},
}));

vi.mock("../lib/pending-file-changes", () => ({
  pendingFileChangeStore: {
    list: mocks.pendingFileChangesList,
  },
}));

vi.mock("../lib/pending-shell-commands", () => ({
  pendingShellCommandStore: {
    list: mocks.pendingShellCommandsList,
  },
}));

vi.mock("../lib/workspace", () => ({
  pristineWorkspace: {},
}));

type MockContext = {
  req: {
    param: (name: string) => string;
  };
  json: ReturnType<typeof vi.fn>;
};

describe("agent thread message routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses workspace metadata resource ids when recalling thread history", async () => {
    mocks.memory.getThreadById.mockResolvedValue({
      id: "thread-123",
      title: "Existing thread",
      resourceId: undefined,
      createdAt: new Date("2026-05-01T10:00:00.000Z"),
      updatedAt: new Date("2026-05-02T10:00:00.000Z"),
      metadata: {
        pristine: {
          workspaceResourceId: "pristine:workspace:c:/workspace/pristine",
        },
      },
    });
    mocks.memory.recall.mockResolvedValue({
      messages: [{ id: "message-1", role: "user" }],
      total: 1,
    });

    const { agentRoutes } = await import("./agent-routes");
    const route = agentRoutes.find(
      (candidate): candidate is Extract<(typeof agentRoutes)[number], { handler: Function }> => (
        candidate.path === "/agent/threads/:id/messages" &&
        candidate.method === "GET" &&
        "handler" in candidate
      ),
    );

    expect(route).toBeDefined();

    const context: MockContext = {
      req: {
        param: () => "thread-123",
      },
      json: vi.fn((body: unknown, status?: number) => ({ body, status: status ?? 200 })),
    };

    const response = await route!.handler(context as never, vi.fn() as never);

    expect(mocks.memory.recall).toHaveBeenCalledWith({
      threadId: "thread-123",
      resourceId: "pristine:workspace:c:/workspace/pristine",
      page: 0,
      perPage: false,
    });
    expect(context.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        uiMessages: [{ id: "ui-message-1" }],
      }),
    );
    expect(response).toEqual(
      expect.objectContaining({
        status: 200,
      }),
    );
  });
});