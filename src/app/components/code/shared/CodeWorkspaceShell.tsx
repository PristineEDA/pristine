import { ResizableHandle, ResizablePanel, ResizablePanelGroup, type PanelImperativeHandle } from '../../ui/resizable';

interface CodeWorkspaceShellProps {
  shellTestId?: string;
  activityBar: React.ReactNode;
  overlay?: React.ReactNode;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  leftPanelRef?: React.RefObject<PanelImperativeHandle | null>;
  showLeftPanel: boolean;
  showBottomPanel: boolean;
  showRightPanel: boolean;
  leftPanelId: string;
  centerPanelId: string;
  topPanelId: string;
  bottomPanelId: string;
  rightPanelId: string;
  leftContent: React.ReactNode;
  topContent: React.ReactNode;
  bottomContent: React.ReactNode;
  rightContent: React.ReactNode;
}

export function CodeWorkspaceShell({
  shellTestId,
  activityBar,
  overlay,
  containerRef,
  leftPanelRef,
  showLeftPanel,
  showBottomPanel,
  showRightPanel,
  leftPanelId,
  centerPanelId,
  topPanelId,
  bottomPanelId,
  rightPanelId,
  leftContent,
  topContent,
  bottomContent,
  rightContent,
}: CodeWorkspaceShellProps) {
  return (
    <div data-testid={shellTestId} className="flex flex-1 overflow-hidden">
      {activityBar}

      <div ref={containerRef} className="flex-1 min-w-0">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel panelRef={leftPanelRef} defaultSize={18} minSize={12} maxSize={35} id={leftPanelId} collapsed={!showLeftPanel}>
            {showLeftPanel ? leftContent : <div className="h-full" />}
          </ResizablePanel>

          <ResizableHandle hidden={!showLeftPanel} />

          <ResizablePanel defaultSize={55} minSize={30} id={centerPanelId}>
            <div className="relative h-full">
              {overlay}

              <ResizablePanelGroup orientation="vertical">
                <ResizablePanel defaultSize={60} minSize={25} id={topPanelId}>
                  {topContent}
                </ResizablePanel>

                <ResizableHandle hidden={!showBottomPanel} />
                <ResizablePanel defaultSize={40} minSize={15} maxSize={60} id={bottomPanelId} collapsed={!showBottomPanel}>
                  {showBottomPanel ? bottomContent : <div className="h-full" />}
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>

          <ResizableHandle hidden={!showRightPanel} />

          <ResizablePanel defaultSize={22} minSize={18} maxSize={45} id={rightPanelId} collapsed={!showRightPanel}>
            {showRightPanel ? rightContent : <div className="h-full" />}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}