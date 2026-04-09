import noteImageSrc from '@/assets/images/whiteboard/note.svg';

import type {
  ToolbarButton, PenSubBarItem, EraserSubBarItem,
  ColorSubBarItem, ShapeSubBarItem, TopSubBarHomeItem,
  VeConfig,
} from './types';

// ─── Asset Exports ──────────────────────────────────────────────────────────

export { noteImageSrc };

// ─── Top Bar ────────────────────────────────────────────────────────────────

export const topBarLeft: ToolbarButton[] = [
  { name: 'ri-home-9-line', tooltip: 'home' },
  { name: 'ri-stack-line', tooltip: 'layer' },
  { name: 'ri-kanban-view', tooltip: 'kanban' },
];

export const topSubBarHome: TopSubBarHomeItem[] = [
  { name: 'open', tooltip: 'xxxx' },
  { name: 'save', tooltip: 'xxxx' },
  { name: 'export', tooltip: 'xxxx' },
  { name: 'shortcuts', tooltip: 'xxxx' },
  { name: 'guide', tooltip: 'xxxx' },
];

export const topBarRight: ToolbarButton[] = [
  { name: 'ri-search-line', tooltip: 'search' },
  { name: 'ri-notification-badge-line', tooltip: 'message' },
  { name: 'ri-ai-generate-2', tooltip: 'ai' },
  { name: 'ri-share-line', tooltip: 'export' },
];

// ─── Bottom Bar Left ────────────────────────────────────────────────────────

export const bottomBarLeft: ToolbarButton[] = [
  { name: 'ri-cursor-line', tooltip: 'select', shortcut: 'S' },
  { name: 'ri-hand', tooltip: 'grab', shortcut: 'G' },
  { name: 'ri-arrow-go-back-line', tooltip: 'undo', shortcut: 'ctrl-Z' },
  { name: 'ri-arrow-go-forward-line', tooltip: 'redo', shortcut: 'ctrl-R' },
];


// ─── Bottom Bar Right ───────────────────────────────────────────────────────

export const bottomBarRight: ToolbarButton[] = [
  { name: 'ri-edit-line', tooltip: 'pen', shortcut: 'Q' },
  { name: 'ri-eraser-line', tooltip: 'eraser', shortcut: 'E' },
  { name: 'ri-text', tooltip: 'text', shortcut: 'T' },
  { name: 'ri-image-line', tooltip: 'image', shortcut: 'I' },
  { name: 'ri-shapes-line', tooltip: 'shape', shortcut: 'D' },
];

// ─── Pen Sub-bars ───────────────────────────────────────────────────────────

export const penSubBarFirst: PenSubBarItem[] = [
  { name: 'ri-ball-pen-line', tooltip: 'pen-ball' },
  { name: 'ri-quill-pen-line', tooltip: 'pen-quill' },
  { name: 'ri-pen-nib-line', tooltip: 'pen-nib' },
  { name: 'ri-mark-pen-line', tooltip: 'pen-mark' },
  { name: 'ri-brush-line', tooltip: 'pen-brush' },
  { name: 'ri-paint-brush-line', tooltip: 'pen-paint' },
];

export const penSubBarSecond: PenSubBarItem[] = [
  { name: 'ri-circle-line', tooltip: 'pen-solid' },
  { name: 'ri-circle-fill', tooltip: 'pen-dash' },
];

export const penSubBarThird: PenSubBarItem[] = [
  { name: 'S', tooltip: 'pen-small' },
  { name: 'M', tooltip: 'pen-medium' },
  { name: 'L', tooltip: 'pen-large' },
];

export const penSubBarFourth: ColorSubBarItem[] = [
  { name: 'bg-black', tooltip: 'pen-black' },
  { name: 'bg-white', tooltip: 'pen-white' },
  { name: 'bg-gray-500', tooltip: 'pen-gray' },
  { name: 'bg-red-500', tooltip: 'pen-red' },
  { name: 'bg-orange-500', tooltip: 'pen-orange' },
  { name: 'bg-yellow-500', tooltip: 'pen-yellow' },
  { name: 'bg-green-500', tooltip: 'pen-green' },
  { name: 'bg-cyan-500', tooltip: 'pen-cyan' },
  { name: 'bg-blue-500', tooltip: 'pen-blue' },
  { name: 'bg-purple-500', tooltip: 'pen-purple' },
];

// ─── Eraser Sub-bar ─────────────────────────────────────────────────────────

export const eraserSubBarFirst: EraserSubBarItem[] = [
  { size: 'w-3 h-3', tooltip: 'earser-small' },
  { size: 'w-4 h-4', tooltip: 'earser-medium' },
  { size: 'w-5 h-5', tooltip: 'earser-large' },
  { size: 'w-6 h-6', tooltip: 'earser-extra large' },
];

// ─── Shape Sub-bar ──────────────────────────────────────────────────────────

export const shapeSubBarFirst: ShapeSubBarItem[] = [
  { name: 'ri-circle-line', tooltip: 'shape-circle' },
  { name: 'ri-triangle-line', tooltip: 'shape-triangle' },
  { name: 'ri-rectangle-line', tooltip: 'shape-rectangle' },
  { name: 'ri-pentagon-line', tooltip: 'shape-pentagon' },
  { name: 'ri-hexagon-line', tooltip: 'shape-hexagon' },
  { name: 'ri-octagon-line', tooltip: 'shape-octagon' },
];

// ─── History Icon Maps ──────────────────────────────────────────────────────

export const veHistoryItemActionMap: Record<string, string> = {
  'init': 'ri-radio-button-line',
  'move': 'ri-drag-move-fill',
  'resize': 'ri-custom-size',
  'add': 'ri-add-box-fill',
  'delete': 'ri-delete-bin-5-fill',
  'paste': 'ri-file-copy-fill',
};

export const veHistoryItemShapeMap: Record<string, string> = {
  'all': 'ri-macbook-line',
  'Circle': 'ri-circle-fill',
  'Triangle': 'ri-triangle-fill',
  'Rect': 'ri-rectangle-fill',
  'Pentagon': 'ri-pentagon-fill',
  'Hexagon': 'ri-hexagon-fill',
  'Octagon': 'ri-octagon-fill',
  'Text': 'ri-t-box-fill',
  'SpecNote': 'ri-sticky-note-fill',
  'Image': 'ri-image-fill',
  'Pen': 'ri-edit-line',
  'Eraser': 'ri-eraser-line',
  'Shapes': 'ri-shapes-fill',
};

// ─── Default Canvas Config ──────────────────────────────────────────────────

export const defaultVeConfig: VeConfig = {
  gridSize: 20,
  gridType: 'point',
  gridLineStrokeWidth: { ver: 1, hor: 0.5 },
  gridPointStrokeWidth: 1.5,
  gridColor: 'rgba(255,255,255,0.2)',
  shapeFillColor: '#4da6ff',
  backgroundColor: '#34495e',
  guidelineOffset: 5,
  minZoom: 0.1,
  maxZoom: 8,
  zoominScale: 1.2,
  zoomoutScale: 0.8,
  placePictureMaxHeight: 10,
};
