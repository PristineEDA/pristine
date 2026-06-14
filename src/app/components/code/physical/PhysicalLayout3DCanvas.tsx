import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import type {
  LspLayoutBounds,
  LspLayoutCatalog,
  LspLayoutGeometry,
} from '../../../../../types/systemverilog-lsp';
import { createPhysicalLayout3DSceneInput, type PhysicalLayout3DMeshInput } from './physicalLayout3dGeometry';
import type { PhysicalLayoutTarget } from './physicalLayoutGeometry';
import type { PhysicalLayoutVisibility } from './physicalLayoutLayers';

type ThreeRendererStatus = 'initializing' | 'three-webgl' | 'error';

interface PhysicalLayout3DCanvasProps {
  catalog: LspLayoutCatalog | null;
  geometry: LspLayoutGeometry | null;
  layoutVisibility: PhysicalLayoutVisibility;
  selectedTarget: PhysicalLayoutTarget | null;
}

const minimumCanvasWidth = 220;
const minimumCanvasHeight = 180;
const defaultOrbit = {
  angleX: -0.9,
  angleY: -0.72,
};
const defaultZoom = 1;

export function PhysicalLayout3DCanvas({
  catalog,
  geometry,
  layoutVisibility,
  selectedTarget,
}: PhysicalLayout3DCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const boundsRef = useRef<LspLayoutBounds | null>(null);
  const [rendererStatus, setRendererStatus] = useState<ThreeRendererStatus>('initializing');
  const [renderCount, setRenderCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ width: minimumCanvasWidth, height: minimumCanvasHeight });
  const [orbit, setOrbit] = useState(defaultOrbit);
  const [zoom, setZoom] = useState(defaultZoom);

  const sceneInput = useMemo(
    () => createPhysicalLayout3DSceneInput(catalog, geometry, selectedTarget, layoutVisibility),
    [catalog, geometry, layoutVisibility, selectedTarget],
  );

  boundsRef.current = sceneInput.bounds;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch (cause) {
      setRendererStatus('error');
      setError(cause instanceof Error ? cause.message : 'Unable to initialize 3D layout renderer.');
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x101317, 1);
    renderer.domElement.tabIndex = -1;
    renderer.domElement.dataset.physicalLayout3DCanvas = 'true';
    host.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const group = new THREE.Group();
    groupRef.current = group;
    scene.add(group);
    scene.add(new THREE.AmbientLight(0xffffff, 0.72));

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(8, -10, 12);
    scene.add(keyLight);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    camera.position.set(0, 0, 120);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    setRendererStatus('three-webgl');
    updateRendererSize();
    redrawScene();
    requestRender();

    return () => {
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
      disposeGroup(group);
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      groupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateRendererSize();
      requestRender();
    });
    resizeObserver.observe(host);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    redrawScene();
    requestRender();
  }, [sceneInput]);

  useEffect(() => {
    updateTransforms();
    requestRender();
  }, [orbit.angleX, orbit.angleY, size.height, size.width, zoom]);

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
      setOrbit((current) => ({
        angleX: clamp(current.angleX + dy * 0.01, -1.35, -0.2),
        angleY: current.angleY + dx * 0.01,
      }));
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
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((current) => clamp(current * Math.exp(-event.deltaY * 0.001), 0.28, 5));
    };
    const handleDoubleClick = () => {
      setOrbit(defaultOrbit);
      setZoom(defaultZoom);
    };

    host.addEventListener('pointerdown', handlePointerDown);
    host.addEventListener('pointermove', handlePointerMove);
    host.addEventListener('pointerup', handlePointerUp);
    host.addEventListener('pointercancel', handlePointerUp);
    host.addEventListener('wheel', handleWheel, { passive: false });
    host.addEventListener('dblclick', handleDoubleClick);
    return () => {
      host.removeEventListener('pointerdown', handlePointerDown);
      host.removeEventListener('pointermove', handlePointerMove);
      host.removeEventListener('pointerup', handlePointerUp);
      host.removeEventListener('pointercancel', handlePointerUp);
      host.removeEventListener('wheel', handleWheel);
      host.removeEventListener('dblclick', handleDoubleClick);
    };
  }, []);

  const updateRendererSize = () => {
    const host = hostRef.current;
    const renderer = rendererRef.current;
    if (!host || !renderer) {
      return;
    }

    const width = Math.max(minimumCanvasWidth, Math.floor(host.clientWidth));
    const height = Math.max(minimumCanvasHeight, Math.floor(host.clientHeight));
    renderer.setSize(width, height, false);
    setSize({ width, height });
    updateCamera(width, height);
  };

  const updateCamera = (width = size.width, height = size.height) => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }

    const bounds = boundsRef.current;
    const boundsWidth = Math.max((bounds?.x1 ?? 1) - (bounds?.x0 ?? 0), 0.001);
    const boundsHeight = Math.max((bounds?.y1 ?? 1) - (bounds?.y0 ?? 0), 0.001);
    const aspect = Math.max(width / Math.max(height, 1), 0.01);
    const viewSize = Math.max(boundsWidth / Math.max(aspect, 0.01), boundsHeight, 1) * 1.35 / zoom;
    camera.left = -viewSize * aspect / 2;
    camera.right = viewSize * aspect / 2;
    camera.top = viewSize / 2;
    camera.bottom = -viewSize / 2;
    camera.near = 0.1;
    camera.far = 1000;
    camera.updateProjectionMatrix();
  };

  const updateTransforms = () => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    group.rotation.x = orbit.angleX;
    group.rotation.z = orbit.angleY;
    updateCamera();
  };

  const redrawScene = () => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    disposeGroup(group);
    const bounds = sceneInput.bounds;
    if (!bounds) {
      return;
    }

    const centerX = (bounds.x0 + bounds.x1) / 2;
    const centerY = (bounds.y0 + bounds.y1) / 2;
    group.add(createBaseGrid(bounds, centerX, centerY));

    for (const meshInput of sceneInput.meshes) {
      const mesh = createExtrudedMesh(meshInput, centerX, centerY);
      if (mesh) {
        group.add(mesh);
      }
    }
    updateTransforms();
  };

  const requestRender = () => {
    if (renderFrameRef.current !== null) {
      return;
    }

    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) {
        return;
      }

      renderer.render(scene, camera);
      setRenderCount((current) => current + 1);
    });
  };

  return (
    <div
      ref={hostRef}
      aria-label="Physical layout 3D canvas"
      className="relative h-full min-h-0 w-full overflow-hidden bg-[#101317] outline-none"
      data-orbit-angle-x={orbit.angleX.toFixed(4)}
      data-orbit-angle-y={orbit.angleY.toFixed(4)}
      data-render-count={renderCount}
      data-renderer={rendererStatus}
      data-selected-target-name={selectedTarget?.name ?? ''}
      data-shape-count={sceneInput.selectedShapeCount}
      data-source-kind={catalog?.sourceKind ?? ''}
      data-testid="physical-layout-3d-canvas"
      data-visible-shape-count={sceneInput.meshes.length}
      data-zoom={zoom.toFixed(4)}
      role="img"
      tabIndex={0}
    >
      {rendererStatus === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-[12px] text-ide-error">
          {error ?? '3D layout renderer unavailable'}
        </div>
      )}
    </div>
  );
}

