import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import type { ColorThemeOption, ColorThemePreviewPalette } from '../../../theme/colorThemeTypes'
import { cn } from '../../../../lib/utils'
import { Card, CardContent, CardFooter } from '../../ui/card'
import { AdvancedPickerLayout, filterOptionsByLabel } from './AdvancedPickerLayout'

type EditorThemeAdvancedDialogProps = {
  availableThemes: ColorThemeOption[]
  dialogStyle?: CSSProperties
  getThemePreview: (themeId: string) => ColorThemePreviewPalette
  onOpenChange: (open: boolean) => void
  onSelectTheme: (themeId: string) => void
  open: boolean
  selectedTheme: string
}

const advancedThemeSearchPlaceholder = 'Search UI themes...'
const advancedThemeSearchEmptyText = 'No UI theme found.'

function ThemePreviewCard({
  isSelected,
  onSelect,
  option,
  preview,
  testIdPrefix,
}: {
  isSelected: boolean
  onSelect?: (themeId: string) => void
  option: ColorThemeOption
  preview: ColorThemePreviewPalette
  testIdPrefix: 'settings-theme-current' | 'settings-theme-preview'
}) {
  const isInteractive = Boolean(onSelect)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onSelect) {
      return
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    onSelect(option.value)
  }

  const handleSelect = onSelect ? () => onSelect(option.value) : undefined

  return (
    <Card
      aria-label={`Select ${option.label}`}
      aria-pressed={isInteractive ? isSelected : undefined}
      className={cn(
        'gap-0 overflow-hidden py-0 transition-[border-color,background-color,box-shadow]',
        isInteractive && 'hover:cursor-pointer hover:border-accent-foreground/20 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isSelected && 'border-black shadow-sm',
      )}
      data-state={isSelected ? 'selected' : 'unselected'}
      data-testid={`${testIdPrefix}-card-${option.value}`}
      onClick={handleSelect}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      <CardContent className="flex min-h-32 items-center justify-center px-3 py-6 sm:px-4">
        <div
          className="w-full max-w-[15rem] overflow-hidden rounded-md border shadow-sm"
          data-testid={`${testIdPrefix}-editor-${option.value}`}
          style={{
            backgroundColor: preview.background,
            borderColor: `${preview.comment}44`,
          }}
        >
          <div className="grid grid-cols-[2rem_minmax(0,1fr)] text-left font-mono text-[9px] leading-[1.15rem] sm:text-[10px]">
            <div
              className="border-r px-1.5 py-2 text-right"
              style={{
                backgroundColor: preview.surface,
                borderColor: `${preview.comment}33`,
                color: preview.comment,
              }}
            >
              <div>1</div>
              <div>2</div>
              <div>3</div>
              <div>4</div>
            </div>
            <div className="space-y-0.5 px-2 py-2" style={{ color: preview.foreground }}>
              <div className="truncate" data-testid={`${testIdPrefix}-line-comment-${option.value}`}>
                <span style={{ color: preview.comment }}>// timing path</span>
              </div>
              <div className="truncate" data-testid={`${testIdPrefix}-line-module-${option.value}`}>
                <span style={{ color: preview.pink }}>module</span>{' '}
                <span style={{ color: preview.cyan }}>alu</span>
                <span style={{ color: preview.foreground }}>(</span>
                <span style={{ color: preview.orange }}>clk</span>
                <span style={{ color: preview.foreground }}>)</span>
              </div>
              <div
                className="truncate rounded-sm px-1"
                data-testid={`${testIdPrefix}-selection-${option.value}`}
                style={{ backgroundColor: preview.selection }}
              >
                <span style={{ color: preview.orange }}>sum</span>{' '}
                <span style={{ color: preview.foreground }}>=</span>{' '}
                <span style={{ color: preview.green }}>calc</span>
                <span style={{ color: preview.foreground }}>(</span>
                <span style={{ color: preview.yellow }}>'RUN'</span>
                <span style={{ color: preview.foreground }}>)</span>
              </div>
              <div className="truncate" data-testid={`${testIdPrefix}-line-end-${option.value}`}>
                <span style={{ color: preview.pink }}>endmodule</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="relative h-11 justify-center overflow-hidden border-t border-border/70 bg-muted/35 px-3 py-2.5 text-[13px] font-medium text-foreground">
        <div className="absolute inset-x-0 top-1/2 flex min-w-0 -translate-y-1/2 flex-col items-center leading-none">
          <span
            className="block w-full truncate px-3 text-center"
            data-testid={`${testIdPrefix}-label-${option.value}`}
          >
            {option.label}
          </span>
          <span
            className="mt-px text-[10px] font-normal text-muted-foreground"
            data-testid={`${testIdPrefix}-author-${option.value}`}
          >
            {option.author}
          </span>
        </div>
      </CardFooter>
    </Card>
  )
}

export function EditorThemeAdvancedDialog({
  availableThemes,
  dialogStyle,
  getThemePreview,
  onOpenChange,
  onSelectTheme,
  open,
  selectedTheme,
}: EditorThemeAdvancedDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
    }
  }, [open])

  const filteredAvailableThemeOptions = useMemo(
    () => filterOptionsByLabel(availableThemes, searchQuery),
    [availableThemes, searchQuery],
  )
  const selectedThemeOption = useMemo(() => {
    return filteredAvailableThemeOptions.find((option) => option.value === selectedTheme)
      ?? availableThemes.find((option) => option.value === selectedTheme)
      ?? {
        value: selectedTheme,
        label: selectedTheme,
        description: 'Currently selected theme.',
        author: 'Unknown author',
        kind: 'dark' as const,
        source: 'builtin' as const,
      }
  }, [availableThemes, filteredAvailableThemeOptions, selectedTheme])

  return (
    <AdvancedPickerLayout
      availableEmptyStateTestId="settings-theme-advanced-empty-state"
      availableEmptyText={advancedThemeSearchEmptyText}
      availableGridContent={filteredAvailableThemeOptions.map((option) => (
        <ThemePreviewCard
          key={option.value}
          isSelected={option.value === selectedTheme}
          onSelect={onSelectTheme}
          option={option}
          preview={getThemePreview(option.value)}
          testIdPrefix="settings-theme-preview"
        />
      ))}
      availableGridTestId="settings-theme-advanced-grid"
      availableHasItems={filteredAvailableThemeOptions.length > 0}
      availableSectionDescription="Choose the VS Code color theme used across the workbench, Monaco, and the integrated terminal."
      availableSectionTestId="settings-theme-available-section"
      availableSectionTitle="Available themes"
      closeButtonTestId="settings-theme-advanced-close-button"
      currentGridContent={
        <ThemePreviewCard
          isSelected={false}
          option={selectedThemeOption}
          preview={getThemePreview(selectedTheme)}
          testIdPrefix="settings-theme-current"
        />
      }
      currentSectionDescription="The theme currently used across Pristine UI, Monaco editor tabs, and terminal surfaces."
      currentSectionTestId="settings-theme-current-section"
      currentSectionTitle="Current"
      description="Preview VS Code color themes in a compact editor layout before applying them across the workbench."
      dialogStyle={dialogStyle}
      dialogTestId="settings-theme-advanced-dialog"
      onOpenChange={onOpenChange}
      open={open}
      scrollAreaTestId="settings-theme-advanced-scroll-area"
      searchInputTestId="settings-theme-advanced-search-input"
      searchPlaceholder={advancedThemeSearchPlaceholder}
      searchValue={searchQuery}
      title="Advanced theme picker"
      onSearchValueChange={setSearchQuery}
    />
  )
}