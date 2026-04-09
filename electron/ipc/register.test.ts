import { beforeEach, describe, expect, it, vi } from 'vitest';

const { 
  mockRegisterWindowHandlers,
  mockSetupWindowStreams,
  mockRegisterFilesystemHandlers,
  mockSetFsRoot,
  mockRegisterShellHandlers,
  mockSetShellProjectRoot,
  mockRegisterTerminalHandlers,
  mockSetTerminalProjectRoot,
  mockRegisterConfigHandlers,
  mockRegisterPlatformHandler,
} = vi.hoisted(() => ({
  mockRegisterWindowHandlers: vi.fn(),
  mockSetupWindowStreams: vi.fn(),
  mockRegisterFilesystemHandlers: vi.fn(),
  mockSetFsRoot: vi.fn(),
  mockRegisterShellHandlers: vi.fn(),
  mockSetShellProjectRoot: vi.fn(),
  mockRegisterTerminalHandlers: vi.fn(),
  mockSetTerminalProjectRoot: vi.fn(),
  mockRegisterConfigHandlers: vi.fn(),
  mockRegisterPlatformHandler: vi.fn(),
}));

vi.mock('./window.js', () => ({
  registerWindowHandlers: (...args: unknown[]) => mockRegisterWindowHandlers(...args),
  setupWindowStreams: (...args: unknown[]) => mockSetupWindowStreams(...args),
}));

vi.mock('./filesystem.js', () => ({
  registerFilesystemHandlers: () => mockRegisterFilesystemHandlers(),
  setProjectRoot: (root: string) => mockSetFsRoot(root),
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

    expect(mockSetFsRoot).toHaveBeenCalledWith(expect.stringContaining('project-root'));
    expect(mockSetShellProjectRoot).toHaveBeenCalledWith(expect.stringContaining('project-root'));
    expect(mockSetTerminalProjectRoot).toHaveBeenCalledWith(expect.stringContaining('project-root'));
  });

  it('registers all handler groups with the expected dependencies', () => {
    const getMainWindow = vi.fn(() => null);
    const setFloatingInfoWindowVisible = vi.fn(() => false);

    registerAllHandlers(getMainWindow, setFloatingInfoWindowVisible);

    expect(mockRegisterPlatformHandler).toHaveBeenCalledTimes(1);
    expect(mockRegisterWindowHandlers).toHaveBeenCalledWith(getMainWindow, setFloatingInfoWindowVisible);
    expect(mockRegisterFilesystemHandlers).toHaveBeenCalledTimes(1);
    expect(mockRegisterShellHandlers).toHaveBeenCalledWith(getMainWindow);
    expect(mockRegisterTerminalHandlers).toHaveBeenCalledWith(getMainWindow);
    expect(mockRegisterConfigHandlers).toHaveBeenCalledTimes(1);
  });

  it('re-exports setupWindowStreams', () => {
    const win = { id: 'mock-window' };

    setupWindowStreams(win as never);

    expect(mockSetupWindowStreams).toHaveBeenCalledWith(win);
  });
});