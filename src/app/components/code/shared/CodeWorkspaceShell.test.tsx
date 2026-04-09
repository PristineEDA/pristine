import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodeWorkspaceShell } from './CodeWorkspaceShell';

const panelRecords: Array<{ id?: string; collapsed?: boolean }> = [];
const handleRecords: Array<{ hidden?: boolean }> = [];

vi.mock('../../ui/resizable', () => ({
  ResizablePanelGroup: ({ children, orientation }: { children: React.ReactNode; orientation: string }) => (
    <div data-testid={`panel-group-${orientation}`}>{children}</div>
  ),
  ResizablePanel: ({ children, id, collapsed, panelRef }: { children: React.ReactNode; id?: string; collapsed?: boolean; panelRef?: { current: { resize: (size: number | `${number}%`) => void } | null } }) => {
    panelRecords.push({ id, collapsed });
    if (panelRef) {
      panelRef.current = collapsed ? null : { resize: vi.fn() };
    }

    return (
      <div data-testid={`panel-${id ?? 'unknown'}`} data-collapsed={collapsed ? 'true' : 'false'}>
        {children}
      </div>
    );
  },
  ResizableHandle: ({ hidden }: { hidden?: boolean }) => {
    handleRecords.push({ hidden });
    return <div data-testid="panel-handle" data-hidden={hidden ? 'true' : 'false'} />;
  },
}));

describe('CodeWorkspaceShell', () => {
  it('renders all visible regions and wires the container and left panel refs', () => {
    panelRecords.length = 0;
    handleRecords.length = 0;

    const containerRef = createRef<HTMLDivElement>();
    const leftPanelRef = createRef<{ resize: (size: number | `${number}%`) => void } | null>();

    render(
      <CodeWorkspaceShell
        shellTestId="workspace-shell"
        activityBar={<div>Activity</div>}
        overlay={<div>Overlay</div>}
        containerRef={containerRef}
        leftPanelRef={leftPanelRef}
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
    expect(containerRef.current).toBeInstanceOf(HTMLDivElement);
    expect(leftPanelRef.current).not.toBeNull();
    expect(panelRecords).toEqual([
      { id: 'left', collapsed: false },
      { id: 'center', collapsed: undefined },
      { id: 'top', collapsed: undefined },
      { id: 'bottom', collapsed: false },
      { id: 'right', collapsed: false },
    ]);
    expect(handleRecords).toEqual([
      { hidden: false },
      { hidden: false },
      { hidden: false },
    ]);
  });

  it('keeps hidden panel content out of the layout and marks the matching handles as hidden', () => {
    panelRecords.length = 0;
    handleRecords.length = 0;

    const leftPanelRef = createRef<{ resize: (size: number | `${number}%`) => void } | null>();

    render(
      <CodeWorkspaceShell
        activityBar={<div>Activity</div>}
        leftPanelRef={leftPanelRef}
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
    expect(leftPanelRef.current).toBeNull();
    expect(handleRecords).toEqual([
      { hidden: true },
      { hidden: true },
      { hidden: true },
    ]);
    expect(panelRecords).toEqual([
      { id: 'left', collapsed: true },
      { id: 'center', collapsed: undefined },
      { id: 'top', collapsed: undefined },
      { id: 'bottom', collapsed: true },
      { id: 'right', collapsed: true },
    ]);
  });
});