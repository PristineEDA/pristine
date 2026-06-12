import { useEffect, useMemo, useRef, useState } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';

import type {
  LspLayoutCatalog,
  LspLayoutGeometry,
  LspLayoutMacro,
  LspLayoutShape,
} from '../../../../../types/systemverilog-lsp';
import {
  applyLayoutWheel,
  findLayoutMacro,
  getFitLayoutCamera,
  getMacroBounds,
  getShapesBounds,
  selectMacroShapes,
  type PhysicalLayoutCamera,
} from './physicalLayoutGeometry';
import {
  createPhysicalLayoutPinLabels,
  filterVisiblePhysicalLayoutShapes,
  getPhysicalLayoutLayerColor,
  getVisiblePhysicalLayoutCategoryCount,
  getVisiblePhysicalLayoutLayerCount,
  getVisiblePhysicalLayoutShapeCounts,
  isPhysicalLayoutOutlineVisible,
  type PhysicalLayoutPinLabel,
  type PhysicalLayoutVisibility,
} from './physicalLayoutLayers';

type PixiRendererPreference = 'webgpu' | 'webgl';
type PixiRendererStatus = PixiRendererPreference | 'error' | 'initializing';

interface PhysicalLayoutCanvasProps {
  catalog: LspLayoutCatalog | null;
  geometry: LspLayoutGeometry | null;
  selectedMacroName: string | null;
  layoutVisibility: PhysicalLayoutVisibility;
}

const defaultCamera: PhysicalLayoutCamera = { panX: 0, panY: 0, zoom: 24 };
const minimumCanvasWidth = 240;
const minimumCanvasHeight = 180;
const gridMajorStep = 1;
const gridMinorStep = 0.2;

