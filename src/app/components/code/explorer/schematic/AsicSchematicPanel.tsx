import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Home, Maximize2, RotateCcw, Spline } from 'lucide-react';

import { useTheme } from '../../../../context/ThemeContext';
import { Button } from '../../../ui/button';
import { TooltipIconButton } from '../../../ui/tooltip-icon-button';
import { AsicSchematicCanvas, type AsicSchematicCanvasHandle } from './AsicSchematicCanvas';
import { findModulePath, layoutAsicSchematic } from './asicSchematicLayout';
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [camera, setCamera] = useState<CameraSnapshot>({ x: 0, y: 0, zoom: 1 });
  const [renderer, setRenderer] = useState('initializing');
  const [layoutState, setLayoutState] = useState<'loading' | 'ready' | 'error'>('loading');

  const modulePath = useMemo(() => findModulePath(mockAsicSchematicGraph, moduleId), [moduleId]);
  const activeModule = mockAsicSchematicGraph.modules[moduleId];
  const selectedNode = layout?.nodes.find((node) => node.id === selectedNodeId) ?? null;

  useEffect(() => {
    let cancelled = false;
    setLayoutState('loading');
    setSelectedNodeId(null);

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
      data-node-count={layout?.nodes.length ?? 0}
      data-edge-count={layout?.edges.length ?? 0}
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
                onClick={() => setModuleId(module.id)}
              >
                {module.name}
              </button>
            </div>
          ))}
        </div>
        <div className="hidden items-center gap-2 text-[11px] text-ide-text-muted md:flex">
          <span>{layout?.nodes.length ?? 0} modules</span>
          <span>{layout?.edges.length ?? 0} nets</span>
          <span>{renderer}</span>
        </div>
        <TooltipIconButton content="Root module">
          <Button variant="ghost" size="icon-xs" aria-label="Root module" onClick={() => setModuleId(mockAsicSchematicGraph.rootModuleId)}>
            <Home size={12} />
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
                <Button size="xs" variant="ghost" className="mt-2 h-6 px-1.5 text-[11px]" onClick={() => setModuleId(selectedNode.moduleId!)}>
                  Open module
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {layoutState === 'error' ? (
          <div className="flex flex-1 items-center justify-center text-[12px] text-ide-text-muted">Unable to layout schematic.</div>
        ) : null}
        {layoutState === 'loading' ? (
          <div className="flex flex-1 items-center justify-center text-[12px] text-ide-text-muted">Loading schematic...</div>
        ) : null}
        {layoutState === 'ready' && layout ? (
          <AsicSchematicCanvas
            ref={canvasRef}
            layout={layout}
            selectedNodeId={selectedNodeId}
            themeKey={`${themeId}:${theme}`}
            onCameraChange={setCamera}
            onModuleOpen={setModuleId}
            onNodeSelect={setSelectedNodeId}
            onRendererChange={setRenderer}
          />
        ) : null}
      </div>
    </div>
  );
}
