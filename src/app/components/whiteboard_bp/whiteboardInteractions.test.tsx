import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Konva from 'konva';

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn(), toggleTheme: vi.fn() }),
}));

const createdStages: any[] = [];

vi.mock('konva', async () => {
  const actual = await vi.importActual<typeof import('konva')>('konva');
  const KonvaDefault = actual.default;

  class TrackingStage extends KonvaDefault.Stage {
    constructor(config: any) {
      super(config);
      createdStages.push(this);
    }
  }

  return {
    ...actual,
    default: {
      ...KonvaDefault,
      Stage: TrackingStage,
    },
  };
});

import { WhiteboardView } from './WhiteboardView';

function installImmediateResizeObserver(width = 800, height = 600) {
  class ImmediateResizeObserver {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe = (target: Element) => {
      this.callback([
        {
          target,
          contentRect: {
            width,
            height,
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: width,
            bottom: height,
            toJSON: () => ({}),
          } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ], this as unknown as ResizeObserver);
    };

    unobserve = vi.fn();
    disconnect = vi.fn();
  }

  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: ImmediateResizeObserver,
  });
}

function getStage() {
  const stage = createdStages[createdStages.length - 1];
  expect(stage).toBeTruthy();
  return stage;
}

function setStageBounds(stage: any, width = 800, height = 600) {
  Object.defineProperty(stage.container(), 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    }),
  });
}

function fireStageMouseEvent(stage: any, type: 'click' | 'mousedown' | 'mousemove' | 'mouseup', x: number, y: number) {
  const nativeEvent = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });

  setStageBounds(stage);
  stage.setPointersPositions(nativeEvent);
  stage.fire(type, {
    target: stage,
    evt: nativeEvent,
  });
}

function setStagePointer(stage: any, x: number, y: number) {
  const nativeEvent = new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });

  setStageBounds(stage);
  stage.setPointersPositions(nativeEvent);
}

function fireNodeClick(stage: any, node: any, options?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) {
  const nativeEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: node.x?.() ?? 0,
    clientY: node.y?.() ?? 0,
    shiftKey: options?.shiftKey ?? false,
    ctrlKey: options?.ctrlKey ?? false,
    metaKey: options?.metaKey ?? false,
  });

  setStageBounds(stage);
  stage.setPointersPositions(nativeEvent);
  node.fire('click', { target: node, evt: nativeEvent }, true);
}

function getTransformer(stage: any) {
  const transformer = stage.findOne('Transformer');
  expect(transformer).toBeTruthy();
  return transformer;
}

