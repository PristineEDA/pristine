import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export const SLANG_SERVER_BINARY_NAME = 'slang-server.exe';

function getDevelopmentBinaryBasePath(appPath = app.getAppPath()): string {
  const resolvedAppPath = path.resolve(appPath);

  if (path.basename(resolvedAppPath) === 'dist-electron') {
    return path.resolve(resolvedAppPath, '..');
  }

  return resolvedAppPath;
}

export function getDevelopmentSlangServerPath(appPath = app.getAppPath()): string {
  return path.join(getDevelopmentBinaryBasePath(appPath), 'binaries', SLANG_SERVER_BINARY_NAME);
}

export function getPackagedSlangServerPath(resourcesPath = process.resourcesPath): string {
  return path.join(resourcesPath, 'binaries', SLANG_SERVER_BINARY_NAME);
}

export function resolveSlangServerPath(
  options: { isPackaged?: boolean; resourcesPath?: string; appPath?: string } = {},
): string {
  const isPackaged = options.isPackaged ?? app.isPackaged;

  if (isPackaged) {
    return getPackagedSlangServerPath(options.resourcesPath);
  }

  return getDevelopmentSlangServerPath(options.appPath);
}

export function assertSlangServerPathAvailable(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `SystemVerilog LSP binary not found at ${filePath}. Run "pnpm run prepare:slang-server" first.`,
    );
  }

  return filePath;
}