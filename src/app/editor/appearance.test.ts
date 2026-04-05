import { describe, expect, it } from 'vitest';
import { createTerminalTheme, IDE_MONO_FONT_FAMILY } from './appearance';
import { createDraculaThemeDefinition } from './draculaTheme';

describe('appearance', () => {
  it('falls back to editor-aligned defaults when CSS variables are unavailable', () => {
    const theme = createTerminalTheme('dark', null);

    expect(theme.background).toBe('#282a36');
    expect(theme.foreground).toBe('#f8f8f2');
    expect(theme.magenta).toBe('#ff79c6');
    expect(theme.brightMagenta).toBe('#bd93f9');
    expect(IDE_MONO_FONT_FAMILY).toContain('JetBrains Mono');
  });

  it('prefers CSS variables when they are present', () => {
    const styleReader = {
      getPropertyValue: (name: string) => {
        const values: Record<string, string> = {
          '--ide-dracula-surface': '#090909',
          '--ide-dracula-background': '#101010',
          '--ide-dracula-selection': '#303030',
          '--ide-dracula-comment': '#8080aa',
          '--ide-dracula-foreground': '#f0f0f0',
          '--ide-dracula-bright-foreground': '#ffffff',
          '--ide-dracula-pink': '#aa55ff',
          '--ide-dracula-purple': '#9b6bff',
          '--ide-dracula-cyan': '#55ddff',
          '--ide-dracula-green': '#11aa55',
          '--ide-dracula-yellow': '#f4d35e',
          '--ide-dracula-red': '#ff6666',
          '--ide-dracula-orange': '#ffaa44',
        };

        return values[name] ?? '';
      },
    };

    const theme = createTerminalTheme('dark', styleReader);

    expect(theme.background).toBe('#101010');
    expect(theme.foreground).toBe('#f0f0f0');
    expect(theme.cursor).toBe('#f0f0f0');
    expect(theme.selectionBackground).toBe('#303030');
    expect(theme.green).toBe('#11aa55');
    expect(theme.magenta).toBe('#aa55ff');
    expect(theme.brightMagenta).toBe('#9b6bff');
    expect(theme.red).toBe('#ff6666');
  });

  it('creates the monaco dracula definition from the same shared palette', () => {
    const styleReader = {
      getPropertyValue: (name: string) => {
        const values: Record<string, string> = {
          '--ide-dracula-surface': '#090909',
          '--ide-dracula-background': '#101010',
          '--ide-dracula-selection': '#303030',
          '--ide-dracula-comment': '#8080aa',
          '--ide-dracula-foreground': '#f0f0f0',
          '--ide-dracula-bright-foreground': '#ffffff',
          '--ide-dracula-pink': '#aa55ff',
          '--ide-dracula-purple': '#9b6bff',
          '--ide-dracula-cyan': '#55ddff',
          '--ide-dracula-green': '#11aa55',
          '--ide-dracula-yellow': '#f4d35e',
          '--ide-dracula-red': '#ff6666',
          '--ide-dracula-orange': '#ffaa44',
        };

        return values[name] ?? '';
      },
    };

    const themeDefinition = createDraculaThemeDefinition(styleReader);

    expect(themeDefinition.colors['editor.background']).toBe('#101010');
    expect(themeDefinition.colors['editorWidget.background']).toBe('#090909');
    expect(themeDefinition.colors['editorWarning.foreground']).toBe('#ffaa44');
    expect(themeDefinition.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ token: 'keyword', foreground: 'aa55ff' }),
        expect.objectContaining({ token: 'support.function', foreground: '11aa55' }),
        expect.objectContaining({ token: 'variable', foreground: 'ffaa44' }),
        expect.objectContaining({ token: 'type', foreground: '55ddff' }),
      ]),
    );
  });
});