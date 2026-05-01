import type { OutlineItem } from '../../../../data/mockData';
import { ScrollArea } from '../../ui/scroll-area';
import { OutlineNode } from './OutlineNode';

export function OutlinePanel({
  currentOutlineId,
  onLineJump,
  outline,
}: {
  currentOutlineId: string;
  onLineJump: (line: number) => void;
  outline: OutlineItem[];
}) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-3 py-1.5 shrink-0">
        <span className="text-muted-foreground uppercase text-[11px] font-bold tracking-wide">
          OUTLINE - {currentOutlineId || 'No file open'}
        </span>
      </div>
      <ScrollArea className="flex-1">
        {outline.length === 0 ? (
          <div className="px-4 py-3 text-muted-foreground text-[12px]">
            No outline information available
          </div>
        ) : (
          outline.map((item) => (
            <OutlineNode key={item.id} item={item} depth={0} onLineJump={onLineJump} />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
