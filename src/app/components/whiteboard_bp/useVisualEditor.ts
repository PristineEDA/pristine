import { useRef, useCallback, useState, useEffect, type ChangeEvent } from 'react';
import Konva from 'konva';
import { useTheme } from '../../context/ThemeContext';
import type {
  LayerControl,
  PicUploadData,
  SelectedRectPosition,
  ShapeInPagePanelState,
  ShapeInPagePanelTool,
  VeConfig,
  VeSelectedBtn,
  VeStageState,
  VeSystem,
  VeSystemLayer,
  WhiteboardLayerName,
} from './types';
import { defaultVeConfig } from './constants';
import { useHistory } from './useHistory';
import { useKeyboard } from './useKeyboard';
import {
  copyObj as copyObjUtil,
  createCircle,
  createFreehandLine,
  createImage,
  createPolygon,
  createRect,
  createShape as createShapeFromSnapshot,
  createText,
  createTriangle,
  deleteObj as deleteObjUtil,
  getPolygonName,
  pasteObj as pasteObjUtil,
} from './shapeFactory';
import {
  WHITEBOARD_SELECTABLE_SELECTOR,
  clampScale,
  getGridRenderMetrics,
  resolveEraserWidth,
  resolvePenStyle,
  resolveShapeTool,
} from './whiteboardUtils';

type DrawingMode = 'pen' | 'eraser' | null;

const EMPTY_SYSTEM: VeSystem = {
  stage: null,
  xfer: null,
  resizeObsvr: null,
  grid: null,
  clipboard: [],
  history: null,
  selectedRect: null,
  picUploadInputer: null,
};

function getSnapPointOnStage(stage: Konva.Stage, gridSize: number) {
  const pointerPos = stage.getRelativePointerPosition();

  if (!pointerPos) {
    return { x: 0, y: 0 };
  }

  return {
    x: Math.round(pointerPos.x / gridSize) * gridSize,
    y: Math.round(pointerPos.y / gridSize) * gridSize,
  };
}

