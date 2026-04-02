import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceProvider, useWorkspace } from '../context/WorkspaceContext';
import { EditorSplitLayout } from './EditorSplitLayout';

vi.mock('./EditorArea', () => ({
  EditorArea: ({
    tabs,
    activeTabId,
    onTabChange,
    onTabClose,
    onTabPin,
    onSplitEditor,
    onTabDragStart,
    onTabDragEnd,
    onFocus,
    showDragInteractionShield,
    dragInteractionShieldTestId,
  }: any) => (
    <div data-testid="mock-editor-area" onMouseDown={onFocus}>
      <div data-testid="mock-active-tab">{activeTabId}</div>
      <div data-testid="mock-tabs">{tabs.map((tab: { id: string }) => tab.id).join(',')}</div>
      <div data-testid="mock-preview-tabs">{tabs.filter((tab: { isPinned?: boolean }) => tab.isPinned === false).map((tab: { id: string }) => tab.id).join(',')}</div>
      {showDragInteractionShield ? <div data-testid={dragInteractionShieldTestId} /> : null}
      {onSplitEditor ? <button onClick={() => onSplitEditor('horizontal')}>split-editor</button> : null}
      {onSplitEditor ? <button onClick={() => onSplitEditor('vertical')}>split-editor-down</button> : null}
      {tabs.map((tab: { id: string; name: string }) => (
        <div key={tab.id}>
          <button
            data-testid={`mock-tab-${tab.id}`}
            draggable
            onClick={() => onTabChange(tab.id)}
            onDoubleClick={() => onTabPin?.(tab.id)}
            onDragStart={() => {
              onTabPin?.(tab.id);
              onTabDragStart?.(tab.id);
            }}
            onDragEnd={() => onTabDragEnd?.()}
          >
            {tab.name}
          </button>
          <button data-testid={`mock-close-${tab.id}`} onClick={() => onTabClose(tab.id)}>
            close
          </button>
        </div>
      ))}
    </div>
  ),
}));

function LayoutHarness() {
  const { openFile, openPreviewFile } = useWorkspace();

  return (
    <div>
      <button onClick={() => openFile('rtl/core/reg_file.v', 'reg_file.v')}>open-reg</button>
      <button onClick={() => openFile('rtl/core/alu.v', 'alu.v')}>open-alu</button>
      <button onClick={() => openPreviewFile('rtl/core/reg_file.v', 'reg_file.v')}>preview-reg</button>
      <EditorSplitLayout />
    </div>
  );
}

function mockRect(element: HTMLElement) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      width: 100,
      height: 100,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

function fireDragEvent(element: HTMLElement, type: 'dragover' | 'drop', clientX: number, clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { configurable: true, value: clientX },
    clientY: { configurable: true, value: clientY },
  });
  fireEvent(element, event);
}