export function PhysicalLayoutCanvas({
  catalog,
  geometry,
  selectedMacroName,
  layoutVisibility,
}: PhysicalLayoutCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const backgroundRef = useRef<Container | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const cameraRef = useRef<PhysicalLayoutCamera>(defaultCamera);
  const selectedMacroRef = useRef<LspLayoutMacro | null>(null);
  const selectedShapesRef = useRef<LspLayoutShape[]>([]);
  const selectedLabelsRef = useRef<PhysicalLayoutPinLabel[]>([]);
  const outlineVisibleRef = useRef(false);
  const [renderer, setRenderer] = useState<PixiRendererStatus>('initializing');
  const [camera, setCamera] = useState<PhysicalLayoutCamera>(defaultCamera);
  const [renderCount, setRenderCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ width: minimumCanvasWidth, height: minimumCanvasHeight });

  const selectedMacro = useMemo(() => findLayoutMacro(catalog, selectedMacroName), [catalog, selectedMacroName]);
  const selectedShapes = useMemo(
    () => selectMacroShapes(catalog, geometry, selectedMacroName),
    [catalog, geometry, selectedMacroName],
  );
  const visibleShapes = useMemo(
    () => filterVisiblePhysicalLayoutShapes(selectedShapes, layoutVisibility),
    [selectedShapes, layoutVisibility],
  );
  const visibleLabels = useMemo(
    () => createPhysicalLayoutPinLabels(catalog, selectedShapes, layoutVisibility),
    [catalog, selectedShapes, layoutVisibility],
  );
  const visibleShapeCounts = useMemo(
    () => getVisiblePhysicalLayoutShapeCounts(selectedShapes, layoutVisibility),
    [selectedShapes, layoutVisibility],
  );
  const selectedBounds = useMemo(
    () => getShapesBounds(selectedShapes, selectedMacro ? getMacroBounds(selectedMacro) : null),
    [selectedMacro, selectedShapes],
  );
  const layerCount = catalog?.layers.length ?? 0;
  const catalogPinCount = catalog?.pins.length ?? 0;
  const selectedPinCount = catalog && selectedMacro
    ? catalog.pins.filter((pin) => pin.macroIndex === selectedMacro.index).length
    : 0;
  const visibleLayerCount = getVisiblePhysicalLayoutLayerCount(catalog, layoutVisibility);
  const visibleCategoryCount = getVisiblePhysicalLayoutCategoryCount(catalog, layoutVisibility);
  const outlineVisible = isPhysicalLayoutOutlineVisible(layoutVisibility);

  selectedMacroRef.current = selectedMacro;
  selectedShapesRef.current = visibleShapes;
  selectedLabelsRef.current = visibleLabels;
  outlineVisibleRef.current = outlineVisible;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    let disposed = false;
    void createPixiApp(host).then(({ app, renderer: pixiRenderer }) => {
      if (disposed) {
        app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
        return;
      }

      appRef.current = app;
      backgroundRef.current = new Container();
      worldRef.current = new Container();
      app.stage.addChild(backgroundRef.current);
      app.stage.addChild(worldRef.current);
      setRenderer(pixiRenderer);
      setSize({ width: app.renderer.width, height: app.renderer.height });
      redrawScene();
      requestRender();
    }).catch((cause: unknown) => {
      if (disposed) {
        return;
      }

      setRenderer('error');
      setError(cause instanceof Error ? cause.message : 'Unable to initialize layout renderer.');
    });

    return () => {
      disposed = true;
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
      appRef.current?.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
      appRef.current = null;
      worldRef.current = null;
      backgroundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      const app = appRef.current;
      if (!app) {
        return;
      }

      const width = Math.max(minimumCanvasWidth, Math.floor(host.clientWidth));
      const height = Math.max(minimumCanvasHeight, Math.floor(host.clientHeight));
      app.renderer.resize(width, height);
      setSize({ width, height });
      requestRender();
    });
    resizeObserver.observe(host);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const nextCamera = getFitLayoutCamera(selectedBounds, size);
    cameraRef.current = nextCamera;
    setCamera(nextCamera);
    redrawScene();
    requestRender();
  }, [selectedBounds, selectedMacroName, size.height, size.width]);

  useEffect(() => {
    redrawScene();
    requestRender();
  }, [outlineVisible, visibleLabels, visibleShapes]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const dragState = {
      pointerId: -1,
      previousX: 0,
      previousY: 0,
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = host.getBoundingClientRect();
      updateCamera(applyLayoutWheel(cameraRef.current, event, { x: bounds.left, y: bounds.top }));
    };
    const handlePointerDown = (event: PointerEvent) => {
      dragState.pointerId = event.pointerId;
      dragState.previousX = event.clientX;
      dragState.previousY = event.clientY;
      host.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      const dx = event.clientX - dragState.previousX;
      const dy = event.clientY - dragState.previousY;
      dragState.previousX = event.clientX;
      dragState.previousY = event.clientY;
      updateCamera({
        ...cameraRef.current,
        panX: cameraRef.current.panX + dx,
        panY: cameraRef.current.panY + dy,
      });
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (dragState.pointerId !== event.pointerId) {
        return;
      }

      dragState.pointerId = -1;
      if (host.hasPointerCapture(event.pointerId)) {
        host.releasePointerCapture(event.pointerId);
      }
    };

    host.addEventListener('wheel', handleWheel, { passive: false });
    host.addEventListener('pointerdown', handlePointerDown);
    host.addEventListener('pointermove', handlePointerMove);
    host.addEventListener('pointerup', handlePointerUp);
    host.addEventListener('pointercancel', handlePointerUp);
    return () => {
      host.removeEventListener('wheel', handleWheel);
      host.removeEventListener('pointerdown', handlePointerDown);
      host.removeEventListener('pointermove', handlePointerMove);
      host.removeEventListener('pointerup', handlePointerUp);
      host.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  const requestRender = () => {
    if (renderFrameRef.current !== null) {
      return;
    }

    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      const app = appRef.current;
      if (!app) {
        return;
      }

      updateTransforms();
      app.render();
      setRenderCount((current) => current + 1);
    });
  };

  const updateCamera = (nextCamera: PhysicalLayoutCamera) => {
    cameraRef.current = nextCamera;
    setCamera(nextCamera);
    requestRender();
  };

  const updateTransforms = () => {
    const world = worldRef.current;
    if (!world) {
      return;
    }

    const nextCamera = cameraRef.current;
    world.position.set(nextCamera.panX, nextCamera.panY);
    world.scale.set(nextCamera.zoom);
  };

  const redrawScene = () => {
    const background = backgroundRef.current;
    const world = worldRef.current;
    const app = appRef.current;
    if (!background || !world || !app) {
      return;
    }

    background.removeChildren().forEach((child) => child.destroy({ children: true }));
    world.removeChildren().forEach((child) => child.destroy({ children: true }));
    background.addChild(drawBackground(size.width, size.height));

    const macro = selectedMacroRef.current;
    if (!macro) {
      return;
    }

    world.addChild(drawGrid(macro));
    if (outlineVisibleRef.current) {
      world.addChild(drawMacroOutline(macro));
    }
    world.addChild(drawShapes(selectedShapesRef.current));
    const labels = drawPinLabels(selectedLabelsRef.current);
    if (labels.length > 0) {
      world.addChild(...labels);
    }
  };

  return (
    <div
      ref={hostRef}
      aria-label="Physical layout editor canvas"
      className="relative h-full min-h-0 w-full overflow-hidden bg-[#101317] outline-none"
      data-catalog-pin-count={catalogPinCount}
      data-geometry-shape-count={geometry?.shapes.length ?? 0}
      data-hidden-layer-count={Math.max(0, layerCount - visibleLayerCount)}
      data-outline-visible={outlineVisible ? 'true' : 'false'}
      data-layer-count={layerCount}
      data-macro-count={catalog?.macros.length ?? 0}
      data-pan-x={camera.panX.toFixed(2)}
      data-pan-y={camera.panY.toFixed(2)}
      data-render-count={renderCount}
      data-renderer={renderer}
      data-selected-macro-name={selectedMacroName ?? ''}
      data-selected-pin-count={selectedPinCount}
      data-selected-shape-count={selectedShapes.length}
      data-shape-count={selectedShapes.length}
      data-testid="physical-layout-canvas"
      data-visible-category-count={visibleCategoryCount}
      data-visible-label-count={visibleLabels.length}
      data-visible-label-names={visibleLabels.map((label) => label.name).join('|')}
      data-visible-layer-count={visibleLayerCount}
      data-visible-obstruction-shape-count={visibleShapeCounts.obstruction}
      data-visible-pin-shape-count={visibleShapeCounts.pin}
      data-visible-shape-count={visibleShapes.length}
      data-zoom={camera.zoom.toFixed(4)}
      role="img"
      tabIndex={0}
    >
      {renderer === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-[12px] text-ide-error">
          {error ?? 'Layout renderer unavailable'}
        </div>
      )}
    </div>
  );
}

