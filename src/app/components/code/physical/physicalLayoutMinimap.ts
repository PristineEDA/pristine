import type { LspLayoutBounds } from '../../../../../types/systemverilog-lsp';

export interface PhysicalLayoutMinimapRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface PhysicalLayoutMinimapModel {
  cell: PhysicalLayoutMinimapRect;
  cellWorldHeight: number;
  cellWorldWidth: number;
  panel: PhysicalLayoutMinimapRect;
  viewport: PhysicalLayoutMinimapRect;
  viewportWorld: LspLayoutBounds;
  viewportWorldHeight: number;
  viewportWorldWidth: number;
  visible: boolean;
}

export interface PhysicalLayoutMinimapInput {
  canvasSize: {
    height: number;
    width: number;
  };
  cellBounds: LspLayoutBounds | null | undefined;
  maxHeight?: number;
  maxWidth?: number;
  minViewportSize?: number;
  padding?: number;
  panelMargin?: number;
  viewportBounds: LspLayoutBounds | null | undefined;
}

const defaultMaxWidth = 112;
const defaultMaxHeight = 84;
const defaultPanelMargin = 12;
const defaultPadding = 8;
const defaultMinViewportSize = 4;

export function createPhysicalLayoutMinimapModel({
  canvasSize,
  cellBounds,
  maxHeight = defaultMaxHeight,
  maxWidth = defaultMaxWidth,
  minViewportSize = defaultMinViewportSize,
  padding = defaultPadding,
  panelMargin = defaultPanelMargin,
  viewportBounds,
}: PhysicalLayoutMinimapInput): PhysicalLayoutMinimapModel {
  const emptyRect = { x: 0, y: 0, width: 0, height: 0 };
  const panelWidth = Math.min(maxWidth, Math.max(0, canvasSize.width - panelMargin * 2));
  const panelHeight = Math.min(maxHeight, Math.max(0, canvasSize.height - panelMargin * 2));
  const panel = {
    x: Math.max(panelMargin, canvasSize.width - panelWidth - panelMargin),
    y: panelMargin,
    width: panelWidth,
    height: panelHeight,
  };

  if (
    !cellBounds
    || !viewportBounds
    || canvasSize.width <= 0
    || canvasSize.height <= 0
    || panelWidth <= padding * 2
    || panelHeight <= padding * 2
  ) {
    return {
      cell: emptyRect,
      cellWorldHeight: 0,
      cellWorldWidth: 0,
      panel,
      viewport: emptyRect,
      viewportWorld: { x0: 0, y0: 0, x1: 0, y1: 0 },
      viewportWorldHeight: 0,
      viewportWorldWidth: 0,
      visible: false,
    };
  }

  const cellWorldWidth = Math.max(cellBounds.x1 - cellBounds.x0, 0);
  const cellWorldHeight = Math.max(cellBounds.y1 - cellBounds.y0, 0);
  if (cellWorldWidth <= 0 || cellWorldHeight <= 0) {
    return {
      cell: emptyRect,
      cellWorldHeight,
      cellWorldWidth,
      panel,
      viewport: emptyRect,
      viewportWorld: viewportBounds,
      viewportWorldHeight: Math.max(viewportBounds.y1 - viewportBounds.y0, 0),
      viewportWorldWidth: Math.max(viewportBounds.x1 - viewportBounds.x0, 0),
      visible: false,
    };
  }

  const contentWidth = Math.max(panelWidth - padding * 2, 1);
  const contentHeight = Math.max(panelHeight - padding * 2, 1);
  const scale = Math.min(contentWidth / cellWorldWidth, contentHeight / cellWorldHeight);
  const cellWidth = cellWorldWidth * scale;
  const cellHeight = cellWorldHeight * scale;
  const cell = {
    x: panel.x + (panelWidth - cellWidth) / 2,
    y: panel.y + (panelHeight - cellHeight) / 2,
    width: cellWidth,
    height: cellHeight,
  };
  const clippedViewport = {
    x0: clamp(viewportBounds.x0, cellBounds.x0, cellBounds.x1),
    y0: clamp(viewportBounds.y0, cellBounds.y0, cellBounds.y1),
    x1: clamp(viewportBounds.x1, cellBounds.x0, cellBounds.x1),
    y1: clamp(viewportBounds.y1, cellBounds.y0, cellBounds.y1),
  };
  const viewportWorldWidth = Math.max(clippedViewport.x1 - clippedViewport.x0, 0);
  const viewportWorldHeight = Math.max(clippedViewport.y1 - clippedViewport.y0, 0);
  const viewportWidth = Math.max(viewportWorldWidth * scale, minViewportSize);
  const viewportHeight = Math.max(viewportWorldHeight * scale, minViewportSize);
  const viewportCenterX = worldToMinimapX((clippedViewport.x0 + clippedViewport.x1) / 2, cellBounds, cell);
  const viewportCenterY = worldToMinimapY((clippedViewport.y0 + clippedViewport.y1) / 2, cellBounds, cell);
  const viewport = {
    x: clamp(viewportCenterX - viewportWidth / 2, cell.x, cell.x + cell.width - viewportWidth),
    y: clamp(viewportCenterY - viewportHeight / 2, cell.y, cell.y + cell.height - viewportHeight),
    width: Math.min(viewportWidth, cell.width),
    height: Math.min(viewportHeight, cell.height),
  };

  return {
    cell,
    cellWorldHeight,
    cellWorldWidth,
    panel,
    viewport,
    viewportWorld: viewportBounds,
    viewportWorldHeight: Math.max(viewportBounds.y1 - viewportBounds.y0, 0),
    viewportWorldWidth: Math.max(viewportBounds.x1 - viewportBounds.x0, 0),
    visible: true,
  };
}

function worldToMinimapX(worldX: number, cellBounds: LspLayoutBounds, cell: PhysicalLayoutMinimapRect): number {
  const width = Math.max(cellBounds.x1 - cellBounds.x0, 0.001);
  return cell.x + ((worldX - cellBounds.x0) / width) * cell.width;
}

function worldToMinimapY(worldY: number, cellBounds: LspLayoutBounds, cell: PhysicalLayoutMinimapRect): number {
  const height = Math.max(cellBounds.y1 - cellBounds.y0, 0.001);
  return cell.y + ((worldY - cellBounds.y0) / height) * cell.height;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
