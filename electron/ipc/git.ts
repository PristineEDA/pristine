import { ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AsyncChannels } from './channels.js';
import type { WorkspaceGitStatusPayload } from '../../types/workspace-git.js';

const GIT_STATUS_MAX_BUFFER_BYTES = 1024 * 1024;

let projectRoot: string | null = null;

function getProjectRoot(): string {
  if (!projectRoot) {
    throw new Error('Project root not set');
  }

  return projectRoot;
}

function normalizeGitPath(value: string): string {
  const normalized = value
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .trim();

  return normalized;
}

function unquoteGitPath(value: string): string {
  const trimmed = value.trim();

  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) {
    return trimmed;
  }

  try {
    return JSON.parse(trimmed) as string;
  } catch {
    return trimmed.slice(1, -1);
  }
}

function toStatusPath(rawPath: string): string {
  const targetPath = rawPath.includes(' -> ')
    ? rawPath.slice(rawPath.lastIndexOf(' -> ') + 4)
    : rawPath;

  return normalizeGitPath(unquoteGitPath(targetPath));
}

function parseBranchName(summary: string): string | null {
  if (summary.startsWith('No commits yet on ')) {
    return summary.slice('No commits yet on '.length).trim() || null;
  }

  if (summary.startsWith('HEAD (no branch)')) {
    return 'HEAD';
  }

  const branchName = summary.split('...')[0]?.trim() ?? '';
  return branchName.length > 0 ? branchName : null;
}

function isTrackedChange(statusCode: string): boolean {
  return [...statusCode].some((code) => code !== ' ' && code !== '?' && code !== '!');
}

function parseGitStatus(stdout: string): Pick<WorkspaceGitStatusPayload, 'branchName' | 'pathStates'> {
  const pathStates: WorkspaceGitStatusPayload['pathStates'] = {};
  let branchName: string | null = null;

  stdout.split(/\r?\n/g).forEach((line) => {
    if (!line) {
      return;
    }

    if (line.startsWith('## ')) {
      branchName = parseBranchName(line.slice(3));
      return;
    }

    if (line.length < 4) {
      return;
    }

    const statusCode = line.slice(0, 2);
    const statusPath = toStatusPath(line.slice(3));

    if (!statusPath) {
      return;
    }

    if (statusCode === '!!') {
      pathStates[statusPath] = 'ignored';
      return;
    }

    if (statusCode === '??') {
      return;
    }

    if (isTrackedChange(statusCode)) {
      pathStates[statusPath] = 'modified';
    }
  });

  return {
    branchName,
    pathStates,
  };
}

function execGitStatus(root: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      [
        '-c',
        'status.relativePaths=true',
        'status',
        '--porcelain=1',
        '--branch',
        '--ignored=matching',
        '--untracked-files=all',
        '--',
        '.',
      ],
      {
        cwd: root,
        maxBuffer: GIT_STATUS_MAX_BUFFER_BYTES,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(stdout);
      },
    );
  });
}

async function hasProjectFiles(root: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.some((entry) => entry.name !== '.git');
  } catch {
    return false;
  }
}

export function setGitProjectRoot(root: string): void {
  projectRoot = path.resolve(root);
}

export function registerGitHandlers(): void {
  ipcMain.handle(AsyncChannels.GIT_GET_STATUS, async (): Promise<WorkspaceGitStatusPayload> => {
    const root = getProjectRoot();
    const projectHasFiles = await hasProjectFiles(root);

    if (!projectHasFiles) {
      return {
        branchName: null,
        hasProjectFiles: false,
        isGitRepo: false,
        pathStates: {},
      };
    }

    try {
      const stdout = await execGitStatus(root);
      const { branchName, pathStates } = parseGitStatus(stdout);

      return {
        branchName,
        hasProjectFiles: true,
        isGitRepo: true,
        pathStates,
      };
    } catch {
      return {
        branchName: null,
        hasProjectFiles: true,
        isGitRepo: false,
        pathStates: {},
      };
    }
  });
}