describe('EditorSplitLayout', () => {
  it('creates a second editor group from the split action', () => {
    render(
      <WorkspaceProvider>
        <LayoutHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(within(screen.getByTestId('editor-group-group-1')).getByText('split-editor'));

    expect(screen.getByTestId('editor-group-group-2')).toBeInTheDocument();
    expect(within(screen.getByTestId('editor-group-group-1')).getByTestId('mock-tabs')).toHaveTextContent('rtl/core/reg_file.v');
    expect(within(screen.getByTestId('editor-group-group-2')).getByTestId('mock-tabs')).toHaveTextContent('rtl/core/reg_file.v');
  });

  it('supports creating a vertical split from the tab bar actions', () => {
    render(
      <WorkspaceProvider>
        <LayoutHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(within(screen.getByTestId('editor-group-group-1')).getByText('split-editor-down'));

    expect(screen.getByTestId('editor-group-group-2')).toBeInTheDocument();
    expect(within(screen.getByTestId('editor-group-group-2')).getByTestId('mock-tabs')).toHaveTextContent('rtl/core/reg_file.v');
  });

  it('creates a new split when a tab is dropped on the right edge', () => {
    render(
      <WorkspaceProvider>
        <LayoutHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));

    const group = screen.getByTestId('editor-group-group-1');
    mockRect(group);

    const draggedTab = within(group).getByTestId('mock-tab-rtl/core/reg_file.v');
    fireEvent.dragStart(draggedTab);

    expect(screen.getByTestId('editor-drag-shield-group-1')).toBeInTheDocument();

    fireDragEvent(group, 'dragover', 95, 50);

    const indicator = screen.getByTestId('editor-drop-indicator-right');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass('w-px', 'transition-all', 'duration-150', 'ease-out');
    expect(indicator).toHaveClass('right-1/2', 'translate-x-1/2', 'bg-ide-text-section/75');

    fireDragEvent(group, 'drop', 95, 50);
    fireEvent.dragEnd(draggedTab);

    expect(screen.getByTestId('editor-group-group-2')).toBeInTheDocument();
    expect(within(screen.getByTestId('editor-group-group-2')).getByTestId('mock-tabs')).toHaveTextContent('rtl/core/reg_file.v');
    expect(screen.queryByTestId('editor-drag-shield-group-1')).not.toBeInTheDocument();
  });

  it('pins a preview tab when the tab itself is double-clicked', () => {
    render(
      <WorkspaceProvider>
        <LayoutHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('preview-reg'));
    const group = screen.getByTestId('editor-group-group-1');
    const previewTab = within(group).getByTestId('mock-tab-rtl/core/reg_file.v');

    fireEvent.doubleClick(previewTab);

    expect(within(group).getByTestId('mock-active-tab')).toHaveTextContent('rtl/core/reg_file.v');
    expect(within(group).getByTestId('mock-preview-tabs')).toHaveTextContent('');
  });

  it('pins a preview tab before drag state starts so cancelled drags still keep it', () => {
    render(
      <WorkspaceProvider>
        <LayoutHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('preview-reg'));
    const group = screen.getByTestId('editor-group-group-1');
    const previewTab = within(group).getByTestId('mock-tab-rtl/core/reg_file.v');

    fireEvent.dragStart(previewTab);

    expect(within(group).getByTestId('mock-preview-tabs')).toHaveTextContent('');
    expect(screen.getByTestId('editor-drag-shield-group-1')).toBeInTheDocument();
  });

  it('moves a tab into an existing group when dropped in the center', () => {
    render(
      <WorkspaceProvider>
        <LayoutHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));
    fireEvent.click(screen.getByText('open-alu'));
    fireEvent.click(within(screen.getByTestId('editor-group-group-1')).getByText('split-editor'));

    const sourceGroup = screen.getByTestId('editor-group-group-1');
    const targetGroup = screen.getByTestId('editor-group-group-2');
    mockRect(targetGroup);

    fireEvent.dragStart(within(sourceGroup).getByTestId('mock-tab-rtl/core/reg_file.v'));
    fireDragEvent(targetGroup, 'dragover', 50, 50);

    const indicator = screen.getByTestId('editor-drop-indicator-center');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass('transition-all', 'duration-150', 'ease-out');
    expect(indicator).toHaveClass('left-[20%]', 'right-[20%]', 'top-[20%]', 'bottom-[20%]');

    fireDragEvent(targetGroup, 'drop', 50, 50);

    expect(within(sourceGroup).getByTestId('mock-tabs')).toHaveTextContent('rtl/core/alu.v');
    expect(within(targetGroup).getByTestId('mock-tabs')).toHaveTextContent('rtl/core/alu.v,rtl/core/reg_file.v');
  });

  it('renders half-pane edge hot zones with animated neutral styling', () => {
    render(
      <WorkspaceProvider>
        <LayoutHarness />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByText('open-reg'));

    const group = screen.getByTestId('editor-group-group-1');
    mockRect(group);

    fireEvent.dragStart(within(group).getByTestId('mock-tab-rtl/core/reg_file.v'));
    fireDragEvent(group, 'dragover', 10, 50);

    const indicator = screen.getByTestId('editor-drop-indicator-left');
    expect(indicator).toHaveClass('transition-all', 'duration-150', 'ease-out');

    const halfPaneZone = Array.from(group.querySelectorAll('div')).find((element) => element.className.includes('w-1/2'));
    expect(halfPaneZone).not.toBeNull();

    const overlayLabel = screen.getByText('Split left');
    expect(overlayLabel).toHaveClass('border-ide-border-light/70', 'bg-ide-sidebar-bg/95', 'text-ide-text-section');
  });
});