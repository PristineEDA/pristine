import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import {
  getEditorFontFamilyAuthor,
  editorFontFamilyOptions,
  getEditorFontFamilyLabel,
  getEditorFontFamilyStack,
  type EditorFontFamilyId,
} from '../../../editor/editorSettings';
import { ensureEditorFontFamilyLoaded } from '../../../editor/fontLoader';
import { cn } from '../../../../lib/utils';
import { Card, CardContent, CardFooter } from '../../ui/card';
import { AdvancedPickerLayout, filterOptionsByLabel } from './AdvancedPickerLayout';

type EditorFontAdvancedDialogProps = {
  dialogStyle?: CSSProperties;
  onOpenChange: (open: boolean) => void;
  onSelectFontFamily: (fontFamily: EditorFontFamilyId) => void;
  open: boolean;
  selectedFontFamily: EditorFontFamilyId;
};

const fontPreviewLetters = 'AaBbCcDdEe';
const fontPreviewDigits = '0123456789';
const advancedFontSearchPlaceholder = 'Search editor fonts...';
const advancedFontSearchEmptyText = 'No editor font found.';

function FontPreviewCard({
  fontFamily,
  isSelected,
  onSelect,
  testIdPrefix,
}: {
  fontFamily: EditorFontFamilyId;
  isSelected: boolean;
  onSelect?: (fontFamily: EditorFontFamilyId) => void;
  testIdPrefix: 'settings-editor-font-family-current' | 'settings-editor-font-family-preview';
}) {
  const author = getEditorFontFamilyAuthor(fontFamily);
  const label = getEditorFontFamilyLabel(fontFamily);
  const stack = getEditorFontFamilyStack(fontFamily);
  const isInteractive = Boolean(onSelect);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onSelect) {
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    onSelect(fontFamily);
  };

  const handleSelect = onSelect ? () => onSelect(fontFamily) : undefined;

  return (
    <Card
      aria-label={`Select ${label}`}
      aria-pressed={isInteractive ? isSelected : undefined}
      className={cn(
        'gap-0 overflow-hidden py-0 transition-[border-color,background-color,box-shadow]',
        isInteractive && 'hover:cursor-pointer hover:border-accent-foreground/20 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isSelected && 'border-black shadow-sm',
      )}
      data-state={isSelected ? 'selected' : 'unselected'}
      data-testid={`${testIdPrefix}-card-${fontFamily}`}
      onClick={handleSelect}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      <CardContent className="flex min-h-32 items-center justify-center px-3 py-6 sm:px-4">
        <div className="space-y-1.5 text-center text-foreground" style={{ fontFamily: stack }}>
          <p
            className="text-[1.35rem] leading-none font-medium tracking-[0.02em]"
            data-testid={`${testIdPrefix}-letters-${fontFamily}`}
          >
            {fontPreviewLetters}
          </p>
          <p
            className="text-[0.95rem] leading-none tracking-[0.08em]"
            data-testid={`${testIdPrefix}-digits-${fontFamily}`}
          >
            {fontPreviewDigits}
          </p>
        </div>
      </CardContent>
      <CardFooter className="relative h-10 justify-center overflow-hidden border-t border-border/70 bg-muted/35 px-3 py-2.5 text-[13px] font-medium text-foreground">
        <div className="absolute inset-x-0 top-1/2 flex min-w-0 -translate-y-1/2 flex-col items-center leading-none">
          <span
            className="block w-full truncate px-3 text-center"
            data-testid={`${testIdPrefix}-label-${fontFamily}`}
          >
            {label}
          </span>
          <span
            className="mt-px text-[10px] font-normal text-muted-foreground"
            data-testid={`${testIdPrefix}-author-${fontFamily}`}
          >
            {author}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}

export function EditorFontAdvancedDialog({
  dialogStyle,
  onOpenChange,
  onSelectFontFamily,
  open,
  selectedFontFamily,
}: EditorFontAdvancedDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      return;
    }

    for (const option of editorFontFamilyOptions) {
      void ensureEditorFontFamilyLoaded(option.value).catch(() => undefined);
    }
  }, [open]);

  const filteredAvailableFontOptions = useMemo(() => filterOptionsByLabel(editorFontFamilyOptions, searchQuery), [searchQuery]);

  return (
    <AdvancedPickerLayout
      availableEmptyStateTestId="settings-editor-font-family-advanced-empty-state"
      availableEmptyText={advancedFontSearchEmptyText}
      availableGridContent={filteredAvailableFontOptions.map((option) => (
        <FontPreviewCard
          key={option.value}
          fontFamily={option.value}
          isSelected={option.value === selectedFontFamily}
          onSelect={onSelectFontFamily}
          testIdPrefix="settings-editor-font-family-preview"
        />
      ))}
      availableGridTestId="settings-editor-font-family-advanced-grid"
      availableHasItems={filteredAvailableFontOptions.length > 0}
      availableSectionDescription="Choose from the bundled monospace fonts available for the editor."
      availableSectionTestId="settings-editor-font-family-available-section"
      availableSectionTitle="Available fonts"
      closeButtonTestId="settings-editor-font-family-advanced-close-button"
      currentGridContent={
        <FontPreviewCard
          fontFamily={selectedFontFamily}
          isSelected={false}
          testIdPrefix="settings-editor-font-family-current"
        />
      }
      currentSectionDescription="The font currently used by Monaco editor tabs."
      currentSectionTestId="settings-editor-font-family-current-section"
      currentSectionTitle="Current"
      description="Preview the bundled editor fonts and pick the one that fits your coding layout."
      dialogStyle={dialogStyle}
      dialogTestId="settings-editor-font-family-advanced-dialog"
      onOpenChange={onOpenChange}
      open={open}
      scrollAreaTestId="settings-editor-font-family-advanced-scroll-area"
      searchInputTestId="settings-editor-font-family-advanced-search-input"
      searchPlaceholder={advancedFontSearchPlaceholder}
      searchValue={searchQuery}
      title="Advanced font picker"
      onSearchValueChange={setSearchQuery}
    />
  );
}