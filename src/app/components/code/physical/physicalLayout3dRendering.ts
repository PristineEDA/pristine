import * as THREE from 'three';

import type { PhysicalLayout3DMeshInput } from './physicalLayout3dGeometry';

const categoryRenderOrder: Record<PhysicalLayout3DMeshInput['category'], number> = {
  boundary: 0,
  path: 1,
  text: 2,
  pin: 3,
  label: 4,
  obstruction: 5,
  net: 6,
  specialNet: 7,
  blockage: 8,
};

export const physicalLayout3DRenderOrders = {
  baseGrid: 0,
  baseGridOutline: 10,
  shapeBase: 1_000,
  shapeEdgeBase: 2_000,
  highlightedShapeBase: 3_000,
  highlightedEdgeBase: 4_000,
} as const;

export function getPhysicalLayout3DShapeRenderOrder(input: PhysicalLayout3DMeshInput, highlighted: boolean): number {
  return (highlighted ? physicalLayout3DRenderOrders.highlightedShapeBase : physicalLayout3DRenderOrders.shapeBase)
    + input.layerIndex * 100
    + (categoryRenderOrder[input.category] ?? 0) * 10
    + input.shapeIndex / 1_000_000;
}

export function getPhysicalLayout3DEdgeRenderOrder(input: PhysicalLayout3DMeshInput, highlighted: boolean): number {
  return (highlighted ? physicalLayout3DRenderOrders.highlightedEdgeBase : physicalLayout3DRenderOrders.shapeEdgeBase)
    + input.layerIndex * 100
    + (categoryRenderOrder[input.category] ?? 0) * 10
    + input.shapeIndex / 1_000_000;
}

export function getPhysicalLayout3DMeshMaterialOptions(
  input: PhysicalLayout3DMeshInput,
  highlighted: boolean,
): THREE.MeshStandardMaterialParameters {
  const opacity = highlighted ? 1 : Math.min(1, Math.max(0.01, input.opacity));
  const transparent = opacity < 0.999;

  return {
    color: highlighted ? 0xf8fafc : input.color,
    depthTest: true,
    depthWrite: !transparent,
    metalness: input.category === 'path' ? 0.34 : 0.18,
    opacity,
    roughness: 0.48,
    side: THREE.DoubleSide,
    transparent,
  };
}

export function getPhysicalLayout3DEdgeMaterialOptions(
  input: PhysicalLayout3DMeshInput,
  highlighted: boolean,
): THREE.LineBasicMaterialParameters {
  return {
    color: highlighted ? 0xffffff : input.color,
    depthTest: !highlighted,
    depthWrite: false,
    opacity: highlighted ? 1 : Math.min(1, Math.max(0.08, input.opacity + 0.2)),
    transparent: true,
  };
}

export function getPhysicalLayout3DBaseGridMaterialOptions(): THREE.MeshBasicMaterialParameters {
  return {
    color: 0x121820,
    depthTest: true,
    depthWrite: false,
    opacity: 0.78,
    side: THREE.DoubleSide,
    transparent: true,
  };
}

export function getPhysicalLayout3DBaseOutlineMaterialOptions(): THREE.LineBasicMaterialParameters {
  return {
    color: 0x384552,
    depthTest: true,
    depthWrite: false,
    opacity: 0.75,
    transparent: true,
  };
}
