import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

function createElectronApiMock() {
  return {
    platform: 'win32',
    arch: 'x64',
    versions: {
      electron: '33.0.0',
      node: process.versions.node,
      chrome: '130.0.0.0',
    },
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn(() => false),
    onMaximizedChange: vi.fn(() => vi.fn()),
    fs: {
      readFile: vi.fn().mockResolvedValue(''),
      writeFile: vi.fn(),
      readDir: vi.fn().mockResolvedValue([]),
      stat: vi.fn(),
      exists: vi.fn().mockResolvedValue(false),
    },
    shell: {
      exec: vi.fn(),
      kill: vi.fn(),
      onStdout: vi.fn(() => vi.fn()),
      onStderr: vi.fn(() => vi.fn()),
      onExit: vi.fn(() => vi.fn()),
    },
    config: {
      get: vi.fn(),
      set: vi.fn(),
    },
  };
}

beforeEach(() => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  }

  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    writable: true,
    value: createElectronApiMock(),
  });
});

afterEach(() => {
  if (typeof window !== 'undefined') {
    cleanup();
  }
});