// ─── IPC Channel Constants ────────────────────────────────────────────────────
// Three-tier classification per architecture constraints:
//   sync:   — synchronous queries (<10ms), lightweight reads only
//   async:  — asynchronous invoke/handle, non-blocking UI
//   stream: — main→renderer push, <50ms latency target

export const SyncChannels = {
  PLATFORM: 'sync:platform',
  CONFIG_GET: 'sync:config:get',
  WINDOW_IS_MAXIMIZED: 'sync:window:is-maximized',
} as const;

export const AsyncChannels = {
  WINDOW_MINIMIZE: 'async:window:minimize',
  WINDOW_MAXIMIZE: 'async:window:maximize',
  WINDOW_CLOSE: 'async:window:close',
  FS_READ_FILE: 'async:fs:read-file',
  FS_WRITE_FILE: 'async:fs:write-file',
  FS_READ_DIR: 'async:fs:read-dir',
  FS_STAT: 'async:fs:stat',
  FS_EXISTS: 'async:fs:exists',
  SHELL_EXEC: 'async:shell:exec',
  SHELL_KILL: 'async:shell:kill',
  CONFIG_SET: 'async:config:set',
} as const;

export const StreamChannels = {
  SHELL_STDOUT: 'stream:shell:stdout',
  SHELL_STDERR: 'stream:shell:stderr',
  SHELL_EXIT: 'stream:shell:exit',
  WINDOW_MAXIMIZED_CHANGE: 'stream:window:maximized-change',
} as const;
