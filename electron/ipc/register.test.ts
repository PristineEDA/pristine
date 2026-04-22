import { beforeEach, describe, expect, it, vi } from 'vitest';

const { 
  mockRegisterDialogHandlers,
  mockSetDialogProjectRoot,
  mockRegisterWindowHandlers,
  mockSetupWindowStreams,
  mockRegisterFilesystemHandlers,
  mockSetFsRoot,
  mockRegisterGitHandlers,
  mockSetGitProjectRoot,
  mockRegisterLspHandlers,
  mockSetLspProjectRoot,
  mockRegisterShellHandlers,
  mockSetShellProjectRoot,
  mockRegisterTerminalHandlers,
  mockSetTerminalProjectRoot,
  mockRegisterConfigHandlers,
  mockRegisterAuthHandlers,
  mockRegisterPlatformHandler,
} = vi.hoisted(() => ({
  mockRegisterDialogHandlers: vi.fn(),
  mockSetDialogProjectRoot: vi.fn(),
  mockRegisterWindowHandlers: vi.fn(),
  mockSetupWindowStreams: vi.fn(),
  mockRegisterFilesystemHandlers: vi.fn(),
  mockSetFsRoot: vi.fn(),
  mockRegisterGitHandlers: vi.fn(),
  mockSetGitProjectRoot: vi.fn(),
  mockRegisterLspHandlers: vi.fn(),
  mockSetLspProjectRoot: vi.fn(),
  mockRegisterShellHandlers: vi.fn(),
  mockSetShellProjectRoot: vi.fn(),
  mockRegisterTerminalHandlers: vi.fn(),
  mockSetTerminalProjectRoot: vi.fn(),
  mockRegisterConfigHandlers: vi.fn(),
  mockRegisterAuthHandlers: vi.fn(),
  mockRegisterPlatformHandler: vi.fn(),
}));

vi.mock('./dialog.js', () => ({
  registerDialogHandlers: (...args: unknown[]) => mockRegisterDialogHandlers(...args),
  setDialogProjectRoot: (root: string) => mockSetDialogProjectRoot(root),
}));

vi.mock('./window.js', () => ({
  registerWindowHandlers: (...args: unknown[]) => mockRegisterWindowHandlers(...args),
  setupWindowStreams: (...args: unknown[]) => mockSetupWindowStreams(...args),
}));

vi.mock('./filesystem.js', () => ({
  registerFilesystemHandlers: () => mockRegisterFilesystemHandlers(),
  setProjectRoot: (root: string) => mockSetFsRoot(root),
}));

vi.mock('./git.js', () => ({
  registerGitHandlers: () => mockRegisterGitHandlers(),
  setGitProjectRoot: (root: string) => mockSetGitProjectRoot(root),
}));

vi.mock('./lsp.js', () => ({
  registerLspHandlers: (...args: unknown[]) => mockRegisterLspHandlers(...args),
  setLspProjectRoot: (root: string) => mockSetLspProjectRoot(root),
}));

vi.mock('./shell.js', () => ({
  registerShellHandlers: (...args: unknown[]) => mockRegisterShellHandlers(...args),
  setShellProjectRoot: (root: string) => mockSetShellProjectRoot(root),
}));

vi.mock('./terminal.js', () => ({
  registerTerminalHandlers: (...args: unknown[]) => mockRegisterTerminalHandlers(...args),
  setTerminalProjectRoot: (root: string) => mockSetTerminalProjectRoot(root),
}));

vi.mock('./config.js', () => ({
  registerConfigHandlers: () => mockRegisterConfigHandlers(),
}));

vi.mock('./auth.js', () => ({
  registerAuthHandlers: () => mockRegisterAuthHandlers(),
}));

vi.mock('./platform.js', () => ({
  registerPlatformHandler: () => mockRegisterPlatformHandler(),
}));

import { registerAllHandlers, setProjectRoot, setupWindowStreams } from './register.js';

describe('register helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes and forwards the project root to filesystem and shell handlers', () => {
    setProjectRoot('./workspace/../project-root');

    expect(mockSetDialogProjectRoot).toHaveBeenCalledWith(expect.stringContaining('project-root'));
    expect(mockSetFsRoot).toHaveBeenCalledWith(expect.stringContaining('project-root'));
    expect(mockSetGitProjectRoot).toHaveBeenCalledWith(expect.stringContaining('project-root'));
    expect(mockSetLspProjectRoot).toHaveBeenCalledWith(expect.stringContaining('project-root'));
    expect(mockSetShellProjectRoot).toHaveBeenCalledWith(expect.stringContaining('project-root'));
    expect(mockSetTerminalProjectRoot).toHaveBeenCalledWith(expect.stringContaining('project-root'));
  });

  it('registers all handler groups with the expected dependencies', () => {
    const getMainWindow = vi.fn(() => null);
    const setFloatingInfoWindowVisible = vi.fn(() => false);
    const resolveCloseRequest = vi.fn(() => false);

    registerAllHandlers(getMainWindow, setFloatingInfoWindowVisible, resolveCloseRequest);

    expect(mockRegisterPlatformHandler).toHaveBeenCalledTimes(1);
    expect(mockRegisterDialogHandlers).toHaveBeenCalledWith(getMainWindow);
    expect(mockRegisterWindowHandlers).toHaveBeenCalledWith(getMainWindow, setFloatingInfoWindowVisible, resolveCloseRequest);
    expect(mockRegisterFilesystemHandlers).toHaveBeenCalledTimes(1);
    expect(mockRegisterGitHandlers).toHaveBeenCalledTimes(1);
    expect(mockRegisterLspHandlers).toHaveBeenCalledWith(getMainWindow);
    expect(mockRegisterShellHandlers).toHaveBeenCalledWith(getMainWindow);
    expect(mockRegisterTerminalHandlers).toHaveBeenCalledWith(getMainWindow);
    expect(mockRegisterConfigHandlers).toHaveBeenCalledTimes(1);
    expect(mockRegisterAuthHandlers).toHaveBeenCalledTimes(1);
  });

  it('re-exports setupWindowStreams', () => {
    const win = { id: 'mock-window' };

    setupWindowStreams(win as never);

    expect(mockSetupWindowStreams).toHaveBeenCalledWith(win);
  });
});