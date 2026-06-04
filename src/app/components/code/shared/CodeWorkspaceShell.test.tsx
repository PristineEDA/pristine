import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CodeWorkspaceShell,
  EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX,
  EXPLORER_RIGHT_PANEL_MAX_WIDTH_PX,
  EXPLORER_RIGHT_PANEL_MIN_WIDTH_PX,
} from './CodeWorkspaceShell';
import {
  CodeViewerLayoutProvider,
  WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY,
} from '../../../context/CodeViewerLayoutContext';

const panelRecords: Array<{ id?: string; collapsed?: boolean }> = [];
const handleRecords: Array<{ hidden?: boolean }> = [];
const panelResizeCalls: Array<{ id?: string; size: number | `${number}%` }> = [];
const panelSnapHandlers = new Map<string, { onMinSnap?: () => void; onMaxSnap?: () => void }>();
const panelImperativeHandles = new Map<string, { resize: (size: number | `${number}%`) => void }>();
const mockedEnsureLspStreamSubscriptions = vi.fn();

function latestPanelRecords(count: number) {
  return panelRecords.slice(-count);
}

function latestHandleRecords(count: number) {
  return handleRecords.slice(-count);
}

vi.mock('../../ui/resizable', () => ({
  PANEL_TRANSITION_DURATION_MS: 300,
  ResizablePanelGroup: ({
    children,
    className,
    layoutGapPx,
    orientation,
  }: {
    children: React.ReactNode;
    className?: string;
    layoutGapPx?: number;
    orientation: string;
  }) => (
    <div data-testid={`panel-group-${orientation}`} className={className} data-layout-gap-px={layoutGapPx ?? ''}>{children}</div>
  ),
  ResizablePanel: ({
    children,
    className,
    id,
    collapsed,
    defaultSize,
    minSize,
    maxSize,
    minSizePx,
    maxSizePx,
    onSizeChange,
    panelRef,
    snap,
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
    id?: string;
    collapsed?: boolean;
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
    minSizePx?: number;
    maxSizePx?: number;
    onSizeChange?: (size: number) => void;
    panelRef?: React.Ref<{ resize: (size: number | `${number}%`) => void } | null>;
    snap?: { minThreshold?: number; maxThreshold?: number; onMinSnap?: () => void; onMaxSnap?: () => void };
    [key: string]: unknown;
  }) => {
    panelRecords.push({ id, collapsed });

    const resizeHandle = {
      resize: (size: number | `${number}%`) => {
        panelResizeCalls.push({ id, size });
        onSizeChange?.(typeof size === 'string' ? Number.parseFloat(size) : size);
      },
    };

    if (panelRef) {
      if (typeof panelRef === 'function') {
        panelRef(resizeHandle);
      } else {
        panelRef.current = resizeHandle;
      }
    }

    if (id) {
      panelImperativeHandles.set(id, resizeHandle);
    }

    if (id && snap) {
      panelSnapHandlers.set(id, snap);
    }

    return (
      <div
        data-testid={`panel-${id ?? 'unknown'}`}
        className={className}
        data-default-size={defaultSize ?? ''}
        data-min-size={minSize ?? ''}
        data-max-size={maxSize ?? ''}
        data-collapsed={collapsed ? 'true' : 'false'}
        data-min-size-px={minSizePx ?? ''}
        data-max-size-px={maxSizePx ?? ''}
        data-has-panel-ref={panelRef ? 'true' : 'false'}
        data-snap-min-threshold={snap?.minThreshold ?? ''}
        data-snap-max-threshold={snap?.maxThreshold ?? ''}
        data-bottom-panel-maximized={String(props['data-bottom-panel-maximized'] ?? '')}
      >
        {children}
      </div>
    );
  },
  ResizableHandle: ({ className, hidden }: { className?: string; hidden?: boolean }) => {
    handleRecords.push({ hidden });
    return <div data-testid="panel-handle" className={className} data-hidden={hidden ? 'true' : 'false'} />;
  },
}));

