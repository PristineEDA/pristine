"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/app/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover"

export interface ComboboxOption {
  value: string
  label: string
  description?: string
  keywords?: string[]
}

interface ComboboxProps {
  emptyText?: string
  onValueChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  previewPaneTestId?: string
  renderOptionPreview?: (option: ComboboxOption) => React.ReactNode
  searchPlaceholder?: string
  triggerClassName?: string
  triggerTestId?: string
  value: string
  getOptionTestId?: (value: string) => string
}

function getComboboxListTestId(triggerTestId?: string) {
  return triggerTestId ? `${triggerTestId}-list` : undefined
}

function Combobox({
  emptyText = "No result found.",
  onValueChange,
  options,
  placeholder = "Select an option",
  previewPaneTestId,
  renderOptionPreview,
  searchPlaceholder = "Search...",
  triggerClassName,
  triggerTestId,
  value,
  getOptionTestId,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [previewedOptionValue, setPreviewedOptionValue] = React.useState<string | null>(null)
  const [previewVisible, setPreviewVisible] = React.useState(false)
  const selectedOption = options.find((option) => option.value === value) ?? null
  const previewedOption = options.find((option) => option.value === previewedOptionValue) ?? null
  const listTestId = getComboboxListTestId(triggerTestId)
  const contentTestId = triggerTestId ? `${triggerTestId}-popover-content` : undefined
  const hasPreviewPane = Boolean(renderOptionPreview)

  React.useEffect(() => {
    if (!open || !listTestId) {
      return
    }

    let nestedAnimationFrameId = 0
    const animationFrameId = window.requestAnimationFrame(() => {
      nestedAnimationFrameId = window.requestAnimationFrame(() => {
        const listElement = document.querySelector<HTMLElement>(`[data-combobox-list="${listTestId}"]`)
        const selectedElement = document.querySelector<HTMLElement>(
          `[data-combobox-list="${listTestId}"] [data-selected-option="true"]`,
        )

        if (listElement && selectedElement) {
          const targetScrollTop = Math.max(
            selectedElement.offsetTop - listElement.clientHeight / 2 + selectedElement.offsetHeight / 2,
            0,
          )

          if (typeof listElement.scrollTo === "function") {
            listElement.scrollTo({ top: targetScrollTop })
          } else {
            listElement.scrollTop = targetScrollTop
          }
        }

        selectedElement?.scrollIntoView({ block: "center" })
      })
    })

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.cancelAnimationFrame(nestedAnimationFrameId)
    }
  }, [listTestId, open, value])

  React.useEffect(() => {
    if (open) {
      return
    }

    setPreviewVisible(false)
    setPreviewedOptionValue(null)
  }, [open])

  React.useEffect(() => {
    if (!previewedOptionValue) {
      return
    }

    if (options.some((option) => option.value === previewedOptionValue)) {
      return
    }

    setPreviewVisible(false)
    setPreviewedOptionValue(null)
  }, [options, previewedOptionValue])

  const handleListWheel = React.useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const listElement = event.currentTarget

    if (listElement.scrollHeight <= listElement.clientHeight) {
      return
    }

    if (typeof listElement.scrollBy === "function") {
      listElement.scrollBy({ top: event.deltaY })
    } else {
      listElement.scrollTop += event.deltaY
    }

    event.preventDefault()
  }, [])

  const showOptionPreview = React.useCallback((optionValue: string) => {
    if (!renderOptionPreview) {
      return
    }

    setPreviewedOptionValue(optionValue)
    setPreviewVisible(true)
  }, [renderOptionPreview])

  const hideOptionPreview = React.useCallback(() => {
    if (!renderOptionPreview) {
      return
    }

    setPreviewVisible(false)
  }, [renderOptionPreview])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid={triggerTestId}
          className={cn("flex w-full min-w-0 max-w-full justify-between overflow-hidden font-normal", triggerClassName)}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0", hasPreviewPane ? "w-[min(46rem,calc(100vw-2rem))]" : "w-(--radix-popover-trigger-width)") }>
        <div
          data-testid={contentTestId}
          className={cn("min-w-0", hasPreviewPane && "grid min-h-[22rem] grid-cols-[minmax(0,1fr)_18rem]")}
          onMouseLeave={hideOptionPreview}
        >
          <Command className="min-w-0">
            <CommandInput placeholder={searchPlaceholder} onFocus={hideOptionPreview} />
            <div
              data-combobox-list={listTestId}
              data-testid={listTestId}
              className="max-h-[300px] overflow-y-auto overscroll-contain"
              onWheel={handleListWheel}
            >
              <CommandList className="max-h-none overflow-visible">
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={[option.label, option.value, ...(option.keywords ?? [])].join(" ")}
                      data-selected-option={value === option.value ? "true" : "false"}
                      data-testid={getOptionTestId?.(option.value)}
                      onFocus={() => showOptionPreview(option.value)}
                      onMouseEnter={() => showOptionPreview(option.value)}
                      onSelect={() => {
                        onValueChange(option.value)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "size-4",
                          value === option.value ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{option.label}</span>
                        {option.description ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </div>
          </Command>
          {hasPreviewPane ? (
            <div
              aria-hidden={!previewVisible || !previewedOption}
              data-state={previewVisible && previewedOption ? "visible" : "hidden"}
              data-testid={previewPaneTestId}
              className={cn(
                "border-l border-border/70 bg-muted/20 p-3 transition-[opacity,transform] duration-300 ease-out",
                previewVisible && previewedOption ? "opacity-100 translate-x-0" : "pointer-events-none opacity-0 translate-x-2",
              )}
            >
              {previewedOption ? renderOptionPreview?.(previewedOption) : null}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { Combobox }