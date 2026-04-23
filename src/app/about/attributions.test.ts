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
        expect.objectContaining({
          id: 'editor-theme-catppuccin-mocha',
          name: 'Catppuccin Mocha',
          author: 'Catppuccin Organization',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-alabaster',
          name: 'Alabaster',
          author: 'Nikita Prokopov',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-synthwave-84',
          name: "Synthwave '84",
          author: 'Robb Owen',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-bluloco-dark',
          name: 'Bluloco Dark',
          author: 'uloco',
          license: 'LGPL-3.0',
        }),
        expect.objectContaining({
          id: 'editor-theme-shades-of-purple',
          name: 'Shades of Purple',
          author: 'Ahmad Awais',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-winter-is-coming-dark-blue',
          name: 'Winter is Coming (Dark Blue)',
          author: 'John Papa',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-monokai-night',
          name: 'Monokai Night',
          author: 'Fabio Spampinato',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-aura-soft-dark',
          name: 'Aura Soft Dark',
          author: 'Dalton Menezes',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-hackr-theme',
          name: 'Hackr.io Theme',
          author: 'Robert Johns',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-light-owl',
          name: 'Light Owl',
          author: 'Sarah Drasner',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-atom-one-light',
          name: 'Atom One Light',
          author: 'akamud',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-slack-dark-mode',
          name: 'Slack Theme Dark Mode',
          author: 'Felipe Mendes',
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