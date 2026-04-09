import { BrowserWindow } from 'electron';
import path from 'node:path';
import { registerWindowHandlers, setupWindowStreams } from './window.js';
import { registerFilesystemHandlers, setProjectRoot as setFsRoot } from './filesystem.js';
import { registerShellHandlers, setShellProjectRoot } from './shell.js';
import { registerTerminalHandlers, setTerminalProjectRoot } from './terminal.js';
import { registerConfigHandlers } from './config.js';
import { registerPlatformHandler } from './platform.js';

export function setProjectRoot(root: string): void {
  const resolved = path.resolve(root);
  setFsRoot(resolved);
  setShellProjectRoot(resolved);
  setTerminalProjectRoot(resolved);
}

export function registerAllHandlers(
  getMainWindow: () => BrowserWindow | null,
  setFloatingInfoWindowVisible: (visible: boolean) => boolean = () => false,
): void {
  registerPlatformHandler();
  registerWindowHandlers(getMainWindow, setFloatingInfoWindowVisible);
  registerFilesystemHandlers();
  registerShellHandlers(getMainWindow);
  registerTerminalHandlers(getMainWindow);
  registerConfigHandlers();
}

export { setupWindowStreams };
