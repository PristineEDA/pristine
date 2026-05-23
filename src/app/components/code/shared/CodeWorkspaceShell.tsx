import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  EXPLORER_LEFT_PANEL_MAX_WIDTH_PX,
  EXPLORER_LEFT_PANEL_MIN_WIDTH_PX,
  EXPLORER_RIGHT_PANEL_MAX_WIDTH_PX,
  EXPLORER_RIGHT_PANEL_MIN_WIDTH_PX,
} from './codeWorkspaceLayout';
import { useCodeViewerLayout } from '../../../context/CodeViewerLayoutContext';
import {
  getCodeWorkspaceBodyClassName,
  getCodeWorkspaceCenterColumnClassName,
  getCodeWorkspacePanelFrameClassName,
  getCodeWorkspacePanelGroupClassName,
  getCodeWorkspacePanelGroupLayoutGapPx,
  getCodeWorkspaceResizeHandleClassName,
  getCodeWorkspaceShellClassName,
} from './codeViewerLayoutStyles';
import {
  PANEL_TRANSITION_DURATION_MS,
  type PanelImperativeHandle,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../../ui/resizable';

export {
  EXPLORER_LEFT_PANEL_DEFAULT_WIDTH_PX,
  EXPLORER_LEFT_PANEL_MAX_WIDTH_PX,
  EXPLORER_LEFT_PANEL_MIN_WIDTH_PX,
  EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX,
  EXPLORER_RIGHT_PANEL_MAX_WIDTH_PX,
  EXPLORER_RIGHT_PANEL_MIN_WIDTH_PX,
} from './codeWorkspaceLayout';

const FIXED_PANEL_TRANSITION_STYLE = {
  transitionDuration: `${PANEL_TRANSITION_DURATION_MS}ms`,
  transitionProperty: 'width, min-width, max-width, flex-basis',
} satisfies React.CSSProperties;

const BOTTOM_PANEL_DEFAULT_SIZE = 40;
const BOTTOM_PANEL_TOP_DEFAULT_SIZE = 60;
const BOTTOM_PANEL_MIN_SIZE = 15;
const BOTTOM_PANEL_MAX_SIZE = 100;
const BOTTOM_PANEL_LEGACY_MAX_SIZE = 60;
const BOTTOM_PANEL_MAX_SNAP_THRESHOLD = 92;
const BOTTOM_PANEL_HIDE_SNAP_THRESHOLD = 16;
const BOTTOM_PANEL_MAXIMIZED_THRESHOLD = 99;

export interface CodeWorkspaceBottomPanelControls {
  isMaximized: boolean;
  onMaximizeToggle: () => void;
}

type CodeWorkspaceBottomContent = React.ReactNode | ((controls: CodeWorkspaceBottomPanelControls) => React.ReactNode);

function clampFixedPanelWidth(width: number, minWidth: number, maxWidth: number) {
  return Math.min(Math.max(width, minWidth), maxWidth);
}

type AnimatedPresencePhase = 'hidden' | 'entering' | 'visible' | 'exiting';

function useAnimatedPanelPresence(isVisible: boolean) {
  const [phase, setPhase] = useState<AnimatedPresencePhase>(() => (isVisible ? 'visible' : 'hidden'));
  const enterTimeoutRef = useRef<number | null>(null);
  const exitTimeoutRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (enterTimeoutRef.current !== null) {
      window.clearTimeout(enterTimeoutRef.current);
      enterTimeoutRef.current = null;
    }

    if (exitTimeoutRef.current !== null) {
      window.clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }

    if (isVisible) {
      setPhase((currentPhase) => {
        if (currentPhase === 'hidden') {
          enterTimeoutRef.current = window.setTimeout(() => {
            setPhase('visible');
            enterTimeoutRef.current = null;
          }, 0);

          return 'entering';
        }

        return 'visible';
      });

      return () => {
        if (enterTimeoutRef.current !== null) {
          window.clearTimeout(enterTimeoutRef.current);
          enterTimeoutRef.current = null;
        }
      };
    }

    setPhase((currentPhase) => {
      if (currentPhase === 'hidden') {
        return currentPhase;
      }

      exitTimeoutRef.current = window.setTimeout(() => {
        setPhase('hidden');
        exitTimeoutRef.current = null;
      }, PANEL_TRANSITION_DURATION_MS);

      return 'exiting';
    });

    return () => {
      if (enterTimeoutRef.current !== null) {
        window.clearTimeout(enterTimeoutRef.current);
        enterTimeoutRef.current = null;
      }

      if (exitTimeoutRef.current !== null) {
        window.clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
    };
  }, [isVisible]);

  return {
    isExpanded: phase === 'visible',
    shouldRender: phase !== 'hidden',
  };
}

