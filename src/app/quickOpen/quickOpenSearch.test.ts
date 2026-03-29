import { describe, expect, it } from 'vitest';
import { createQuickOpenFileEntries, searchQuickOpenFiles } from './quickOpenSearch';

describe('quickOpenSearch', () => {
  it('normalizes workspace file entries and keeps hidden files', () => {
    expect(createQuickOpenFileEntries(['rtl\\core\\alu.v', '.gitignore'])).toEqual([
      { path: 'rtl/core/alu.v', name: 'alu.v' },
      { path: '.gitignore', name: '.gitignore' },
    ]);
  });

  it('prefers filename-first matches over path-only matches', () => {
    const files = createQuickOpenFileEntries([
      'rtl/core/alu.v',
      'docs/reference/alu-notes.md',
      'rtl/core/registers.v',
    ]);

    expect(searchQuickOpenFiles(files, 'alu').map((result) => result.path)).toEqual([
      'rtl/core/alu.v',
      'docs/reference/alu-notes.md',
    ]);
  });
});