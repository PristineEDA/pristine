import { describe, expect, it } from 'vitest';
import { WORKSPACE_ROOT_PATH } from '../../../workspace/workspaceFiles';
import { resolveWorkspaceFileIcon, resolveWorkspaceFolderIcon } from './WorkspaceEntryIcon';

describe('resolveWorkspaceFileIcon', () => {
  it('prefers exact filenames and config patterns from Material Icon Theme', () => {
    expect(resolveWorkspaceFileIcon('README.md').key).toBe('readme');
    expect(resolveWorkspaceFileIcon('package.json').key).toBe('nodejs');
    expect(resolveWorkspaceFileIcon('pnpm-lock.yaml').key).toBe('pnpm');
    expect(resolveWorkspaceFileIcon('tsconfig.node.json').key).toBe('tsconfig');
    expect(resolveWorkspaceFileIcon('vite.config.web.ts').key).toBe('vite');
    expect(resolveWorkspaceFileIcon('playwright.perf.config.ts').key).toBe('playwright');
    expect(resolveWorkspaceFileIcon('vitest.config.ts').key).toBe('vitest');
    expect(resolveWorkspaceFileIcon('eslint.config.mjs').key).toBe('eslint');
    expect(resolveWorkspaceFileIcon('wrangler.jsonc').key).toBe('wrangler');
  });

  it('matches extension-based icons and preserves the generic fallback for uncovered file types', () => {
    expect(resolveWorkspaceFileIcon('crt0.S').key).toBe('assembly');
    expect(resolveWorkspaceFileIcon('component.test.tsx').key).toBe('test-jsx');
    expect(resolveWorkspaceFileIcon('vite-env.d.ts').key).toBe('typescript-def');
    expect(resolveWorkspaceFileIcon('diagram.svg').key).toBe('svg');
    expect(resolveWorkspaceFileIcon('timing.xdc').key).toBe('file');
  });
});

describe('resolveWorkspaceFolderIcon', () => {
  it('resolves exact names, token matches, and root folders to the expected Material icons', () => {
    expect(resolveWorkspaceFolderIcon({ name: 'src', isOpen: false }).key).toBe('folder-src');
    expect(resolveWorkspaceFolderIcon({ name: 'src', isOpen: true }).key).toBe('folder-src-open');
    expect(resolveWorkspaceFolderIcon({ name: 'dist-electron', isOpen: true }).key).toBe('folder-dist-open');
    expect(resolveWorkspaceFolderIcon({ name: 'test-results', isOpen: false }).key).toBe('folder-test');
    expect(resolveWorkspaceFolderIcon({ name: '.git', isOpen: true }).key).toBe('folder-git-open');
    expect(resolveWorkspaceFolderIcon({ name: WORKSPACE_ROOT_PATH, isOpen: true }).key).toBe('folder-root-open');
    expect(resolveWorkspaceFolderIcon({ name: 'misc', isOpen: false }).key).toBe('folder');
  });
});