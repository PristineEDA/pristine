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
  searchPlaceholder = "Search...",
  triggerClassName,
  triggerTestId,
  value,
  getOptionTestId,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const selectedOption = options.find((option) => option.value === value) ?? null
  const listTestId = getComboboxListTestId(triggerTestId)

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid={triggerTestId}
          className={cn("w-full justify-between font-normal", triggerClassName)}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
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
      </PopoverContent>
    </Popover>
  )
}

export { Combobox }