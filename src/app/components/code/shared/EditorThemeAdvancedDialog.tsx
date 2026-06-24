import { BetweenHorizontalStart, List } from 'lucide-react'
import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import type { ColorThemeOption, ColorThemePreviewPalette } from '../../../theme/colorThemeTypes'
import { AdvancedPickerLayout, advancedPickerGridClassName, filterOptionsByLabel } from './AdvancedPickerLayout'
import { IconTabToggleGroup } from './IconTabToggleGroup'
import { ColorThemePreviewCard } from './PickerPreviewCards'

type EditorThemeAdvancedDialogProps = {
  availableThemes: ColorThemeOption[]
  dialogStyle?: CSSProperties
  getThemePreview: (themeId: string) => ColorThemePreviewPalette
  layoutMode: 'grouped' | 'list'
  onOpenChange: (open: boolean) => void
  onLayoutModeChange: (layoutMode: 'grouped' | 'list') => void
  onSelectTheme: (themeId: string) => void
  open: boolean
  selectedTheme: string
}

const advancedThemeSearchPlaceholder = 'Search UI themes...'
const advancedThemeSearchEmptyText = 'No UI theme found.'
const themeLayoutToggleItems = [
  {
    value: 'list',
    label: 'List layout',
    icon: List,
    testId: 'settings-theme-advanced-layout-list-button',
  },
  {
    value: 'grouped',
    label: 'Grouped layout',
    icon: BetweenHorizontalStart,
    testId: 'settings-theme-advanced-layout-grouped-button',
  },
] as const

export function EditorThemeAdvancedDialog({
  availableThemes,
  dialogStyle,
  getThemePreview,
  layoutMode,
  onOpenChange,
  onLayoutModeChange,
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
  const filteredDarkThemeOptions = useMemo(
    () => filteredAvailableThemeOptions.filter((option) => option.kind === 'dark'),
    [filteredAvailableThemeOptions],
  )
  const filteredLightThemeOptions = useMemo(
    () => filteredAvailableThemeOptions.filter((option) => option.kind === 'light'),
    [filteredAvailableThemeOptions],
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

  const availableContent = layoutMode === 'grouped'
    ? (
        <>
          {filteredDarkThemeOptions.length > 0 ? (
            <section data-testid="settings-theme-advanced-dark-section" className="space-y-3">
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-foreground">Dark themes</h4>
                <p className="text-xs leading-5 text-muted-foreground">Themes optimized for dark workbench surfaces.</p>
              </div>
              <div data-testid="settings-theme-advanced-dark-grid" className={advancedPickerGridClassName}>
                {filteredDarkThemeOptions.map((option) => (
                  <ColorThemePreviewCard
                    key={option.value}
                    isSelected={option.value === selectedTheme}
                    onSelect={onSelectTheme}
                    option={option}
                    preview={getThemePreview(option.value)}
                    testIdPrefix="settings-theme-preview"
                  />
                ))}
              </div>
            </section>
          ) : null}
          {filteredLightThemeOptions.length > 0 ? (
            <section data-testid="settings-theme-advanced-light-section" className="space-y-3">
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-foreground">Light themes</h4>
                <p className="text-xs leading-5 text-muted-foreground">Themes optimized for bright workbench surfaces.</p>
              </div>
              <div data-testid="settings-theme-advanced-light-grid" className={advancedPickerGridClassName}>
                {filteredLightThemeOptions.map((option) => (
                  <ColorThemePreviewCard
                    key={option.value}
                    isSelected={option.value === selectedTheme}
                    onSelect={onSelectTheme}
                    option={option}
                    preview={getThemePreview(option.value)}
                    testIdPrefix="settings-theme-preview"
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )
    : undefined

  return (
    <AdvancedPickerLayout
      availableContent={availableContent}
      availableContentClassName={layoutMode === 'grouped' ? 'space-y-6' : undefined}
      availableEmptyStateTestId="settings-theme-advanced-empty-state"
      availableEmptyText={advancedThemeSearchEmptyText}
      availableHeaderControls={(
        <IconTabToggleGroup
          items={themeLayoutToggleItems}
          value={layoutMode}
          groupLabel="Theme picker layout"
          groupTestId="settings-theme-advanced-layout-toggle"
          tooltipSide="top"
          onValueChange={(nextValue) => {
            if (nextValue === 'grouped' || nextValue === 'list') {
              onLayoutModeChange(nextValue)
            }
          }}
        />
      )}
      availableGridContent={filteredAvailableThemeOptions.map((option) => (
        <ColorThemePreviewCard
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
      availableSectionDescription="Choose the color theme used across the workbench, Monaco, and the integrated terminal."
      availableSectionTestId="settings-theme-available-section"
      availableSectionTitle="Available themes"
      closeButtonTestId="settings-theme-advanced-close-button"
      currentGridContent={
        <ColorThemePreviewCard
          isSelected={false}
          option={selectedThemeOption}
          preview={getThemePreview(selectedTheme)}
          testIdPrefix="settings-theme-current"
        />
      }
      currentSectionDescription="The theme currently used across Pristine UI, Monaco editor tabs, and terminal surfaces."
      currentSectionTestId="settings-theme-current-section"
      currentSectionTitle="Current"
      description="Preview color themes in a compact editor layout before applying them across the workbench."
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
