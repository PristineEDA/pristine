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
import { Button } from '../../ui/button'
import { Card, CardContent, CardFooter } from '../../ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Input } from '../../ui/input'
import { ScrollArea } from '../../ui/scroll-area'

type EditorThemeAdvancedDialogProps = {
  dialogStyle?: CSSProperties
  onOpenChange: (open: boolean) => void
  onSelectTheme: (theme: EditorThemeId) => void
  open: boolean
  selectedTheme: EditorThemeId
}

const advancedThemeSearchPlaceholder = 'Search editor themes...'
const advancedThemeSearchEmptyText = 'No editor theme found.'
const advancedThemeSearchInputClassName = 'border-foreground/20 bg-background text-sm hover:border-foreground/35'

function filterThemeOptionsByLabel(query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return editorThemeOptions
  }

  return editorThemeOptions.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
}

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

  const filteredAvailableThemeOptions = useMemo(() => filterThemeOptionsByLabel(searchQuery), [searchQuery])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="settings-editor-theme-advanced-dialog"
        className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-6xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          document
            .querySelector<HTMLButtonElement>('[data-testid="settings-editor-theme-advanced-close-button"]')
            ?.focus()
        }}
        style={dialogStyle}
      >
        <DialogHeader>
          <DialogTitle>Advanced theme picker</DialogTitle>
          <DialogDescription>
            Preview Monaco color themes in a compact editor layout before applying them to code tabs.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0" data-testid="settings-editor-theme-advanced-scroll-area">
          <div className="space-y-8 pr-4">
            <section data-testid="settings-editor-theme-current-section" className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">Current</h3>
                <p className="text-xs leading-5 text-muted-foreground">
                  The theme currently used by Monaco editor tabs.
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <ThemePreviewCard
                  isSelected={false}
                  preview={getEditorThemePreview(selectedTheme, themeStyles)}
                  testIdPrefix="settings-editor-theme-current"
                  theme={selectedTheme}
                />
              </div>
            </section>
            <section data-testid="settings-editor-theme-available-section" className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 space-y-1">
                  <h3 className="text-sm font-medium text-foreground">Available themes</h3>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Choose from the bundled Monaco themes available for the editor.
                  </p>
                </div>
                <div className="w-full shrink-0 sm:w-72">
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={advancedThemeSearchPlaceholder}
                    data-testid="settings-editor-theme-advanced-search-input"
                    className={advancedThemeSearchInputClassName}
                  />
                </div>
              </div>
              <div data-testid="settings-editor-theme-advanced-grid" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredAvailableThemeOptions.length > 0 ? (
                  filteredAvailableThemeOptions.map((option) => (
                    <ThemePreviewCard
                      key={option.value}
                      isSelected={option.value === selectedTheme}
                      onSelect={onSelectTheme}
                      preview={getEditorThemePreview(option.value, themeStyles)}
                      testIdPrefix="settings-editor-theme-preview"
                      theme={option.value}
                    />
                  ))
                ) : (
                  <div
                    className="col-span-full flex min-h-32 items-center justify-center rounded-md border border-dashed border-border/70 px-4 text-center text-sm text-muted-foreground"
                    data-testid="settings-editor-theme-advanced-empty-state"
                  >
                    {advancedThemeSearchEmptyText}
                  </div>
                )}
              </div>
            </section>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            data-testid="settings-editor-theme-advanced-close-button"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}