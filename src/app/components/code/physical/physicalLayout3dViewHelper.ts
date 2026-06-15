import * as THREE from 'three';

export type PhysicalLayout3DViewHelperAxis = 'posX' | 'negX' | 'posY' | 'negY' | 'posZ' | 'negZ';

export interface PhysicalLayout3DViewHelperViewport {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface PhysicalLayout3DViewHelperEndpointPosition {
  x: number;
  y: number;
}

export interface PhysicalLayout3DViewHelperEndpointPositions {
  negX: PhysicalLayout3DViewHelperEndpointPosition | null;
  negY: PhysicalLayout3DViewHelperEndpointPosition | null;
  negZ: PhysicalLayout3DViewHelperEndpointPosition | null;
  posX: PhysicalLayout3DViewHelperEndpointPosition | null;
  posY: PhysicalLayout3DViewHelperEndpointPosition | null;
  posZ: PhysicalLayout3DViewHelperEndpointPosition | null;
}

const helperSize = 128;
const helperPadding = 8;
const axisLength = 42;
const axisRadius = 1.8;
const endpointRadius = 7;
const endpointHitRadius = 12;

const axisColors: Record<PhysicalLayout3DViewHelperAxis, number> = {
  negX: 0x222222,
  negY: 0x222222,
  negZ: 0x222222,
  posX: 0xff4466,
  posY: 0x88ff44,
  posZ: 0x4488ff,
};

export const physicalLayout3DViewHelperSize = helperSize;

export function getPhysicalLayout3DViewHelperViewport(
  canvasWidth: number,
  _canvasHeight: number,
): PhysicalLayout3DViewHelperViewport {
  return {
    height: helperSize,
    left: Math.max(0, canvasWidth - helperSize - helperPadding),
    top: helperPadding,
    width: helperSize,
  };
}

export function getPhysicalLayout3DViewHelperTargetOrbit(axis: PhysicalLayout3DViewHelperAxis) {
  switch (axis) {
    case 'posX':
      return { angleX: -Math.PI / 2, angleY: -Math.PI / 2 };
    case 'negX':
      return { angleX: -Math.PI / 2, angleY: Math.PI / 2 };
    case 'posY':
      return { angleX: -Math.PI / 2, angleY: 0 };
    case 'negY':
      return { angleX: -Math.PI / 2, angleY: Math.PI };
    case 'posZ':
      return { angleX: 0, angleY: 0 };
    case 'negZ':
      return { angleX: Math.PI, angleY: 0 };
    default:
      return { angleX: 0, angleY: 0 };
  }
}

export function createPhysicalLayout3DViewHelper() {
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);
  const camera = new THREE.OrthographicCamera(-64, 64, 64, -64, -128, 128);
  camera.position.set(0, 0, 64);
  camera.lookAt(0, 0, 0);
  const raycaster = new THREE.Raycaster();
  const endpoints: Record<PhysicalLayout3DViewHelperAxis, THREE.Sprite> = {
    negX: createEndpointSprite(axisColors.negX, 'negX'),
    negY: createEndpointSprite(axisColors.negY, 'negY'),
    negZ: createEndpointSprite(axisColors.negZ, 'negZ'),
    posX: createEndpointSprite(axisColors.posX, 'posX'),
    posY: createEndpointSprite(axisColors.posY, 'posY'),
    posZ: createEndpointSprite(axisColors.posZ, 'posZ'),
  };

  addAxis(group, new THREE.Vector3(1, 0, 0), axisColors.posX, endpoints.posX);
  addAxis(group, new THREE.Vector3(-1, 0, 0), axisColors.negX, endpoints.negX);
  addAxis(group, new THREE.Vector3(0, 1, 0), axisColors.posY, endpoints.posY);
  addAxis(group, new THREE.Vector3(0, -1, 0), axisColors.negY, endpoints.negY);
  addAxis(group, new THREE.Vector3(0, 0, 1), axisColors.posZ, endpoints.posZ);
  addAxis(group, new THREE.Vector3(0, 0, -1), axisColors.negZ, endpoints.negZ);

