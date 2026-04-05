import { Fragment, useEffect, useRef } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import { toTreeTestId } from '../workspace/workspaceFiles';
import { FileTypeBadge } from './FileTypeBadge';
import type { QuickOpenSearchResult } from '../quickOpen/quickOpenSearch';

type QuickOpenPaletteMode = 'search' | 'recent';

interface QuickOpenPaletteProps {
  isOpen: boolean;
  mode: QuickOpenPaletteMode;
  query: string;
  results: QuickOpenSearchResult[];
  selectedIndex: number;
  isLoading: boolean;
  errorMessage: string | null;
  emptyMessage: string;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSelectedIndexChange: (index: number) => void;
  onSelectResult: (result: QuickOpenSearchResult) => void;
}

function getDirectoryPath(filePath: string): string {
  const segments = filePath.split('/');
  if (segments.length <= 1) {
    return '';
  }

  return segments.slice(0, -1).join('/');
}

function getMatchedCharacterIndexes(text: string, query: string): Set<number> {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedText = text.toLowerCase();

  if (normalizedQuery.length === 0 || normalizedText.length === 0) {
    return new Set<number>();
  }

  const contiguousMatchIndex = normalizedText.indexOf(normalizedQuery);
  if (contiguousMatchIndex !== -1) {
    return new Set(
      Array.from({ length: normalizedQuery.length }, (_value, index) => contiguousMatchIndex + index),
    );
  }

  const matchedIndexes: number[] = [];
  let queryIndex = 0;

  for (let textIndex = 0; textIndex < normalizedText.length; textIndex += 1) {
    if (normalizedText[textIndex] !== normalizedQuery[queryIndex]) {
      continue;
    }

    matchedIndexes.push(textIndex);
    queryIndex += 1;

    if (queryIndex === normalizedQuery.length) {
      return new Set(matchedIndexes);
    }
  }

  return new Set<number>();
}

function renderHighlightedText(text: string, query: string, testIdPrefix?: string) {
  const matchedIndexes = getMatchedCharacterIndexes(text, query);

  return Array.from(text).map((character, index) => {
    if (!matchedIndexes.has(index)) {
      return <Fragment key={`${text}-${index}`}>{character}</Fragment>;
    }

    return (
      <mark
        key={`${text}-${index}`}
        data-testid={testIdPrefix ? `${testIdPrefix}-${index}` : undefined}
        className="bg-transparent font-semibold text-ide-chat-text-bright"
      >
        {character}
      </mark>
    );
  });
}

export function QuickOpenPalette({
  isOpen,
  mode: _mode,
  query,
  results,
  selectedIndex,
  isLoading,
  errorMessage,
  emptyMessage,
  onClose,
  onQueryChange,
  onSelectedIndexChange,
  onSelectResult,
}: QuickOpenPaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedRowRef.current || !resultsContainerRef.current) {
      return;
    }

    selectedRowRef.current.scrollIntoView({ block: 'nearest' });
  }, [isOpen, selectedIndex, results]);

  if (!isOpen) {
    return null;
  }

  const hasResults = results.length > 0;
  const selectedResult = hasResults ? results[selectedIndex] ?? results[0] : null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[60px] z-50 flex justify-center px-4">
      <div
        data-testid="quick-open-overlay"
        className="pointer-events-auto w-full max-w-[42rem] overflow-hidden rounded-none border border-border bg-muted shadow-[0_18px_48px_rgba(0,0,0,0.42)]"
      >
        <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-2">
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            data-testid="quick-open-input"
            value={query}
            placeholder="Type the name of a file to open"
            className="w-full bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
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
          <div className="hidden items-center gap-1 rounded-none border border-border bg-muted px-2 py-1 text-[10px] text-muted-foreground md:flex">
            <CornerDownLeft size={12} />
            Open
          </div>
        </div>

        <div ref={resultsContainerRef} className="max-h-[22rem] overflow-y-auto overflow-x-hidden py-1">
          {isLoading && (
            <div className="px-4 py-3 text-[12px] text-muted-foreground">Indexing workspace files...</div>
          )}

          {!isLoading && errorMessage && (
            <div className="px-4 py-3 text-[12px] text-destructive">{errorMessage}</div>
          )}

          {!isLoading && !errorMessage && !hasResults && (
            <div data-testid="quick-open-empty" className="px-4 py-3 text-[11px] text-muted-foreground">{emptyMessage}</div>
          )}

          {!isLoading && !errorMessage && results.map((result, index) => {
            const isSelected = index === selectedIndex;
            const directoryPath = getDirectoryPath(result.path);

            return (
              <button
                key={result.path}
                ref={isSelected ? selectedRowRef : null}
                type="button"
                data-testid={`quick-open-result-${toTreeTestId(result.path)}`}
                className={`flex w-full cursor-pointer items-center gap-3 px-3 py-1.5 text-left transition-colors ${
                  isSelected
                    ? 'bg-primary/20 text-foreground'
                    : 'text-foreground hover:bg-accent'
                }`}
                onMouseEnter={() => onSelectedIndexChange(index)}
                onClick={() => onSelectResult(result)}
              >
                <div className="flex w-6 shrink-0 justify-end">
                  <FileTypeBadge
                    name={result.name}
                    className="text-[10px] leading-none"
                    fallbackClassName="text-muted-foreground"
                    testId={`quick-open-icon-${toTreeTestId(result.path)}`}
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden whitespace-nowrap">
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
                    {renderHighlightedText(result.name, query, `quick-open-match-name-${toTreeTestId(result.path)}`)}
                  </span>
                  {directoryPath.length > 0 && (
                    <span
                      data-testid={`quick-open-path-${toTreeTestId(result.path)}`}
                      className="max-w-[45%] shrink-0 truncate text-right text-[11px] text-muted-foreground"
                    >
                      {renderHighlightedText(directoryPath, query, `quick-open-match-path-${toTreeTestId(result.path)}`)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}