async function createPixiApp(host: HTMLElement) {
  const width = Math.max(minimumCanvasWidth, Math.floor(host.clientWidth));
  const height = Math.max(minimumCanvasHeight, Math.floor(host.clientHeight));
  const preferences: PixiRendererPreference[] = ['webgpu', 'webgl'];
  let lastError: unknown;

  for (const preference of preferences) {
    const app = new Application();

    try {
      await app.init({
        width,
        height,
        autoDensity: true,
        antialias: true,
        autoStart: false,
        backgroundAlpha: 0,
        preference,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      app.stop();
      app.canvas.dataset.physicalLayoutCanvas = 'true';
      app.canvas.tabIndex = -1;
      host.appendChild(app.canvas);
      return { app, renderer: preference };
    } catch (cause) {
      lastError = cause;
      app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to initialize layout renderer.');
}

function drawBackground(width: number, height: number) {
  return new Graphics()
    .rect(0, 0, width, height)
    .fill({ color: 0x101317, alpha: 1 });
}

function drawGrid(macro: LspLayoutMacro) {
  const bounds = getMacroBounds(macro);
  const graphics = new Graphics();

  for (let x = Math.floor(bounds.x0 / gridMinorStep) * gridMinorStep; x <= bounds.x1 + 0.001; x += gridMinorStep) {
    const isMajor = Math.abs(Math.round(x / gridMajorStep) - x / gridMajorStep) < 0.001;
    graphics
      .moveTo(x, bounds.y0)
      .lineTo(x, bounds.y1)
      .stroke({ color: isMajor ? 0x34404c : 0x1e2730, alpha: isMajor ? 0.5 : 0.28, width: 0.008 });
  }

  for (let y = Math.floor(bounds.y0 / gridMinorStep) * gridMinorStep; y <= bounds.y1 + 0.001; y += gridMinorStep) {
    const isMajor = Math.abs(Math.round(y / gridMajorStep) - y / gridMajorStep) < 0.001;
    graphics
      .moveTo(bounds.x0, y)
      .lineTo(bounds.x1, y)
      .stroke({ color: isMajor ? 0x34404c : 0x1e2730, alpha: isMajor ? 0.5 : 0.28, width: 0.008 });
  }

  return graphics;
}

function drawMacroOutline(macro: LspLayoutMacro) {
  const bounds = getMacroBounds(macro);
  return new Graphics()
    .rect(bounds.x0, bounds.y0, bounds.x1 - bounds.x0, bounds.y1 - bounds.y0)
    .fill({ color: 0x151c24, alpha: 0.48 })
    .stroke({ color: 0xe5eef8, alpha: 0.9, width: 0.025 });
}

function drawShapes(shapes: readonly LspLayoutShape[]) {
  const graphics = new Graphics();

  for (const shape of shapes) {
    const color = getPhysicalLayoutLayerColor(shape.layerIndex).pixiColor;
    const alpha = shape.ownerKind === 'obstruction' ? 0.35 : 0.7;

    if (shape.kind === 'polygon' && shape.polygon && shape.polygon.length >= 3) {
      graphics
        .poly(shape.polygon.flatMap((point) => [point.x, point.y]), true)
        .fill({ color, alpha })
        .stroke({ color, alpha: 0.9, width: 0.018 });
      continue;
    }

    const x0 = Math.min(shape.rect.x0, shape.rect.x1);
    const y0 = Math.min(shape.rect.y0, shape.rect.y1);
    const width = Math.max(Math.abs(shape.rect.x1 - shape.rect.x0), 0.01);
    const height = Math.max(Math.abs(shape.rect.y1 - shape.rect.y0), 0.01);
    graphics
      .rect(x0, y0, width, height)
      .fill({ color, alpha })
      .stroke({ color, alpha: 0.92, width: 0.015 });
  }

  return graphics;
}

function drawPinLabels(labels: readonly PhysicalLayoutPinLabel[]) {
  const baseFontSize = 14;
  const worldFontSize = 0.16;

  return labels.map((label) => {
    const text = new Text({
      text: label.name,
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: baseFontSize,
        fontWeight: '600',
        fill: label.color,
        stroke: { color: 0x101317, width: 2 },
      },
    });

    text.anchor.set(0.5);
    text.position.set(label.x, label.y);
    text.scale.set(worldFontSize / baseFontSize);
    text.resolution = 2;
    return text;
  });
}
