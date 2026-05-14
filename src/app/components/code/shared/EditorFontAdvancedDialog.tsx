import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import {
  editorFontFamilyOptions,
  type EditorFontFamilyId,
} from '../../../editor/editorSettings';
import { ensureEditorFontFamilyLoaded } from '../../../editor/fontLoader';
import { AdvancedPickerLayout, filterOptionsByLabel } from './AdvancedPickerLayout';
import { EditorFontPreviewCard } from './PickerPreviewCards';

type EditorFontAdvancedDialogProps = {
  dialogStyle?: CSSProperties;
  onOpenChange: (open: boolean) => void;
  onSelectFontFamily: (fontFamily: EditorFontFamilyId) => void;
  open: boolean;
  selectedFontFamily: EditorFontFamilyId;
};

const advancedFontSearchPlaceholder = 'Search editor fonts...';
const advancedFontSearchEmptyText = 'No editor font found.';

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
        <EditorFontPreviewCard
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
        <EditorFontPreviewCard
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