function createExtrudedMesh(
  input: PhysicalLayout3DMeshInput,
  centerX: number,
  centerY: number,
): THREE.Group | null {
  try {
    const shape = new THREE.Shape();
    const first = input.points[0];
    if (!first) {
      return null;
    }

    shape.moveTo(first.x - centerX, first.y - centerY);
    for (const point of input.points.slice(1)) {
      shape.lineTo(point.x - centerX, point.y - centerY);
    }
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: false,
      depth: input.depth,
      steps: 1,
    });
    geometry.translate(0, 0, input.z);
    const material = new THREE.MeshStandardMaterial({
      color: input.color,
      metalness: input.category === 'path' ? 0.28 : 0.12,
      opacity: input.opacity,
      roughness: 0.58,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: input.color,
        opacity: Math.min(1, input.opacity + 0.2),
        transparent: true,
      }),
    );
    const group = new THREE.Group();
    group.add(mesh);
    group.add(edges);
    return group;
  } catch {
    return null;
  }
}

function createBaseGrid(bounds: LspLayoutBounds, centerX: number, centerY: number): THREE.Group {
  const group = new THREE.Group();
  const width = Math.max(bounds.x1 - bounds.x0, 0.001);
  const height = Math.max(bounds.y1 - bounds.y0, 0.001);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      color: 0x121820,
      opacity: 0.78,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  plane.position.set((bounds.x0 + bounds.x1) / 2 - centerX, (bounds.y0 + bounds.y1) / 2 - centerY, -0.015);
  group.add(plane);

  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height)),
    new THREE.LineBasicMaterial({ color: 0x384552, opacity: 0.75, transparent: true }),
  );
  outline.position.copy(plane.position);
  group.add(outline);
  return group;
}

function disposeGroup(group: THREE.Group) {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeObject(child);
  }
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh | THREE.LineSegments;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    geometry?.dispose();
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else {
      material?.dispose();
    }
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
