import * as React from 'react';
import { GripVerticalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Orientation = 'horizontal' | 'vertical';

export interface PanelImperativeHandle {
  resize: (size: number | `${number}%`) => void;
}

interface ResizablePanelGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  orientation: Orientation;
}

interface ResizablePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  id?: string;
  panelRef?: React.Ref<PanelImperativeHandle | null>;
  collapsed?: boolean;
}

interface ResizableHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  withHandle?: boolean;
  hidden?: boolean;
}

interface PanelItem {
  key: string;
  props: ResizablePanelProps;
}

function flattenChildren(children: React.ReactNode): React.ReactElement[] {
  const result: React.ReactElement[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      return;
    }

    if (child.type === React.Fragment) {
      const fragmentChild = child as React.ReactElement<{ children?: React.ReactNode }>;
      result.push(...flattenChildren(fragmentChild.props.children));
      return;
    }

    result.push(child);
  });

  return result;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPanel(panels: PanelItem[], index: number) {
  const panel = panels[index];
  if (!panel) {
    throw new Error(`Resizable panel at index ${index} was not found.`);
  }

  return panel;
}

function getSize(sizes: number[], index: number) {
  return sizes[index] ?? 0;
}

function getPanelMinSize(panel: PanelItem) {
  return panel.props.minSize ?? 0;
}

function getPanelMaxSize(panel: PanelItem) {
  return panel.props.maxSize ?? 100;
}

function distributeRemainingSpace(
  panels: PanelItem[],
  previousSizes: number[],
  fixedIndex: number,
  fixedSize: number,
) {
  if (panels.length === 1) {
    return [100];
  }

  const next = panels.map((panel, index) => (index === fixedIndex ? fixedSize : getPanelMinSize(panel)));
  const otherIndices = panels.map((_, index) => index).filter((index) => index !== fixedIndex);
  let remaining = 100 - fixedSize - otherIndices.reduce((sum, index) => sum + getPanelMinSize(getPanel(panels, index)), 0);

  let adjustable = otherIndices.filter((index) => getSize(next, index) < getPanelMaxSize(getPanel(panels, index)));

  while (remaining > 0.001 && adjustable.length > 0) {
    const weights = adjustable.map((index) => Math.max(getSize(previousSizes, index) - getPanelMinSize(getPanel(panels, index)), 0.01));
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);

    if (totalWeight <= 0) {
      const equalShare = remaining / adjustable.length;
      let consumed = 0;

      adjustable.forEach((index) => {
        const available = getPanelMaxSize(getPanel(panels, index)) - getSize(next, index);
        const addition = Math.min(equalShare, available);
        next[index] = getSize(next, index) + addition;
        consumed += addition;
      });

      if (consumed <= 0.001) {
        break;
      }

      remaining -= consumed;
    } else {
      let consumed = 0;

      adjustable.forEach((index, weightIndex) => {
        const available = getPanelMaxSize(getPanel(panels, index)) - getSize(next, index);
        const desired = remaining * ((weights[weightIndex] ?? 0) / totalWeight);
        const addition = Math.min(desired, available);
        next[index] = getSize(next, index) + addition;
        consumed += addition;
      });

      if (consumed <= 0.001) {
        break;
      }

      remaining -= consumed;
    }

    adjustable = adjustable.filter((index) => getSize(next, index) < getPanelMaxSize(getPanel(panels, index)) - 0.001);
  }

  if (remaining > 0.001) {
    next[fixedIndex] = getSize(next, fixedIndex) + remaining;
  }

  return next;
}

function buildInitialSizes(panels: PanelItem[]) {
  if (panels.length === 0) {
    return [];
  }

  if (panels.length === 1) {
    return [100];
  }

  const sizes = panels.map((panel) => panel.props.defaultSize ?? 0);
  const explicitIndices = sizes
    .map((_, index) => (panelHasExplicitDefault(getPanel(panels, index)) ? index : -1))
    .filter((index) => index >= 0);
  const unspecifiedIndices = sizes
    .map((_, index) => (!panelHasExplicitDefault(getPanel(panels, index)) ? index : -1))
    .filter((index) => index >= 0);
  const total = sizes.reduce((sum, size) => sum + size, 0);

  if (total <= 0) {
    return panels.map(() => 100 / panels.length);
  }

  if (total < 100) {
    const remaining = 100 - total;

    if (unspecifiedIndices.length > 0) {
      const extraPerPanel = remaining / unspecifiedIndices.length;
      unspecifiedIndices.forEach((index) => {
        sizes[index] = getSize(sizes, index) + extraPerPanel;
      });
    } else {
      const largestIndex = explicitIndices.reduce((currentLargest, index) => (
        getSize(sizes, index) > getSize(sizes, currentLargest) ? index : currentLargest
      ), explicitIndices[0] ?? 0);

      sizes[largestIndex] = getSize(sizes, largestIndex) + remaining;
    }
  }

  if (total > 100) {
    const scale = 100 / total;
    return sizes.map((size) => size * scale);
  }

  return sizes;
}

