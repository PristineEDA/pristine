// ─── IPC Channel Constants ────────────────────────────────────────────────────
// Three-tier classification per architecture constraints:
//   sync:   — synchronous queries (<10ms), lightweight reads only
//   async:  — asynchronous invoke/handle, non-blocking UI
//   stream: — main→renderer push, <50ms latency target

export const SyncChannels = {
  PLATFORM: 'sync:platform',
  CONFIG_GET: 'sync:config:get',
  WINDOW_IS_MAXIMIZED: 'sync:window:is-maximized',
  WINDOW_IS_FULLSCREEN: 'sync:window:is-full-screen',
} as const;

export const AsyncChannels = {
  WINDOW_MINIMIZE: 'async:window:minimize',
  WINDOW_MAXIMIZE: 'async:window:maximize',
  WINDOW_SHOW: 'async:window:show',
  WINDOW_HIDE: 'async:window:hide',
  WINDOW_CLOSE: 'async:window:close',
  WINDOW_RESOLVE_CLOSE_REQUEST: 'async:window:resolve-close-request',
  WINDOW_SET_FLOATING_INFO_VISIBILITY: 'async:window:set-floating-info-visibility',
  FS_READ_FILE: 'async:fs:read-file',
  FS_LIST_FILES: 'async:fs:list-files',
  FS_WRITE_FILE: 'async:fs:write-file',
  FS_READ_DIR: 'async:fs:read-dir',
  FS_STAT: 'async:fs:stat',
  FS_EXISTS: 'async:fs:exists',
  SHELL_EXEC: 'async:shell:exec',
  SHELL_KILL: 'async:shell:kill',
  TERMINAL_CREATE: 'async:terminal:create',
  TERMINAL_WRITE: 'async:terminal:write',
  TERMINAL_RESIZE: 'async:terminal:resize',
  TERMINAL_KILL: 'async:terminal:kill',
  LSP_OPEN_DOCUMENT: 'async:lsp:open-document',
  LSP_CHANGE_DOCUMENT: 'async:lsp:change-document',
  LSP_CLOSE_DOCUMENT: 'async:lsp:close-document',
  LSP_COMPLETION: 'async:lsp:completion',
  LSP_HOVER: 'async:lsp:hover',
  LSP_DEFINITION: 'async:lsp:definition',
  LSP_REFERENCES: 'async:lsp:references',
  CONFIG_SET: 'async:config:set',
} as const;

export const StreamChannels = {
  SHELL_STDOUT: 'stream:shell:stdout',
  SHELL_STDERR: 'stream:shell:stderr',
  SHELL_EXIT: 'stream:shell:exit',
  TERMINAL_DATA: 'stream:terminal:data',
  TERMINAL_EXIT: 'stream:terminal:exit',
  LSP_DIAGNOSTICS: 'stream:lsp:diagnostics',
  LSP_STATE: 'stream:lsp:state',
  MENU_COMMAND: 'stream:menu:command',
  WINDOW_CLOSE_REQUEST: 'stream:window:close-request',
  WINDOW_MAXIMIZED_CHANGE: 'stream:window:maximized-change',
  WINDOW_FULLSCREEN_CHANGE: 'stream:window:full-screen-change',
} as const;
