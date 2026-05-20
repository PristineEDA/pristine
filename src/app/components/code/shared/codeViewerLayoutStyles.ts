import { cn } from '@/lib/utils';
import type { CodeViewerLayoutMode } from '../../../context/CodeViewerLayoutContext';

export const MINIMAL_CODE_VIEWER_PANEL_GAP_PX = 10;
const MINIMAL_EDITOR_TAB_BAR_CLASS_NAME = 'h-[30px] items-center gap-0 px-1 rounded-t-md';
const MINIMAL_EDITOR_TAB_HEIGHT_CLASS_NAME = 'h-[27px]';
const DEFAULT_EDITOR_TAB_WIDTH_CLASS_NAME = 'min-w-[100px] max-w-[200px]';
const MINIMAL_EDITOR_TAB_WIDTH_CLASS_NAME = 'min-w-[90px] max-w-[180px]';
const PANEL_HEADER_PADDING_CLASS_NAME = 'px-2 py-1.5';

export function isMinimalCodeViewerLayout(layoutMode: CodeViewerLayoutMode) {
  return layoutMode === 'minimal';
}

export function getCodeWorkspaceShellClassName(layoutMode: CodeViewerLayoutMode) {
  return cn(
    'flex flex-1 overflow-hidden',
    isMinimalCodeViewerLayout(layoutMode) && 'min-h-0',
  );
}

export function getCodeWorkspaceBodyClassName(layoutMode: CodeViewerLayoutMode) {
  return cn(
    'flex flex-1 min-w-0',
    isMinimalCodeViewerLayout(layoutMode) && 'gap-2.5 p-2.5 min-h-0 overflow-hidden',
  );
}

export function getCodeWorkspaceCenterColumnClassName(layoutMode: CodeViewerLayoutMode) {
  return cn(
    'flex-1 min-w-0',
    isMinimalCodeViewerLayout(layoutMode) && 'min-h-0',
  );
}

export function getCodeWorkspacePanelFrameClassName(layoutMode: CodeViewerLayoutMode, className?: string) {
  return cn(
    'min-h-0 overflow-hidden',
    isMinimalCodeViewerLayout(layoutMode) && 'rounded-md border border-ide-border bg-ide-bg',
    className,
  );
}

export function getCodeWorkspacePanelGroupClassName(_layoutMode: CodeViewerLayoutMode, className?: string) {
  return cn(className);
}

export function getCodeWorkspacePanelGroupLayoutGapPx(layoutMode: CodeViewerLayoutMode) {
  return isMinimalCodeViewerLayout(layoutMode) ? MINIMAL_CODE_VIEWER_PANEL_GAP_PX : 0;
}

export function getCodeWorkspaceResizeHandleClassName(layoutMode: CodeViewerLayoutMode) {
  return cn(
    isMinimalCodeViewerLayout(layoutMode) && 'rounded-full bg-transparent overlay-handle',
  );
}

export function getEditorAreaRootClassName(layoutMode: CodeViewerLayoutMode) {
  return cn(
    'flex flex-col h-full bg-ide-editor-bg text-ide-text overflow-hidden',
    isMinimalCodeViewerLayout(layoutMode) && 'rounded-md',
  );
}

export function getEditorTabBarClassName(layoutMode: CodeViewerLayoutMode) {
  return cn(
    'flex items-stretch bg-ide-tab-bg text-ide-text overflow-x-auto shrink-0 border-b border-ide-border',
    isMinimalCodeViewerLayout(layoutMode)
      ? MINIMAL_EDITOR_TAB_BAR_CLASS_NAME
      : 'h-[27px]',
  );
}

export function getEditorTabClassName(layoutMode: CodeViewerLayoutMode, isActive: boolean) {
  return cn(
    'flex items-center gap-1 cursor-pointer group border-r border-ide-border transition-colors shrink-0',
    isMinimalCodeViewerLayout(layoutMode)
      ? `${MINIMAL_EDITOR_TAB_WIDTH_CLASS_NAME} ${MINIMAL_EDITOR_TAB_HEIGHT_CLASS_NAME} rounded-md px-2 border border-transparent`
      : `${DEFAULT_EDITOR_TAB_WIDTH_CLASS_NAME} h-full px-3 border-t-2`,
    isActive
      ? cn(
        'bg-ide-editor-bg text-ide-text',
        isMinimalCodeViewerLayout(layoutMode) ? 'border-ide-border shadow-sm' : 'border-t-ide-accent',
      )
      : cn(
        'bg-ide-tab-bg text-ide-text-muted hover:bg-ide-tab-hover hover:text-ide-text',
        isMinimalCodeViewerLayout(layoutMode) ? 'hover:border-ide-border/80' : 'border-t-transparent',
      ),
  );
}

export function getPanelHeaderClassName(layoutMode: CodeViewerLayoutMode, className?: string) {
  return cn(
    'flex shrink-0 items-center text-ide-text',
    isMinimalCodeViewerLayout(layoutMode) ? `m-1.5 mb-0 rounded ${PANEL_HEADER_PADDING_CLASS_NAME}` : PANEL_HEADER_PADDING_CLASS_NAME,
    className,
  );
}

export function getBottomPanelClassName(layoutMode: CodeViewerLayoutMode) {
  return cn(
    'flex h-full min-h-0 flex-col overflow-hidden bg-ide-bg text-ide-text',
    isMinimalCodeViewerLayout(layoutMode) ? 'rounded-md' : 'border-t border-ide-border',
  );
}

export function getBottomPanelTabBarClassName(layoutMode: CodeViewerLayoutMode) {
  return cn(
    'flex items-center shrink-0 bg-ide-tab-bg text-ide-text border-b border-ide-border',
    isMinimalCodeViewerLayout(layoutMode) ? 'h-9 gap-1.5 px-1.5 rounded-t-md' : 'h-8 gap-1 px-1',
  );
}
