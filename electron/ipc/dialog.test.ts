import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHandle, mockShowOpenDialog, mockShowSaveDialog } = vi.hoisted(() => ({
  mockHandle: vi.fn(),
  mockShowOpenDialog: vi.fn(),
  mockShowSaveDialog: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  dialog: {
    showOpenDialog: (...args: unknown[]) => mockShowOpenDialog(...args),
    showSaveDialog: (...args: unknown[]) => mockShowSaveDialog(...args),
  },
  ipcMain: {
    handle: (...args: unknown[]) => mockHandle(...args),
  },
}));

import { registerDialogHandlers, setDialogProjectRoot } from './dialog.js';

function getHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
  const call = mockHandle.mock.calls.find((entry) => entry[0] === channel);
  if (!call) {
    throw new Error(`No handler registered for ${channel}`);
  }

  return call[1];
}

describe('dialog IPC handlers', () => {
  beforeEach(() => {
    mockHandle.mockClear();
    mockShowOpenDialog.mockReset();
    mockShowSaveDialog.mockReset();
    delete process.env['PRISTINE_E2E_PROJECT_DIRECTORY_PATH'];
    delete process.env['PRISTINE_E2E_PROJECT_DIRECTORY_CANCEL'];
    delete process.env['PRISTINE_E2E_SAVE_DIALOG_PATH'];
    delete process.env['PRISTINE_E2E_SAVE_DIALOG_CANCEL'];
    setDialogProjectRoot('/workspace/project');
    registerDialogHandlers(() => null);
  });

  it('returns a workspace-relative save target when the chosen path is inside the project root', async () => {
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/workspace/project/rtl/generated/new_file.sv',
    });

    const handler = getHandler('async:dialog:show-save');

    await expect(handler({}, 'untitled-1')).resolves.toEqual({
      canceled: false,
      filePath: '/workspace/project/rtl/generated/new_file.sv',
      workspaceRelativePath: 'rtl/generated/new_file.sv',
    });
  });

  it('returns a null workspace-relative path for external save targets', async () => {
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/outside/project/new_file.sv',
    });

    const handler = getHandler('async:dialog:show-save');

    await expect(handler({}, 'untitled-1')).resolves.toEqual({
      canceled: false,
      filePath: '/outside/project/new_file.sv',
      workspaceRelativePath: null,
    });
  });

  it('supports deterministic e2e save dialog overrides through environment variables', async () => {
    process.env['PRISTINE_E2E'] = '1';
    process.env['PRISTINE_E2E_SAVE_DIALOG_PATH'] = '/workspace/project/rtl/generated/e2e_file.sv';
    const handler = getHandler('async:dialog:show-save');

    await expect(handler({}, 'untitled-1')).resolves.toEqual({
      canceled: false,
      filePath: path.resolve('/workspace/project/rtl/generated/e2e_file.sv'),
      workspaceRelativePath: 'rtl/generated/e2e_file.sv',
    });
  });

  it('returns the chosen project directory path', async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/workspace/project/generated'],
    });

    const handler = getHandler('async:dialog:show-open-project-directory');

    await expect(handler({})).resolves.toEqual({
      canceled: false,
      filePath: '/workspace/project/generated',
    });
    expect(mockShowOpenDialog).toHaveBeenCalledWith({
      defaultPath: path.resolve('/workspace/project'),
      properties: ['openDirectory', 'createDirectory'],
    });
  });

  it('supports deterministic e2e project directory overrides through environment variables', async () => {
    process.env['PRISTINE_E2E'] = '1';
    process.env['PRISTINE_E2E_PROJECT_DIRECTORY_PATH'] = '/workspace/project/new-project';
    const handler = getHandler('async:dialog:show-open-project-directory');

    await expect(handler({})).resolves.toEqual({
      canceled: false,
      filePath: path.resolve('/workspace/project/new-project'),
    });
    expect(mockShowOpenDialog).not.toHaveBeenCalled();
  });
});
