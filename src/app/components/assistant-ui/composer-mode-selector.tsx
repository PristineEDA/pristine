"use client";

import { useCallback, useState, type ComponentPropsWithoutRef } from "react";
import type { VariantProps } from "class-variance-authority";
import {
  Bot,
  ChevronDownIcon,
  Lightbulb,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { selectTriggerVariants } from "@/app/components/assistant-ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";

export type ComposerModeValue = "agent" | "ask" | "plan";

type ComposerModeOption = {
  value: ComposerModeValue;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
};

export const DEFAULT_COMPOSER_MODE: ComposerModeValue = "agent";

const composerModeOptions = [
  {
    value: "agent",
    label: "Agent",
    icon: Bot,
    shortcut: "Ctrl+Shift+I",
  },
  {
    value: "ask",
    label: "Ask",
    icon: MessageCircle,
  },
  {
    value: "plan",
    label: "Plan",
    icon: Lightbulb,
  },
] satisfies readonly ComposerModeOption[];

function getComposerModeOption(value?: string): ComposerModeOption {
  return composerModeOptions.find((option) => option.value === value)
    ?? composerModeOptions[0]!;
}

export type ComposerModeSelectorProps = Omit<
  ComponentPropsWithoutRef<typeof DropdownMenu>,
  "children"
> &
  VariantProps<typeof selectTriggerVariants> & {
    className?: string;
    contentClassName?: string;
    defaultValue?: ComposerModeValue;
    onValueChange?: (value: ComposerModeValue) => void;
    value?: ComposerModeValue;
  };

export function ComposerModeSelector({
  className,
  contentClassName,
  defaultValue,
  onValueChange,
  size,
  value,
  variant,
  ...menuProps
}: ComposerModeSelectorProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<ComposerModeValue>(
    () => defaultValue ?? DEFAULT_COMPOSER_MODE,
  );
  const selectedValue = isControlled ? value : internalValue;
  const selectedOption = getComposerModeOption(selectedValue);

  const handleValueChange = useCallback(
    (nextValue: ComposerModeValue) => {
      if (!isControlled) {
        setInternalValue(nextValue);
      }

      onValueChange?.(nextValue);
    },
    [isControlled, onValueChange],
  );

  return (
    <DropdownMenu {...menuProps}>
      <DropdownMenuTrigger
        data-slot="composer-mode-selector-trigger"
        data-size={size ?? "default"}
        data-variant={variant ?? "outline"}
        className={cn(
          "min-w-0",
          selectTriggerVariants({ variant, size }),
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-normal">{selectedOption.label}</span>
        </span>
        <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-slot="composer-mode-selector-content"
        align="start"
        className={cn("w-48 min-w-48 p-1", contentClassName)}
      >
        {composerModeOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = option.value === selectedOption.value;

          return (
            <DropdownMenuItem
              key={option.value}
              data-selected={String(isSelected)}
              data-slot="composer-mode-selector-item"
              textValue={option.label}
              className={cn(
                "min-w-0 gap-2 text-[12px]",
                isSelected && "bg-accent text-accent-foreground",
              )}
              onSelect={(event) => {
                if (event.defaultPrevented) {
                  return;
                }

                handleValueChange(option.value);
              }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center",
                  isSelected && "text-accent-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate font-normal">
                {option.label}
              </span>
              {option.shortcut && (
                <span
                  className={cn(
                    "ml-auto text-xs tracking-widest",
                    isSelected
                      ? "text-accent-foreground/80"
                      : "text-muted-foreground",
                  )}
                >
                  {option.shortcut}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}