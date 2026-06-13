import { useEffect, useRef, useState } from 'react';

import type { LspLayoutCatalog, LspLayoutGeometry, LspLayoutOpenResult } from '../../../../../types/systemverilog-lsp';
import type { PhysicalLayoutVisibility } from './physicalLayoutLayers';
import { getDefaultLayoutTarget, type PhysicalLayoutTarget } from './physicalLayoutGeometry';
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

export function PhysicalLayoutEditorPanel({
  activeLayoutFilePath,
  layoutVisibility,
  selectedTarget,
  onLayoutStateChange,
  onSelectedTargetChange,
}: PhysicalLayoutEditorPanelProps) {
  const [status, setStatus] = useState<PhysicalLayoutStatus>('idle');
  const [openResult, setOpenResult] = useState<LspLayoutOpenResult | null>(null);
  const [geometry, setGeometry] = useState<LspLayoutGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);
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
        const defaultTarget = getDefaultLayoutTarget(result.catalog);
        if (defaultTarget && !selectedTargetRef.current) {
          onSelectedTargetChangeRef.current?.(defaultTarget);
        }

        const nextGeometry = await lsp.layoutGeometry({
          sessionId: result.sessionId,
          maxShapes: geometryMaxShapes,
        });
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

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[#0f1419] text-ide-text"
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
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-ide-border/70 px-3 text-[11px] text-ide-text-muted">
        <span className="font-medium text-ide-text">Physical Layout</span>
        <span data-testid="physical-layout-selected-macro">{selectedTargetName || 'No layout target'}</span>
        <span>{macroCount} macros</span>
        <span>{cellCount} cells</span>
        <span>{layerCount} layers</span>
        <span>{shapeCount} shapes</span>
      </div>

      <div className="relative min-h-0 flex-1">
        {status === 'error' ? (
          <div
            className="absolute inset-0 flex items-center justify-center px-6 text-center text-[12px] leading-5 text-ide-error"
            data-testid="physical-layout-error"
          >
            {error}
          </div>
        ) : (
          <PhysicalLayoutCanvas
            catalog={catalog}
            geometry={geometry}
            layoutVisibility={layoutVisibility}
            selectedTarget={selectedTarget}
          />
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
