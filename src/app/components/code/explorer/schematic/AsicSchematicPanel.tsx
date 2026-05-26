import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Home, Maximize2, RotateCcw, Spline } from 'lucide-react';

import { useTheme } from '../../../../context/ThemeContext';
import { Button } from '../../../ui/button';
import { TooltipIconButton } from '../../../ui/tooltip-icon-button';
import { AsicSchematicCanvas, type AsicSchematicCanvasHandle } from './AsicSchematicCanvas';
import { applySchematicNodePositions, findModulePath, layoutAsicSchematic, schematicGridSize, type SchematicNodePositionOverrides } from './asicSchematicLayout';
import { mockAsicSchematicGraph } from './asicSchematicMockData';
import type { SchematicLayoutResult } from './asicSchematicTypes';

interface CameraSnapshot {
  x: number;
  y: number;
  zoom: number;
}

export function AsicSchematicPanel() {
  const { theme, themeId } = useTheme();
  const canvasRef = useRef<AsicSchematicCanvasHandle | null>(null);
  const [moduleId, setModuleId] = useState(mockAsicSchematicGraph.rootModuleId);
  const [layout, setLayout] = useState<SchematicLayoutResult | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [backStack, setBackStack] = useState<string[]>([]);
  const [forwardStack, setForwardStack] = useState<string[]>([]);
  const [camera, setCamera] = useState<CameraSnapshot>({ x: 0, y: 0, zoom: 1 });
  const [renderer, setRenderer] = useState('initializing');
  const [layoutState, setLayoutState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [positionOverridesByModule, setPositionOverridesByModule] = useState<Record<string, SchematicNodePositionOverrides>>({});

  const modulePath = useMemo(() => findModulePath(mockAsicSchematicGraph, moduleId), [moduleId]);
  const activeModule = mockAsicSchematicGraph.modules[moduleId];
  const activeLayout = useMemo(
    () => layout ? applySchematicNodePositions(layout, positionOverridesByModule[moduleId] ?? {}) : null,
    [layout, moduleId, positionOverridesByModule],
  );
  const selectedNode = selectedNodeIds.length === 1 ? activeLayout?.nodes.find((node) => node.id === selectedNodeIds[0]) ?? null : null;
  const selectedEdge = selectedEdgeIds.length === 1 ? activeLayout?.edges.find((edge) => edge.id === selectedEdgeIds[0]) ?? null : null;
  const parentModuleId = modulePath.length > 1 ? modulePath[modulePath.length - 2]?.id ?? null : null;
  const nextChildModuleId = forwardStack[0] ?? null;

  const handleEnterModule = useCallback((nextModuleId: string) => {
    if (nextModuleId === moduleId) {
      return;
    }

    setBackStack((currentStack) => [...currentStack, moduleId]);
    setForwardStack([]);
    setModuleId(nextModuleId);
  }, [moduleId]);

  const handleGoParentModule = useCallback(() => {
    const nextModuleId = backStack[backStack.length - 1] ?? parentModuleId;

    if (!nextModuleId) {
      return;
    }

    setBackStack((currentStack) => currentStack.length > 0 ? currentStack.slice(0, -1) : currentStack);
    setForwardStack((currentStack) => [moduleId, ...currentStack.filter((candidate) => candidate !== moduleId)]);
    setModuleId(nextModuleId);
  }, [backStack, moduleId, parentModuleId]);

  const handleGoNextChildModule = useCallback(() => {
    if (!nextChildModuleId) {
      return;
    }

    setForwardStack((currentStack) => currentStack.slice(1));
    setBackStack((currentStack) => [...currentStack, moduleId]);
    setModuleId(nextChildModuleId);
  }, [moduleId, nextChildModuleId]);

  const handleDirectModuleNavigation = useCallback((nextModuleId: string) => {
    setBackStack([]);
    setForwardStack([]);
    setModuleId(nextModuleId);
  }, []);

  const handleNodePositionsChange = useCallback((positions: SchematicNodePositionOverrides, movedNodeIds: readonly string[]) => {
    setPositionOverridesByModule((currentOverrides) => {
      const moduleOverrides = currentOverrides[moduleId] ?? {};
      const mergedOverrides = {
        ...moduleOverrides,
        ...positions,
      };

      if (!layout) {
        return {
          ...currentOverrides,
          [moduleId]: mergedOverrides,
        };
      }

      const resolvedLayout = applySchematicNodePositions(layout, mergedOverrides, {
        avoidOverlaps: true,
        snapToGrid: true,
        gridSize: schematicGridSize,
        selectedNodeIds: movedNodeIds,
      });
      const resolvedOverrides = { ...mergedOverrides };
      movedNodeIds.forEach((nodeId) => {
        const resolvedNode = resolvedLayout.nodes.find((node) => node.id === nodeId);

        if (resolvedNode) {
          resolvedOverrides[nodeId] = { x: resolvedNode.x, y: resolvedNode.y };
        }
      });

      if (Object.entries(resolvedOverrides).every(([nodeId, position]) => {
        const currentPosition = moduleOverrides[nodeId];

        return currentPosition?.x === position?.x && currentPosition?.y === position?.y;
      })) {
        return currentOverrides;
      }

      return {
        ...currentOverrides,
        [moduleId]: resolvedOverrides,
      };
    });
  }, [layout, moduleId]);

  const handleNodeSelectionChange = useCallback((nodeIds: string[]) => {
    setSelectedNodeIds(nodeIds);
    if (nodeIds.length > 0) {
      setSelectedEdgeIds([]);
    }
  }, []);

  const handleEdgeSelectionChange = useCallback((edgeIds: string[]) => {
    setSelectedEdgeIds(edgeIds);
    if (edgeIds.length > 0) {
      setSelectedNodeIds([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLayoutState('loading');
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);

    layoutAsicSchematic(mockAsicSchematicGraph, moduleId)
      .then((nextLayout) => {
        if (!cancelled) {
          setLayout(nextLayout);
          setLayoutState('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLayoutState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  return (
    <div
      data-testid="asic-schematic-panel"
      data-ready={layoutState === 'ready' && renderer !== 'initializing'}
      data-renderer={renderer}
      data-theme={theme}
      data-module-id={moduleId}
      data-node-count={activeLayout?.nodes.length ?? 0}
      data-edge-count={activeLayout?.edges.length ?? 0}
      data-selected-node-count={selectedNodeIds.length}
      data-selected-node-ids={selectedNodeIds.join(',')}
      data-selected-edge-count={selectedEdgeIds.length}
      data-selected-edge-ids={selectedEdgeIds.join(',')}
      data-zoom={camera.zoom.toFixed(3)}
      data-pan-x={camera.x.toFixed(1)}
      data-pan-y={camera.y.toFixed(1)}
      className="flex h-full min-h-0 flex-col bg-ide-bg text-ide-text"
    >
      <div className="flex min-h-8 shrink-0 items-center gap-2 border-b border-ide-border px-3 py-1.5">
        <Spline size={13} className="text-ide-accent" />
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[11px]">
          {modulePath.map((module, index) => (
            <div key={module.id} className="flex min-w-0 items-center gap-1">
              {index > 0 ? <ChevronRight size={10} className="shrink-0 text-ide-text-muted" /> : null}
              <button
                type="button"
                className="truncate rounded px-1 py-0.5 text-ide-text-muted hover:bg-ide-hover hover:text-ide-text"
                onClick={() => handleDirectModuleNavigation(module.id)}
              >
                {module.name}
              </button>
            </div>
          ))}
        </div>
        <div className="hidden items-center gap-2 text-[11px] text-ide-text-muted md:flex">
          <span>{activeLayout?.nodes.length ?? 0} modules</span>
          <span>{activeLayout?.edges.length ?? 0} nets</span>
          <span>{renderer}</span>
        </div>
        <TooltipIconButton content="Root module">
          <Button variant="ghost" size="icon-xs" aria-label="Root module" onClick={() => handleDirectModuleNavigation(mockAsicSchematicGraph.rootModuleId)}>
            <Home size={12} />
          </Button>
        </TooltipIconButton>
        <TooltipIconButton content="Parent module">
          <Button variant="ghost" size="icon-xs" aria-label="Parent module" onClick={handleGoParentModule} disabled={!parentModuleId && backStack.length === 0}>
            <ChevronUp size={12} />
          </Button>
        </TooltipIconButton>
        <TooltipIconButton content="Next child module">
          <Button variant="ghost" size="icon-xs" aria-label="Next child module" onClick={handleGoNextChildModule} disabled={!nextChildModuleId}>
            <ChevronDown size={12} />
          </Button>
        </TooltipIconButton>
        <TooltipIconButton content="Fit schematic">
          <Button variant="ghost" size="icon-xs" aria-label="Fit schematic" onClick={() => canvasRef.current?.fitToView()}>
            <Maximize2 size={12} />
          </Button>
        </TooltipIconButton>
        <TooltipIconButton content="Reset view">
          <Button variant="ghost" size="icon-xs" aria-label="Reset schematic view" onClick={() => canvasRef.current?.resetView()}>
            <RotateCcw size={12} />
          </Button>
        </TooltipIconButton>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="hidden w-52 shrink-0 border-r border-ide-border bg-ide-bg p-3 text-[11px] lg:block">
          <div className="font-medium text-ide-text">{activeModule?.name}</div>
          <p className="mt-1 leading-4 text-ide-text-muted">{activeModule?.description}</p>
          {selectedNode ? (
            <div className="mt-4 rounded-md border border-ide-border bg-ide-panel-bg p-2">
              <div className="font-medium text-ide-text">{selectedNode.label}</div>
              <div className="mt-1 text-ide-text-muted">{selectedNode.subtitle}</div>
              {selectedNode.canDrillDown && selectedNode.moduleId ? (
                <Button size="xs" variant="ghost" className="mt-2 h-6 px-1.5 text-[11px]" onClick={() => handleEnterModule(selectedNode.moduleId!)}>
                  Open module
                </Button>
              ) : null}
            </div>
          ) : selectedNodeIds.length > 1 ? (
            <div className="mt-4 rounded-md border border-ide-border bg-ide-panel-bg p-2">
              <div className="font-medium text-ide-text">{selectedNodeIds.length} modules selected</div>
            </div>
          ) : selectedEdge ? (
            <div className="mt-4 rounded-md border border-ide-border bg-ide-panel-bg p-2">
              <div className="font-medium text-ide-text">{selectedEdge.label}</div>
              <div className="mt-1 text-ide-text-muted">{selectedEdge.isBus ? `${selectedEdge.signalWidth}-bit bus` : 'Single signal'}</div>
              {selectedEdge.kind ? <div className="mt-1 text-ide-text-muted">{selectedEdge.kind}</div> : null}
            </div>
          ) : null}
        </div>

        {layoutState === 'error' ? (
          <div className="flex flex-1 items-center justify-center text-[12px] text-ide-text-muted">Unable to layout schematic.</div>
        ) : null}
        {layoutState === 'loading' ? (
          <div className="flex flex-1 items-center justify-center text-[12px] text-ide-text-muted">Loading schematic...</div>
        ) : null}
        {layoutState === 'ready' && activeLayout ? (
          <AsicSchematicCanvas
            ref={canvasRef}
            layout={activeLayout}
            selectedNodeIds={selectedNodeIds}
            selectedEdgeIds={selectedEdgeIds}
            themeKey={`${themeId}:${theme}`}
            onCameraChange={setCamera}
            onModuleOpen={handleEnterModule}
            onNodeSelectionChange={handleNodeSelectionChange}
            onEdgeSelectionChange={handleEdgeSelectionChange}
            onNodePositionsChange={handleNodePositionsChange}
            onRendererChange={setRenderer}
          />
        ) : null}
      </div>
    </div>
  );
}
