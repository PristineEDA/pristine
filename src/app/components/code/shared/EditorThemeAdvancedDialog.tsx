import type { CSSProperties } from 'react'
import {
  editorThemeOptions,
  getEditorThemeLabel,
  type EditorThemeId,
} from '../../../editor/editorSettings'
import { getEditorThemePreview, type EditorThemePreview } from '../../../editor/monacoThemes'
import { getRootThemeStyles } from '../../../editor/themeSource'
import { cn } from '../../../../lib/utils'
import { Button } from '../../ui/button'
import { Card, CardContent, CardFooter } from '../../ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { ScrollArea } from '../../ui/scroll-area'

type EditorThemeAdvancedDialogProps = {
  dialogStyle?: CSSProperties
  onOpenChange: (open: boolean) => void
  onSelectTheme: (theme: EditorThemeId) => void
  open: boolean
  selectedTheme: EditorThemeId
}

function ThemePreviewCard({
  isSelected,
  onSelect,
  preview,
  theme,
}: {
  isSelected: boolean
  onSelect: (theme: EditorThemeId) => void
  preview: EditorThemePreview
  theme: EditorThemeId
}) {
  const label = getEditorThemeLabel(theme)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    onSelect(theme)
  }

  return (
    <Card
      aria-label={`Select ${label}`}
      aria-pressed={isSelected}
      className={cn(
        'gap-0 overflow-hidden py-0 transition-[border-color,background-color,box-shadow] hover:cursor-pointer hover:border-accent-foreground/20 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isSelected && 'border-primary/60 shadow-sm',
      )}
      data-state={isSelected ? 'selected' : 'unselected'}
      data-testid={`settings-editor-theme-preview-card-${theme}`}
      onClick={() => onSelect(theme)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <CardContent className="flex min-h-32 items-center justify-center px-3 py-6 sm:px-4">
        <div
          className="w-full max-w-[15rem] overflow-hidden rounded-md border shadow-sm"
          data-testid={`settings-editor-theme-preview-editor-${theme}`}
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
              <div className="truncate" data-testid={`settings-editor-theme-preview-line-comment-${theme}`}>
                <span style={{ color: preview.palette.comment }}>// timing path</span>
              </div>
              <div className="truncate" data-testid={`settings-editor-theme-preview-line-module-${theme}`}>
                <span style={{ color: preview.palette.pink }}>module</span>{' '}
                <span style={{ color: preview.palette.cyan }}>alu</span>
                <span style={{ color: preview.palette.foreground }}>(</span>
                <span style={{ color: preview.palette.orange }}>clk</span>
                <span style={{ color: preview.palette.foreground }}>)</span>
              </div>
              <div
                className="truncate rounded-sm px-1"
                data-testid={`settings-editor-theme-preview-selection-${theme}`}
                style={{ backgroundColor: preview.palette.selection }}
              >
                <span style={{ color: preview.palette.orange }}>sum</span>{' '}
                <span style={{ color: preview.palette.foreground }}>=</span>{' '}
                <span style={{ color: preview.palette.green }}>calc</span>
                <span style={{ color: preview.palette.foreground }}>(</span>
                <span style={{ color: preview.palette.yellow }}>'RUN'</span>
                <span style={{ color: preview.palette.foreground }}>)</span>
              </div>
              <div className="truncate" data-testid={`settings-editor-theme-preview-line-end-${theme}`}>
                <span style={{ color: preview.palette.pink }}>endmodule</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-center border-t border-border/70 bg-muted/35 px-3 py-2.5 text-[13px] font-medium text-foreground">
        {label}
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
  const themeStyles = getRootThemeStyles()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="settings-editor-theme-advanced-dialog"
        className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-6xl"
        style={dialogStyle}
      >
        <DialogHeader>
          <DialogTitle>Advanced theme picker</DialogTitle>
          <DialogDescription>
            Preview Monaco color themes in a compact editor layout before applying them to code tabs.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0" data-testid="settings-editor-theme-advanced-scroll-area">
          <div className="pr-4">
            <div data-testid="settings-editor-theme-advanced-grid" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {editorThemeOptions.map((option) => (
                <ThemePreviewCard
                  key={option.value}
                  isSelected={option.value === selectedTheme}
                  onSelect={onSelectTheme}
                  preview={getEditorThemePreview(option.value, themeStyles)}
                  theme={option.value}
                />
              ))}
            </div>
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