vi.mock('../../../lsp/systemVerilogLspBridge', () => ({
  systemVerilogLspBridge: {
    ensureStreamSubscriptions: () => mockedEnsureLspStreamSubscriptions(),
  },
}));

describe('CodeWorkspaceShell', () => {
  it('installs LSP stream subscriptions before any editor pane is opened', () => {
    render(
      <CodeWorkspaceShell
        shellTestId="workspace-shell"
        activityBar={<div>Activity</div>}
        showLeftPanel
        showBottomPanel
        showRightPanel
        leftPanelId="left"
        centerPanelId="center"
        topPanelId="top"
        bottomPanelId="bottom"
        rightPanelId="right"
        leftContent={<div>Explorer</div>}
        topContent={<div>Editor</div>}
        bottomContent={<div>Terminal</div>}
        rightContent={<div>Inspector</div>}
      />,
    );

    expect(mockedEnsureLspStreamSubscriptions).toHaveBeenCalledTimes(1);
  });

  it('renders all visible regions with the percentage layout by default', () => {
    panelRecords.length = 0;
    handleRecords.length = 0;

    render(
      <CodeWorkspaceShell
        shellTestId="workspace-shell"
        activityBar={<div>Activity</div>}
        overlay={<div>Overlay</div>}
        showLeftPanel
        showBottomPanel
        showRightPanel
        leftPanelId="left"
        centerPanelId="center"
        topPanelId="top"
        bottomPanelId="bottom"
        rightPanelId="right"
        leftContent={<div>Explorer</div>}
        topContent={<div>Editor</div>}
        bottomContent={<div>Terminal</div>}
        rightContent={<div>Inspector</div>}
      />,
    );

    expect(screen.getByTestId('workspace-shell')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Overlay')).toBeInTheDocument();
    expect(screen.getByText('Explorer')).toBeInTheDocument();
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
    expect(screen.getByText('Inspector')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-left-layout-margin')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-top-layout-margin')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-bottom-layout-margin')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-right-layout-margin')).not.toBeInTheDocument();
    expect(screen.getByTestId('panel-right')).toHaveAttribute('data-min-size-px', String(EXPLORER_RIGHT_PANEL_MIN_WIDTH_PX));
    expect(screen.getByTestId('panel-right')).toHaveAttribute('data-max-size-px', String(EXPLORER_RIGHT_PANEL_MAX_WIDTH_PX));
    expect(latestPanelRecords(5)).toEqual([
      { id: 'left', collapsed: false },
      { id: 'center', collapsed: undefined },
      { id: 'top', collapsed: undefined },
      { id: 'bottom', collapsed: false },
      { id: 'right', collapsed: false },
    ]);
    expect(latestHandleRecords(3)).toEqual([
      { hidden: false },
      { hidden: false },
      { hidden: false },
    ]);
  });

  it('wires Explorer bottom panel maximize controls to the bottom panel resize handle', () => {
    panelRecords.length = 0;
    handleRecords.length = 0;
    panelResizeCalls.length = 0;
    panelSnapHandlers.clear();
    panelImperativeHandles.clear();

    render(
      <CodeWorkspaceShell
        activityBar={<div>Activity</div>}
        showLeftPanel={false}
        showBottomPanel
        showRightPanel={false}
        leftPanelId="left"
        centerPanelId="center"
        topPanelId="top"
        bottomPanelId="bottom"
        rightPanelId="right"
        leftContent={<div>Explorer</div>}
        topContent={<div>Editor</div>}
        bottomContent={({ isMaximized, onMaximizeToggle }) => (
          <button type="button" onClick={onMaximizeToggle}>{isMaximized ? 'restore-bottom' : 'maximize-bottom'}</button>
        )}
        rightContent={<div>Inspector</div>}
        enableBottomPanelMaximize
      />,
    );

    expect(screen.getByTestId('panel-top')).toHaveAttribute('data-min-size', '0');
    expect(screen.getByTestId('panel-bottom')).toHaveAttribute('data-max-size', '100');
    expect(screen.getByTestId('panel-bottom')).toHaveAttribute('data-has-panel-ref', 'true');
    expect(screen.getByTestId('panel-bottom')).toHaveAttribute('data-snap-max-threshold', '92');
    expect(screen.getByTestId('panel-bottom')).toHaveAttribute('data-bottom-panel-maximized', 'false');

    fireEvent.click(screen.getByText('maximize-bottom'));

    expect(panelResizeCalls).toEqual([{ id: 'bottom', size: 100 }]);
    expect(screen.getByText('restore-bottom')).toBeInTheDocument();
    expect(screen.getByTestId('panel-bottom')).toHaveAttribute('data-bottom-panel-maximized', 'true');

    fireEvent.click(screen.getByText('restore-bottom'));

    expect(panelResizeCalls).toEqual([
      { id: 'bottom', size: 100 },
      { id: 'bottom', size: 40 },
    ]);
  });

  it('treats the bottom panel snap zone as maximized state', () => {
    panelRecords.length = 0;
    handleRecords.length = 0;
    panelResizeCalls.length = 0;
    panelSnapHandlers.clear();
    panelImperativeHandles.clear();

    render(
      <CodeWorkspaceShell
        activityBar={<div>Activity</div>}
        showLeftPanel={false}
        showBottomPanel
        showRightPanel={false}
        leftPanelId="left"
        centerPanelId="center"
        topPanelId="top"
        bottomPanelId="bottom"
        rightPanelId="right"
        leftContent={<div>Explorer</div>}
        topContent={<div>Editor</div>}
        bottomContent={({ isMaximized }) => <div>{isMaximized ? 'restore-bottom' : 'maximize-bottom'}</div>}
        rightContent={<div>Inspector</div>}
        enableBottomPanelMaximize
      />,
    );

    const bottomPanel = screen.getByTestId('panel-bottom');
    const snapThreshold = Number(bottomPanel.getAttribute('data-snap-max-threshold'));
    const bottomPanelHandle = panelImperativeHandles.get('bottom');

    if (!bottomPanelHandle) {
      throw new Error('Expected bottom panel imperative handle to be registered');
    }

    expect(snapThreshold).toBe(92);

    act(() => {
      bottomPanelHandle.resize(snapThreshold);
    });

    expect(screen.getByText('restore-bottom')).toBeInTheDocument();
    expect(bottomPanel).toHaveAttribute('data-bottom-panel-maximized', 'true');
  });

  it('uses the bottom panel minimum snap callback to auto-hide without closing the content', () => {
    panelRecords.length = 0;
    handleRecords.length = 0;
    panelSnapHandlers.clear();
    panelImperativeHandles.clear();
    const onBottomPanelAutoHide = vi.fn();

    render(
      <CodeWorkspaceShell
        activityBar={<div>Activity</div>}
        showLeftPanel={false}
        showBottomPanel
        showRightPanel={false}
        leftPanelId="left"
        centerPanelId="center"
        topPanelId="top"
        bottomPanelId="bottom"
        rightPanelId="right"
        leftContent={<div>Explorer</div>}
        topContent={<div>Editor</div>}
        bottomContent={<div>Terminal</div>}
        rightContent={<div>Inspector</div>}
        enableBottomPanelMaximize
        onBottomPanelAutoHide={onBottomPanelAutoHide}
      />,
    );

    expect(screen.getByText('Terminal')).toBeInTheDocument();
    expect(screen.getByTestId('panel-bottom')).toHaveAttribute('data-snap-min-threshold', '16');

    panelSnapHandlers.get('bottom')?.onMinSnap?.();

    expect(onBottomPanelAutoHide).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  it('applies minimal layout chrome without changing the activity bar region', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY ? 'minimal' : null,
    );

    render(
      <CodeViewerLayoutProvider>
        <CodeWorkspaceShell
          shellTestId="workspace-shell"
          activityBar={<div data-testid="activity-region">Activity</div>}
          showLeftPanel
          showBottomPanel
          showRightPanel
          leftPanelId="left"
          centerPanelId="center"
          topPanelId="top"
          bottomPanelId="bottom"
          rightPanelId="right"
          leftContent={<div>Explorer</div>}
          topContent={<div>Editor</div>}
          bottomContent={<div>Terminal</div>}
          rightContent={<div>Inspector</div>}
        />
      </CodeViewerLayoutProvider>,
    );

    expect(screen.getByTestId('workspace-shell')).toHaveAttribute('data-code-viewer-layout-mode', 'minimal');
    expect(screen.getByTestId('workspace-shell')).toHaveClass('min-h-0');
    expect(screen.getByTestId('activity-region').parentElement).not.toHaveClass('rounded-md');
    expect(screen.getByTestId('panel-left')).toHaveClass('rounded-md', 'border', 'bg-ide-bg');
    expect(screen.getByTestId('panel-top')).toHaveClass('rounded-md', 'border', 'bg-ide-bg');
    expect(screen.getByTestId('panel-bottom')).toHaveClass('rounded-md', 'border', 'bg-ide-bg');
    expect(screen.getByTestId('panel-right')).toHaveClass('rounded-md', 'border', 'bg-ide-bg');
    expect(screen.getByTestId('panel-group-horizontal')).not.toHaveClass('gap-2.5');
    expect(screen.getByTestId('panel-group-vertical')).not.toHaveClass('gap-2.5');
    expect(screen.getByTestId('panel-group-horizontal')).toHaveAttribute('data-layout-gap-px', '10');
    expect(screen.getByTestId('panel-group-vertical')).toHaveAttribute('data-layout-gap-px', '10');
    expect(screen.getAllByTestId('panel-handle').every((handle) => handle.className.includes('bg-transparent'))).toBe(true);
    expect(screen.getAllByTestId('panel-handle').every((handle) => handle.className.includes('overlay-handle'))).toBe(true);
  });

  it('lets the fixed minimal left panel opt out of the outer frame while other panels keep theirs', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY ? 'minimal' : null,
    );

    render(
      <CodeViewerLayoutProvider>
        <CodeWorkspaceShell
          shellTestId="workspace-shell"
          activityBar={<div data-testid="activity-region">Activity</div>}
          useLeftPanelFrame={false}
          showLeftPanel
          showBottomPanel
          showRightPanel
          leftPanelId="left"
          centerPanelId="center"
          topPanelId="top"
          bottomPanelId="bottom"
          rightPanelId="right"
          leftFixedWidthPx={240}
          onLeftFixedWidthChange={() => undefined}
          leftContent={<div>Explorer</div>}
          topContent={<div>Editor</div>}
          bottomContent={<div>Terminal</div>}
          rightContent={<div>Inspector</div>}
        />
      </CodeViewerLayoutProvider>,
    );

    expect(screen.getByTestId('panel-left')).not.toHaveClass('rounded-md');
    expect(screen.getByTestId('panel-left')).not.toHaveClass('border');
    expect(screen.getByTestId('panel-left')).not.toHaveClass('bg-ide-bg');
    expect(screen.getByTestId('panel-top')).toHaveClass('rounded-md', 'border', 'bg-ide-bg');
    expect(screen.getByTestId('panel-bottom')).toHaveClass('rounded-md', 'border', 'bg-ide-bg');
    expect(screen.getByTestId('panel-right')).toHaveClass('rounded-md', 'border', 'bg-ide-bg');
  });

  it('lets the fixed minimal right panel opt out of the outer frame while other panels keep theirs', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY ? 'minimal' : null,
    );

    render(
      <CodeViewerLayoutProvider>
        <CodeWorkspaceShell
          shellTestId="workspace-shell"
          activityBar={<div data-testid="activity-region">Activity</div>}
          useRightPanelFrame={false}
          showLeftPanel
          showBottomPanel
          showRightPanel
          leftPanelId="left"
          centerPanelId="center"
          topPanelId="top"
          bottomPanelId="bottom"
          rightPanelId="right"
          rightFixedWidthPx={300}
          onRightFixedWidthChange={() => undefined}
          leftContent={<div>Explorer</div>}
          topContent={<div>Editor</div>}
          bottomContent={<div>Terminal</div>}
          rightContent={<div>Inspector</div>}
        />
      </CodeViewerLayoutProvider>,
    );

    expect(screen.getByTestId('panel-right')).not.toHaveClass('rounded-md');
    expect(screen.getByTestId('panel-right')).not.toHaveClass('border');
    expect(screen.getByTestId('panel-right')).not.toHaveClass('bg-ide-bg');
    expect(screen.getByTestId('panel-left')).toHaveClass('rounded-md', 'border', 'bg-ide-bg');
    expect(screen.getByTestId('panel-top')).toHaveClass('rounded-md', 'border', 'bg-ide-bg');
    expect(screen.getByTestId('panel-bottom')).toHaveClass('rounded-md', 'border', 'bg-ide-bg');
  });

  it('collapses fixed minimal handles so resize targets do not consume layout space', () => {
    vi.mocked(window.electronAPI!.config.get).mockImplementation((key: string) =>
      key === WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY ? 'minimal' : null,
    );

    function FixedWidthMinimalHarness() {
      const [leftWidth, setLeftWidth] = useState(240);

      return (
        <CodeViewerLayoutProvider>
          <CodeWorkspaceShell
            shellTestId="workspace-shell"
            activityBar={<div>Activity</div>}
            showLeftPanel
            showBottomPanel
            showRightPanel={false}
            leftPanelId="left"
            centerPanelId="center"
            topPanelId="top"
            bottomPanelId="bottom"
            rightPanelId="right"
            leftFixedWidthPx={leftWidth}
            onLeftFixedWidthChange={setLeftWidth}
            leftContent={<div>Explorer</div>}
            topContent={<div>Editor</div>}
            bottomContent={<div>Terminal</div>}
            rightContent={<div>Inspector</div>}
          />
        </CodeViewerLayoutProvider>
      );
    }

    render(<FixedWidthMinimalHarness />);

    expect(screen.getByTestId('panel-handle-left')).toHaveClass('w-0', '-mx-[5px]', 'overlay-handle');
  });

  it('renders a fixed-width left panel and clamps drag updates', () => {
    panelRecords.length = 0;
    handleRecords.length = 0;

    function FixedWidthHarness() {
      const [leftWidth, setLeftWidth] = useState(240);

      return (
        <>
          <span data-testid="left-width-value">{leftWidth}</span>
          <CodeWorkspaceShell
            activityBar={<div>Activity</div>}
            overlay={<div>Overlay</div>}
            showLeftPanel
            showBottomPanel
            showRightPanel
            leftPanelId="left"
            centerPanelId="center"
            topPanelId="top"
            bottomPanelId="bottom"
            rightPanelId="right"
            leftFixedWidthPx={leftWidth}
            onLeftFixedWidthChange={setLeftWidth}
            leftContent={<div>Explorer</div>}
            topContent={<div>Editor</div>}
            bottomContent={<div>Terminal</div>}
            rightContent={<div>Inspector</div>}
          />
        </>
      );
    }

    render(<FixedWidthHarness />);

    expect(screen.getByTestId('panel-left')).toHaveStyle({ width: '240px' });
    expect(screen.getByTestId('panel-handle-left')).toBeInTheDocument();
    expect(latestPanelRecords(4)).toEqual([
      { id: 'center', collapsed: undefined },
      { id: 'top', collapsed: undefined },
      { id: 'bottom', collapsed: false },
      { id: 'right', collapsed: false },
    ]);
    expect(latestHandleRecords(2)).toEqual([
      { hidden: false },
      { hidden: false },
    ]);

    const leftHandle = screen.getByTestId('panel-handle-left');

    expect(leftHandle).toHaveClass('cursor-ew-resize');

    fireEvent.pointerDown(leftHandle, { clientX: 240, pointerId: 1 });
    expect(document.body.style.cursor).toBe('ew-resize');
    fireEvent.pointerMove(leftHandle, { clientX: 320, pointerId: 1 });
    fireEvent.pointerUp(leftHandle, { clientX: 320, pointerId: 1 });
    expect(document.body.style.cursor).toBe('');

    expect(screen.getByTestId('left-width-value')).toHaveTextContent('320');
    expect(screen.getByTestId('panel-left')).toHaveStyle({ width: '320px' });

    fireEvent.pointerDown(leftHandle, { clientX: 320, pointerId: 2 });
    fireEvent.pointerMove(leftHandle, { clientX: -120, pointerId: 2 });
    fireEvent.pointerUp(leftHandle, { clientX: -120, pointerId: 2 });

    expect(screen.getByTestId('left-width-value')).toHaveTextContent('200');
    expect(screen.getByTestId('panel-left')).toHaveStyle({ width: '200px' });

    fireEvent.pointerDown(leftHandle, { clientX: 200, pointerId: 3 });
    fireEvent.pointerMove(leftHandle, { clientX: 800, pointerId: 3 });
    fireEvent.pointerUp(leftHandle, { clientX: 800, pointerId: 3 });

    expect(screen.getByTestId('left-width-value')).toHaveTextContent('480');
    expect(screen.getByTestId('panel-left')).toHaveStyle({ width: '480px' });
  });

  it('keeps hidden panel content out of the layout and marks the matching handles as hidden', () => {
    panelRecords.length = 0;
    handleRecords.length = 0;

    render(
      <CodeWorkspaceShell
        activityBar={<div>Activity</div>}
        showLeftPanel={false}
        showBottomPanel={false}
        showRightPanel={false}
        leftPanelId="left"
        centerPanelId="center"
        topPanelId="top"
        bottomPanelId="bottom"
        rightPanelId="right"
        leftContent={<div>Explorer</div>}
        topContent={<div>Editor</div>}
        bottomContent={<div>Terminal</div>}
        rightContent={<div>Inspector</div>}
      />,
    );

    expect(screen.queryByText('Explorer')).not.toBeInTheDocument();
    expect(screen.queryByText('Terminal')).not.toBeInTheDocument();
    expect(screen.queryByText('Inspector')).not.toBeInTheDocument();
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(latestHandleRecords(3)).toEqual([
      { hidden: true },
      { hidden: true },
      { hidden: true },
    ]);
    expect(latestPanelRecords(5)).toEqual([
      { id: 'left', collapsed: true },
      { id: 'center', collapsed: undefined },
      { id: 'top', collapsed: undefined },
      { id: 'bottom', collapsed: true },
      { id: 'right', collapsed: true },
    ]);
  });

  it('preserves the opposite fixed side width when either explorer side is toggled', () => {
    panelRecords.length = 0;
    handleRecords.length = 0;

    function FixedSideHarness() {
      const [leftWidth, setLeftWidth] = useState(280);
      const [rightWidth, setRightWidth] = useState(EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX);
      const [showLeft, setShowLeft] = useState(true);
      const [showRight, setShowRight] = useState(true);

      return (
        <>
          <span data-testid="left-width-value">{leftWidth}</span>
          <span data-testid="right-width-value">{rightWidth}</span>
          <button type="button" onClick={() => setShowLeft((current) => !current)}>toggle-left</button>
          <button type="button" onClick={() => setShowRight((current) => !current)}>toggle-right</button>
          <CodeWorkspaceShell
            activityBar={<div>Activity</div>}
            overlay={<div>Overlay</div>}
            showLeftPanel={showLeft}
            showBottomPanel
            showRightPanel={showRight}
            leftPanelId="left"
            centerPanelId="center"
            topPanelId="top"
            bottomPanelId="bottom"
            rightPanelId="right"
            leftFixedWidthPx={leftWidth}
            onLeftFixedWidthChange={setLeftWidth}
            rightFixedWidthPx={rightWidth}
            onRightFixedWidthChange={setRightWidth}
            leftContent={<div>Explorer</div>}
            topContent={<div>Editor</div>}
            bottomContent={<div>Terminal</div>}
            rightContent={<div>Inspector</div>}
          />
        </>
      );
    }

    render(<FixedSideHarness />);

    expect(screen.getByTestId('panel-left')).toHaveStyle({ width: '280px' });
    expect(screen.getByTestId('panel-right')).toHaveStyle({ width: '300px' });
    expect(latestPanelRecords(3)).toEqual([
      { id: 'center', collapsed: undefined },
      { id: 'top', collapsed: undefined },
      { id: 'bottom', collapsed: false },
    ]);
    expect(latestHandleRecords(1)).toEqual([
      { hidden: false },
    ]);

    const leftHandle = screen.getByTestId('panel-handle-left');
    const rightHandle = screen.getByTestId('panel-handle-right');

    expect(leftHandle).toHaveClass('cursor-ew-resize');
    expect(rightHandle).toHaveClass('cursor-ew-resize');

    fireEvent.pointerDown(leftHandle, { clientX: 280, pointerId: 1 });
    fireEvent.pointerMove(leftHandle, { clientX: 340, pointerId: 1 });
    fireEvent.pointerUp(leftHandle, { clientX: 340, pointerId: 1 });

    expect(screen.getByTestId('left-width-value')).toHaveTextContent('340');
    expect(screen.getByTestId('right-width-value')).toHaveTextContent('300');

    fireEvent.pointerDown(rightHandle, { clientX: 700, pointerId: 2 });
    fireEvent.pointerMove(rightHandle, { clientX: 640, pointerId: 2 });
    fireEvent.pointerUp(rightHandle, { clientX: 640, pointerId: 2 });

    expect(screen.getByTestId('right-width-value')).toHaveTextContent('360');
    expect(screen.getByTestId('left-width-value')).toHaveTextContent('340');
    expect(screen.getByTestId('panel-right')).toHaveStyle({ width: '360px' });

    fireEvent.click(screen.getByText('toggle-left'));

    expect(screen.getByTestId('panel-left')).toHaveStyle({ width: '0px' });
    expect(screen.getByTestId('panel-left')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('panel-left').style.transitionDuration).toBe('300ms');
    expect(screen.getByTestId('panel-left').style.transitionProperty).toBe('width, min-width, max-width, flex-basis');
    expect(screen.getByTestId('right-width-value')).toHaveTextContent('360');
    expect(screen.getByTestId('panel-right')).toHaveStyle({ width: '360px' });

    fireEvent.click(screen.getByText('toggle-left'));

    expect(screen.getByTestId('panel-left')).toHaveStyle({ width: '340px' });
    expect(screen.getByTestId('right-width-value')).toHaveTextContent('360');

    fireEvent.click(screen.getByText('toggle-right'));

    expect(screen.getByTestId('panel-right')).toHaveStyle({ width: '0px' });
    expect(screen.getByTestId('panel-right')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('panel-right').style.transitionDuration).toBe('300ms');
    expect(screen.getByTestId('panel-right').style.transitionProperty).toBe('width, min-width, max-width, flex-basis');
    expect(screen.getByTestId('left-width-value')).toHaveTextContent('340');

    fireEvent.click(screen.getByText('toggle-right'));

    expect(screen.getByTestId('panel-right')).toHaveStyle({ width: '360px' });
    expect(screen.getByTestId('panel-right')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByTestId('left-width-value')).toHaveTextContent('340');

    const rightHandleAfterReopen = screen.getByTestId('panel-handle-right');
    fireEvent.pointerDown(rightHandleAfterReopen, { clientX: 640, pointerId: 3 });
    fireEvent.pointerMove(rightHandleAfterReopen, { clientX: 1200, pointerId: 3 });
    fireEvent.pointerUp(rightHandleAfterReopen, { clientX: 1200, pointerId: 3 });

    expect(screen.getByTestId('right-width-value')).toHaveTextContent(String(EXPLORER_RIGHT_PANEL_MIN_WIDTH_PX));

    const rightHandleAfterMinClamp = screen.getByTestId('panel-handle-right');
    fireEvent.pointerDown(rightHandleAfterMinClamp, { clientX: 1200, pointerId: 4 });
    fireEvent.pointerMove(rightHandleAfterMinClamp, { clientX: 0, pointerId: 4 });
    fireEvent.pointerUp(rightHandleAfterMinClamp, { clientX: 0, pointerId: 4 });

    expect(screen.getByTestId('right-width-value')).toHaveTextContent(String(EXPLORER_RIGHT_PANEL_MAX_WIDTH_PX));
    expect(screen.getByTestId('left-width-value')).toHaveTextContent('340');
  });

  it('keeps a previously opened fixed right panel mounted when hidden and shown again', () => {
    let rightPanelMountCount = 0;

    function StatefulRightPanelContent() {
      const [instanceId] = useState(() => {
        rightPanelMountCount += 1;
        return rightPanelMountCount;
      });

      return <div data-testid="stateful-right-panel" data-instance-id={String(instanceId)}>Inspector</div>;
    }

    function FixedRightMountHarness() {
      const [leftWidth] = useState(280);
      const [showRight, setShowRight] = useState(true);

      return (
        <>
          <button type="button" onClick={() => setShowRight((current) => !current)}>toggle-right</button>
          <CodeWorkspaceShell
            activityBar={<div>Activity</div>}
            showLeftPanel={false}
            showBottomPanel={false}
            showRightPanel={showRight}
            leftPanelId="left"
            centerPanelId="center"
            topPanelId="top"
            bottomPanelId="bottom"
            rightPanelId="right"
            leftFixedWidthPx={leftWidth}
            onLeftFixedWidthChange={() => leftWidth}
            rightFixedWidthPx={EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX}
            onRightFixedWidthChange={() => EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX}
            leftContent={<div>Explorer</div>}
            topContent={<div>Editor</div>}
            bottomContent={<div>Terminal</div>}
            rightContent={<StatefulRightPanelContent />}
          />
        </>
      );
    }

    render(<FixedRightMountHarness />);

    expect(screen.getByTestId('stateful-right-panel')).toHaveAttribute('data-instance-id', '1');
    expect(rightPanelMountCount).toBe(1);

    fireEvent.click(screen.getByText('toggle-right'));

    expect(screen.getByTestId('panel-right')).toHaveStyle({ width: '0px' });
    expect(screen.getByTestId('panel-right')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('stateful-right-panel')).toHaveAttribute('data-instance-id', '1');
    expect(rightPanelMountCount).toBe(1);

    fireEvent.click(screen.getByText('toggle-right'));

    expect(screen.getByTestId('panel-right')).toHaveStyle({ width: '300px' });
    expect(screen.getByTestId('panel-right')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByTestId('stateful-right-panel')).toHaveAttribute('data-instance-id', '1');
    expect(rightPanelMountCount).toBe(1);
  });

  it('does not treat a non-fixed shell mount as a previously opened fixed right panel', () => {
    const { rerender } = render(
      <CodeWorkspaceShell
        activityBar={<div>Activity</div>}
        showLeftPanel={false}
        showBottomPanel
        showRightPanel
        leftPanelId="simulation-left"
        centerPanelId="simulation-center"
        topPanelId="simulation-top"
        bottomPanelId="simulation-bottom"
        rightPanelId="simulation-right"
        leftContent={<div>Simulation Left</div>}
        topContent={<div>Simulation Main</div>}
        bottomContent={<div>Simulation Bottom</div>}
        rightContent={<div>Simulation Right</div>}
      />,
    );

    expect(screen.getByTestId('panel-simulation-right')).toBeInTheDocument();

    rerender(
      <CodeWorkspaceShell
        activityBar={<div>Activity</div>}
        showLeftPanel={false}
        showBottomPanel={false}
        showRightPanel={false}
        leftPanelId="left"
        centerPanelId="center"
        topPanelId="top"
        bottomPanelId="bottom"
        rightPanelId="right"
        leftFixedWidthPx={280}
        onLeftFixedWidthChange={() => 280}
        rightFixedWidthPx={EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX}
        onRightFixedWidthChange={() => EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX}
        leftContent={<div>Explorer</div>}
        topContent={<div>Editor</div>}
        bottomContent={<div>Terminal</div>}
        rightContent={<div>Inspector</div>}
      />,
    );

    expect(screen.queryByTestId('panel-right')).not.toBeInTheDocument();
  });
});
