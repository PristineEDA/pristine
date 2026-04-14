import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export function getSlangServerBinaryName(platform = process.platform): string {
  return platform === 'win32' ? 'slang-server.exe' : 'slang-server';
}

export const SLANG_SERVER_BINARY_NAME = getSlangServerBinaryName();

function getDevelopmentBinaryBasePath(appPath = app.getAppPath()): string {
  const resolvedAppPath = path.resolve(appPath);

  if (path.basename(resolvedAppPath) === 'dist-electron') {
    return path.resolve(resolvedAppPath, '..');
  }

  return resolvedAppPath;
}

export function getDevelopmentSlangServerPath(appPath = app.getAppPath(), platform = process.platform): string {
  return path.join(getDevelopmentBinaryBasePath(appPath), 'binaries', getSlangServerBinaryName(platform));
}

export function getPackagedSlangServerPath(resourcesPath = process.resourcesPath, platform = process.platform): string {
  return path.join(resourcesPath, 'binaries', getSlangServerBinaryName(platform));
}

export function resolveSlangServerPath(
  options: { isPackaged?: boolean; resourcesPath?: string; appPath?: string; platform?: NodeJS.Platform } = {},
): string {
  const isPackaged = options.isPackaged ?? app.isPackaged;
  const platform = options.platform ?? process.platform;

  if (isPackaged) {
    return getPackagedSlangServerPath(options.resourcesPath, platform);
  }

  return getDevelopmentSlangServerPath(options.appPath, platform);
}

export function assertSlangServerPathAvailable(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `SystemVerilog LSP binary not found at ${filePath}. Run "pnpm run prepare:slang-server" first.`,
    );
  }

  return filePath;
}
