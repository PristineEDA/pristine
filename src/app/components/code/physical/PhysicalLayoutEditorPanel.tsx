import { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import { cn } from '@/lib/utils';

import type {
  LspLayoutCatalog,
  LspLayoutCatalogSummary,
  LspLayoutGeometry,
  LspLayoutGeometryOptions,
  LspLayoutStatus,
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
import {
  defaultPhysicalLayoutGdsTileMetrics,
  type PhysicalLayoutGdsTileMetrics,
} from './physicalLayoutGdsTiles';
import { getDefaultLayoutTarget, type PhysicalLayoutTarget } from './physicalLayoutGeometry';
import { PhysicalLayout3DCanvas } from './PhysicalLayout3DCanvas';
import { PhysicalLayoutCanvas } from './PhysicalLayoutCanvas';

export type PhysicalLayoutStatus = 'idle' | 'loading' | 'parsing' | 'ready' | 'error';

export interface PhysicalLayoutStateSnapshot {
  catalog: LspLayoutCatalog | null;
  error: string | null;
  geometry: LspLayoutGeometry | null;
  openResult: LspLayoutOpenResult | null;
  status: PhysicalLayoutStatus;
}

interface PhysicalLayoutEditorPanelProps {
  activeLayoutFilePath: string | null;
  highlightedShapeIndex?: number | null;
  layoutVisibility: PhysicalLayoutVisibility;
  selectedTarget: PhysicalLayoutTarget | null;
  onHighlightedShapeChange?: (shapeIndex: number | null) => void;
  onGdsTileGeometryChange?: (geometry: LspLayoutGeometry | null) => void;
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

  if (target.kind === 'design') {
    return {
      sessionId,
      maxShapes: geometryMaxShapes,
    };
  }

  return null;
}

function isGdsLayoutFilePath(filePath: string): boolean {
  const normalizedPath = filePath.toLowerCase();
  return normalizedPath.endsWith('.gds') || normalizedPath.endsWith('.gdsii');
}

async function loadReadyGdsCatalog(
  result: LspLayoutOpenResult,
  onStatus: (status: LspLayoutStatus) => void,
): Promise<LspLayoutOpenResult> {
  const lsp = window.electronAPI?.lsp;
  if (!lsp?.layoutStatus || !lsp.layoutCatalogSummary || !lsp.layoutCatalogPage) {
    throw new Error('GDS layout catalog API is unavailable.');
  }

  let status = await lsp.layoutStatus(result.sessionId);
  onStatus(status);
  const startedAt = Date.now();
  while (status.state !== 'ready') {
    if (status.state === 'failed') {
      throw new Error(status.error || 'GDS layout parsing failed.');
    }
    if (Date.now() - startedAt > 120_000) {
      throw new Error('Timed out waiting for GDS layout parsing to finish.');
    }
    await delay(150);
    status = await lsp.layoutStatus(result.sessionId);
    onStatus(status);
  }

  const summary = await lsp.layoutCatalogSummary(result.sessionId);
  const catalog = await loadGdsCatalogPages(result.sessionId, summary);
  return {
    ...result,
    catalog,
    cellCount: catalog.gdsCells.length,
    layerCount: catalog.layers.length,
    macroCount: catalog.macros.length,
    componentCount: catalog.components.length,
    netCount: catalog.nets.length,
    diagnosticCount: catalog.diagnostics.length,
    sourceKind: catalog.sourceKind,
    unitsPerMicron: catalog.unitsPerMicron || result.unitsPerMicron,
  };
}

async function loadGdsCatalogPages(sessionId: string, summary: LspLayoutCatalogSummary): Promise<LspLayoutCatalog> {
  const lsp = window.electronAPI?.lsp;
  if (!lsp?.layoutCatalogPage) {
    throw new Error('GDS layout catalog page API is unavailable.');
  }

  const [cellPage, layerPage] = await Promise.all([
    summary.gdsCellCount > 0
      ? lsp.layoutCatalogPage({
          sessionId,
          tableKind: 'cells',
          offset: 0,
          limit: Math.min(summary.gdsCellCount, 4096),
          maxBytes: 8 * 1024 * 1024,
        })
      : Promise.resolve(null),
    summary.layerCount > 0
      ? lsp.layoutCatalogPage({
          sessionId,
          tableKind: 'layers',
          offset: 0,
          limit: Math.min(summary.layerCount, 4096),
          maxBytes: 4 * 1024 * 1024,
        })
      : Promise.resolve(null),
  ]);

  return {
    unitsPerMicron: summary.unitsPerMicron,
    sourceKind: summary.sourceKind,
    shapeCount: summary.shapeCount,
    hasBounds: summary.hasBounds,
    topCellIndex: summary.topCellIndex,
    layers: layerPage?.layers.length ? layerPage.layers : summary.layerSummary,
    macros: [],
    pins: [],
    defPins: [],
    vias: [],
    components: [],
    nets: [],
    gdsCells: cellPage?.gdsCells ?? [],
    gdsReferences: [],
    gdsElements: [],
    gdsPoints: [],
    diagnostics: [],
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export function PhysicalLayoutEditorPanel({
  activeLayoutFilePath,
  highlightedShapeIndex = null,
  layoutVisibility,
  onGdsTileGeometryChange,
  selectedTarget,
  onHighlightedShapeChange,
  onLayoutStateChange,
  onSelectedTargetChange,
}: PhysicalLayoutEditorPanelProps) {
  const { layoutMode } = useCodeViewerLayout();
  const [status, setStatus] = useState<PhysicalLayoutStatus>('idle');
  const [openResult, setOpenResult] = useState<LspLayoutOpenResult | null>(null);
  const [geometry, setGeometry] = useState<LspLayoutGeometry | null>(null);
  const [gdsTileGeometry, setGdsTileGeometry] = useState<LspLayoutGeometry | null>(null);
  const [gdsTileMetrics, setGdsTileMetrics] = useState<PhysicalLayoutGdsTileMetrics>(defaultPhysicalLayoutGdsTileMetrics);
  const [error, setError] = useState<string | null>(null);
  const [gdsParseStatus, setGdsParseStatus] = useState<LspLayoutStatus | null>(null);
  const [is3DViewVisible, setIs3DViewVisible] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const onLayoutStateChangeRef = useRef(onLayoutStateChange);
  const onGdsTileGeometryChangeRef = useRef(onGdsTileGeometryChange);
  const onSelectedTargetChangeRef = useRef(onSelectedTargetChange);
  const selectedTargetRef = useRef(selectedTarget);

  onLayoutStateChangeRef.current = onLayoutStateChange;
  onGdsTileGeometryChangeRef.current = onGdsTileGeometryChange;
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
        setGdsTileGeometry(null);
        onGdsTileGeometryChangeRef.current?.(null);
        setGdsTileMetrics(defaultPhysicalLayoutGdsTileMetrics);
        setGdsParseStatus(null);
        return;
      }

      setStatus('loading');
      setError(null);
      setOpenResult(null);
      setGeometry(null);
      setGdsTileGeometry(null);
      onGdsTileGeometryChangeRef.current?.(null);
      setGdsTileMetrics(defaultPhysicalLayoutGdsTileMetrics);
      setGdsParseStatus(null);
      try {
        const isGdsFile = isGdsLayoutFilePath(activeLayoutFilePath);
        const result = await lsp.layoutOpen({
          deferCatalog: isGdsFile,
          openMode: isGdsFile ? 'auto' : undefined,
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
        setGeometry(null);
        setGdsTileGeometry(null);
        onGdsTileGeometryChangeRef.current?.(null);
        setGdsTileMetrics(defaultPhysicalLayoutGdsTileMetrics);
        const readyResult = result.catalog.sourceKind === 'gds'
          ? await loadReadyGdsCatalog(result, (nextStatus) => {
              if (!disposed) {
                setStatus(nextStatus.state === 'ready' ? 'loading' : 'parsing');
                setGdsParseStatus(nextStatus);
              }
            })
          : result;
        if (disposed) {
          if (readyResult.sessionId) {
            void lsp.layoutClose(readyResult.sessionId);
          }
          return;
        }

        setOpenResult(readyResult);
        setGdsParseStatus(null);
        const defaultTarget = getDefaultLayoutTarget(readyResult.catalog);
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
    setGdsTileGeometry(null);
    onGdsTileGeometryChangeRef.current?.(null);
    setGdsTileMetrics(defaultPhysicalLayoutGdsTileMetrics);
  }, [activeLayoutFilePath, selectedTarget?.kind, selectedTarget?.index]);

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
  const isGdsTarget = catalog?.sourceKind === 'gds' && selectedTarget?.kind === 'gdsCell';
  const activeCanvasGeometry = isGdsTarget ? gdsTileGeometry : geometry;
  const shapeCount = activeCanvasGeometry?.shapes.length ?? 0;
  const macroCount = catalog?.macros.length ?? 0;
  const cellCount = catalog?.gdsCells.length ?? 0;
  const layerCount = catalog?.layers.length ?? 0;
  const selectedTargetName = selectedTarget?.name ?? '';
  const is3DRenderable = isGdsTarget && gdsTileGeometry !== null;
  const canvas2D = (
    <PhysicalLayoutCanvas
      catalog={catalog}
      geometry={geometry}
      highlightedShapeIndex={highlightedShapeIndex}
      layoutSessionId={openResult?.sessionId ?? null}
      layoutVisibility={layoutVisibility}
      selectedTarget={selectedTarget}
      onGdsTileGeometryChange={(nextGeometry) => {
        setGdsTileGeometry(nextGeometry);
        onGdsTileGeometryChangeRef.current?.(nextGeometry);
      }}
      onGdsTileMetricsChange={setGdsTileMetrics}
      onHighlightedShapeChange={onHighlightedShapeChange}
    />
  );
  const canvas3D = is3DRenderable ? (
    <PhysicalLayout3DCanvas
      catalog={catalog}
      geometry={gdsTileGeometry}
      highlightedShapeIndex={highlightedShapeIndex}
      layoutVisibility={layoutVisibility}
      selectedTarget={selectedTarget}
      onHighlightedShapeChange={onHighlightedShapeChange}
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
      data-highlighted-shape-index={highlightedShapeIndex ?? ''}
      data-layer-count={layerCount}
      data-macro-count={macroCount}
      data-selected-macro-name={selectedTarget?.kind === 'macro' ? selectedTarget.name : ''}
      data-selected-target-kind={selectedTarget?.kind ?? ''}
      data-selected-target-name={selectedTargetName}
      data-shape-count={shapeCount}
      data-gds-parse-state={gdsParseStatus?.state ?? ''}
      data-gds-parse-phase={gdsParseStatus?.phase ?? ''}
      data-gds-parse-progress={formatGdsParseProgress(gdsParseStatus)}
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
        <div className="flex shrink-0 items-center gap-2">
          {gdsParseStatus && <PhysicalGdsProgressInfo status={gdsParseStatus} />}
          {isGdsTarget && <PhysicalGdsMetricInfo metrics={gdsTileMetrics} />}
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

        {(status === 'loading' || status === 'parsing') && (
          <div
            className="pointer-events-none absolute left-3 top-3 rounded border border-ide-border/80 bg-ide-bg/90 px-2 py-1 text-[11px] text-ide-text-muted shadow"
            data-testid="physical-layout-loading"
          >
            {gdsParseStatus ? formatGdsParseLabel(gdsParseStatus) : 'Loading physical layout'}
          </div>
        )}
      </div>
    </div>
  );
}

interface PhysicalGdsMetricInfoProps {
  metrics: PhysicalLayoutGdsTileMetrics;
}

function PhysicalGdsMetricInfo({ metrics }: PhysicalGdsMetricInfoProps) {
  return (
    <div
      className="flex h-6 items-center gap-2 rounded-md border border-ide-border/70 bg-ide-bg/40 px-2 text-[10px] leading-none text-ide-text-muted"
      data-gds-average-fps={formatMetricValue(metrics.averageFps, 1)}
      data-gds-buffer-capacity-vertex-count={metrics.bufferCapacityVertexCount}
      data-gds-buffer-realloc-count={metrics.bufferReallocCount}
      data-gds-buffer-update-count={metrics.bufferUpdateCount}
      data-gds-buffer-update-ms={formatMetricValue(metrics.bufferUpdateMs, 3)}
      data-gds-cache-bytes={metrics.cacheByteLength}
      data-gds-cache-entry-count={metrics.cacheEntryCount}
      data-gds-frame-p95-ms={formatMetricValue(metrics.frameP95Ms, 1)}
      data-gds-inflight-count={metrics.inflightRequestCount}
      data-gds-mesh-buffer-bytes={metrics.bufferByteLength + metrics.indexByteLength}
      data-gds-mesh-batch-count={metrics.meshBatchCount}
      data-gds-draw-node-count={metrics.meshDrawNodeCount}
      data-gds-render-mode="tile-mesh"
      data-gds-render-ms={formatMetricValue(metrics.lastRenderMs, 2)}
      data-gds-retry-count={metrics.retryCount}
      data-gds-tile-query-ms={formatMetricValue(metrics.lastTileQueryMs, 2)}
      data-gds-tile-roundtrip-ms={formatMetricValue(metrics.lastTileRoundtripMs, 2)}
      data-gds-truncated={metrics.truncated ? 'true' : 'false'}
      data-testid="physical-gds-toolbar-metrics"
    >
      <div className="flex items-center gap-1" data-testid="physical-gds-toolbar-metrics-render">
        <span>Render</span>
        <span className="font-mono text-ide-accent" data-testid="physical-gds-toolbar-metrics-render-value">
          {formatMetricValue(metrics.lastRenderMs, 1)}
        </span>
        <span>ms</span>
      </div>
      <div className="flex items-center gap-1" data-testid="physical-gds-toolbar-metrics-fps">
        <span>FPS</span>
        <span className="font-mono text-ide-accent" data-testid="physical-gds-toolbar-metrics-fps-value">
          {formatMetricValue(metrics.averageFps, 1)}
        </span>
      </div>
      <div className="flex items-center gap-1" data-testid="physical-gds-toolbar-metrics-tile">
        <span>Tile</span>
        <span className="font-mono text-ide-accent" data-testid="physical-gds-toolbar-metrics-tile-value">
          {formatMetricValue(metrics.lastTileRoundtripMs, 1)}
        </span>
        <span>ms</span>
      </div>
      <div className="flex items-center gap-1" data-testid="physical-gds-toolbar-metrics-mesh">
        <span>Mesh</span>
        <span className="font-mono text-ide-accent" data-testid="physical-gds-toolbar-metrics-mesh-value">
          {metrics.meshBatchCount}
        </span>
      </div>
      <div className="flex items-center gap-1" data-testid="physical-gds-toolbar-metrics-cache">
        <span>Cache</span>
        <span className="font-mono text-ide-accent" data-testid="physical-gds-toolbar-metrics-cache-value">
          {formatByteMetric(metrics.cacheByteLength)}
        </span>
      </div>
    </div>
  );
}

interface PhysicalGdsProgressInfoProps {
  status: LspLayoutStatus;
}

function PhysicalGdsProgressInfo({ status }: PhysicalGdsProgressInfoProps) {
  return (
    <div
      className="flex h-6 items-center gap-2 rounded-md border border-ide-border/70 bg-ide-bg/40 px-2 text-[10px] leading-none text-ide-text-muted"
      data-gds-parse-bytes-read={status.bytesRead}
      data-gds-parse-cell-count={status.cellCount}
      data-gds-parse-elapsed-ms={formatMetricValue(status.elapsedMicros / 1000, 1)}
      data-gds-parse-file-size={status.fileSizeBytes}
      data-gds-parse-phase={status.phase}
      data-gds-parse-point-count={status.pointCount}
      data-gds-parse-progress={formatGdsParseProgress(status)}
      data-gds-parse-record-count={status.recordCount}
      data-gds-parse-state={status.state}
      data-testid="physical-gds-progress"
    >
      <span>GDS</span>
      <span className="font-mono text-ide-accent" data-testid="physical-gds-progress-state">
        {status.state}
      </span>
      <span>{status.phase}</span>
      <span className="font-mono text-ide-accent" data-testid="physical-gds-progress-value">
        {formatGdsParseProgress(status)}%
      </span>
    </div>
  );
}

function formatGdsParseLabel(status: LspLayoutStatus): string {
  return `Parsing GDS ${status.phase} ${formatGdsParseProgress(status)}%`;
}

function formatGdsParseProgress(status: LspLayoutStatus | null): string {
  if (!status || status.fileSizeBytes <= 0) {
    return '0.0';
  }

  const progress = Math.min(100, Math.max(0, (status.bytesRead / status.fileSizeBytes) * 100));
  return progress.toFixed(1);
}

function formatMetricValue(value: number, digits: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return value.toFixed(digits);
}

function formatByteMetric(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0M';
  }

  return `${(value / (1024 * 1024)).toFixed(0)}M`;
}
