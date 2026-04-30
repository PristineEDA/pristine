import type {
  Unstable_MentionCategory,
  Unstable_SlashCommand,
} from '@assistant-ui/react';

export const mockPristineMentionCategories = [
  {
    id: 'context',
    label: 'Context',
    items: [
      {
        id: 'workspace',
        type: 'context',
        label: 'Workspace',
        description: 'Guide the response with the current workspace',
        icon: 'FileCode2',
      },
      {
        id: 'selection',
        type: 'context',
        label: 'Selection',
        description: 'Refer to the currently selected code when available',
        icon: 'FileCode2',
      },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    items: [
      {
        id: 'propose_file_change',
        type: 'tool',
        label: 'File change proposal',
        description: 'Ask for a buffered file edit proposal',
        icon: 'FileCode2',
      },
      {
        id: 'propose_shell_command',
        type: 'tool',
        label: 'Shell command proposal',
        description: 'Ask for an approval-gated shell command proposal',
        icon: 'Shell',
      },
    ],
  },
] satisfies readonly Unstable_MentionCategory[];

export const mockPristineSlashCommands = [
  {
    id: 'inspect',
    label: '/inspect',
    description: 'Inspect the current project context',
    icon: 'FileCode2',
    execute: () => undefined,
  },
  {
    id: 'plan',
    label: '/plan',
    description: 'Ask for a focused implementation or debug plan',
    icon: 'Sparkles',
    execute: () => undefined,
  },
  {
    id: 'propose-edit',
    label: '/propose-edit',
    description: 'Request a buffered code edit proposal',
    icon: 'FileCode2',
    execute: () => undefined,
  },
  {
    id: 'shell',
    label: '/shell',
    description: 'Request an approval-gated shell command proposal',
    icon: 'Shell',
    execute: () => undefined,
  },
] satisfies readonly Unstable_SlashCommand[];