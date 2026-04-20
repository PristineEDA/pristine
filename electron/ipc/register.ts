import { BrowserWindow } from 'electron';
import path from 'node:path';
import { registerDialogHandlers, setDialogProjectRoot } from './dialog.js';
import { registerWindowHandlers, setupWindowStreams } from './window.js';
import { registerFilesystemHandlers, setProjectRoot as setFsRoot } from './filesystem.js';
import { registerGitHandlers, setGitProjectRoot } from './git.js';
import { registerLspHandlers, setLspProjectRoot } from './lsp.js';
import { registerShellHandlers, setShellProjectRoot } from './shell.js';
import { registerTerminalHandlers, setTerminalProjectRoot } from './terminal.js';
import { registerConfigHandlers } from './config.js';
import { registerPlatformHandler } from './platform.js';
import { registerAuthHandlers } from './auth.js';
import type { WindowCloseDecision } from '../../src/app/window/windowClose.js';

export function setProjectRoot(root: string): void {
  const resolved = path.resolve(root);
  setDialogProjectRoot(resolved);
  setFsRoot(resolved);
  setGitProjectRoot(resolved);
  setLspProjectRoot(resolved);
  setShellProjectRoot(resolved);
  setTerminalProjectRoot(resolved);
}

export function registerAllHandlers(
  getMainWindow: () => BrowserWindow | null,
  setFloatingInfoWindowVisible: (visible: boolean) => boolean = () => false,
  resolveCloseRequest: (requestId: number, decision: WindowCloseDecision) => boolean = () => false,
): void {
  registerPlatformHandler();
  registerDialogHandlers(getMainWindow);
  registerWindowHandlers(getMainWindow, setFloatingInfoWindowVisible, resolveCloseRequest);
  registerFilesystemHandlers();
  registerGitHandlers();
  registerLspHandlers(getMainWindow);
  registerShellHandlers(getMainWindow);
  registerTerminalHandlers(getMainWindow);
  registerConfigHandlers();
  registerAuthHandlers();
}

export { setupWindowStreams };
