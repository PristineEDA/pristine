import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export function getPristineEngineBinaryName(platform = process.platform): string {
  return platform === 'win32' ? 'pristine-engine.exe' : 'pristine-engine';
}

export const PRISTINE_ENGINE_BINARY_NAME = getPristineEngineBinaryName();

function getDevelopmentBinaryBasePath(appPath = app.getAppPath()): string {
  const resolvedAppPath = path.resolve(appPath);

  if (path.basename(resolvedAppPath) === 'dist-electron') {
    return path.resolve(resolvedAppPath, '..');
  }

  return resolvedAppPath;
}

export function getDevelopmentPristineEnginePath(appPath = app.getAppPath(), platform = process.platform): string {
  return path.join(getDevelopmentBinaryBasePath(appPath), 'binaries', getPristineEngineBinaryName(platform));
}

export function getPackagedPristineEnginePath(resourcesPath = process.resourcesPath, platform = process.platform): string {
  return path.join(resourcesPath, 'binaries', getPristineEngineBinaryName(platform));
}

export function resolvePristineEnginePath(
  options: { isPackaged?: boolean; resourcesPath?: string; appPath?: string; platform?: NodeJS.Platform } = {},
): string {
  const isPackaged = options.isPackaged ?? app.isPackaged;
  const platform = options.platform ?? process.platform;

  if (isPackaged) {
    return getPackagedPristineEnginePath(options.resourcesPath, platform);
  }

  return getDevelopmentPristineEnginePath(options.appPath, platform);
}

export function assertPristineEnginePathAvailable(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `SystemVerilog LSP binary not found at ${filePath}. Run "pnpm run prepare:pristine-engine" first.`,
    );
  }

  return filePath;
}