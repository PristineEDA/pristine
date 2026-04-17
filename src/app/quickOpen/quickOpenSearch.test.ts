import { describe, expect, it } from 'vitest';
import { createQuickOpenFileEntries, getRecentQuickOpenFiles, searchQuickOpenFiles } from './quickOpenSearch';

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

  it('returns no search matches for an empty query', () => {
    const files = createQuickOpenFileEntries([
      'rtl/core/alu.v',
      'docs/reference/alu-notes.md',
    ]);

    expect(searchQuickOpenFiles(files, '')).toEqual([]);
  });

  it('returns recent files in recency order and filters missing indexed entries', () => {
    const indexedFiles = createQuickOpenFileEntries([
      'rtl/core/alu.v',
      'rtl/core/reg_file.v',
    ]);

    expect(getRecentQuickOpenFiles([
      { path: 'rtl/core/reg_file.v', name: 'reg_file.v' },
      { path: 'missing/file.v', name: 'file.v' },
      { path: 'rtl/core/alu.v', name: 'alu.v' },
    ], indexedFiles).map((result) => result.path)).toEqual([
      'rtl/core/reg_file.v',
      'rtl/core/alu.v',
    ]);
  });

  it('keeps tied search results ordered by path when name and score match', () => {
    const files = createQuickOpenFileEntries([
      'bbb/alu.v',
      'aaa/alu.v',
    ]);

    expect(searchQuickOpenFiles(files, 'alu.v').map((result) => result.path)).toEqual([
      'aaa/alu.v',
      'bbb/alu.v',
    ]);
  });

  it('caps recent results at the provided limit and preserves recency scores', () => {
    const indexedFiles = createQuickOpenFileEntries([
      'rtl/core/alu.v',
      'rtl/core/reg_file.v',
      'rtl/core/cpu_top.v',
    ]);

    expect(getRecentQuickOpenFiles([
      { path: 'rtl/core/cpu_top.v', name: 'cpu_top.v' },
      { path: 'rtl/core/reg_file.v', name: 'reg_file.v' },
      { path: 'rtl/core/alu.v', name: 'alu.v' },
    ], indexedFiles, 2)).toEqual([
      { path: 'rtl/core/cpu_top.v', name: 'cpu_top.v', score: 2 },
      { path: 'rtl/core/reg_file.v', name: 'reg_file.v', score: 1 },
    ]);
  });
});