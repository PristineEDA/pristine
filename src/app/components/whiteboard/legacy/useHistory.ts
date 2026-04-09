import { useRef, useCallback, useState } from 'react';
import Konva from 'konva';
import type { HistorySnapshot, HistoryItem, HistoryState, VeSystemLayer } from './types';

interface UseHistoryOptions {
  maxHistory?: number;
  getSystemLayer: () => VeSystemLayer;
  createShapeFromData: (shapeData: any) => void;
  deleteObj: (node: Konva.Node) => void;
}

export function useHistory({
  maxHistory = 100,
  getSystemLayer,
  createShapeFromData,
  deleteObj,
}: UseHistoryOptions) {
  const undoStackRef = useRef<HistorySnapshot[]>([]);
  const redoStackRef = useRef<HistorySnapshot[]>([]);
  const lastTimestampRef = useRef<Date | null>(null);
  const historyListPanelRef = useRef<HTMLDivElement | null>(null);

  const [historyState, setHistoryState] = useState<HistoryState>({ num: 0, memUsage: 0, progress: 0 });
  const [historyItemList, setHistoryItemList] = useState<HistoryItem[]>([]);

  const calcMemoryUsage = useCallback(() => {
    let total = 0;
    undoStackRef.current.forEach((s) => { total += s.state.length * 2; });
    redoStackRef.current.forEach((s) => { total += s.state.length * 2; });
    return Math.round(total / 1024);
  }, []);

  const renderHistoryList = useCallback((clickTrigger: boolean) => {
    const items: HistoryItem[] = [];

    undoStackRef.current.forEach((snapshot, idx) => {
      items.push({
        action: snapshot.action,
        shapeClass: snapshot.shapeClass,
        timestamp: snapshot.timestamp.toLocaleTimeString(),
        active: idx === undoStackRef.current.length - 1,
      });
    });

    for (let i = redoStackRef.current.length - 1; i >= 0; --i) {
      const snapshot = redoStackRef.current[i];
      if (!snapshot) {
        continue;
      }
      items.push({
        action: snapshot.action,
        shapeClass: snapshot.shapeClass,
        timestamp: snapshot.timestamp.toLocaleTimeString(),
        active: false,
      });
    }

    setHistoryItemList(items);

    if (!clickTrigger && historyListPanelRef.current) {
      requestAnimationFrame(() => {
        if (historyListPanelRef.current) {
          historyListPanelRef.current.scrollTop = historyListPanelRef.current.scrollHeight;
        }
      });
    }
  }, []);

  const updateUI = useCallback((clickTrigger = false) => {
    const num = undoStackRef.current.length + redoStackRef.current.length;
    setHistoryState({
      num,
      memUsage: calcMemoryUsage(),
      progress: (num / maxHistory) * 100,
    });
    renderHistoryList(clickTrigger);
  }, [calcMemoryUsage, maxHistory, renderHistoryList]);

  const createSnapshot = useCallback((action: string, shapeId: number, shapeClass: string, timestamp: Date): HistorySnapshot => {
    const layers = getSystemLayer();
    const layerState: any[] = [];

    layers.shape?.getChildren().forEach((node) => {
      layerState.push({ id: node._id, type: node.getClassName(), attrs: node.getAttrs() });
    });

    layers.design?.getChildren().forEach((node) => {
      layerState.push({ id: node._id, type: node.getClassName(), attrs: node.getAttrs() });
    });

    layers.comment?.getChildren().forEach((node) => {
      layerState.push({ id: node._id, type: node.getClassName(), attrs: node.getAttrs() });
    });

    return {
      action, shapeId, shapeClass,
      state: JSON.stringify(layerState),
      timestamp, size: layerState.length,
    };
  }, [getSystemLayer]);

  const restoreState = useCallback((stateString: string | null) => {
    const layers = getSystemLayer();
    const layerGroups = [layers.shape, layers.design, layers.comment];

    layerGroups.forEach((group) => {
      const nodes = group?.getChildren() ?? [];
      for (let i = nodes.length - 1; i >= 0; --i) {
        const node = nodes[i];
        if (node) {
          deleteObj(node);
        }
      }
    });

    if (!stateString) return;

    const layerState = JSON.parse(stateString);
    layerState.forEach((shapeData: any) => createShapeFromData(shapeData));
  }, [getSystemLayer, deleteObj, createShapeFromData]);

  const pushState = useCallback((action: string, shapeId: number, shapeClass: string) => {
    redoStackRef.current = [];
    const timestamp = new Date();
    const snapshot = createSnapshot(action, shapeId, shapeClass, timestamp);
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > maxHistory) {
      undoStackRef.current.shift();
    }
    lastTimestampRef.current = timestamp;
    updateUI();
  }, [createSnapshot, maxHistory, updateUI]);

  const undo = useCallback(() => {
    if (undoStackRef.current.length - 1 === 0) return;
    const prevState = undoStackRef.current[undoStackRef.current.length - 2];
    restoreState(prevState ? prevState.state : null);
    const snapshot = undoStackRef.current.pop()!;
    redoStackRef.current.push(snapshot);
    updateUI();
  }, [restoreState, updateUI]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const snapshot = redoStackRef.current.pop()!;
    restoreState(snapshot.state);
    undoStackRef.current.push(snapshot);
    updateUI();
  }, [restoreState, updateUI]);

  const handleHistoryItemClick = useCallback((idx: number) => {
    if (idx < undoStackRef.current.length - 1) {
      const prevState = undoStackRef.current[idx];
      restoreState(prevState ? prevState.state : null);
      for (let i = undoStackRef.current.length - 1 - idx; i >= 1; --i) {
        redoStackRef.current.push(undoStackRef.current.pop()!);
      }
      updateUI(true);
    } else if (idx > undoStackRef.current.length - 1) {
      const redoOffset = idx - (undoStackRef.current.length - 1);
      const snapshot = redoStackRef.current[redoStackRef.current.length - redoOffset];
      if (!snapshot) {
        return;
      }
      restoreState(snapshot.state);
      for (let i = redoOffset; i >= 1; --i) {
        undoStackRef.current.push(redoStackRef.current.pop()!);
      }
      updateUI(true);
    }
  }, [restoreState, updateUI]);

  return {
    pushState,
    undo,
    redo,
    handleHistoryItemClick,
    historyState,
    historyItemList,
    historyListPanelRef,
    undoStackRef,
    redoStackRef,
  };
}
