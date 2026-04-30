import { describe, expect, it } from 'vitest';
import {
  mockPristineMentionCategories,
  mockPristineSlashCommands,
} from './pristineAssistantTriggers';

describe('pristine assistant trigger mock data', () => {
  it('provides categorized @ mention items for context and tool directives', () => {
    expect(mockPristineMentionCategories.map((category) => category.id)).toEqual([
      'context',
      'tools',
    ]);

    expect(mockPristineMentionCategories[0]?.items.map((item) => item.id)).toEqual([
      'workspace',
      'selection',
    ]);
    expect(mockPristineMentionCategories[1]?.items.map((item) => item.id)).toEqual([
      'propose_file_change',
      'propose_shell_command',
    ]);
  });

  it('keeps / commands frontend-only while backend handlers are deferred', () => {
    expect(mockPristineSlashCommands.map((command) => command.label)).toEqual([
      '/inspect',
      '/plan',
      '/propose-edit',
      '/shell',
    ]);

    for (const command of mockPristineSlashCommands) {
      expect(command.execute()).toBeUndefined();
    }
  });
});