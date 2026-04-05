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

    fireEvent.pointerDown(handle, { clientX: 200, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 300, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 300, clientY: 0, pointerId: 1 });

    expect(leftPanel.style.flexBasis).toBe('30%');
    expect(rightPanel.style.flexBasis).toBe('70%');
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

    expect(screen.queryByTestId('panel-left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('panel-right')).not.toBeInTheDocument();
    expect(screen.getByTestId('panel-center').style.flexBasis).toBe('100%');
    expect(screen.queryByTestId('left-handle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right-handle')).not.toBeInTheDocument();
  });
});