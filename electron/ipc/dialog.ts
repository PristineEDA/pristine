import { BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { AsyncChannels } from './channels.js';
import { assertOptionalString } from './validators.js';

let projectRoot: string | null = null;

export interface SaveDialogResult {
  canceled: boolean;
  filePath: string | null;
  workspaceRelativePath: string | null;
}

export function setDialogProjectRoot(root: string): void {
  projectRoot = path.resolve(root);
}

function getWorkspaceRelativePath(filePath: string): string | null {
  if (!projectRoot) {
    return null;
  }

  const resolved = path.resolve(filePath);
  const relative = path.relative(projectRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  return relative.replace(/\\/g, '/');
}

function createE2ESaveDialogResult(filePath: string): SaveDialogResult {
  return {
    canceled: false,
    filePath,
    workspaceRelativePath: getWorkspaceRelativePath(filePath),
  };
}

export function registerDialogHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(AsyncChannels.DIALOG_SHOW_SAVE, async (_event, defaultPath?: unknown) => {
    assertOptionalString(defaultPath, 'defaultPath');

    const e2eFilePath = process.env['PRISTINE_E2E_SAVE_DIALOG_PATH'];
    if (process.env['PRISTINE_E2E'] === '1' && e2eFilePath) {
      delete process.env['PRISTINE_E2E_SAVE_DIALOG_PATH'];
      return createE2ESaveDialogResult(path.resolve(e2eFilePath));
    }

    if (process.env['PRISTINE_E2E'] === '1' && process.env['PRISTINE_E2E_SAVE_DIALOG_CANCEL'] === '1') {
      delete process.env['PRISTINE_E2E_SAVE_DIALOG_CANCEL'];
      return {
        canceled: true,
        filePath: null,
        workspaceRelativePath: null,
      } satisfies SaveDialogResult;
    }

    const mainWindow = getMainWindow();
    const dialogDefaultPath = defaultPath
      ? (projectRoot && !path.isAbsolute(defaultPath)
        ? path.resolve(projectRoot, defaultPath)
        : defaultPath)
      : projectRoot ?? undefined;
    const dialogOptions = {
      defaultPath: dialogDefaultPath,
    };
    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (result.canceled || !result.filePath) {
      return {
        canceled: true,
        filePath: null,
        workspaceRelativePath: null,
      } satisfies SaveDialogResult;
    }

    return createE2ESaveDialogResult(result.filePath);
  });
}