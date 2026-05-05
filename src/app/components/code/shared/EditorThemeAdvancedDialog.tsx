import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import {
  editorThemeOptions,
  getEditorThemeAuthor,
  getEditorThemeLabel,
  type EditorThemeId,
} from '../../../editor/editorSettings'
import { getEditorThemePreview, type EditorThemePreview } from '../../../editor/monacoThemes'
import { getRootThemeStyles } from '../../../editor/themeSource'
import { cn } from '../../../../lib/utils'
import { Card, CardContent, CardFooter } from '../../ui/card'
import { AdvancedPickerLayout, filterOptionsByLabel } from './AdvancedPickerLayout'

type EditorThemeAdvancedDialogProps = {
  dialogStyle?: CSSProperties
  onOpenChange: (open: boolean) => void
  onSelectTheme: (theme: EditorThemeId) => void
  open: boolean
  selectedTheme: EditorThemeId
}

const advancedThemeSearchPlaceholder = 'Search editor themes...'
const advancedThemeSearchEmptyText = 'No editor theme found.'

function ThemePreviewCard({
  isSelected,
  onSelect,
  preview,
  testIdPrefix,
  theme,
}: {
  isSelected: boolean
  onSelect?: (theme: EditorThemeId) => void
  preview: EditorThemePreview
  testIdPrefix: 'settings-editor-theme-current' | 'settings-editor-theme-preview'
  theme: EditorThemeId
}) {
  const label = getEditorThemeLabel(theme)
  const author = getEditorThemeAuthor(theme)
  const isInteractive = Boolean(onSelect)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onSelect) {
      return
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    onSelect(theme)
  }

  const handleSelect = onSelect ? () => onSelect(theme) : undefined

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
      data-testid={`${testIdPrefix}-card-${theme}`}
      onClick={handleSelect}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      <CardContent className="flex min-h-32 items-center justify-center px-3 py-6 sm:px-4">
        <div
          className="w-full max-w-[15rem] overflow-hidden rounded-md border shadow-sm"
          data-testid={`${testIdPrefix}-editor-${theme}`}
          style={{
            backgroundColor: preview.palette.background,
            borderColor: `${preview.palette.comment}44`,
          }}
        >
          <div className="grid grid-cols-[2rem_minmax(0,1fr)] text-left font-mono text-[9px] leading-[1.15rem] sm:text-[10px]">
            <div
              className="border-r px-1.5 py-2 text-right"
              style={{
                backgroundColor: preview.palette.surface,
                borderColor: `${preview.palette.comment}33`,
                color: preview.palette.comment,
              }}
            >
              <div>1</div>
              <div>2</div>
              <div>3</div>
              <div>4</div>
            </div>
            <div className="space-y-0.5 px-2 py-2" style={{ color: preview.palette.foreground }}>
              <div className="truncate" data-testid={`${testIdPrefix}-line-comment-${theme}`}>
                <span style={{ color: preview.palette.comment }}>// timing path</span>
              </div>
              <div className="truncate" data-testid={`${testIdPrefix}-line-module-${theme}`}>
                <span style={{ color: preview.palette.pink }}>module</span>{' '}
                <span style={{ color: preview.palette.cyan }}>alu</span>
                <span style={{ color: preview.palette.foreground }}>(</span>
                <span style={{ color: preview.palette.orange }}>clk</span>
                <span style={{ color: preview.palette.foreground }}>)</span>
              </div>
              <div
                className="truncate rounded-sm px-1"
                data-testid={`${testIdPrefix}-selection-${theme}`}
                style={{ backgroundColor: preview.palette.selection }}
              >
                <span style={{ color: preview.palette.orange }}>sum</span>{' '}
                <span style={{ color: preview.palette.foreground }}>=</span>{' '}
                <span style={{ color: preview.palette.green }}>calc</span>
                <span style={{ color: preview.palette.foreground }}>(</span>
                <span style={{ color: preview.palette.yellow }}>'RUN'</span>
                <span style={{ color: preview.palette.foreground }}>)</span>
              </div>
              <div className="truncate" data-testid={`${testIdPrefix}-line-end-${theme}`}>
                <span style={{ color: preview.palette.pink }}>endmodule</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="relative h-10 justify-center overflow-hidden border-t border-border/70 bg-muted/35 px-3 py-2.5 text-[13px] font-medium text-foreground">
        <div className="absolute inset-x-0 top-1/2 flex min-w-0 -translate-y-1/2 flex-col items-center leading-none">
          <span
            className="block w-full truncate px-3 text-center"
            data-testid={`${testIdPrefix}-label-${theme}`}
          >
            {label}
          </span>
          <span
            className="mt-px text-[10px] font-normal text-muted-foreground"
            data-testid={`${testIdPrefix}-author-${theme}`}
          >
            {author}
          </span>
        </div>
      </CardFooter>
    </Card>
  )
}

export function EditorThemeAdvancedDialog({
  dialogStyle,
  onOpenChange,
  onSelectTheme,
  open,
  selectedTheme,
}: EditorThemeAdvancedDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const themeStyles = getRootThemeStyles()

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
    }
  }, [open])

  const filteredAvailableThemeOptions = useMemo(() => filterOptionsByLabel(editorThemeOptions, searchQuery), [searchQuery])

  return (
    <AdvancedPickerLayout
      availableEmptyStateTestId="settings-editor-theme-advanced-empty-state"
      availableEmptyText={advancedThemeSearchEmptyText}
      availableGridContent={filteredAvailableThemeOptions.map((option) => (
        <ThemePreviewCard
          key={option.value}
          isSelected={option.value === selectedTheme}
          onSelect={onSelectTheme}
          preview={getEditorThemePreview(option.value, themeStyles)}
          testIdPrefix="settings-editor-theme-preview"
          theme={option.value}
        />
      ))}
      availableGridTestId="settings-editor-theme-advanced-grid"
      availableHasItems={filteredAvailableThemeOptions.length > 0}
      availableSectionDescription="Choose from the bundled Monaco themes available for the editor."
      availableSectionTestId="settings-editor-theme-available-section"
      availableSectionTitle="Available themes"
      closeButtonTestId="settings-editor-theme-advanced-close-button"
      currentGridContent={
        <ThemePreviewCard
          isSelected={false}
          preview={getEditorThemePreview(selectedTheme, themeStyles)}
          testIdPrefix="settings-editor-theme-current"
          theme={selectedTheme}
        />
      }
      currentSectionDescription="The theme currently used by Monaco editor tabs."
      currentSectionTestId="settings-editor-theme-current-section"
      currentSectionTitle="Current"
      description="Preview Monaco color themes in a compact editor layout before applying them to code tabs."
      dialogStyle={dialogStyle}
      dialogTestId="settings-editor-theme-advanced-dialog"
      onOpenChange={onOpenChange}
      open={open}
      scrollAreaTestId="settings-editor-theme-advanced-scroll-area"
      searchInputTestId="settings-editor-theme-advanced-search-input"
      searchPlaceholder={advancedThemeSearchPlaceholder}
      searchValue={searchQuery}
      title="Advanced theme picker"
      onSearchValueChange={setSearchQuery}
    />
  )
}