function panelHasExplicitDefault(panel: PanelItem) {
  return typeof panel.props.defaultSize === 'number';
}

function normalizeSizes(sizes: number[]) {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (total <= 0) {
    return sizes;
  }

  return sizes.map((size) => (size / total) * 100);
}

function resizePanelByIndex(
  panels: PanelItem[],
  previousSizes: number[],
  panelIndex: number,
  requestedSize: number,
) {
  const panel = getPanel(panels, panelIndex);
  const otherPanels = panels.filter((_, index) => index !== panelIndex);
  const minimumTarget = Math.max(
    getPanelMinSize(panel),
    100 - otherPanels.reduce((sum, otherPanel) => sum + getPanelMaxSize(otherPanel), 0),
  );
  const maximumTarget = Math.min(
    getPanelMaxSize(panel),
    100 - otherPanels.reduce((sum, otherPanel) => sum + getPanelMinSize(otherPanel), 0),
  );
  const nextSize = clamp(requestedSize, minimumTarget, maximumTarget);

  return normalizeSizes(distributeRemainingSpace(panels, previousSizes, panelIndex, nextSize));
}

function adjustAdjacentSizes(
  panels: PanelItem[],
  previousSizes: number[],
  leftIndex: number,
  rightIndex: number,
  deltaSize: number,
) {
  const leftPanel = getPanel(panels, leftIndex);
  const rightPanel = getPanel(panels, rightIndex);
  const minDelta = Math.max(
    getPanelMinSize(leftPanel) - getSize(previousSizes, leftIndex),
    getSize(previousSizes, rightIndex) - getPanelMaxSize(rightPanel),
  );
  const maxDelta = Math.min(
    getPanelMaxSize(leftPanel) - getSize(previousSizes, leftIndex),
    getSize(previousSizes, rightIndex) - getPanelMinSize(rightPanel),
  );
  const clampedDelta = clamp(deltaSize, minDelta, maxDelta);

  if (Math.abs(clampedDelta) <= 0.001) {
    return previousSizes;
  }

  const next = [...previousSizes];
  next[leftIndex] = getSize(next, leftIndex) + clampedDelta;
  next[rightIndex] = getSize(next, rightIndex) - clampedDelta;
  return normalizeSizes(next);
}

function setPanelRefValue(panelRef: ResizablePanelProps['panelRef'], value: PanelImperativeHandle | null) {
  if (!panelRef) {
    return;
  }

  if (typeof panelRef === 'function') {
    panelRef(value);
    return;
  }

  panelRef.current = value;
}

