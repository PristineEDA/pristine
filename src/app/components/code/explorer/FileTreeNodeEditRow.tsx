import { useEffect, useRef, type CSSProperties } from 'react';
import {
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { WorkspaceFileIcon, WorkspaceFolderIcon } from '../shared/WorkspaceEntryIcon';

const treeRowIndentStyleCache = new Map<number, CSSProperties>();

export function getTreeRowIndentStyle(depth: number): CSSProperties {
  const cachedStyle = treeRowIndentStyleCache.get(depth);

  if (cachedStyle) {
    return cachedStyle;
  }

  const nextStyle = { paddingLeft: depth * 12 + 4 };
  treeRowIndentStyleCache.set(depth, nextStyle);
  return nextStyle;
}

export function FileIcon({ name }: { name: string; language?: string }) {
  return <WorkspaceFileIcon name={name} className="h-4 w-4" />;
}

export function TreeEditInputRow({
  depth,
  errorMessage,
  isDraft,
  isExpanded,
  isFolder,
  isSelected,
  isSubmitting,
  testId,
  value,
  onBlur,
  onCancel,
  onChange,
  onSubmit,
}: {
  depth: number;
  errorMessage: string | null;
  isDraft: boolean;
  isExpanded?: boolean;
  isFolder: boolean;
  isSelected: boolean;
  isSubmitting: boolean;
  testId: string;
  value: string;
  onBlur: () => void;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div>
      <div
        data-testid={`file-tree-node-${testId}`}
        className={`flex items-center gap-1 h-6 transition-colors ${
          isSelected
            ? 'bg-primary/20 text-foreground hover:bg-primary/20'
            : 'text-foreground hover:bg-accent'
        } ${isDraft ? 'opacity-65' : ''}`}
        style={getTreeRowIndentStyle(depth)}
      >
        {isFolder ? (
          <>
            <span className="text-muted-foreground">
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            <WorkspaceFolderIcon name={value || 'new_folder'} isOpen={Boolean(isExpanded)} className="h-4 w-4" />
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              <FileIcon name={value || 'new_file.sv'} />
            </span>
          </>
        )}
        <input
          ref={inputRef}
          data-testid={`file-tree-input-${testId}`}
          value={value}
          disabled={isSubmitting}
          spellCheck={false}
          aria-invalid={errorMessage ? 'true' : 'false'}
          className={`ml-1 h-5 flex-1 rounded border bg-background/80 px-2 text-[12px] outline-none transition-colors ${
            errorMessage
              ? 'border-destructive text-foreground focus:border-destructive'
              : 'border-border text-foreground focus:border-primary'
          } ${isSubmitting ? 'opacity-80' : ''}`}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void onSubmit();
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      </div>
      {errorMessage && (
        <div className="px-3 py-1 text-[11px] text-destructive" style={{ paddingLeft: depth * 12 + 28 }}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}
