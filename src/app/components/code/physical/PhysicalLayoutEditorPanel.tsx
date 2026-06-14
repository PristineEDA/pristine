import { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import { cn } from '@/lib/utils';

import type {
  LspLayoutCatalog,
  LspLayoutGeometry,
  LspLayoutGeometryOptions,
  LspLayoutOpenResult,
} from '../../../../../types/systemverilog-lsp';
import { Button } from '../../ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../ui/resizable';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';
import { useCodeViewerLayout } from '../../../context/CodeViewerLayoutContext';
import {
  getCodeWorkspacePanelGroupLayoutGapPx,
  getCodeWorkspaceResizeHandleClassName,
} from '../shared/codeViewerLayoutStyles';
import type { PhysicalLayoutVisibility } from './physicalLayoutLayers';
import { getDefaultLayoutTarget, type PhysicalLayoutTarget } from './physicalLayoutGeometry';
import { PhysicalLayout3DCanvas } from './PhysicalLayout3DCanvas';
import { PhysicalLayoutCanvas } from './PhysicalLayoutCanvas';

export type PhysicalLayoutStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PhysicalLayoutStateSnapshot {
  catalog: LspLayoutCatalog | null;
  error: string | null;
  geometry: LspLayoutGeometry | null;
  openResult: LspLayoutOpenResult | null;
  status: PhysicalLayoutStatus;
}

interface PhysicalLayoutEditorPanelProps {
  activeLayoutFilePath: string | null;
  layoutVisibility: PhysicalLayoutVisibility;
  selectedTarget: PhysicalLayoutTarget | null;
  onLayoutStateChange?: (state: PhysicalLayoutStateSnapshot) => void;
  onSelectedTargetChange?: (target: PhysicalLayoutTarget | null) => void;
}

const geometryMaxShapes = 250_000;

function createLayoutTargetGeometryOptions(
  sessionId: string,
  target: PhysicalLayoutTarget | null,
): LspLayoutGeometryOptions | null {
  if (!target) {
    return null;
  }

  if (target.kind === 'macro' && target.index !== null) {
    return {
      sessionId,
      maxShapes: 0,
      macroIndices: [target.index],
    };
  }

  if (target.kind === 'gdsCell' && target.index !== null) {
    return {
      sessionId,
      maxShapes: 0,
      gdsRootCellIndices: [target.index],
    };
  }

  if (target.kind === 'design') {
    return {
      sessionId,
      maxShapes: geometryMaxShapes,
    };
  }

  return null;
}

export function PhysicalLayoutEditorPanel({
  activeLayoutFilePath,
  layoutVisibility,
  selectedTarget,
  onLayoutStateChange,
  onSelectedTargetChange,
}: PhysicalLayoutEditorPanelProps) {
  const { layoutMode } = useCodeViewerLayout();
  const [status, setStatus] = useState<PhysicalLayoutStatus>('idle');
  const [openResult, setOpenResult] = useState<LspLayoutOpenResult | null>(null);
  const [geometry, setGeometry] = useState<LspLayoutGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [is3DViewVisible, setIs3DViewVisible] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const onLayoutStateChangeRef = useRef(onLayoutStateChange);
  const onSelectedTargetChangeRef = useRef(onSelectedTargetChange);
  const selectedTargetRef = useRef(selectedTarget);

  onLayoutStateChangeRef.current = onLayoutStateChange;
  onSelectedTargetChangeRef.current = onSelectedTargetChange;
  selectedTargetRef.current = selectedTarget;

  useEffect(() => {
    let disposed = false;

    async function openLayout() {
      const lsp = window.electronAPI?.lsp;
      if (!lsp?.layoutOpen || !lsp.layoutGeometry || !lsp.layoutClose) {
        setStatus('error');
        setError('Layout LSP API is unavailable.');
        return;
      }

      if (!activeLayoutFilePath) {
        setStatus('idle');
        setError(null);
        setOpenResult(null);
        setGeometry(null);
        return;
      }

      setStatus('loading');
      setError(null);
      setOpenResult(null);
      setGeometry(null);
      try {
        const result = await lsp.layoutOpen({
          workspaceFilePath: activeLayoutFilePath,
          title: activeLayoutFilePath.split('/').pop() ?? activeLayoutFilePath,
        });
        if (disposed) {
          if (result.sessionId) {
            void lsp.layoutClose(result.sessionId);
          }
          return;
        }

        if (!result.sessionId) {
          throw new Error(result.messages[0] ?? 'Layout session did not open.');
        }

        sessionIdRef.current = result.sessionId;
        setOpenResult(result);
        setGeometry(null);
        const defaultTarget = getDefaultLayoutTarget(result.catalog);
        if (defaultTarget && !selectedTargetRef.current) {
          onSelectedTargetChangeRef.current?.(defaultTarget);
        }
        setStatus(defaultTarget ? 'loading' : 'ready');
      } catch (cause) {
        if (disposed) {
          return;
        }

        setStatus('error');
        setError(cause instanceof Error ? cause.message : 'Unable to open physical layout.');
      }
    }

    void openLayout();

    return () => {
      disposed = true;
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sessionId) {
        void window.electronAPI?.lsp.layoutClose?.(sessionId);
      }
    };
  }, [activeLayoutFilePath]);

  useEffect(() => {
    let disposed = false;
    const lsp = window.electronAPI?.lsp;
    const sessionId = openResult?.sessionId;

    async function requestTargetGeometry() {
      if (!sessionId || !lsp?.layoutGeometry) {
        return;
      }

      const options = createLayoutTargetGeometryOptions(sessionId, selectedTarget);
      if (!options) {
        setGeometry(null);
        setStatus('ready');
        return;
      }

      setStatus('loading');
      setError(null);
      setGeometry(null);

      try {
        const nextGeometry = await lsp.layoutGeometry(options);
        if (disposed) {
          return;
        }

        setGeometry(nextGeometry);
        setStatus('ready');
      } catch (cause) {
        if (disposed) {
          return;
        }

        setStatus('error');
        setError(cause instanceof Error ? cause.message : 'Unable to load physical layout geometry.');
      }
    }

    void requestTargetGeometry();

    return () => {
      disposed = true;
    };
  }, [openResult?.sessionId, selectedTarget]);

  useEffect(() => {
    onLayoutStateChangeRef.current?.({
      catalog: openResult?.catalog ?? null,
      error,
      geometry,
      openResult,
      status,
    });
  }, [error, geometry, openResult, status]);

  const catalog = openResult?.catalog ?? null;
  const shapeCount = geometry?.shapes.length ?? 0;
  const macroCount = catalog?.macros.length ?? 0;
  const cellCount = catalog?.gdsCells.length ?? 0;
  const layerCount = catalog?.layers.length ?? 0;
  const selectedTargetName = selectedTarget?.name ?? '';
  const is3DRenderable = catalog?.sourceKind === 'gds' && selectedTarget?.kind === 'gdsCell' && geometry !== null;
  const canvas2D = (
    <PhysicalLayoutCanvas
      catalog={catalog}
      geometry={geometry}
      layoutVisibility={layoutVisibility}
      selectedTarget={selectedTarget}
    />
  );
  const canvas3D = is3DRenderable ? (
    <PhysicalLayout3DCanvas
      catalog={catalog}
      geometry={geometry}
      layoutVisibility={layoutVisibility}
      selectedTarget={selectedTarget}
    />
  ) : (
    <div
      className="flex h-full min-h-0 w-full items-center justify-center bg-[#101317] px-6 text-center text-[12px] leading-5 text-ide-text-muted"
      data-testid="physical-layout-3d-empty"
    >
      3D layout view is available after selecting a GDS cell with loaded geometry.
    </div>
  );

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[#0f1419] text-ide-text"
      data-3d-supported={is3DRenderable ? 'true' : 'false'}
      data-3d-visible={is3DViewVisible ? 'true' : 'false'}
      data-layer-count={layerCount}
      data-macro-count={macroCount}
      data-selected-macro-name={selectedTarget?.kind === 'macro' ? selectedTarget.name : ''}
      data-selected-target-kind={selectedTarget?.kind ?? ''}
      data-selected-target-name={selectedTargetName}
      data-shape-count={shapeCount}
      data-source-kind={catalog?.sourceKind ?? ''}
      data-status={status}
      data-testid="physical-layout-editor"
    >
      <div className="flex h-8 shrink-0 items-center justify-between gap-3 border-b border-ide-border/70 px-3 text-[11px] text-ide-text-muted">
        <div className="flex min-w-0 items-center gap-3 overflow-hidden">
          <span className="shrink-0 font-medium text-ide-text">Physical Layout</span>
          <span className="truncate" data-testid="physical-layout-selected-macro">{selectedTargetName || 'No layout target'}</span>
          <span className="shrink-0">{macroCount} macros</span>
          <span className="shrink-0">{cellCount} cells</span>
          <span className="shrink-0">{layerCount} layers</span>
          <span className="shrink-0">{shapeCount} shapes</span>
        </div>
        <TooltipIconButton content={is3DViewVisible ? 'Hide 3D layout view' : 'Show 3D layout view'} side="bottom">
          <Button
            aria-label="Toggle 3D layout view"
            aria-pressed={is3DViewVisible}
            className="h-6 w-6 rounded-md text-ide-text-muted hover:text-ide-text data-[active=true]:bg-ide-accent/20 data-[active=true]:text-ide-accent"
            data-active={is3DViewVisible}
            data-testid="physical-layout-3d-toggle"
            size="icon-xs"
            type="button"
            variant="ghost"
            onClick={() => setIs3DViewVisible((current) => !current)}
          >
            <Box size={13} />
          </Button>
        </TooltipIconButton>
      </div>

      <div className="relative min-h-0 flex-1">
        {status === 'error' ? (
          <div
            className="absolute inset-0 flex items-center justify-center px-6 text-center text-[12px] leading-5 text-ide-error"
            data-testid="physical-layout-error"
          >
            {error}
          </div>
        ) : is3DViewVisible ? (
          <ResizablePanelGroup
            className="h-full min-h-0 min-w-0"
            data-testid="physical-layout-3d-split"
            orientation="horizontal"
            layoutGapPx={getCodeWorkspacePanelGroupLayoutGapPx(layoutMode)}
          >
            <ResizablePanel id="physical-layout-2d-panel" defaultSize={50} minSize={28} minSizePx={260}>
              {canvas2D}
            </ResizablePanel>

            <ResizableHandle
              className={cn(getCodeWorkspaceResizeHandleClassName(layoutMode), 'group')}
              data-testid="physical-layout-3d-resize-handle"
            >
              <span
                className="pointer-events-none h-full w-[var(--ide-scrollbar-size)] rounded-[var(--ide-scrollbar-radius)] bg-[var(--ide-text-dim)] opacity-80 transition-colors group-hover:bg-[var(--ide-text-muted)] group-focus-visible:bg-[var(--ide-text-muted)]"
                data-testid="physical-layout-3d-resize-indicator"
              />
            </ResizableHandle>

            <ResizablePanel id="physical-layout-3d-panel" defaultSize={50} minSize={24} minSizePx={220}>
              {canvas3D}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          canvas2D
        )}

        {status === 'loading' && (
          <div
            className="pointer-events-none absolute left-3 top-3 rounded border border-ide-border/80 bg-ide-bg/90 px-2 py-1 text-[11px] text-ide-text-muted shadow"
            data-testid="physical-layout-loading"
          >
            Loading physical layout
          </div>
        )}
      </div>
    </div>
  );
}
