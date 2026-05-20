import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { centerViewSwitchItemClassName } from './viewSwitcherStyles';

const iconTabToggleGroupClassName = 'rounded bg-ide-hover p-0.5 gap-0.5';
const iconTabToggleItemClassName = `${centerViewSwitchItemClassName} h-8 w-8 rounded-md`;

export const compactIconTabToggleItemClassName = 'h-7 w-7 rounded-md';
export const compactIconTabToggleIconSize = 12;

export interface IconTabToggleGroupItem {
  icon: LucideIcon;
  label: string;
  testId: string;
  value: string;
}

interface IconTabToggleGroupProps {
  items: readonly IconTabToggleGroupItem[];
  value: string;
  onValueChange: (value: string) => void;
  groupLabel: string;
  groupTestId?: string;
  orientation?: 'horizontal' | 'vertical';
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  itemClassName?: string;
  iconSize?: number;
}

export function IconTabToggleGroup({
  items,
  value,
  onValueChange,
  groupLabel,
  groupTestId,
  orientation = 'horizontal',
  tooltipSide = 'bottom',
  className,
  itemClassName,
  iconSize = 13,
}: IconTabToggleGroupProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <ToggleGroup
        aria-label={groupLabel}
        data-testid={groupTestId}
        type="single"
        orientation={orientation}
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue) {
            onValueChange(nextValue);
          }
        }}
        className={cn(
          iconTabToggleGroupClassName,
          orientation === 'vertical' ? 'flex-col' : 'flex-row',
          className,
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Tooltip key={item.value}>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <ToggleGroupItem
                    aria-label={item.label}
                    data-testid={item.testId}
                    value={item.value}
                    className={cn(iconTabToggleItemClassName, itemClassName)}
                  >
                    <Icon size={iconSize} />
                  </ToggleGroupItem>
                </span>
              </TooltipTrigger>
              <TooltipContent side={tooltipSide} sideOffset={6}>{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </ToggleGroup>
    </TooltipProvider>
  );
}