function ResizablePanelGroup({
  children,
  className,
  orientation,
  ...props
}: ResizablePanelGroupProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const flattenedChildren = React.useMemo(() => flattenChildren(children), [children]);
  const sequence = React.useMemo(() => flattenedChildren.map((child, index) => {
    if (child.type === ResizablePanel) {
      return {
        kind: 'panel' as const,
        key: String(child.key ?? `panel-${index}`),
        props: child.props as ResizablePanelProps,
      };
    }

    return {
      kind: 'handle' as const,
      key: String(child.key ?? `handle-${index}`),
      props: child.props as ResizableHandleProps,
    };
  }), [flattenedChildren]);
  const visiblePanels = React.useMemo(
    () => sequence.filter((item): item is PanelItem & { kind: 'panel' } => item.kind === 'panel' && !item.props.collapsed),
    [sequence],
  );
  const visibleSignature = React.useMemo(
    () => visiblePanels.map((panel) => `${panel.props.id ?? panel.key}:${panel.props.defaultSize ?? 'auto'}:${panel.props.minSize ?? 0}:${panel.props.maxSize ?? 100}`).join('|'),
    [visiblePanels],
  );
  const [sizes, setSizes] = React.useState<number[]>(() => buildInitialSizes(visiblePanels));

  React.useEffect(() => {
    setSizes(buildInitialSizes(visiblePanels));
  }, [visibleSignature]);

  React.useEffect(() => {
    sequence.forEach((item) => {
      if (item.kind === 'panel' && item.props.collapsed) {
        setPanelRefValue(item.props.panelRef, null);
      }
    });

    visiblePanels.forEach((panel, index) => {
      setPanelRefValue(panel.props.panelRef, {
        resize: (value) => {
          const nextRequestedSize = typeof value === 'string' ? Number.parseFloat(value) : value;
          if (!Number.isFinite(nextRequestedSize)) {
            return;
          }

          setSizes((currentSizes) => resizePanelByIndex(visiblePanels, currentSizes, index, nextRequestedSize));
        },
      });
    });

    return () => {
      sequence.forEach((item) => {
        if (item.kind === 'panel') {
          setPanelRefValue(item.props.panelRef, null);
        }
      });
    };
  }, [sequence, visiblePanels]);

  const panelIndexByKey = React.useMemo(() => {
    const next = new Map<string, number>();
    visiblePanels.forEach((panel, index) => {
      next.set(panel.key, index);
    });
    return next;
  }, [visiblePanels]);

  const renderItems: React.ReactNode[] = [];

  sequence.forEach((item, index) => {
    if (item.kind === 'panel') {
      const panelIndex = panelIndexByKey.get(item.key);
      if (panelIndex === undefined) {
        return;
      }

      renderItems.push(
        <div
          key={item.key}
          data-slot="resizable-panel"
          data-testid={item.props.id ? `panel-${item.props.id}` : undefined}
          data-panel-id={item.props.id}
          className={cn('min-h-0 min-w-0 overflow-hidden', item.props.className)}
          style={{
            flexBasis: `${sizes[panelIndex] ?? 0}%`,
            flexGrow: 0,
            flexShrink: 0,
          }}
        >
          {item.props.children}
        </div>,
      );

      return;
    }

    if (item.props.hidden) {
      return;
    }

    const previousVisiblePanel = [...sequence.slice(0, index)].reverse().find(
      (candidate): candidate is PanelItem & { kind: 'panel' } => candidate.kind === 'panel' && !candidate.props.collapsed,
    );
    const nextVisiblePanel = sequence.slice(index + 1).find(
      (candidate): candidate is PanelItem & { kind: 'panel' } => candidate.kind === 'panel' && !candidate.props.collapsed,
    );

    if (!previousVisiblePanel || !nextVisiblePanel) {
      return;
    }

    const leftIndex = panelIndexByKey.get(previousVisiblePanel.key);
    const rightIndex = panelIndexByKey.get(nextVisiblePanel.key);

    if (leftIndex === undefined || rightIndex === undefined) {
      return;
    }

    renderItems.push(
      <ResizableHandleView
        key={item.key}
        orientation={orientation}
        handleProps={item.props}
        onDelta={(deltaPixels) => {
          const containerRect = containerRef.current?.getBoundingClientRect();
          const containerSize = orientation === 'horizontal' ? containerRect?.width ?? 0 : containerRect?.height ?? 0;
          if (containerSize <= 0) {
            return;
          }

          const deltaSize = (deltaPixels / containerSize) * 100;
          setSizes((currentSizes) => adjustAdjacentSizes(visiblePanels, currentSizes, leftIndex, rightIndex, deltaSize));
        }}
      />,
    );
  });

  return (
    <div
      ref={containerRef}
      data-slot="resizable-panel-group"
      aria-orientation={orientation}
      className={cn(
        'flex h-full w-full min-h-0 min-w-0',
        orientation === 'vertical' && 'flex-col',
        className,
      )}
      {...props}
    >
      {renderItems}
    </div>
  );
}

function ResizableHandleView({
  orientation,
  handleProps,
  onDelta,
}: {
  orientation: Orientation;
  handleProps: ResizableHandleProps;
  onDelta: (deltaPixels: number) => void;
}) {
  const { className, withHandle, children, ...props } = handleProps;
  const startPositionRef = React.useRef<number | null>(null);

  const endDrag = React.useCallback((pointerId?: number, target?: EventTarget | null) => {
    startPositionRef.current = null;
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');

    if (target instanceof HTMLElement && pointerId !== undefined) {
      target.releasePointerCapture?.(pointerId);
    }
  }, []);

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
      data-slot="resizable-handle"
      className={cn(
        'relative flex shrink-0 items-center justify-center bg-border focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1',
        orientation === 'horizontal'
          ? 'h-full w-px cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2'
          : 'h-px w-full cursor-row-resize after:absolute after:left-0 after:top-1/2 after:h-1 after:w-full after:-translate-y-1/2',
        className,
      )}
      onPointerDown={(event) => {
        startPositionRef.current = orientation === 'horizontal' ? event.clientX : event.clientY;
        document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (startPositionRef.current === null) {
          return;
        }

        const nextPosition = orientation === 'horizontal' ? event.clientX : event.clientY;
        onDelta(nextPosition - startPositionRef.current);
        startPositionRef.current = nextPosition;
      }}
      onPointerUp={(event) => endDrag(event.pointerId, event.currentTarget)}
      onPointerCancel={(event) => endDrag(event.pointerId, event.currentTarget)}
      {...props}
    >
      {withHandle ? (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border">
          <GripVerticalIcon className={cn('size-2.5', orientation === 'vertical' && 'rotate-90')} />
        </div>
      ) : children}
    </div>
  );
}

function ResizablePanel({ children }: ResizablePanelProps) {
  return <>{children}</>;
}

function ResizableHandle(_props: ResizableHandleProps) {
  return null;
}

ResizablePanel.displayName = 'ResizablePanel';
ResizableHandle.displayName = 'ResizableHandle';

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