function useAnimatedPanelExpansion(isVisible: boolean, shouldRender: boolean) {
  const [isExpanded, setIsExpanded] = useState(() => isVisible);
  const previousShouldRenderRef = useRef(shouldRender);
  const enterTimeoutRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (enterTimeoutRef.current !== null) {
      window.clearTimeout(enterTimeoutRef.current);
      enterTimeoutRef.current = null;
    }

    const wasRendered = previousShouldRenderRef.current;
    previousShouldRenderRef.current = shouldRender;

    if (!shouldRender) {
      setIsExpanded(false);
      return;
    }

    if (!isVisible) {
      setIsExpanded(false);
      return;
    }

    if (isExpanded) {
      return;
    }

    if (wasRendered) {
      setIsExpanded(true);
      return;
    }

    enterTimeoutRef.current = window.setTimeout(() => {
      setIsExpanded(true);
      enterTimeoutRef.current = null;
    }, 0);

    return () => {
      if (enterTimeoutRef.current !== null) {
        window.clearTimeout(enterTimeoutRef.current);
        enterTimeoutRef.current = null;
      }
    };
  }, [isVisible, shouldRender]);

  return isExpanded;
}

interface CodeWorkspaceShellProps {
  shellTestId?: string;
  activityBar: React.ReactNode;
  overlay?: React.ReactNode;
  useLeftPanelFrame?: boolean;
  useRightPanelFrame?: boolean;
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
  bottomContent: CodeWorkspaceBottomContent;
  rightContent: React.ReactNode;
  enableBottomPanelMaximize?: boolean;
  onBottomPanelAutoHide?: () => void;
  leftFixedWidthPx?: number;
  onLeftFixedWidthChange?: React.Dispatch<React.SetStateAction<number>>;
  leftFixedMinWidthPx?: number;
  leftFixedMaxWidthPx?: number;
  rightFixedWidthPx?: number;
  onRightFixedWidthChange?: React.Dispatch<React.SetStateAction<number>>;
  rightFixedMinWidthPx?: number;
  rightFixedMaxWidthPx?: number;
}

