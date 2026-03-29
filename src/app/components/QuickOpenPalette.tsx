import { useEffect, useRef } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import { toTreeTestId } from '../workspace/workspaceFiles';
import type { QuickOpenSearchResult } from '../quickOpen/quickOpenSearch';

interface QuickOpenPaletteProps {
  isOpen: boolean;
  query: string;
  results: QuickOpenSearchResult[];
  selectedIndex: number;
  isLoading: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSelectedIndexChange: (index: number) => void;
  onSelectResult: (result: QuickOpenSearchResult) => void;
}

export function QuickOpenPalette({
  isOpen,
  query,
  results,
  selectedIndex,
  isLoading,
  errorMessage,
  onClose,
  onQueryChange,
  onSelectedIndexChange,
  onSelectResult,
}: QuickOpenPaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const hasResults = results.length > 0;
  const selectedResult = hasResults ? results[selectedIndex] ?? results[0] : null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        data-testid="quick-open-overlay"
        className="pointer-events-auto w-full max-w-[44rem] overflow-hidden rounded-xl border border-ide-chat-border bg-ide-chat-dropdown shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-ide-chat-border px-4 py-3">
          <Search size={16} className="shrink-0 text-ide-text-muted" />
          <input
            ref={inputRef}
            data-testid="quick-open-input"
            value={query}
            placeholder="Type the name of a file to open"
            className="w-full bg-transparent text-[14px] text-ide-chat-text outline-none placeholder:text-ide-text-muted"
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (!hasResults) {
                  return;
                }

                onSelectedIndexChange(Math.min(selectedIndex + 1, results.length - 1));
              }

              if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (!hasResults) {
                  return;
                }

                onSelectedIndexChange(Math.max(selectedIndex - 1, 0));
              }

              if (event.key === 'Enter') {
                event.preventDefault();
                if (selectedResult) {
                  onSelectResult(selectedResult);
                }
              }

              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
          />
          <div className="hidden items-center gap-1 rounded-md border border-ide-border bg-ide-tab-bg px-2 py-1 text-[11px] text-ide-text-muted md:flex">
            <CornerDownLeft size={12} />
            Open
          </div>
        </div>

        <div className="max-h-[22rem] overflow-y-auto overflow-x-hidden py-1">
          {isLoading && (
            <div className="px-4 py-3 text-[12px] text-ide-text-muted">Indexing workspace files...</div>
          )}

          {!isLoading && errorMessage && (
            <div className="px-4 py-3 text-[12px] text-ide-error">{errorMessage}</div>
          )}

          {!isLoading && !errorMessage && !hasResults && (
            <div className="px-4 py-3 text-[12px] text-ide-text-muted">No matching files</div>
          )}

          {!isLoading && !errorMessage && results.map((result, index) => {
            const isSelected = index === selectedIndex;

            return (
              <button
                key={result.path}
                type="button"
                data-testid={`quick-open-result-${toTreeTestId(result.path)}`}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                  isSelected
                    ? 'bg-ide-accent-dark text-white'
                    : 'text-ide-text hover:bg-ide-hover'
                }`}
                onMouseEnter={() => onSelectedIndexChange(index)}
                onClick={() => onSelectResult(result)}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{result.name}</div>
                  <div className={`truncate text-[11px] ${isSelected ? 'text-white/75' : 'text-ide-text-muted'}`}>
                    {result.path}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}