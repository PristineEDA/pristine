import { getSchematicNodeRect, type SchematicNodePositionOverrides, type SchematicRect } from './asicSchematicLayout';
import type { SchematicLayoutResult, SchematicNodeLayout, SchematicPoint } from './asicSchematicTypes';

export type SchematicAlignmentGuideKind = 'center' | 'edge';
export type SchematicAlignmentGuideOrientation = 'horizontal' | 'vertical';

export interface SchematicAlignmentGuide {
  kind: SchematicAlignmentGuideKind;
  orientation: SchematicAlignmentGuideOrientation;
  position: number;
  start: number;
  end: number;
}

interface AlignmentCandidate {
  kind: SchematicAlignmentGuideKind;
  value: number;
}

const guidePadding = 36;

export function getSchematicAlignmentGuides(
  layout: SchematicLayoutResult,
  draggedNodeIds: readonly string[],
  positions: SchematicNodePositionOverrides,
  tolerance = 8,
): SchematicAlignmentGuide[] {
  const draggedNodeIdSet = new Set(draggedNodeIds);
  const moduleNodes = layout.nodes.filter((node) => node.kind === 'module');
  const draggedRects = moduleNodes
    .filter((node) => draggedNodeIdSet.has(node.id))
    .map((node) => getRectWithPosition(node, positions[node.id]));
  const stationaryRects = moduleNodes
    .filter((node) => !draggedNodeIdSet.has(node.id))
    .map(getSchematicNodeRect);

  if (draggedRects.length === 0 || stationaryRects.length === 0) {
    return [];
  }

  const guides = new Map<string, SchematicAlignmentGuide>();
  const safeTolerance = Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : 8;

  draggedRects.forEach((draggedRect) => {
    stationaryRects.forEach((stationaryRect) => {
      addAxisGuides(guides, 'vertical', getXAxisCandidates(draggedRect), getXAxisCandidates(stationaryRect), safeTolerance, {
        draggedStart: draggedRect.y,
        draggedEnd: draggedRect.y + draggedRect.height,
        targetStart: stationaryRect.y,
        targetEnd: stationaryRect.y + stationaryRect.height,
      });
      addAxisGuides(guides, 'horizontal', getYAxisCandidates(draggedRect), getYAxisCandidates(stationaryRect), safeTolerance, {
        draggedStart: draggedRect.x,
        draggedEnd: draggedRect.x + draggedRect.width,
        targetStart: stationaryRect.x,
        targetEnd: stationaryRect.x + stationaryRect.width,
      });
    });
  });

  return [...guides.values()].sort((first, second) => {
    if (first.orientation !== second.orientation) {
      return first.orientation.localeCompare(second.orientation);
    }

    return first.position - second.position;
  });
}

function addAxisGuides(
  guides: Map<string, SchematicAlignmentGuide>,
  orientation: SchematicAlignmentGuideOrientation,
  draggedCandidates: readonly AlignmentCandidate[],
  targetCandidates: readonly AlignmentCandidate[],
  tolerance: number,
  span: { draggedStart: number; draggedEnd: number; targetStart: number; targetEnd: number },
) {
  draggedCandidates.forEach((draggedCandidate) => {
    targetCandidates.forEach((targetCandidate) => {
      if (Math.abs(draggedCandidate.value - targetCandidate.value) > tolerance) {
        return;
      }

      const position = roundGuideCoordinate(targetCandidate.value);
      const key = `${orientation}:${position}`;
      const existingGuide = guides.get(key);
      const nextGuide: SchematicAlignmentGuide = {
        orientation,
        position,
        kind: draggedCandidate.kind === 'center' && targetCandidate.kind === 'center' ? 'center' : 'edge',
        start: roundGuideCoordinate(Math.min(span.draggedStart, span.targetStart) - guidePadding),
        end: roundGuideCoordinate(Math.max(span.draggedEnd, span.targetEnd) + guidePadding),
      };

      if (!existingGuide || existingGuide.kind === 'edge' && nextGuide.kind === 'center') {
        guides.set(key, nextGuide);
      }
    });
  });
}

function getRectWithPosition(node: SchematicNodeLayout, position?: SchematicPoint): SchematicRect {
  return {
    x: position?.x ?? node.x,
    y: position?.y ?? node.y,
    width: node.width,
    height: node.height,
  };
}

function getXAxisCandidates(rect: SchematicRect): AlignmentCandidate[] {
  return [
    { kind: 'edge', value: rect.x },
    { kind: 'center', value: rect.x + rect.width / 2 },
    { kind: 'edge', value: rect.x + rect.width },
  ];
}

function getYAxisCandidates(rect: SchematicRect): AlignmentCandidate[] {
  return [
    { kind: 'edge', value: rect.y },
    { kind: 'center', value: rect.y + rect.height / 2 },
    { kind: 'edge', value: rect.y + rect.height },
  ];
}

function roundGuideCoordinate(value: number) {
  return Math.round(value * 10) / 10;
}