function FixedPanelResizeHandle({
  className,
  hidden,
  onDelta,
  testId,
}: {
  className?: string;
  hidden?: boolean;
  onDelta: (deltaPixels: number) => void;
  testId: string;
}) {
  const startPositionRef = useRef<number | null>(null);
  const isOverlayHandle = className?.includes('overlay-handle') ?? false;

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
        'relative flex h-full shrink-0 cursor-ew-resize items-center justify-center bg-border focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1',
        isOverlayHandle
          ? 'w-0 overflow-visible -mx-[5px] z-10 after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2'
          : 'w-px after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2',
        className,
      )}
      onPointerDown={(event) => {
        startPositionRef.current = event.clientX;
        document.body.style.cursor = 'ew-resize';
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
  useLeftPanelFrame = true,
  useRightPanelFrame = true,
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
  enableBottomPanelMaximize = false,
  onBottomPanelAutoHide,
  leftFixedWidthPx,
  onLeftFixedWidthChange,
  leftFixedMinWidthPx,
  leftFixedMaxWidthPx,
  rightFixedWidthPx,
  onRightFixedWidthChange,
  rightFixedMinWidthPx,
  rightFixedMaxWidthPx,
}: CodeWorkspaceShellProps) {
  const { layoutMode } = useCodeViewerLayout();
  const hasFixedLeftPanel = typeof leftFixedWidthPx === 'number' && typeof onLeftFixedWidthChange === 'function';
  const hasFixedRightPanel = typeof rightFixedWidthPx === 'number' && typeof onRightFixedWidthChange === 'function';
  const leftPanelPresence = useAnimatedPanelPresence(showLeftPanel);
  const bottomPanelPresence = useAnimatedPanelPresence(showBottomPanel);
  const rightPanelPresence = useAnimatedPanelPresence(showRightPanel);
  const bottomPanelRef = useRef<PanelImperativeHandle | null>(null);
  const bottomPanelSizeRef = useRef(BOTTOM_PANEL_DEFAULT_SIZE);
  const lastNonMaximizedBottomPanelSizeRef = useRef(BOTTOM_PANEL_DEFAULT_SIZE);
  const [isBottomPanelMaximized, setIsBottomPanelMaximized] = useState(false);
  const fixedRightPanelWasOpenedRef = useRef(hasFixedRightPanel && showRightPanel);
  const fixedLeftMinWidth = leftFixedMinWidthPx ?? EXPLORER_LEFT_PANEL_MIN_WIDTH_PX;
  const fixedLeftMaxWidth = leftFixedMaxWidthPx ?? EXPLORER_LEFT_PANEL_MAX_WIDTH_PX;
  const fixedRightMinWidth = rightFixedMinWidthPx ?? EXPLORER_RIGHT_PANEL_MIN_WIDTH_PX;
  const fixedRightMaxWidth = rightFixedMaxWidthPx ?? EXPLORER_RIGHT_PANEL_MAX_WIDTH_PX;
  const clampedLeftFixedWidth = hasFixedLeftPanel
    ? clampFixedPanelWidth(leftFixedWidthPx, fixedLeftMinWidth, fixedLeftMaxWidth)
    : null;
  const clampedRightFixedWidth = hasFixedRightPanel
    ? clampFixedPanelWidth(rightFixedWidthPx, fixedRightMinWidth, fixedRightMaxWidth)
    : null;
  const panelGroupLayoutGapPx = getCodeWorkspacePanelGroupLayoutGapPx(layoutMode);

  if (hasFixedRightPanel && showRightPanel) {
    fixedRightPanelWasOpenedRef.current = true;
  }

  const shouldRenderFixedRightPanel = hasFixedRightPanel
    && (showRightPanel || fixedRightPanelWasOpenedRef.current);
  const isFixedRightPanelExpanded = useAnimatedPanelExpansion(showRightPanel, shouldRenderFixedRightPanel);
  const leftPanelClassName = useLeftPanelFrame
    ? getCodeWorkspacePanelFrameClassName(layoutMode)
    : 'min-h-0 overflow-hidden';
  const fixedLeftPanelClassName = useLeftPanelFrame
    ? getCodeWorkspacePanelFrameClassName(layoutMode, 'shrink-0')
    : 'min-h-0 overflow-hidden shrink-0';
  const rightPanelClassName = useRightPanelFrame
    ? getCodeWorkspacePanelFrameClassName(layoutMode)
    : 'min-h-0 overflow-hidden';
  const fixedRightPanelClassName = useRightPanelFrame
    ? getCodeWorkspacePanelFrameClassName(layoutMode, 'shrink-0')
    : 'min-h-0 overflow-hidden shrink-0';

  useLayoutEffect(() => {
    if (!showBottomPanel) {
      setIsBottomPanelMaximized(false);
    }
  }, [showBottomPanel]);

  const handleBottomPanelSizeChange = useCallback((size: number) => {
    bottomPanelSizeRef.current = size;

    const nextIsMaximized = size >= BOTTOM_PANEL_MAXIMIZED_THRESHOLD;
    setIsBottomPanelMaximized((currentValue) => (currentValue === nextIsMaximized ? currentValue : nextIsMaximized));

    if (!nextIsMaximized && size > BOTTOM_PANEL_HIDE_SNAP_THRESHOLD) {
      lastNonMaximizedBottomPanelSizeRef.current = Math.min(Math.max(size, BOTTOM_PANEL_MIN_SIZE), BOTTOM_PANEL_MAX_SNAP_THRESHOLD - 1);
    }
  }, []);

  const handleBottomPanelAutoHide = useCallback(() => {
    setIsBottomPanelMaximized(false);
    onBottomPanelAutoHide?.();
  }, [onBottomPanelAutoHide]);

  const handleBottomPanelMaxSnap = useCallback(() => {
    setIsBottomPanelMaximized(true);
  }, []);

  const handleBottomPanelMaximizeToggle = useCallback(() => {
    if (!enableBottomPanelMaximize) {
      return;
    }

    const bottomPanel = bottomPanelRef.current;

    if (!bottomPanel) {
      return;
    }

    if (isBottomPanelMaximized) {
      setIsBottomPanelMaximized(false);
      bottomPanel.resize(lastNonMaximizedBottomPanelSizeRef.current);
      return;
    }

    const currentSize = bottomPanelSizeRef.current;
    if (currentSize > BOTTOM_PANEL_HIDE_SNAP_THRESHOLD && currentSize < BOTTOM_PANEL_MAXIMIZED_THRESHOLD) {
      lastNonMaximizedBottomPanelSizeRef.current = currentSize;
    }

    setIsBottomPanelMaximized(true);
    bottomPanel.resize(BOTTOM_PANEL_MAX_SIZE);
  }, [enableBottomPanelMaximize, isBottomPanelMaximized]);

  const bottomPanelControls = {
    isMaximized: isBottomPanelMaximized,
    onMaximizeToggle: handleBottomPanelMaximizeToggle,
  } satisfies CodeWorkspaceBottomPanelControls;
  const renderedBottomContent = typeof bottomContent === 'function'
    ? bottomContent(bottomPanelControls)
    : bottomContent;
  const bottomPanelSnap = enableBottomPanelMaximize
    ? {
      minThreshold: BOTTOM_PANEL_HIDE_SNAP_THRESHOLD,
      maxThreshold: BOTTOM_PANEL_MAX_SNAP_THRESHOLD,
      maxSize: BOTTOM_PANEL_MAX_SIZE,
      onMinSnap: handleBottomPanelAutoHide,
      onMaxSnap: handleBottomPanelMaxSnap,
    }
    : undefined;

  const centerPanelContent = (
    <div className="relative h-full">
      {overlay}

      <ResizablePanelGroup orientation="vertical" layoutGapPx={panelGroupLayoutGapPx} className={getCodeWorkspacePanelGroupClassName(layoutMode)}>
        <ResizablePanel
          defaultSize={BOTTOM_PANEL_TOP_DEFAULT_SIZE}
          minSize={enableBottomPanelMaximize ? 0 : 25}
          id={topPanelId}
          className={getCodeWorkspacePanelFrameClassName(layoutMode)}
        >
          {topContent}
        </ResizablePanel>

        <ResizableHandle hidden={!showBottomPanel} className={getCodeWorkspaceResizeHandleClassName(layoutMode)} />
        <ResizablePanel
          defaultSize={BOTTOM_PANEL_DEFAULT_SIZE}
          minSize={BOTTOM_PANEL_MIN_SIZE}
          maxSize={enableBottomPanelMaximize ? BOTTOM_PANEL_MAX_SIZE : BOTTOM_PANEL_LEGACY_MAX_SIZE}
          id={bottomPanelId}
          collapsed={!showBottomPanel}
          panelRef={enableBottomPanelMaximize ? bottomPanelRef : undefined}
          onSizeChange={enableBottomPanelMaximize ? handleBottomPanelSizeChange : undefined}
          snap={bottomPanelSnap}
          data-bottom-panel-maximized={enableBottomPanelMaximize ? String(isBottomPanelMaximized) : undefined}
          className={getCodeWorkspacePanelFrameClassName(layoutMode)}
        >
          {bottomPanelPresence.shouldRender ? renderedBottomContent : <div className="h-full" />}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );

  const centerAndRightPanels = (
    <>
      <ResizablePanel defaultSize={55} minSize={30} id={centerPanelId}>
        {centerPanelContent}
      </ResizablePanel>

      <ResizableHandle hidden={!showRightPanel} className={getCodeWorkspaceResizeHandleClassName(layoutMode)} />

      <ResizablePanel
        defaultSize={22}
        minSizePx={EXPLORER_RIGHT_PANEL_MIN_WIDTH_PX}
        maxSizePx={EXPLORER_RIGHT_PANEL_MAX_WIDTH_PX}
        id={rightPanelId}
        collapsed={!showRightPanel}
        className={rightPanelClassName}
      >
        {rightPanelPresence.shouldRender ? rightContent : <div className="h-full" />}
      </ResizablePanel>
    </>
  );

  return (
    <div data-testid={shellTestId} data-code-viewer-layout-mode={layoutMode} className={getCodeWorkspaceShellClassName(layoutMode)}>
      {activityBar}

      {hasFixedLeftPanel ? (
        <div className={getCodeWorkspaceBodyClassName(layoutMode)}>
          {leftPanelPresence.shouldRender && clampedLeftFixedWidth !== null && (
            <div
              data-slot="resizable-panel"
              data-testid={`panel-${leftPanelId}`}
              data-panel-id={leftPanelId}
              aria-hidden={showLeftPanel ? 'false' : 'true'}
              className={cn(
                fixedLeftPanelClassName,
                !showLeftPanel && 'pointer-events-none select-none',
              )}
              style={{
                width: `${leftPanelPresence.isExpanded ? clampedLeftFixedWidth : 0}px`,
                minWidth: `${leftPanelPresence.isExpanded ? clampedLeftFixedWidth : 0}px`,
                maxWidth: `${leftPanelPresence.isExpanded ? clampedLeftFixedWidth : 0}px`,
                flexBasis: `${leftPanelPresence.isExpanded ? clampedLeftFixedWidth : 0}px`,
                flexGrow: 0,
                flexShrink: 0,
                ...FIXED_PANEL_TRANSITION_STYLE,
              }}
            >
              {leftContent}
            </div>
          )}

          <FixedPanelResizeHandle
            className={getCodeWorkspaceResizeHandleClassName(layoutMode)}
            hidden={!showLeftPanel}
            testId={`panel-handle-${leftPanelId}`}
            onDelta={(deltaPixels) => {
              onLeftFixedWidthChange?.((currentWidth) => clampFixedPanelWidth(
                currentWidth + deltaPixels,
                fixedLeftMinWidth,
                fixedLeftMaxWidth,
              ));
            }}
          />

          {hasFixedRightPanel ? (
            <>
              <div className={getCodeWorkspaceCenterColumnClassName(layoutMode)}>
                <ResizablePanelGroup orientation="horizontal" layoutGapPx={panelGroupLayoutGapPx} className={getCodeWorkspacePanelGroupClassName(layoutMode)}>
                  <ResizablePanel defaultSize={100} minSize={30} id={centerPanelId}>
                    {centerPanelContent}
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>

              <FixedPanelResizeHandle
                className={getCodeWorkspaceResizeHandleClassName(layoutMode)}
                hidden={!showRightPanel}
                testId={`panel-handle-${rightPanelId}`}
                onDelta={(deltaPixels) => {
                  onRightFixedWidthChange?.((currentWidth) => clampFixedPanelWidth(
                    currentWidth - deltaPixels,
                    fixedRightMinWidth,
                    fixedRightMaxWidth,
                  ));
                }}
              />

              {shouldRenderFixedRightPanel && clampedRightFixedWidth !== null && (
                <div
                  data-slot="resizable-panel"
                  data-testid={`panel-${rightPanelId}`}
                  data-panel-id={rightPanelId}
                  aria-hidden={showRightPanel ? 'false' : 'true'}
                  className={cn(
                    fixedRightPanelClassName,
                    !showRightPanel && 'pointer-events-none select-none',
                  )}
                  style={{
                    width: `${isFixedRightPanelExpanded ? clampedRightFixedWidth : 0}px`,
                    minWidth: `${isFixedRightPanelExpanded ? clampedRightFixedWidth : 0}px`,
                    maxWidth: `${isFixedRightPanelExpanded ? clampedRightFixedWidth : 0}px`,
                    flexBasis: `${isFixedRightPanelExpanded ? clampedRightFixedWidth : 0}px`,
                    flexGrow: 0,
                    flexShrink: 0,
                    ...FIXED_PANEL_TRANSITION_STYLE,
                  }}
                >
                  {rightContent}
                </div>
              )}
            </>
          ) : (
            <div className={getCodeWorkspaceCenterColumnClassName(layoutMode)}>
              <ResizablePanelGroup orientation="horizontal" layoutGapPx={panelGroupLayoutGapPx} className={getCodeWorkspacePanelGroupClassName(layoutMode)}>
                {centerAndRightPanels}
              </ResizablePanelGroup>
            </div>
          )}
        </div>
      ) : (
        <div className={getCodeWorkspaceCenterColumnClassName(layoutMode)}>
          <ResizablePanelGroup orientation="horizontal" layoutGapPx={panelGroupLayoutGapPx} className={getCodeWorkspacePanelGroupClassName(layoutMode)}>
            <ResizablePanel defaultSize={18} minSize={12} maxSize={35} id={leftPanelId} collapsed={!showLeftPanel} className={leftPanelClassName}>
              {leftPanelPresence.shouldRender ? leftContent : <div className="h-full" />}
            </ResizablePanel>

            <ResizableHandle hidden={!showLeftPanel} className={getCodeWorkspaceResizeHandleClassName(layoutMode)} />

            {centerAndRightPanels}
          </ResizablePanelGroup>
        </div>
      )}
    </div>
  );
}
