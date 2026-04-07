import * as React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

interface TooltipIconButtonProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: React.ComponentProps<typeof TooltipContent>['side'];
  sideOffset?: number;
  wrapTrigger?: boolean;
}

export function TooltipIconButton({
  content,
  children,
  side = 'top',
  sideOffset = 6,
  wrapTrigger = false,
}: TooltipIconButtonProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          {wrapTrigger ? <span className="inline-flex">{children}</span> : children}
        </TooltipTrigger>
        <TooltipContent side={side} sideOffset={sideOffset}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}