  return {
    camera,
    dispose() {
      disposeObject(scene);
    },
    getEndpointPositions(viewport: PhysicalLayout3DViewHelperViewport): PhysicalLayout3DViewHelperEndpointPositions {
      group.updateWorldMatrix(true, true);
      camera.updateMatrixWorld(true);
      return {
        negX: projectEndpoint(endpoints.negX, camera, viewport),
        negY: projectEndpoint(endpoints.negY, camera, viewport),
        negZ: projectEndpoint(endpoints.negZ, camera, viewport),
        posX: projectEndpoint(endpoints.posX, camera, viewport),
        posY: projectEndpoint(endpoints.posY, camera, viewport),
        posZ: projectEndpoint(endpoints.posZ, camera, viewport),
      };
    },
    hitTest(viewportX: number, viewportY: number, viewport: PhysicalLayout3DViewHelperViewport): PhysicalLayout3DViewHelperAxis | null {
      if (
        viewportX < viewport.left
        || viewportY < viewport.top
        || viewportX > viewport.left + viewport.width
        || viewportY > viewport.top + viewport.height
      ) {
        return null;
      }

      const pointer = new THREE.Vector2(
        ((viewportX - viewport.left) / viewport.width) * 2 - 1,
        -(((viewportY - viewport.top) / viewport.height) * 2 - 1),
      );
      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObjects(Object.values(endpoints), false);
      const endpoint = intersections[0]?.object;
      const axis = endpoint?.userData.axis;
      if (typeof axis === 'string' && axis in axisColors) {
        return axis as PhysicalLayout3DViewHelperAxis;
      }

      const positions = this.getEndpointPositions(viewport);
      let closestAxis: PhysicalLayout3DViewHelperAxis | null = null;
      let closestDistance = endpointHitRadius;
      for (const [candidateAxis, position] of Object.entries(positions)) {
        if (!position) {
          continue;
        }

        const distance = Math.hypot(viewportX - position.x, viewportY - position.y);
        if (distance <= closestDistance) {
          closestAxis = candidateAxis as PhysicalLayout3DViewHelperAxis;
          closestDistance = distance;
        }
      }

      return closestAxis;
    },
    render(
      renderer: THREE.WebGLRenderer,
      viewport: PhysicalLayout3DViewHelperViewport,
      orbitQuaternion: THREE.Quaternion,
    ) {
      group.quaternion.copy(orbitQuaternion);
      group.quaternion.invert();
      group.updateMatrixWorld(true);

      const previousScissorTest = renderer.getScissorTest();
      const previousViewport = new THREE.Vector4();
      const previousScissor = new THREE.Vector4();
      renderer.getViewport(previousViewport);
      renderer.getScissor(previousScissor);

      const rendererHeight = renderer.domElement.height / Math.max(renderer.getPixelRatio(), 1);
      const viewportY = Math.max(0, rendererHeight - viewport.top - viewport.height);
      renderer.clearDepth();
      renderer.setScissorTest(true);
      renderer.setViewport(viewport.left, viewportY, viewport.width, viewport.height);
      renderer.setScissor(viewport.left, viewportY, viewport.width, viewport.height);
      renderer.render(scene, camera);
      renderer.setViewport(previousViewport);
      renderer.setScissor(previousScissor);
      renderer.setScissorTest(previousScissorTest);
    },
  };
}

export function getPhysicalLayout3DViewHelperAxisColor(axis: PhysicalLayout3DViewHelperAxis): number {
  return axisColors[axis];
}

function addAxis(group: THREE.Group, direction: THREE.Vector3, color: number, endpoint: THREE.Sprite) {
  const midpoint = direction.clone().multiplyScalar(axisLength / 2);
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 16),
    new THREE.MeshBasicMaterial({
      color,
      depthTest: true,
      depthWrite: false,
      transparent: color === axisColors.negX,
      opacity: color === axisColors.negX ? 0.55 : 1,
    }),
  );
  cylinder.position.copy(midpoint);
  cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  group.add(cylinder);

  endpoint.position.copy(direction.clone().multiplyScalar(axisLength));
  group.add(endpoint);
}

function createEndpointSprite(color: number, axis: PhysicalLayout3DViewHelperAxis) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    context.arc(32, 32, 23, 0, Math.PI * 2);
    context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.globalAlpha = axis.startsWith('neg') ? 0.55 : 1;
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    depthTest: true,
    depthWrite: false,
    map: texture,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(endpointRadius * 2, endpointRadius * 2, 1);
  sprite.userData.axis = axis;
  return sprite;
}

function projectEndpoint(
  endpoint: THREE.Sprite,
  camera: THREE.Camera,
  viewport: PhysicalLayout3DViewHelperViewport,
): PhysicalLayout3DViewHelperEndpointPosition | null {
  const projected = endpoint.getWorldPosition(new THREE.Vector3()).project(camera);
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
    return null;
  }

  return {
    x: viewport.left + ((projected.x + 1) / 2) * viewport.width,
    y: viewport.top + ((1 - projected.y) / 2) * viewport.height,
  };
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh | THREE.Sprite;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    geometry?.dispose();
    if (Array.isArray(material)) {
      material.forEach((entry) => disposeMaterial(entry));
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

function disposeMaterial(material: THREE.Material) {
  const maybeMapMaterial = material as THREE.Material & { map?: THREE.Texture | null };
  maybeMapMaterial.map?.dispose();
  material.dispose();
}
