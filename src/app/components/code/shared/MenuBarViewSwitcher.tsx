import { Code2, Presentation, Workflow } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { MainContentView } from '../../../codeViewPanels';
import { useCodeViewerLayout } from '../../../context/CodeViewerLayoutContext';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import { centerViewSwitchItemClassName } from './viewSwitcherStyles';

interface MenuBarViewSwitcherProps {
  value: MainContentView;
  onValueChange: (value: MainContentView) => void;
  interactiveStyle: CSSProperties;
}

export function MenuBarViewSwitcher({
  value,
  onValueChange,
  interactiveStyle,
}: MenuBarViewSwitcherProps) {
  const { layoutMode } = useCodeViewerLayout();

  return (
    <div
      data-testid="center-view-switcher"
      className="absolute left-1/2 -translate-x-1/2"
      style={interactiveStyle}
    >
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue) {
            onValueChange(nextValue as MainContentView);
          }
        }}
        className={layoutMode === 'minimal' ? 'bg-ide-unified-chrome-hover rounded p-0.5 gap-0.5' : 'bg-ide-hover rounded p-0.5 gap-0.5'}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <ToggleGroupItem
                aria-label="Whiteboard"
                data-testid="center-view-whiteboard"
                value="whiteboard"
                className={centerViewSwitchItemClassName}
              >
                <Presentation size={13} />
              </ToggleGroupItem>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>Whiteboard</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <ToggleGroupItem
                aria-label="Code"
                data-testid="center-view-code"
                value="code"
                className={centerViewSwitchItemClassName}
              >
                <Code2 size={13} />
              </ToggleGroupItem>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>Code</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <ToggleGroupItem
                aria-label="Workflow"
                data-testid="center-view-workflow"
                value="workflow"
                className={centerViewSwitchItemClassName}
              >
                <Workflow size={13} />
              </ToggleGroupItem>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>Workflow</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </div>
  );
}
