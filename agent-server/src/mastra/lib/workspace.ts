import { LocalFilesystem, LocalSandbox, WORKSPACE_TOOLS, Workspace } from "@mastra/core/workspace";

import { workspaceRoot } from "./config";

export const pristineWorkspace = new Workspace({
  id: "pristine-workspace",
  name: "Pristine Workspace",
  filesystem: new LocalFilesystem({
    basePath: workspaceRoot,
    readOnly: true,
  }),
  sandbox: new LocalSandbox({
    workingDirectory: workspaceRoot,
    timeout: 30_000,
  }),
  lsp: true,
  skills: ["agent-server/skills"],
  checkSkillFileMtime: true,
  tools: {
    [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { enabled: true, name: "view" },
    [WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES]: { enabled: true, name: "find_files" },
    [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { enabled: true, name: "search_content" },
    [WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT]: { enabled: true, name: "stat_file" },
    [WORKSPACE_TOOLS.LSP.LSP_INSPECT]: { enabled: true, name: "inspect_symbol" },
    [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { enabled: false },
    [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { enabled: false },
    [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: { enabled: false },
    [WORKSPACE_TOOLS.FILESYSTEM.MKDIR]: { enabled: false },
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: { enabled: false },
    [WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT]: { enabled: false },
    [WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS]: { enabled: false },
    [WORKSPACE_TOOLS.SEARCH.SEARCH]: { enabled: false },
    [WORKSPACE_TOOLS.SEARCH.INDEX]: { enabled: false },
  },
});
