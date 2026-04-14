import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../ui/resizable';

export const EXPLORER_LEFT_PANEL_DEFAULT_WIDTH_PX = 240;
export const EXPLORER_LEFT_PANEL_MIN_WIDTH_PX = 200;
export const EXPLORER_LEFT_PANEL_MAX_WIDTH_PX = 480;

function clampFixedLeftPanelWidth(width: number, minWidth: number, maxWidth: number) {
  return Math.min(Math.max(width, minWidth), maxWidth);
}

interface CodeWorkspaceShellProps {
  shellTestId?: string;
  activityBar: React.ReactNode;
  overlay?: React.ReactNode;
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
  leftFixedWidthPx?: number;
  onLeftFixedWidthChange?: React.Dispatch<React.SetStateAction<number>>;
  leftFixedMinWidthPx?: number;
  leftFixedMaxWidthPx?: number;
}

function FixedLeftPanelResizeHandle({
  hidden,
  onDelta,
  testId,
}: {
  hidden?: boolean;
  onDelta: (deltaPixels: number) => void;
  testId: string;
}) {
  const startPositionRef = useRef<number | null>(null);

  const endDrag = useCallback((pointerId?: number, target?: EventTarget | null) => {
    startPositionRef.current = null;
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');

    if (target instanceof HTMLElement && pointerId !== undefined) {
      target.releasePointerCapture?.(pointerId);
    }
  }, []);

  if (hidden) {
    return null;
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      data-slot="resizable-handle"
      data-testid={testId}
      className={cn(
        'relative flex h-full w-px shrink-0 cursor-col-resize items-center justify-center bg-border focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2',
      )}
      onPointerDown={(event) => {
        startPositionRef.current = event.clientX;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (startPositionRef.current === null) {
          return;
        }

        const deltaPixels = event.clientX - startPositionRef.current;
        onDelta(deltaPixels);
        startPositionRef.current = event.clientX;
      }}
      onPointerUp={(event) => endDrag(event.pointerId, event.currentTarget)}
      onPointerCancel={(event) => endDrag(event.pointerId, event.currentTarget)}
    />
  );
}

export function CodeWorkspaceShell({
  shellTestId,
  activityBar,
  overlay,
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
  leftFixedWidthPx,
  onLeftFixedWidthChange,
  leftFixedMinWidthPx,
  leftFixedMaxWidthPx,
}: CodeWorkspaceShellProps) {
  const hasFixedLeftPanel = typeof leftFixedWidthPx === 'number' && typeof onLeftFixedWidthChange === 'function';
  const fixedLeftMinWidth = leftFixedMinWidthPx ?? EXPLORER_LEFT_PANEL_MIN_WIDTH_PX;
  const fixedLeftMaxWidth = leftFixedMaxWidthPx ?? EXPLORER_LEFT_PANEL_MAX_WIDTH_PX;
  const clampedLeftFixedWidth = hasFixedLeftPanel
    ? clampFixedLeftPanelWidth(leftFixedWidthPx, fixedLeftMinWidth, fixedLeftMaxWidth)
    : null;

  const centerAndRightPanels = (
    <>
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
    </>
  );

  return (
    <div data-testid={shellTestId} className="flex flex-1 overflow-hidden">
      {activityBar}

      {hasFixedLeftPanel ? (
        <div className="flex flex-1 min-w-0">
          {showLeftPanel && clampedLeftFixedWidth !== null && (
            <div
              data-slot="resizable-panel"
              data-testid={`panel-${leftPanelId}`}
              data-panel-id={leftPanelId}
              className="min-h-0 shrink-0 overflow-hidden"
              style={{
                width: `${clampedLeftFixedWidth}px`,
                minWidth: `${clampedLeftFixedWidth}px`,
                maxWidth: `${clampedLeftFixedWidth}px`,
                flexBasis: `${clampedLeftFixedWidth}px`,
                flexGrow: 0,
                flexShrink: 0,
              }}
            >
              {leftContent}
            </div>
          )}

          <FixedLeftPanelResizeHandle
            hidden={!showLeftPanel}
            testId={`panel-handle-${leftPanelId}`}
            onDelta={(deltaPixels) => {
              onLeftFixedWidthChange?.((currentWidth) => clampFixedLeftPanelWidth(
                currentWidth + deltaPixels,
                fixedLeftMinWidth,
                fixedLeftMaxWidth,
              ));
            }}
          />

          <div className="flex-1 min-w-0">
            <ResizablePanelGroup orientation="horizontal">
              {centerAndRightPanels}
            </ResizablePanelGroup>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize={18} minSize={12} maxSize={35} id={leftPanelId} collapsed={!showLeftPanel}>
              {showLeftPanel ? leftContent : <div className="h-full" />}
            </ResizablePanel>

            <ResizableHandle hidden={!showLeftPanel} />

            {centerAndRightPanels}
          </ResizablePanelGroup>
        </div>
      )}
    </div>
  );
}