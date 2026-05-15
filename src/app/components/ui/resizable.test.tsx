import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './resizable';

function mockGroupRect(element: HTMLElement, width: number, height: number) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

function renderHorizontalGroup() {
  return render(
    <div className="h-[400px] w-[1000px]">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel id="left" defaultSize={20} minSize={10}>
          <div>Left</div>
        </ResizablePanel>
        <ResizableHandle data-testid="horizontal-handle" />
        <ResizablePanel id="right" defaultSize={80} minSize={20}>
          <div>Right</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function renderVerticalGroup() {
  return render(
    <div className="h-[400px] w-[1000px]">
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel id="top" defaultSize={25} minSize={10}>
          <div>Top</div>
        </ResizablePanel>
        <ResizableHandle data-testid="vertical-handle" />
        <ResizablePanel id="bottom" defaultSize={75} minSize={20}>
          <div>Bottom</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function renderHorizontalGroupWithPixelConstraints(groupWidth: number, defaultRightSize: number) {
  render(
    <div className="h-[400px]" style={{ width: `${groupWidth}px` }}>
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel id="left" defaultSize={100 - defaultRightSize} minSize={10}>
          <div>Left</div>
        </ResizablePanel>
        <ResizableHandle data-testid="horizontal-handle-fixed" />
        <ResizablePanel id="right" defaultSize={defaultRightSize} minSizePx={320} maxSizePx={480}>
          <div>Right</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

describe('resizable', () => {
  it('resizes adjacent horizontal panels when the handle is dragged', () => {
    renderHorizontalGroup();

    const group = screen.getByText('Left').closest('[data-slot="resizable-panel-group"]') as HTMLElement;
    mockGroupRect(group, 1000, 400);

    const leftPanel = screen.getByTestId('panel-left');
    const rightPanel = screen.getByTestId('panel-right');
    const handle = screen.getByTestId('horizontal-handle');

    expect(leftPanel.style.flexBasis).toBe('20%');
    expect(rightPanel.style.flexBasis).toBe('80%');
    expect(handle).toHaveClass('cursor-ew-resize');

    fireEvent.pointerDown(handle, { clientX: 200, clientY: 0, pointerId: 1 });
    expect(document.body.style.cursor).toBe('ew-resize');
    fireEvent.pointerMove(handle, { clientX: 300, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 300, clientY: 0, pointerId: 1 });

    expect(leftPanel.style.flexBasis).toBe('30%');
    expect(rightPanel.style.flexBasis).toBe('70%');
    expect(document.body.style.cursor).toBe('');
  });

  it('supports overlay handles that keep drag semantics without consuming horizontal layout width', () => {
    render(
      <div className="h-[400px] w-[1000px]">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel id="left" defaultSize={20} minSize={10}>
            <div>Left</div>
          </ResizablePanel>
          <ResizableHandle data-testid="horizontal-overlay-handle" className="overlay-handle bg-transparent" />
          <ResizablePanel id="right" defaultSize={80} minSize={20}>
            <div>Right</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );

    const group = screen.getByText('Left').closest('[data-slot="resizable-panel-group"]') as HTMLElement;
    mockGroupRect(group, 1000, 400);

    const leftPanel = screen.getByTestId('panel-left');
    const rightPanel = screen.getByTestId('panel-right');
    const handle = screen.getByTestId('horizontal-overlay-handle');

    expect(handle).toHaveClass('w-0', '-mx-[5px]', 'bg-transparent');

    fireEvent.pointerDown(handle, { clientX: 200, clientY: 0, pointerId: 11 });
    fireEvent.pointerMove(handle, { clientX: 300, clientY: 0, pointerId: 11 });
    fireEvent.pointerUp(handle, { clientX: 300, clientY: 0, pointerId: 11 });

    expect(leftPanel.style.flexBasis).toBe('30%');
    expect(rightPanel.style.flexBasis).toBe('70%');
  });

  it('resizes adjacent vertical panels when the handle is dragged and uses ns-resize cursor semantics', () => {
    renderVerticalGroup();

    const group = screen.getByText('Top').closest('[data-slot="resizable-panel-group"]') as HTMLElement;
    mockGroupRect(group, 1000, 400);

    const topPanel = screen.getByTestId('panel-top');
    const bottomPanel = screen.getByTestId('panel-bottom');
    const handle = screen.getByTestId('vertical-handle');

    expect(topPanel.style.flexBasis).toBe('25%');
    expect(bottomPanel.style.flexBasis).toBe('75%');
    expect(handle).toHaveClass('cursor-ns-resize');

    fireEvent.pointerDown(handle, { clientX: 0, clientY: 100, pointerId: 5 });
    expect(document.body.style.cursor).toBe('ns-resize');
    fireEvent.pointerMove(handle, { clientX: 0, clientY: 160, pointerId: 5 });
    fireEvent.pointerUp(handle, { clientX: 0, clientY: 160, pointerId: 5 });

    expect(topPanel.style.flexBasis).toBe('40%');
    expect(bottomPanel.style.flexBasis).toBe('60%');
    expect(document.body.style.cursor).toBe('');
  });

  it('reserves layout gap space without letting vertical panel bases overflow', () => {
    render(
      <div className="h-[400px] w-[1000px]">
        <ResizablePanelGroup orientation="vertical" layoutGapPx={10}>
          <ResizablePanel id="top" defaultSize={60} minSize={10}>
            <div>Top</div>
          </ResizablePanel>
          <ResizableHandle data-testid="vertical-gap-handle" className="overlay-handle bg-transparent" />
          <ResizablePanel id="bottom" defaultSize={40} minSize={10}>
            <div>Bottom</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>,
    );

    const group = screen.getByText('Top').closest('[data-slot="resizable-panel-group"]') as HTMLElement;
    mockGroupRect(group, 1000, 400);

    const topPanel = screen.getByTestId('panel-top');
    const bottomPanel = screen.getByTestId('panel-bottom');
    const handle = screen.getByTestId('vertical-gap-handle');

    expect(topPanel.style.flexBasis).toBe('calc(60% - 6px)');
    expect(bottomPanel.style.flexBasis).toBe('calc(40% - 4px)');
    expect(handle.style.flexBasis).toBe('10px');
    expect(handle.style.height).toBe('10px');
    expect(handle).not.toHaveClass('h-0');
    expect(handle).not.toHaveClass('-my-[5px]');

    fireEvent.pointerDown(handle, { clientX: 0, clientY: 240, pointerId: 12 });
    fireEvent.pointerMove(handle, { clientX: 0, clientY: 279, pointerId: 12 });
    fireEvent.pointerUp(handle, { clientX: 0, clientY: 279, pointerId: 12 });

    expect(topPanel.style.flexBasis).toBe('calc(70% - 7px)');
    expect(bottomPanel.style.flexBasis).toBe('calc(30% - 3px)');
  });

  it('respects collapsed panels and keeps only visible panels in the layout flow', () => {
    render(
      <div className="h-[400px] w-[1000px]">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel id="left" defaultSize={18} minSize={12} collapsed>
            <div>Left</div>
          </ResizablePanel>
          <ResizableHandle data-testid="left-handle" hidden />
          <ResizablePanel id="center" defaultSize={55} minSize={30}>
            <div>Center</div>
          </ResizablePanel>
          <ResizableHandle data-testid="right-handle" hidden />
          <ResizablePanel id="right" defaultSize={22} minSize={18} collapsed>
            <div>Right</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    );

    expect(screen.getByTestId('panel-left')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('panel-left')).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByTestId('panel-left').style.flexBasis).toBe('0%');
    expect(screen.getByTestId('panel-left').style.transitionDuration).toBe('300ms');
    expect(screen.getByTestId('panel-left').style.transitionProperty).toBe('flex-basis');
    expect(screen.getByTestId('panel-right')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('panel-right')).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByTestId('panel-right').style.flexBasis).toBe('0%');
    expect(screen.getByTestId('panel-center').style.flexBasis).toBe('100%');
    expect(screen.queryByTestId('left-handle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right-handle')).not.toBeInTheDocument();
  });

  it('respects fixed pixel min and max sizes for horizontal panels at 1000px width', () => {
    renderHorizontalGroupWithPixelConstraints(1000, 40);

    const group = screen.getByText('Left').closest('[data-slot="resizable-panel-group"]') as HTMLElement;
    mockGroupRect(group, 1000, 400);

    const rightPanel = screen.getByTestId('panel-right');
    const handle = screen.getByTestId('horizontal-handle-fixed');

    expect(rightPanel.style.flexBasis).toBe('40%');

    fireEvent.pointerDown(handle, { clientX: 600, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 900, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 900, clientY: 0, pointerId: 1 });

    expect(rightPanel.style.flexBasis).toBe('32%');

    fireEvent.pointerDown(handle, { clientX: 900, clientY: 0, pointerId: 2 });
    fireEvent.pointerMove(handle, { clientX: 300, clientY: 0, pointerId: 2 });
    fireEvent.pointerUp(handle, { clientX: 300, clientY: 0, pointerId: 2 });

    expect(rightPanel.style.flexBasis).toBe('48%');
  });

  it('keeps the same fixed pixel constraints when the container width changes', () => {
    renderHorizontalGroupWithPixelConstraints(1600, 25);

    const group = screen.getByText('Left').closest('[data-slot="resizable-panel-group"]') as HTMLElement;
    mockGroupRect(group, 1600, 400);

    const rightPanel = screen.getByTestId('panel-right');
    const handle = screen.getByTestId('horizontal-handle-fixed');

    expect(rightPanel.style.flexBasis).toBe('25%');

    fireEvent.pointerDown(handle, { clientX: 1200, clientY: 0, pointerId: 3 });
    fireEvent.pointerMove(handle, { clientX: 1500, clientY: 0, pointerId: 3 });
    fireEvent.pointerUp(handle, { clientX: 1500, clientY: 0, pointerId: 3 });

    expect(rightPanel.style.flexBasis).toBe('20%');

    fireEvent.pointerDown(handle, { clientX: 1500, clientY: 0, pointerId: 4 });
    fireEvent.pointerMove(handle, { clientX: 900, clientY: 0, pointerId: 4 });
    fireEvent.pointerUp(handle, { clientX: 900, clientY: 0, pointerId: 4 });

    expect(rightPanel.style.flexBasis).toBe('30%');
  });
});
