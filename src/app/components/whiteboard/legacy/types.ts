import Konva from 'konva';

// ─── Toolbar Button Types ───────────────────────────────────────────────────

export interface ToolbarButton {
  name: string;
  tooltip: string;
  shortcut?: string;
}

export interface PenSubBarItem {
  name: string;
  tooltip: string;
}

export interface EraserSubBarItem {
  size: string;
  tooltip: string;
}

export interface ColorSubBarItem {
  name: string;
  tooltip: string;
}

export type WhiteboardTheme = 'light' | 'dark';

export interface ShapeSubBarItem {
  name: string;
  tooltip: string;
}

export interface TopSubBarHomeItem {
  name: string;
  tooltip: string;
}

// ─── Canvas / Stage Types ───────────────────────────────────────────────────

export interface VeConfig {
  gridSize: number;
  gridType: 'line' | 'point';
  gridLineStrokeWidth: { ver: number; hor: number };
  gridPointStrokeWidth: number;
  gridColor: string;
  shapeFillColor: string;
  backgroundColor: string;
  guidelineOffset: number;
  minZoom: number;
  maxZoom: number;
  zoominScale: number;
  zoomoutScale: number;
  placePictureMaxHeight: number;
}

export interface VeStageState {
  xPos: number;
  yPos: number;
  scale: number;
  isShiftPressed: boolean;
  isCtrlPressed: boolean;
}

export interface LayerControl {
  isHide: boolean;
  isLock: boolean;
}

// ─── History Types ──────────────────────────────────────────────────────────

export interface HistorySnapshot {
  action: string;
  shapeId: number;
  shapeClass: string;
  state: string;
  timestamp: Date;
  size: number;
}

export interface HistoryItem {
  action: string;
  shapeClass: string;
  timestamp: string;
  active: boolean;
}

export interface HistoryState {
  num: number;
  memUsage: number;
  progress: number;
}


// ─── Picture Upload Types ───────────────────────────────────────────────────

export interface PicUploadData {
  uploadImg: HTMLImageElement | null;
  size: number;
}

export type WhiteboardLayerName = 'shape' | 'design' | 'comment';

// ─── Shape In-Page Panel Types ──────────────────────────────────────────────

export interface ShapeInPagePanelState {
  top: number;
  left: number;
  display: string;
}

export interface ShapeInPagePanelTool {
  borderColorPicker: any;
  borderColor: string;
  borderType: string;
  borderStroke: number;
  fillColorPicker: any;
  fillColor: string;
}


// ─── VeSystem Types ─────────────────────────────────────────────────────────

export interface VeSystem {
  stage: Konva.Stage | null;
  xfer: Konva.Transformer | null;
  resizeObsvr: ResizeObserver | null;
  grid: Konva.Group | null;
  clipboard: ClipboardItem[];
  history: VeHistory | null;
  selectedRect: Konva.Rect | null;
  picUploadInputer: HTMLInputElement | null;
}

export interface VeSystemLayer {
  auxBot: Konva.Layer | null;
  shape: Konva.Layer | null;
  design: Konva.Layer | null;
  comment: Konva.Layer | null;
  auxTop: Konva.Layer | null;
}

export interface ClipboardItem {
  obj: Konva.Node;
  shadow: Konva.Node;
  layer: Konva.Layer;
  offset: { x: number; y: number };
}

export interface VeHistory {
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  maxHistory: number;
  memoryLimit: number;
  lastOperationTimestamp: Date | null;
  pushState: (action: string, shapeId: number, shapeClass: string) => void;
  createSnapshot: (action: string, shapeId: number, shapeClass: string, timestamp: Date) => HistorySnapshot;
  undo: () => void;
  redo: () => void;
  restoreState: (stateString: string | null) => void;
  calcMemoryUsage: () => number;
  updateUI: (clickTrigger?: boolean) => void;
  renderHistoryList: (clickTrigger: boolean) => void;
  updateTime: () => void;
}

export type VeSelectedBtn =
  | 'select' | 'grab' | 'undo' | 'redo'
  | 'pen' | 'eraser' | 'text' | 'image' | 'shape';

export interface SelectedRectPosition {
  xPos1: number;
  yPos1: number;
  xPos2: number;
  yPos2: number;
}

export interface PicDOMStruct {
  dropArea: HTMLElement | null;
  previewImg: HTMLImageElement | null;
}