function toHistoryShapeName(name: string) {
  if (name === 'rectangle') {
    return 'Rect';
  }

  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function useVisualEditor() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const picUploadInputRef = useRef<HTMLInputElement>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);

  const veSystemRef = useRef<VeSystem>({ ...EMPTY_SYSTEM });
  const veSystemLayerRef = useRef<VeSystemLayer>({ auxBot: null, shape: null, design: null, comment: null, auxTop: null });
  const selectedRectPosRef = useRef<SelectedRectPosition>({ xPos1: 0, yPos1: 0, xPos2: 0, yPos2: 0 });
  const drawingRef = useRef<{ mode: DrawingMode; line: Konva.Line | null }>({ mode: null, line: null });
  const didInitStageRef = useRef(false);

  const [veConfig] = useState<VeConfig>(defaultVeConfig);
  const [veStageState, setVeStageState] = useState<VeStageState>({
    xPos: 0,
    yPos: 0,
    scale: 1,
    isShiftPressed: false,
    isCtrlPressed: false,
  });
  const veStageStateRef = useRef(veStageState);

  const [veSelectedBtn, setVeSelectedBtn] = useState<VeSelectedBtn>('select');
  const selectedToolRef = useRef<VeSelectedBtn>('select');
  const [veIsGrabbing, setVeIsGrabbing] = useState(false);
  const [veIsCodeFreeze, setVeIsCodeFreeze] = useState(false);
  const { theme: wbTheme } = useTheme();
  const wbThemeRef = useRef<'light' | 'dark'>(wbTheme);
  const [, setVeKeyboardKey] = useState('none');
  const [isTopBarLeftHomeBtnClick, setIsTopBarLeftHomeBtnClick] = useState(false);

  const [veGridLayerControl, setVeGridLayerControl] = useState<LayerControl>({ isHide: false, isLock: false });
  const [veShapeLayerControl, setVeShapeLayerControl] = useState<LayerControl>({ isHide: false, isLock: false });
  const [veDesignLayerControl, setVeDesignLayerControl] = useState<LayerControl>({ isHide: false, isLock: false });
  const [veCommentLayerControl, setVeCommentLayerControl] = useState<LayerControl>({ isHide: false, isLock: false });
  const shapeLayerControlRef = useRef(veShapeLayerControl);
  const designLayerControlRef = useRef(veDesignLayerControl);
  const commentLayerControlRef = useRef(veCommentLayerControl);
  const gridLayerControlRef = useRef(veGridLayerControl);

  const [vePicUploadBtnIdx, setVePicUploadBtnIdx] = useState(0);
  const [vePicPreviewDataList, setVePicPreviewDataList] = useState<PicUploadData[]>([
    { uploadImg: null, size: 0 },
    { uploadImg: null, size: 0 },
    { uploadImg: null, size: 0 },
  ]);
  const vePicPreviewDataListRef = useRef(vePicPreviewDataList);

  const [veShapeInPagePanelState, setVeShapeInPagePanelState] = useState<ShapeInPagePanelState>({ top: 0, left: 0, display: 'none' });
  const [veShapeInPagePanelTool] = useState<ShapeInPagePanelTool>({
    borderColorPicker: null,
    borderColor: 'rgba(255, 0, 0, 1)',
    borderType: 'line',
    borderStroke: 1,
    fillColorPicker: null,
    fillColor: 'rgba(255, 0, 0, 1)',
  });

  const [selectedPenSubBarFirst, setSelectedPenSubBarFirst] = useState('pen-ball');
  const [selectedPenSubBarSecond, setSelectedPenSubBarSecond] = useState('pen-solid');
  const [selectedPenSubBarThird, setSelectedPenSubBarThird] = useState('pen-small');
  const [selectedPenSubBarFourth, setSelectedPenSubBarFourth] = useState('pen-black');
  const [selectedEraserSubBarFirst, setSelectedEraserSubBarFirst] = useState('earser-small');
  const [selectedShapeSubBarFirst, setSelectedShapeSubBarFirst] = useState('shape-circle');
  const penModeRef = useRef({
    tip: selectedPenSubBarFirst,
    dash: selectedPenSubBarSecond,
    size: selectedPenSubBarThird,
    color: selectedPenSubBarFourth,
    eraserSize: selectedEraserSubBarFirst,
    shape: selectedShapeSubBarFirst,
  });

  useEffect(() => {
    veStageStateRef.current = veStageState;
  }, [veStageState]);

  useEffect(() => {
    selectedToolRef.current = veSelectedBtn;
  }, [veSelectedBtn]);

  useEffect(() => {
    wbThemeRef.current = wbTheme;
  }, [wbTheme]);

  useEffect(() => {
    shapeLayerControlRef.current = veShapeLayerControl;
  }, [veShapeLayerControl]);

  useEffect(() => {
    designLayerControlRef.current = veDesignLayerControl;
  }, [veDesignLayerControl]);

  useEffect(() => {
    commentLayerControlRef.current = veCommentLayerControl;
  }, [veCommentLayerControl]);

  useEffect(() => {
    gridLayerControlRef.current = veGridLayerControl;
  }, [veGridLayerControl]);

  useEffect(() => {
    vePicPreviewDataListRef.current = vePicPreviewDataList;
  }, [vePicPreviewDataList]);

  useEffect(() => {
    penModeRef.current = {
      tip: selectedPenSubBarFirst,
      dash: selectedPenSubBarSecond,
      size: selectedPenSubBarThird,
      color: selectedPenSubBarFourth,
      eraserSize: selectedEraserSubBarFirst,
      shape: selectedShapeSubBarFirst,
    };
  }, [
    selectedPenSubBarFirst,
    selectedPenSubBarSecond,
    selectedPenSubBarThird,
    selectedPenSubBarFourth,
    selectedEraserSubBarFirst,
    selectedShapeSubBarFirst,
  ]);

  const setVeStageStatePartial = useCallback((patch: Partial<VeStageState>) => {
    setVeStageState((current) => {
      const next = { ...current, ...patch };
      veStageStateRef.current = next;
      return next;
    });
  }, []);

  const getSystemLayer = useCallback(() => veSystemLayerRef.current, []);

  const deleteObj = useCallback((node: Konva.Node) => {
    deleteObjUtil(node, veSystemLayerRef.current);
  }, []);

  const createShapeFromData = useCallback((shapeData: unknown) => {
    createShapeFromSnapshot(shapeData, veConfig, veSystemLayerRef.current, undefined, veSystemRef.current);
  }, [veConfig]);

  const {
    pushState,
    undo,
    redo,
    handleHistoryItemClick,
    historyState,
    historyItemList,
    historyListPanelRef,
  } = useHistory({
    maxHistory: 100,
    getSystemLayer,
    createShapeFromData,
    deleteObj,
  });

  const updatePreview = useCallback(() => {
    const stage = veSystemRef.current.stage;
    const preview = previewImgRef.current;

    if (!stage || !preview) {
      return;
    }

    try {
      preview.src = stage.toDataURL({ mimeType: 'image/png', pixelRatio: 1 / 3, quality: 1 });
    } catch {
      // ignore preview generation failures in test and CORS-limited scenarios
    }
  }, []);

  const isLayerLocked = useCallback((layerName: WhiteboardLayerName) => {
    if (layerName === 'comment') {
      return commentLayerControlRef.current.isLock;
    }

    if (layerName === 'design') {
      return designLayerControlRef.current.isLock;
    }

    return shapeLayerControlRef.current.isLock;
  }, []);

  const getNodeLayerName = useCallback((node: Konva.Node): WhiteboardLayerName => {
    const attrsLayer = (node.getAttrs() as { boardLayer?: WhiteboardLayerName }).boardLayer;
    if (attrsLayer) {
      return attrsLayer;
    }

    if (node.getLayer() === veSystemLayerRef.current.comment) {
      return 'comment';
    }

    if (node.getLayer() === veSystemLayerRef.current.design) {
      return 'design';
    }

    return 'shape';
  }, []);

  const syncInteractionMode = useCallback(() => {
    const stage = veSystemRef.current.stage;
    if (!stage) {
      return;
    }

    stage.draggable(selectedToolRef.current === 'grab');
    stage.find(WHITEBOARD_SELECTABLE_SELECTOR).forEach((node) => {
      const layerName = getNodeLayerName(node);
      node.draggable(selectedToolRef.current === 'select' && !isLayerLocked(layerName));
    });
    stage.batchDraw();
  }, [getNodeLayerName, isLayerLocked]);

  const renderGrid = useCallback(() => {
    const stage = veSystemRef.current.stage;
    const grid = veSystemRef.current.grid;

    if (!stage || !grid) {
      return;
    }

    grid.visible(!gridLayerControlRef.current.isHide);
    grid.destroyChildren();

    if (gridLayerControlRef.current.isHide) {
      stage.batchDraw();
      return;
    }

    const scale = stage.scaleX() || 1;
    const metrics = getGridRenderMetrics(stage.width(), stage.height(), stage.x(), stage.y(), scale, veConfig.gridSize);
    const pointRadius = Math.max(0.7, veConfig.gridPointStrokeWidth / Math.max(scale, 0.5));
    const lineColor = wbThemeRef.current === 'light' ? '#d7dbe3' : '#30343d';
    const pointColor = wbThemeRef.current === 'light' ? '#b0b6c2' : '#4b5563';

    if (veConfig.gridType === 'line') {
      for (let x = metrics.startX; x <= metrics.endX; x += metrics.spacing) {
        grid.add(new Konva.Line({
          points: [x, metrics.startY, x, metrics.endY],
          stroke: lineColor,
          strokeWidth: veConfig.gridLineStrokeWidth.ver,
          listening: false,
        }));
      }

      for (let y = metrics.startY; y <= metrics.endY; y += metrics.spacing) {
        grid.add(new Konva.Line({
          points: [metrics.startX, y, metrics.endX, y],
          stroke: lineColor,
          strokeWidth: veConfig.gridLineStrokeWidth.hor,
          listening: false,
        }));
      }
    } else {
      for (let x = metrics.startX; x <= metrics.endX; x += metrics.spacing) {
        for (let y = metrics.startY; y <= metrics.endY; y += metrics.spacing) {
          grid.add(new Konva.Circle({
            x,
            y,
            radius: pointRadius,
            fill: pointColor,
            listening: false,
          }));
        }
      }
    }

    stage.batchDraw();
  }, [veConfig]);

  const handleVEZoom = useCallback((delta: number) => {
    const stage = veSystemRef.current.stage;
    if (!stage) {
      return;
    }

    const oldScale = stage.scaleX() || 1;
    const pointer = stage.getPointerPosition() ?? { x: stage.width() / 2, y: stage.height() / 2 };
    const nextScale = clampScale(oldScale * delta, veConfig.minZoom, veConfig.maxZoom);
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    stage.scale({ x: nextScale, y: nextScale });
    stage.position({
      x: pointer.x - mousePointTo.x * nextScale,
      y: pointer.y - mousePointTo.y * nextScale,
    });

    setVeStageStatePartial({
      scale: nextScale,
      xPos: pointer.x,
      yPos: pointer.y,
    });
    renderGrid();
    updatePreview();
  }, [renderGrid, setVeStageStatePartial, updatePreview, veConfig.maxZoom, veConfig.minZoom]);

  const handleVEZoomReset = useCallback(() => {
    const stage = veSystemRef.current.stage;
    if (!stage) {
      return;
    }

    stage.position({ x: 0, y: 0 });
    stage.scale({ x: 1, y: 1 });
    setVeStageStatePartial({ xPos: 0, yPos: 0, scale: 1 });
    renderGrid();
    updatePreview();
  }, [renderGrid, setVeStageStatePartial, updatePreview]);

  const applyShapeTool = useCallback(() => {
    const stage = veSystemRef.current.stage;
    if (!stage || isLayerLocked('shape')) {
      return;
    }

    const pointer = getSnapPointOnStage(stage, veConfig.gridSize);
    const shape = resolveShapeTool(penModeRef.current.shape, veConfig);

    if (shape.kind === 'circle') {
      createCircle(pointer.x, pointer.y, veConfig, veSystemLayerRef.current, pushState, veSystemRef.current);
    } else if (shape.kind === 'triangle') {
      createTriangle(pointer.x, pointer.y, veConfig, veSystemLayerRef.current, pushState, veSystemRef.current);
    } else if (shape.kind === 'rectangle') {
      createRect(
        pointer.x - (shape.width ?? 0) / 2,
        pointer.y - (shape.height ?? 0) / 2,
        shape.width ?? veConfig.gridSize * 6,
        shape.height ?? veConfig.gridSize * 4,
        veConfig,
        veSystemLayerRef.current,
        pushState,
        undefined,
        undefined,
        false,
        undefined,
        false,
        veSystemRef.current,
      );
    } else {
      createPolygon(
        pointer.x,
        pointer.y,
        shape.sides ?? 5,
        shape.radius ?? veConfig.gridSize * 3,
        shape.name,
        veConfig,
        veSystemLayerRef.current,
        pushState,
        veSystemRef.current,
      );
    }

    pushState('add', -1, toHistoryShapeName(shape.name));
    syncInteractionMode();
    updatePreview();
  }, [isLayerLocked, pushState, syncInteractionMode, updatePreview, veConfig]);

  const startDrawingStroke = useCallback((mode: Exclude<DrawingMode, null>) => {
    const stage = veSystemRef.current.stage;

    if (!stage || isLayerLocked('comment')) {
      return;
    }

    const pointer = stage.getRelativePointerPosition();
    if (!pointer) {
      return;
    }

    if (mode === 'pen') {
      const penStyle = resolvePenStyle(
        penModeRef.current.size,
        penModeRef.current.color,
        penModeRef.current.dash,
      );

      drawingRef.current = {
        mode,
        line: createFreehandLine([pointer.x, pointer.y], {
          stroke: penStyle.color,
          strokeWidth: penStyle.strokeWidth,
          dash: penStyle.dash,
          name: 'pen-stroke',
        }, veSystemLayerRef.current),
      };
      return;
    }

    drawingRef.current = {
      mode,
      line: createFreehandLine([pointer.x, pointer.y], {
        stroke: '#000000',
        strokeWidth: resolveEraserWidth(penModeRef.current.eraserSize),
        globalCompositeOperation: 'destination-out',
        name: 'eraser-stroke',
      }, veSystemLayerRef.current),
    };
  }, [isLayerLocked]);

  const continueDrawingStroke = useCallback(() => {
    const stage = veSystemRef.current.stage;
    const activeLine = drawingRef.current.line;
    if (!stage || !activeLine) {
      return;
    }

    const point = stage.getRelativePointerPosition();
    if (!point) {
      return;
    }

    activeLine.points(activeLine.points().concat([point.x, point.y]));
    activeLine.getLayer()?.batchDraw();
  }, []);

  const finishDrawingStroke = useCallback(() => {
    if (!drawingRef.current.line) {
      return;
    }

    pushState(
      drawingRef.current.mode === 'eraser' ? 'delete' : 'add',
      -1,
      drawingRef.current.mode === 'eraser' ? 'Eraser' : 'Pen',
    );
    drawingRef.current = { mode: null, line: null };
    updatePreview();
  }, [pushState, updatePreview]);

  const handleCanvasDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
  }, []);

  const handleCanvasDrop = useCallback((event: DragEvent) => {
    event.preventDefault();
    const stage = veSystemRef.current.stage;

    if (!stage || isLayerLocked('comment')) {
      return;
    }

    stage.setPointersPositions(event);
    const pointer = getSnapPointOnStage(stage, veConfig.gridSize);
    const elemType = event.dataTransfer?.getData('elem-type');

    if (elemType === 'spec-note') {
      const size = veConfig.gridSize * 8;
      createRect(
        pointer.x - size / 2,
        pointer.y - size / 2,
        size,
        size,
        veConfig,
        veSystemLayerRef.current,
        pushState,
        'gray',
        '#F3F1B1',
        true,
        'rgba(255,255,255,0.5)',
        true,
        veSystemRef.current,
      );
      pushState('add', -1, 'SpecNote');
      syncInteractionMode();
      updatePreview();
      return;
    }

    if (elemType === 'picture') {
      const index = parseInt(event.dataTransfer?.getData('elem-idx') ?? '0', 10);
      const picture = vePicPreviewDataListRef.current[index];

      if (!picture?.uploadImg || picture.size === 0) {
        return;
      }

      const rawWidth = picture.uploadImg.width;
      const rawHeight = picture.uploadImg.height;
      let scale = Math.round(rawHeight / (veConfig.gridSize * veConfig.placePictureMaxHeight));
      if (scale === 0) {
        scale = 1;
      }

      createImage(
        pointer.x,
        pointer.y,
        rawWidth / scale,
        rawHeight / scale,
        picture.uploadImg.src,
        veConfig,
        veSystemLayerRef.current,
        pushState,
        veSystemRef.current,
        () => {
          pushState('add', -1, 'Image');
          syncInteractionMode();
          updatePreview();
        },
      );
    }
  }, [isLayerLocked, pushState, syncInteractionMode, updatePreview, veConfig]);

  const copyObj = useCallback(() => {
    copyObjUtil(veSystemRef.current, veSystemLayerRef.current, veConfig);
  }, [veConfig]);

  const pasteObj = useCallback(() => {
    pasteObjUtil(veSystemRef.current, veSystemLayerRef.current, veConfig);
    syncInteractionMode();
    pushState('paste', -1, 'Shapes');
    updatePreview();
  }, [pushState, syncInteractionMode, updatePreview, veConfig]);

  const handleDelete = useCallback(() => {
    const transformer = veSystemRef.current.xfer;
    if (!transformer) {
      return;
    }

    const nodes = transformer.nodes();
    if (nodes.length === 0) {
      return;
    }

    pushState('delete', -1, nodes.length === 1 ? getPolygonName(nodes[0]!) : 'Shapes');

    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index];
      if (node) {
        deleteObj(node);
      }
    }

    transformer.nodes([]);
    updatePreview();
  }, [deleteObj, pushState, updatePreview]);

  const onSelectAll = useCallback(() => {
    const stage = veSystemRef.current.stage;
    const transformer = veSystemRef.current.xfer;
    if (!stage || !transformer) {
      return;
    }

    transformer.nodes(stage.find(WHITEBOARD_SELECTABLE_SELECTOR).filter((node) => node.visible()));
  }, []);

  const onDeselectAll = useCallback(() => {
    veSystemRef.current.xfer?.nodes([]);
  }, []);

  const toggleLayerVisibility = useCallback((layerName: WhiteboardLayerName) => {
    const layerMap = {
      shape: [veSystemLayerRef.current.shape, setVeShapeLayerControl],
      design: [veSystemLayerRef.current.design, setVeDesignLayerControl],
      comment: [veSystemLayerRef.current.comment, setVeCommentLayerControl],
    } as const;

    const [layer, setControl] = layerMap[layerName];
    setControl((current) => {
      const next = { ...current, isHide: !current.isHide };
      layer?.visible(!next.isHide);
      syncInteractionMode();
      updatePreview();
      return next;
    });
  }, [syncInteractionMode, updatePreview]);

  const handleGridLayerHideClick = useCallback(() => {
    setVeGridLayerControl((current) => {
      const next = { ...current, isHide: !current.isHide };
      gridLayerControlRef.current = next;
      renderGrid();
      return next;
    });
  }, [renderGrid]);

  const handleShapeLayerHideClick = useCallback(() => {
    toggleLayerVisibility('shape');
  }, [toggleLayerVisibility]);

  const handleDesignLayerHideClick = useCallback(() => {
    toggleLayerVisibility('design');
  }, [toggleLayerVisibility]);

  const handleCommentLayerHideClick = useCallback(() => {
    toggleLayerVisibility('comment');
  }, [toggleLayerVisibility]);

  const handleBottomBarLeftBtnClick = useCallback((tooltip: string) => {
    if (tooltip === 'undo') {
      undo();
      updatePreview();
      return;
    }

    if (tooltip === 'redo') {
      redo();
      updatePreview();
      return;
    }

    setVeSelectedBtn(tooltip as VeSelectedBtn);
  }, [redo, undo, updatePreview]);

  const exportCanvas = useCallback(() => {
    const stage = veSystemRef.current.stage;
    if (!stage) {
      return;
    }

    const dataURL = stage.toDataURL({ mimeType: 'image/png', pixelRatio: 2, quality: 1 });
    const link = document.createElement('a');
    link.download = 'canvas-drawing.png';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleImageFileUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.match('image.*')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const imgURL = (loadEvent.target as FileReader).result as string;
      const img = new Image();
      img.src = imgURL;
      img.onload = () => {
        setVePicPreviewDataList((current) => {
          const next = [...current];
          next[vePicUploadBtnIdx] = {
            uploadImg: img,
            size: parseFloat((file.size / 1024).toFixed(1)),
          };
          return next;
        });
      };
    };

    reader.readAsDataURL(file);
  }, [vePicUploadBtnIdx]);

  const handlePicUploadBtnClick = useCallback((index: number) => {
    setVePicUploadBtnIdx(index);
    picUploadInputRef.current?.click();
  }, []);

  useKeyboard({
    veSelectedBtn,
    setVeSelectedBtn,
    setVeKeyboardKey,
    setVeStageStatePartial,
    isTopBarLeftHomeBtnClick,
    setIsTopBarLeftHomeBtnClick,
    onSelectAll,
    onCopy: copyObj,
    onPaste: pasteObj,
    onUndo: undo,
    onRedo: redo,
    onDelete: handleDelete,
    onDeselectAll,
  });

  const setupCanvasEvents = useCallback((stage: Konva.Stage) => {
    stage.off('wheel');
    stage.off('mousedown touchstart');
    stage.off('mousemove touchmove');
    stage.off('mouseup touchend');
    stage.off('click tap');
    stage.off('dragmove dragend');

    stage.on('wheel', (event) => {
      event.evt.preventDefault();

      if (event.evt.ctrlKey || event.evt.metaKey) {
        handleVEZoom(event.evt.deltaY > 0 ? veConfig.zoomoutScale : veConfig.zoominScale);
        return;
      }

      if (event.evt.shiftKey) {
        stage.move({ x: -event.evt.deltaY, y: 0 });
      } else {
        stage.move({ x: 0, y: -event.evt.deltaY });
      }

      renderGrid();
      updatePreview();
    });

    stage.on('dragmove', () => {
      renderGrid();
      updatePreview();
    });

    stage.on('dragend', () => {
      renderGrid();
      updatePreview();
      setVeIsGrabbing(false);
    });

    stage.on('mousedown touchstart', (event) => {
      const tool = selectedToolRef.current;

      if (tool === 'pen' || tool === 'eraser') {
        startDrawingStroke(tool);
        return;
      }

      if (tool === 'grab') {
        setVeIsGrabbing(true);
        return;
      }

      if (tool !== 'select' || event.target !== stage) {
        return;
      }

      const pointer = stage.getRelativePointerPosition();
      if (!pointer) {
        return;
      }

      selectedRectPosRef.current = {
        xPos1: pointer.x,
        yPos1: pointer.y,
        xPos2: pointer.x,
        yPos2: pointer.y,
      };
      veSystemRef.current.selectedRect?.setAttrs({
        x: pointer.x,
        y: pointer.y,
        width: 0,
        height: 0,
        visible: true,
      });
    });

    stage.on('mousemove touchmove', () => {
      const pointer = stage.getRelativePointerPosition();
      if (pointer) {
        setVeStageStatePartial({ xPos: pointer.x, yPos: pointer.y });
      }

      if (drawingRef.current.line) {
        continueDrawingStroke();
        return;
      }

      if (selectedToolRef.current !== 'select' || !veSystemRef.current.selectedRect?.visible()) {
        return;
      }

      if (!pointer) {
        return;
      }

      selectedRectPosRef.current.xPos2 = pointer.x;
      selectedRectPosRef.current.yPos2 = pointer.y;
      const rectPos = selectedRectPosRef.current;
      veSystemRef.current.selectedRect?.setAttrs({
        x: Math.min(rectPos.xPos1, rectPos.xPos2),
        y: Math.min(rectPos.yPos1, rectPos.yPos2),
        width: Math.abs(rectPos.xPos2 - rectPos.xPos1),
        height: Math.abs(rectPos.yPos2 - rectPos.yPos1),
      });
    });

    stage.on('mouseup touchend', () => {
      if (drawingRef.current.line) {
        finishDrawingStroke();
        return;
      }

      if (selectedToolRef.current === 'grab') {
        setVeIsGrabbing(false);
      }

      if (selectedToolRef.current !== 'select' || !veSystemRef.current.selectedRect?.visible()) {
        return;
      }

      const selectionBox = veSystemRef.current.selectedRect.getClientRect();
      const nodes = stage.find(WHITEBOARD_SELECTABLE_SELECTOR).filter((node) => (
        node.visible() && Konva.Util.haveIntersection(selectionBox, node.getClientRect())
      ));

      veSystemRef.current.selectedRect.visible(false);
      veSystemRef.current.xfer?.nodes(nodes);
    });

    stage.on('click tap', (event) => {
      const tool = selectedToolRef.current;

      if (tool === 'text' && event.target === stage && !isLayerLocked('comment')) {
        const pointer = getSnapPointOnStage(stage, veConfig.gridSize);
        createText(pointer.x, pointer.y, 'text', veConfig, veSystemLayerRef.current, pushState, veSystemRef.current);
        pushState('add', -1, 'Text');
        syncInteractionMode();
        updatePreview();
        return;
      }

      if (tool === 'shape' && event.target === stage) {
        applyShapeTool();
        return;
      }

      if (tool !== 'select') {
        return;
      }

      if (veSystemRef.current.selectedRect?.visible()) {
        return;
      }

      if (event.target === stage) {
        veSystemRef.current.xfer?.nodes([]);
        setVeShapeInPagePanelState((current) => ({ ...current, display: 'none' }));
        return;
      }

      if (!event.target.hasName('circle') && !event.target.hasName('triangle') && !event.target.hasName('rectangle') &&
        !event.target.hasName('pentagon') && !event.target.hasName('hexagon') && !event.target.hasName('octagon') &&
        !event.target.hasName('text') && !event.target.hasName('image')) {
        return;
      }

      if (isLayerLocked(getNodeLayerName(event.target))) {
        return;
      }

      const isMetaPressed = event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey;
      const currentNodes = veSystemRef.current.xfer?.nodes() ?? [];
      const isSelected = currentNodes.includes(event.target);

      if (!isMetaPressed) {
        veSystemRef.current.xfer?.nodes([event.target]);
      } else if (isSelected) {
        veSystemRef.current.xfer?.nodes(currentNodes.filter((node) => node !== event.target));
      } else {
        veSystemRef.current.xfer?.nodes(currentNodes.concat(event.target));
      }
    });
  }, [
    applyShapeTool,
    continueDrawingStroke,
    finishDrawingStroke,
    getNodeLayerName,
    handleVEZoom,
    isLayerLocked,
    pushState,
    renderGrid,
    setVeStageStatePartial,
    startDrawingStroke,
    syncInteractionMode,
    updatePreview,
    veConfig,
  ]);

  const initStage = useCallback((width: number, height: number) => {
    if (!didInitStageRef.current) {
      const stage = new Konva.Stage({ container: 'konva-veStage', width, height });
      veSystemRef.current.stage = stage;

      const layers: VeSystemLayer = {
        auxBot: new Konva.Layer(),
        shape: new Konva.Layer(),
        design: new Konva.Layer(),
        comment: new Konva.Layer(),
        auxTop: new Konva.Layer(),
      };
      veSystemLayerRef.current = layers;

      stage.add(layers.auxBot!);
      stage.add(layers.shape!);
      stage.add(layers.design!);
      stage.add(layers.comment!);
      stage.add(layers.auxTop!);

      const transformer = new Konva.Transformer({
        centeredScaling: false,
        keepRatio: false,
        rotateEnabled: false,
        ignoreStroke: true,
      });
      transformer.anchorDragBoundFunc((_oldPos, nextPos) => ({
        x: Math.round(nextPos.x / veConfig.gridSize) * veConfig.gridSize,
        y: Math.round(nextPos.y / veConfig.gridSize) * veConfig.gridSize,
      }));
      transformer.on('transformend', () => {
        transformer.nodes().forEach((node) => {
          if (node instanceof Konva.Circle || node instanceof Konva.RegularPolygon) {
            node.radius(node.radius() * node.scaleX());
          } else if (node instanceof Konva.Rect || node instanceof Konva.Text || node instanceof Konva.Image) {
            node.width(node.width() * node.scaleX());
            node.height(node.height() * node.scaleY());
          }
          node.scale({ x: 1, y: 1 });
          pushState('resize', -1, getPolygonName(node));
        });
        updatePreview();
      });
      veSystemRef.current.xfer = transformer;
      layers.auxTop!.add(transformer);

      const selectionRect = new Konva.Rect({ fill: 'rgba(220,234,245,0.25)', visible: false, listening: false });
      veSystemRef.current.selectedRect = selectionRect;
      layers.auxBot!.add(selectionRect);

      const grid = new Konva.Group({ listening: false });
      veSystemRef.current.grid = grid;
      layers.auxBot!.add(grid);

      const stageContainer = stage.container();
      stageContainer.addEventListener('dragover', handleCanvasDragOver);
      stageContainer.addEventListener('drop', handleCanvasDrop as EventListener);

      setupCanvasEvents(stage);
      didInitStageRef.current = true;
      pushState('init', -1, 'all');
    }

    const stage = veSystemRef.current.stage;
    if (!stage) {
      return;
    }

    stage.size({ width, height });
    syncInteractionMode();
    renderGrid();
    updatePreview();
  }, [handleCanvasDragOver, handleCanvasDrop, pushState, renderGrid, setupCanvasEvents, syncInteractionMode, updatePreview, veConfig.gridSize]);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          initStage(width, height);
        }
      });
    });

    observer.observe(container);
    veSystemRef.current.resizeObsvr = observer;

    return () => {
      observer.disconnect();
      const stage = veSystemRef.current.stage;
      if (stage) {
        stage.container().removeEventListener('dragover', handleCanvasDragOver);
        stage.container().removeEventListener('drop', handleCanvasDrop as EventListener);
        stage.destroy();
      }
      veSystemRef.current = { ...EMPTY_SYSTEM };
      didInitStageRef.current = false;
    };
  }, [handleCanvasDragOver, handleCanvasDrop, initStage]);

  useEffect(() => {
    syncInteractionMode();
  }, [syncInteractionMode, veSelectedBtn, veShapeLayerControl, veDesignLayerControl, veCommentLayerControl]);

  useEffect(() => {
    renderGrid();
    updatePreview();
  }, [renderGrid, updatePreview, wbTheme]);

  return {
    canvasContainerRef,
    picUploadInputRef,
    previewImgRef,
    veConfig,
    veStageState,
    veSelectedBtn,
    setVeSelectedBtn,
    veIsGrabbing,
    veIsCodeFreeze,
    setVeIsCodeFreeze,
    wbTheme,
    isTopBarLeftHomeBtnClick,
    setIsTopBarLeftHomeBtnClick,
    veGridLayerControl,
    veShapeLayerControl,
    veDesignLayerControl,
    veCommentLayerControl,
    handleGridLayerHideClick,
    handleShapeLayerHideClick,
    handleDesignLayerHideClick,
    handleCommentLayerHideClick,
    setVeShapeLayerControl,
    setVeDesignLayerControl,
    setVeCommentLayerControl,
    vePicUploadBtnIdx,
    vePicPreviewDataList,
    handlePicUploadBtnClick,
    handleImageFileUpload,
    veShapeInPagePanelState,
    veShapeInPagePanelTool,
    selectedPenSubBarFirst,
    setSelectedPenSubBarFirst,
    selectedPenSubBarSecond,
    setSelectedPenSubBarSecond,
    selectedPenSubBarThird,
    setSelectedPenSubBarThird,
    selectedPenSubBarFourth,
    setSelectedPenSubBarFourth,
    selectedEraserSubBarFirst,
    setSelectedEraserSubBarFirst,
    selectedShapeSubBarFirst,
    setSelectedShapeSubBarFirst,
    historyState,
    historyItemList,
    historyListPanelRef,
    handleHistoryItemClick,
    handleVEZoom,
    handleVEZoomReset,
    handleBottomBarLeftBtnClick,
    exportCanvas,
    undo,
    redo,
  };
}