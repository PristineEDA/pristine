import { BrowserWindow } from 'electron';
import { registerWindowHandlers, setupWindowStreams } from './window.js';
import { registerFilesystemHandlers, setProjectRoot } from './filesystem.js';
import { registerShellHandlers } from './shell.js';
import { registerConfigHandlers } from './config.js';
import { registerPlatformHandler } from './platform.js';

export function registerAllHandlers(getMainWindow: () => BrowserWindow | null): void {
  registerPlatformHandler();
  registerWindowHandlers(getMainWindow);
  registerFilesystemHandlers();
  registerShellHandlers(getMainWindow);
  registerConfigHandlers();
}

export { setupWindowStreams, setProjectRoot };
