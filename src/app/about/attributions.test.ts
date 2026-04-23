import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatAttributionsMarkdown, openSourceAttributionSections } from './attributions';

describe('attributions', () => {
  it('includes the bundled editor themes in the shared attribution data', () => {
    const bundledEditorThemesSection = openSourceAttributionSections.find((section) => section.id === 'bundled-editor-themes');

    expect(bundledEditorThemesSection?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'editor-theme-dracula',
          name: 'Dracula',
          author: 'Dracula Theme',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-github-dark',
          name: 'GitHub Dark',
          author: 'GitHub',
          license: 'MIT',
        }),
      ]),
    );
  });

  it('keeps ATTRIBUTIONS.md in sync with the shared attribution data', () => {
    const expectedMarkdown = formatAttributionsMarkdown();
    const actualMarkdown = fs.readFileSync(path.resolve(process.cwd(), 'ATTRIBUTIONS.md'), 'utf8').replace(/\r\n/g, '\n');

    expect(actualMarkdown).toBe(expectedMarkdown);
  });
});