function dispatchStageDrop(stage: any, data: Record<string, string>, x: number, y: number) {
  const event = new Event('drop', { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'dataTransfer', {
    configurable: true,
    value: {
      getData: (key: string) => data[key] ?? '',
    },
  });

  Object.defineProperty(event, 'clientX', { configurable: true, value: x });
  Object.defineProperty(event, 'clientY', { configurable: true, value: y });
  setStageBounds(stage);
  stage.container().dispatchEvent(event);
}

async function renderWhiteboard() {
  createdStages.length = 0;
  installImmediateResizeObserver();
  render(<WhiteboardView />);
  await waitFor(() => expect(createdStages.length).toBeGreaterThan(0));
  const stage = getStage();
  setStageBounds(stage);
  return { stage };
}

describe('Whiteboard interactions', () => {
  beforeEach(() => {
    createdStages.length = 0;
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'data:image/png;base64,test-preview'),
    });
  });

  it('zooms in and resets zoom from the minimap controls', async () => {
    const { stage } = await renderWhiteboard();
    setStagePointer(stage, 400, 300);

    const zoomInButton = screen.getByTitle('zoom in');
    expect(zoomInButton).toBeTruthy();

    fireEvent.click(zoomInButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '120%' })).toBeInTheDocument();
      expect(stage.scaleX()).toBeCloseTo(1.2, 5);
    });

    fireEvent.click(screen.getByRole('button', { name: '120%' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '100%' })).toBeInTheDocument();
      expect(stage.scaleX()).toBeCloseTo(1, 5);
      expect(stage.x()).toBe(0);
      expect(stage.y()).toBe(0);
    });
  });

  it('creates the selected shape on canvas click', async () => {
    const { stage } = await renderWhiteboard();

    fireEvent.click(screen.getByTitle('shape - D'));
    fireEvent.click(screen.getByTitle('shape-octagon'));

    fireStageMouseEvent(stage, 'click', 160, 200);

    await waitFor(() => {
      expect(stage.find('.octagon')).toHaveLength(1);
    });
  });

  it('supports shift multi-select across shapes', async () => {
    const { stage } = await renderWhiteboard();

    fireEvent.click(screen.getByTitle('shape - D'));
    fireEvent.click(screen.getByTitle('shape-circle'));
    fireStageMouseEvent(stage, 'click', 120, 160);
    fireStageMouseEvent(stage, 'click', 260, 280);

    await waitFor(() => {
      expect(stage.find('.circle')).toHaveLength(2);
    });

    fireEvent.click(screen.getByTitle('select - S'));

    const [firstCircle, secondCircle] = stage.find('.circle');
    const transformer = getTransformer(stage);

    fireNodeClick(stage, firstCircle);
    expect(transformer.nodes()).toHaveLength(1);

    fireNodeClick(stage, secondCircle, { shiftKey: true });
    expect(transformer.nodes()).toHaveLength(2);
  });

  it('prevents shape creation while the shape layer is locked', async () => {
    const { stage } = await renderWhiteboard();

    fireEvent.click(screen.getByTitle('toggle shape lock'));
    fireEvent.click(screen.getByTitle('shape - D'));
    fireEvent.click(screen.getByTitle('shape-triangle'));
    fireStageMouseEvent(stage, 'click', 180, 220);

    await waitFor(() => {
      expect(stage.find('.triangle')).toHaveLength(0);
    });
  });

  it('creates spec-note and uploaded picture via drag and drop', async () => {
    const { stage } = await renderWhiteboard();

    dispatchStageDrop(stage, { 'elem-type': 'spec-note' }, 200, 220);

    await waitFor(() => {
      const noteRects = stage.find('.rectangle').filter((node: any) => node.getAttrs().boardLayer === 'comment');
      expect(noteRects.length).toBe(1);
    });

    const originalFileReader = globalThis.FileReader;
    const originalImage = globalThis.Image;
    const originalFromURL = Konva.Image.fromURL;

    class FileReaderMock {
      result: string | ArrayBuffer | null = null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

      readAsDataURL() {
        this.result = 'data:image/png;base64,mock-image';
        this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
      }
    }

    class ImageMock {
      width = 320;
      height = 160;
      onload: (() => void) | null = null;
      private currentSrc = '';

      set src(value: string) {
        this.currentSrc = value;
        queueMicrotask(() => {
          this.onload?.();
        });
      }

      get src() {
        return this.currentSrc;
      }
    }

    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      writable: true,
      value: FileReaderMock,
    });

    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      writable: true,
      value: ImageMock,
    });

    Konva.Image.fromURL = ((_src: string, callback: (image: InstanceType<typeof Konva.Image>) => void) => {
      const imageNode = new Konva.Image();
      imageNode.image(new ImageMock() as unknown as CanvasImageSource);
      callback(imageNode);
      return imageNode;
    }) as typeof Konva.Image.fromURL;

    try {
      fireEvent.click(screen.getByTitle('image - I'));

      const uploadButtons = document.querySelectorAll('button.w-16.h-12');
      fireEvent.click(uploadButtons[0] as HTMLButtonElement);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['x'.repeat(2048)], 'mock.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(document.querySelector('button.w-16.h-12 img')).toBeTruthy();
      });

      dispatchStageDrop(stage, { 'elem-type': 'picture', 'elem-idx': '0' }, 320, 260);

      await waitFor(() => {
        expect(stage.find('.image')).toHaveLength(1);
      });
    } finally {
      Object.defineProperty(globalThis, 'FileReader', {
        configurable: true,
        writable: true,
        value: originalFileReader,
      });
      Object.defineProperty(globalThis, 'Image', {
        configurable: true,
        writable: true,
        value: originalImage,
      });
      Konva.Image.fromURL = originalFromURL;
    }
  });

  it('creates pen and eraser strokes on pointer interaction', async () => {
    const { stage } = await renderWhiteboard();

    fireEvent.click(screen.getByTitle('pen - Q'));
    fireStageMouseEvent(stage, 'mousedown', 120, 120);
    fireStageMouseEvent(stage, 'mousemove', 150, 150);
    fireStageMouseEvent(stage, 'mouseup', 180, 180);

    await waitFor(() => {
      expect(stage.find('.pen-stroke')).toHaveLength(1);
    });

    fireEvent.click(screen.getByTitle('eraser - E'));
    fireStageMouseEvent(stage, 'mousedown', 180, 180);
    fireStageMouseEvent(stage, 'mousemove', 210, 210);
    fireStageMouseEvent(stage, 'mouseup', 240, 240);

    await waitFor(() => {
      const eraserStroke = stage.findOne('.eraser-stroke');
      expect(eraserStroke).toBeTruthy();
      expect(eraserStroke.getAttr('globalCompositeOperation')).toBe('destination-out');
    });
  });

  it('undoes and redoes shape creation from toolbar actions', async () => {
    const { stage } = await renderWhiteboard();

    fireEvent.click(screen.getByTitle('shape - D'));
    fireEvent.click(screen.getByTitle('shape-triangle'));
    fireStageMouseEvent(stage, 'click', 200, 240);

    await waitFor(() => {
      expect(stage.find('.triangle')).toHaveLength(1);
    });

    fireEvent.click(screen.getByTitle('undo - ctrl-Z'));

    await waitFor(() => {
      expect(stage.find('.triangle')).toHaveLength(0);
    });

    fireEvent.click(screen.getByTitle('redo - ctrl-R'));

    await waitFor(() => {
      expect(stage.find('.triangle')).toHaveLength(1);
    });
  });
});