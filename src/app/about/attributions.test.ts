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
          id: 'editor-theme-dracula-soft',
          name: 'Dracula Theme Soft',
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
          id: 'editor-theme-winter-is-coming-dark-blue',
          name: 'Winter is Coming (Dark Blue)',
          author: 'John Papa',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-winter-is-coming-dark-blue-no-italics',
          name: 'Winter is Coming (Dark Blue - No Italics)',
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
          id: 'editor-theme-palenight-theme',
          name: 'Palenight Theme',
          author: 'Olaolu Olawuyi',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-palenight-italic',
          name: 'Palenight Italic',
          author: 'Olaolu Olawuyi',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-palenight-operator',
          name: 'Palenight Operator',
          author: 'Olaolu Olawuyi',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-palenight-mild-contrast',
          name: 'Palenight (Mild Contrast)',
          author: 'Olaolu Olawuyi',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-darcula-theme',
          name: 'Darcula Theme',
          author: 'rokoroku',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-catppuccin-frappe',
          name: 'Catppuccin Frappe',
          author: 'Catppuccin Organization',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-tokyo-night-storm',
          name: 'Tokyo Night Storm',
          author: 'enkia',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-vue-theme',
          name: 'Vue Theme',
          author: 'Mario Rodeghiero',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-rose-pine-moon',
          name: 'Rose Pine Moon',
          author: 'Rose Pine',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-kanagawa',
          name: 'Kanagawa',
          author: 'barklan',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-hopscotch',
          name: 'Hopscotch',
          author: 'Jan T. Sott',
          license: 'CC0-1.0',
        }),
        expect.objectContaining({
          id: 'editor-theme-monokai-plusplus',
          name: 'Monokai++',
          author: 'Davide Casella',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-gruvbox-material-dark',
          name: 'Gruvbox Material Dark',
          author: 'sainnhe',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-atom-material-theme',
          name: 'Atom Material Theme',
          author: 'tobiasalthoff',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-moonlight',
          name: 'Moonlight',
          author: 'atomiks',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-monokai-dark-soda',
          name: 'Monokai Dark Soda',
          author: 'Adam Caviness',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-mayukai-midnight',
          name: 'Mayukai Midnight',
          author: 'Gulajava Ministudio',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-deepdark-material-theme',
          name: 'Deepdark Material Theme',
          author: 'Nimda',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-hack-the-box',
          name: 'Hack The Box',
          author: 'silofy',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-github-dark-dimmed',
          name: 'GitHub Dark Dimmed',
          author: 'GitHub',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-winter-is-coming-dark-black',
          name: 'Winter is Coming (Dark Black)',
          author: 'John Papa',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-winter-is-coming-dark-black-no-italics',
          name: 'Winter is Coming (Dark Black - No Italics)',
          author: 'John Papa',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-copilot-theme',
          name: 'Copilot Theme',
          author: 'Benjamin Benais',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-tokyo-night-light',
          name: 'Tokyo Night Light',
          author: 'enkia',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-vue-theme-high-contrast',
          name: 'Vue Theme High Contrast',
          author: 'Mario Rodeghiero',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-github-dark-default',
          name: 'GitHub Dark Default',
          author: 'GitHub',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-github-light-default',
          name: 'GitHub Light Default',
          author: 'GitHub',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-github-light-high-contrast',
          name: 'GitHub Light High Contrast',
          author: 'GitHub',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-github-dark-high-contrast',
          name: 'GitHub Dark High Contrast',
          author: 'GitHub',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-github-light-colorblind',
          name: 'GitHub Light Colorblind',
          author: 'GitHub',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-github-dark-colorblind',
          name: 'GitHub Dark Colorblind',
          author: 'GitHub',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-visual-studio-dark-cpp',
          name: 'Dark (Visual Studio - C/C++)',
          author: 'Microsoft',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-visual-studio-2017-light-cpp',
          name: '2017 Light (Visual Studio - C/C++)',
          author: 'Microsoft',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-powershell-ise',
          name: 'PowerShell ISE',
          author: 'Microsoft',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-jellyfish',
          name: 'JellyFish',
          author: 'Pawel Borkar',
          license: 'Apache-2.0',
        }),
        expect.objectContaining({
          id: 'editor-theme-spinel',
          name: 'Spinel',
          author: 'Shopify',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-spinel-light',
          name: 'Spinel Light',
          author: 'Shopify',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-visual-studio-2017-dark-cpp',
          name: '2017 Dark (Visual Studio - C/C++)',
          author: 'Microsoft',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-visual-studio-light-cpp',
          name: 'Light (Visual Studio - C/C++)',
          author: 'Microsoft',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-copilot-theme-higher-contrast',
          name: 'Copilot Theme - Higher Contrast',
          author: 'Benjamin Benais',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-one-dark-pro-flat',
          name: 'One Dark Pro Flat',
          author: 'Binaryify',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-one-dark-pro-darker',
          name: 'One Dark Pro Darker',
          author: 'Binaryify',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-one-dark-pro-mix',
          name: 'One Dark Pro Mix',
          author: 'Binaryify',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-one-dark-pro-night-flat',
          name: 'One Dark Pro Night Flat',
          author: 'Binaryify',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-theme',
          name: 'Theme',
          author: 'Mhammed Talhaouy',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-theme-flat',
          name: 'Theme Flat',
          author: 'Mhammed Talhaouy',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-theme-mix',
          name: 'Theme Mix',
          author: 'Mhammed Talhaouy',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-theme-darker',
          name: 'Theme Darker',
          author: 'Mhammed Talhaouy',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-gruvbox-dark-medium',
          name: 'Gruvbox Dark Medium',
          author: 'jdinhify',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-gruvbox-dark-soft',
          name: 'Gruvbox Dark Soft',
          author: 'jdinhify',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-gruvbox-light-medium',
          name: 'Gruvbox Light Medium',
          author: 'jdinhify',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-gruvbox-light-soft',
          name: 'Gruvbox Light Soft',
          author: 'jdinhify',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-ayu-mirage-bordered',
          name: 'Ayu Mirage Bordered',
          author: 'teabyii',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-ayu-light-bordered',
          name: 'Ayu Light Bordered',
          author: 'teabyii',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-ayu-dark-bordered',
          name: 'Ayu Dark Bordered',
          author: 'teabyii',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-noctis-azureus',
          name: 'Noctis Azureus',
          author: 'Liviu Schera',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-noctis-bordo',
          name: 'Noctis Bordo',
          author: 'Liviu Schera',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-noctis-obscuro',
          name: 'Noctis Obscuro',
          author: 'Liviu Schera',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-noctis-sereno',
          name: 'Noctis Sereno',
          author: 'Liviu Schera',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-noctis-uva',
          name: 'Noctis Uva',
          author: 'Liviu Schera',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-noctis-minimus',
          name: 'Noctis Minimus',
          author: 'Liviu Schera',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-noctis-hibernus',
          name: 'Noctis Hibernus',
          author: 'Liviu Schera',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-noctis-lilac',
          name: 'Noctis Lilac',
          author: 'Liviu Schera',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-andromeda-bordered',
          name: 'Andromeda Bordered',
          author: 'Eliver Lara',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-andromeda-colorizer',
          name: 'Andromeda Colorizer',
          author: 'Eliver Lara',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-andromeda-italic',
          name: 'Andromeda Italic',
          author: 'Eliver Lara',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-andromeda-italic-bordered',
          name: 'Andromeda Italic Bordered',
          author: 'Eliver Lara',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-light-owl',
          name: 'Light Owl',
          author: 'Sarah Drasner',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-light-owl-no-italics',
          name: 'Light Owl (No Italics)',
          author: 'Sarah Drasner',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-night-owl-no-italics',
          name: 'Night Owl (No Italics)',
          author: 'Sarah Drasner',
          license: 'MIT',
        }),
        expect.objectContaining({
          id: 'editor-theme-winter-is-coming-light-no-italics',
          name: 'Winter is Coming (Light - No Italics)',
          author: 'John Papa, Brian Clark',
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