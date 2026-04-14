import { describe, expect, it } from 'vitest';
import {
  closeFileInEditorGroup,
  createEditorGroup,
  createInitialEditorWorkspace,
  getCycledTabIdInEditorGroup,
  getNextActiveTabIdAfterClose,
  moveEditorTab,
  openFileInEditorGroup,
  pinTabInEditorGroup,
  splitEditorGroup,
  type EditorWorkspaceModel,
} from './editorLayout';

describe('editorLayout', () => {
  it('opens files into the focused group without duplicating tabs inside that group', () => {
    let state = createInitialEditorWorkspace('group-1');

    state = openFileInEditorGroup(state, 'group-1', 'rtl/core/reg_file.v', 'reg_file.v');
    state = openFileInEditorGroup(state, 'group-1', 'rtl/core/reg_file.v', 'reg_file.v');

    expect(state.groups['group-1']?.tabs.map((tab) => tab.id)).toEqual(['rtl/core/reg_file.v']);
    expect(state.groups['group-1']?.activeTabId).toBe('rtl/core/reg_file.v');
  });

  it('replaces the existing preview tab when previewing another file in the same group', () => {
    let state = createInitialEditorWorkspace('group-1');

    state = openFileInEditorGroup(state, 'group-1', 'rtl/core/reg_file.v', 'reg_file.v', { preview: true });
    state = openFileInEditorGroup(state, 'group-1', 'rtl/core/alu.v', 'alu.v', { preview: true });

    expect(state.groups['group-1']?.tabs.map((tab) => ({ id: tab.id, isPinned: tab.isPinned }))).toEqual([
      { id: 'rtl/core/alu.v', isPinned: false },
    ]);
    expect(state.groups['group-1']?.previewTabId).toBe('rtl/core/alu.v');
    expect(state.groups['group-1']?.activeTabId).toBe('rtl/core/alu.v');
  });

  it('pins an existing preview tab when the same file is opened permanently', () => {
    let state = createInitialEditorWorkspace('group-1');

    state = openFileInEditorGroup(state, 'group-1', 'rtl/core/reg_file.v', 'reg_file.v', { preview: true });
    state = openFileInEditorGroup(state, 'group-1', 'rtl/core/reg_file.v', 'reg_file.v');

    expect(state.groups['group-1']?.tabs.map((tab) => ({ id: tab.id, isPinned: tab.isPinned }))).toEqual([
      { id: 'rtl/core/reg_file.v', isPinned: true },
    ]);
    expect(state.groups['group-1']?.previewTabId).toBeNull();
  });

  it('pins an existing preview tab directly without duplicating it', () => {
    let state = createInitialEditorWorkspace('group-1');

    state = openFileInEditorGroup(state, 'group-1', 'rtl/core/reg_file.v', 'reg_file.v', { preview: true });
    state = pinTabInEditorGroup(state, 'group-1', 'rtl/core/reg_file.v');

    expect(state.groups['group-1']?.tabs).toEqual([
      { id: 'rtl/core/reg_file.v', name: 'reg_file.v', isPinned: true },
    ]);
    expect(state.groups['group-1']?.previewTabId).toBeNull();
    expect(state.groups['group-1']?.activeTabId).toBe('rtl/core/reg_file.v');
  });

  it('creates a second group when splitting the active tab', () => {
    let state = createInitialEditorWorkspace('group-1');
    state = openFileInEditorGroup(state, 'group-1', 'rtl/core/reg_file.v', 'reg_file.v');

    state = splitEditorGroup(state, 'group-1', 'group-2', 'split-1', 'horizontal');

    expect(state.groups['group-2']?.tabs.map((tab) => tab.id)).toEqual(['rtl/core/reg_file.v']);
    expect(state.groups['group-2']?.tabs[0]?.isPinned).toBe(true);
    expect(state.focusedGroupId).toBe('group-2');
    expect(state.layout?.type).toBe('split');
  });

  it('moves a tab into another group when dropped at the center', () => {
    let state = createInitialEditorWorkspace('group-1');
    state = openFileInEditorGroup(state, 'group-1', 'rtl/core/reg_file.v', 'reg_file.v');
    state = splitEditorGroup(state, 'group-1', 'group-2', 'split-1', 'horizontal');
    state = openFileInEditorGroup(state, 'group-1', 'rtl/core/alu.v', 'alu.v');

    state = moveEditorTab(state, 'group-1', 'rtl/core/alu.v', 'group-2', 'center', 'group-3', 'split-2');

    expect(state.groups['group-1']?.tabs.map((tab) => tab.id)).toEqual(['rtl/core/reg_file.v']);
    expect(state.groups['group-2']?.tabs.map((tab) => tab.id)).toEqual(['rtl/core/reg_file.v', 'rtl/core/alu.v']);
    expect(state.focusedGroupId).toBe('group-2');
  });

  it('creates a new split when a tab is dropped on an edge', () => {
    let state = createInitialEditorWorkspace('group-1');
    state = openFileInEditorGroup(state, 'group-1', 'rtl/core/reg_file.v', 'reg_file.v');
    state = openFileInEditorGroup(state, 'group-1', 'rtl/core/alu.v', 'alu.v');

    state = moveEditorTab(state, 'group-1', 'rtl/core/alu.v', 'group-1', 'right', 'group-2', 'split-1');

    expect(state.groups['group-1']?.tabs.map((tab) => tab.id)).toEqual(['rtl/core/reg_file.v']);
    expect(state.groups['group-2']?.tabs.map((tab) => tab.id)).toEqual(['rtl/core/alu.v']);
    expect(state.focusedGroupId).toBe('group-2');
    expect(state.layout?.type).toBe('split');
  });

  it('pins a preview tab when it is moved into another group', () => {
    let state = createInitialEditorWorkspace('group-1');
    state = openFileInEditorGroup(state, 'group-1', 'rtl/core/reg_file.v', 'reg_file.v');
    state = splitEditorGroup(state, 'group-1', 'group-2', 'split-1', 'horizontal');
    state = openFileInEditorGroup(state, 'group-1', 'rtl/core/alu.v', 'alu.v', { preview: true });

    state = moveEditorTab(state, 'group-1', 'rtl/core/alu.v', 'group-2', 'center', 'group-3', 'split-2');

    expect(state.groups['group-1']?.previewTabId).toBeNull();
    expect(state.groups['group-2']?.tabs.find((tab) => tab.id === 'rtl/core/alu.v')?.isPinned).toBe(true);
  });

  it('cycles tabs to the right by default and supports reverse cycling to the left', () => {
    const group = createEditorGroup(
      'group-1',
      [
        { id: 'README.md', name: 'README.md', isPinned: true },
        { id: 'rtl/core/reg_file.v', name: 'reg_file.v', isPinned: true },
        { id: '.gitignore', name: '.gitignore', isPinned: true },
      ],
      'rtl/core/reg_file.v',
    );

    expect(getCycledTabIdInEditorGroup(group)).toBe('.gitignore');
    expect(getCycledTabIdInEditorGroup({ ...group, activeTabId: '.gitignore' })).toBe('README.md');
    expect(getCycledTabIdInEditorGroup(group, 'backward')).toBe('README.md');
    expect(getCycledTabIdInEditorGroup({ ...group, activeTabId: 'README.md' }, 'backward')).toBe('.gitignore');
  });

  it('selects the nearest surviving neighbor when closing the active tab', () => {
    const group = createEditorGroup(
      'group-1',
      [
        { id: 'README.md', name: 'README.md', isPinned: true },
        { id: 'rtl/core/reg_file.v', name: 'reg_file.v', isPinned: true },
        { id: '.gitignore', name: '.gitignore', isPinned: true },
      ],
      'rtl/core/reg_file.v',
    );

    expect(getNextActiveTabIdAfterClose(group, 'rtl/core/reg_file.v')).toBe('.gitignore');
    expect(getNextActiveTabIdAfterClose({ ...group, activeTabId: '.gitignore' }, '.gitignore')).toBe('rtl/core/reg_file.v');
  });

  it('removes an empty group after its last tab closes', () => {
    let state: EditorWorkspaceModel = {
      ...createInitialEditorWorkspace('group-1'),
      groups: {
        'group-1': createEditorGroup('group-1', [{ id: 'rtl/core/reg_file.v', name: 'reg_file.v', isPinned: true }], 'rtl/core/reg_file.v'),
      },
    };

    state = closeFileInEditorGroup(state, 'group-1', 'rtl/core/reg_file.v');

    expect(state.groups['group-1']).toBeUndefined();
    expect(state.layout).toBeNull();
    expect(state.focusedGroupId).toBeNull();
  });
});