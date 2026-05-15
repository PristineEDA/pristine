import { cn } from '@/lib/utils';
import type { CodeViewerLayoutMode } from '../../../context/CodeViewerLayoutContext';

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
    isMinimalCodeViewerLayout(layoutMode) && 'rounded-md border border-border bg-background',
    className,
  );
}

export function getCodeWorkspacePanelGroupClassName(layoutMode: CodeViewerLayoutMode, className?: string) {
  return cn(
    isMinimalCodeViewerLayout(layoutMode) && 'gap-2',
    className,
  );
}

export function getCodeWorkspaceResizeHandleClassName(layoutMode: CodeViewerLayoutMode) {
  return cn(
    isMinimalCodeViewerLayout(layoutMode) && 'rounded-full bg-transparent',
  );
}

export function getEditorAreaRootClassName(layoutMode: CodeViewerLayoutMode) {
  return cn(
    'flex flex-col h-full bg-background overflow-hidden',
    isMinimalCodeViewerLayout(layoutMode) && 'rounded-md',
  );
}

export function getEditorTabBarClassName(layoutMode: CodeViewerLayoutMode) {
  return cn(
    'flex items-stretch bg-muted overflow-x-auto shrink-0 border-b border-border',
    isMinimalCodeViewerLayout(layoutMode)
      ? 'h-10 gap-1.5 p-1.5 rounded-t-md'
      : 'h-[27px]',
  );
}

export function getEditorTabClassName(layoutMode: CodeViewerLayoutMode, isActive: boolean) {
  return cn(
    'flex items-center gap-1 h-full cursor-pointer group border-r border-border transition-colors shrink-0 min-w-[100px] max-w-[200px]',
    isMinimalCodeViewerLayout(layoutMode)
      ? 'rounded-md px-3 border border-transparent'
      : 'px-3 border-t-2',
    isActive
      ? cn(
        'bg-background text-foreground',
        isMinimalCodeViewerLayout(layoutMode) ? 'border-border shadow-sm' : 'border-t-primary',
      )
      : cn(
        'bg-muted text-muted-foreground hover:bg-muted/80',
        isMinimalCodeViewerLayout(layoutMode) ? 'hover:border-border/80' : 'border-t-transparent',
      ),
  );
}

export function getPanelHeaderClassName(layoutMode: CodeViewerLayoutMode, className?: string) {
  return cn(
    'flex shrink-0 items-center border-b border-border',
    isMinimalCodeViewerLayout(layoutMode) ? 'm-1.5 mb-0 rounded border px-2 py-1.5' : 'px-2 py-1.5',
    className,
  );
}

export function getBottomPanelClassName(layoutMode: CodeViewerLayoutMode) {
  return cn(
    'flex h-full min-h-0 flex-col overflow-hidden border-t border-border bg-background',
    isMinimalCodeViewerLayout(layoutMode) && 'rounded-md border border-border',
  );
}

export function getBottomPanelTabBarClassName(layoutMode: CodeViewerLayoutMode) {
  return cn(
    'flex items-center bg-muted/40 border-b border-border shrink-0',
    isMinimalCodeViewerLayout(layoutMode) ? 'h-9 gap-1.5 p-1.5 rounded-t-md' : 'h-8',
  );
}

export function getBottomPanelTabClassName(layoutMode: CodeViewerLayoutMode, isActive: boolean) {
  return cn(
    'flex items-center gap-1.5 h-full transition-colors',
    isMinimalCodeViewerLayout(layoutMode)
      ? 'rounded px-2.5 border border-transparent text-[12px]'
      : 'px-3 border-b-2 text-[12px]',
    isActive
      ? cn(
        'font-semibold text-foreground',
        isMinimalCodeViewerLayout(layoutMode) ? 'border-border bg-background shadow-sm' : 'border-primary',
      )
      : cn(
        'text-muted-foreground hover:text-foreground',
        isMinimalCodeViewerLayout(layoutMode) ? 'hover:border-border/80' : 'border-transparent',
      ),
  );
}