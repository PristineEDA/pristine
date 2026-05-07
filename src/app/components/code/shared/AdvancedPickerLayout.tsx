import type { CSSProperties, ReactNode } from 'react'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Input } from '../../ui/input'
import { ScrollArea } from '../../ui/scroll-area'
import { cn } from '../../../../lib/utils'

export const advancedPickerDialogClassName = 'h-[85vh] max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-6xl'
export const advancedPickerScrollAreaClassName = 'h-full min-h-0'
export const advancedPickerSearchInputClassName = 'border-foreground/20 bg-background text-sm hover:border-foreground/35'
const advancedPickerGridClassName = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
const advancedPickerEmptyStateClassName = 'col-span-full flex min-h-32 items-center justify-center rounded-md border border-dashed border-border/70 px-4 text-center text-sm text-muted-foreground'

type AdvancedPickerLayoutProps = {
  availableEmptyStateTestId: string
  availableEmptyText: string
  availableGridContent: ReactNode
  availableGridTestId: string
  availableHasItems: boolean
  availableSectionDescription: string
  availableSectionTestId: string
  availableSectionTitle: string
  closeButtonTestId: string
  currentGridContent: ReactNode
  currentSectionDescription: string
  currentSectionTestId: string
  currentSectionTitle: string
  description: string
  dialogStyle?: CSSProperties
  dialogTestId: string
  onOpenChange: (open: boolean) => void
  open: boolean
  scrollAreaTestId: string
  searchInputClassName?: string
  searchInputTestId: string
  searchPlaceholder: string
  searchValue: string
  title: string
  onSearchValueChange: (value: string) => void
}

export function filterOptionsByLabel<T extends { label: string }>(options: readonly T[], query: string): T[] {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return [...options]
  }

  return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
}

export function AdvancedPickerLayout({
  availableEmptyStateTestId,
  availableEmptyText,
  availableGridContent,
  availableGridTestId,
  availableHasItems,
  availableSectionDescription,
  availableSectionTestId,
  availableSectionTitle,
  closeButtonTestId,
  currentGridContent,
  currentSectionDescription,
  currentSectionTestId,
  currentSectionTitle,
  description,
  dialogStyle,
  dialogTestId,
  onOpenChange,
  open,
  scrollAreaTestId,
  searchInputClassName,
  searchInputTestId,
  searchPlaceholder,
  searchValue,
  title,
  onSearchValueChange,
}: AdvancedPickerLayoutProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid={dialogTestId}
        className={advancedPickerDialogClassName}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          document.querySelector<HTMLButtonElement>(`[data-testid="${closeButtonTestId}"]`)?.focus()
        }}
        style={dialogStyle}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className={advancedPickerScrollAreaClassName} data-testid={scrollAreaTestId}>
          <div className="space-y-8 pr-4">
            <section data-testid={currentSectionTestId} className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">{currentSectionTitle}</h3>
                <p className="text-xs leading-5 text-muted-foreground">{currentSectionDescription}</p>
              </div>
              <div className={advancedPickerGridClassName}>{currentGridContent}</div>
            </section>
            <section data-testid={availableSectionTestId} className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 space-y-1">
                  <h3 className="text-sm font-medium text-foreground">{availableSectionTitle}</h3>
                  <p className="text-xs leading-5 text-muted-foreground">{availableSectionDescription}</p>
                </div>
                <div className="w-full shrink-0 sm:w-72">
                  <Input
                    type="text"
                    value={searchValue}
                    onChange={(event) => onSearchValueChange(event.target.value)}
                    placeholder={searchPlaceholder}
                    data-testid={searchInputTestId}
                    className={cn(advancedPickerSearchInputClassName, searchInputClassName)}
                  />
                </div>
              </div>
              <div data-testid={availableGridTestId} className={advancedPickerGridClassName}>
                {availableHasItems ? (
                  availableGridContent
                ) : (
                  <div className={advancedPickerEmptyStateClassName} data-testid={availableEmptyStateTestId}>
                    {availableEmptyText}
                  </div>
                )}
              </div>
            </section>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="outline" data-testid={closeButtonTestId} onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}