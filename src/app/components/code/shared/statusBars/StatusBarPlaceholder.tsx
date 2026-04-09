import { LayoutTemplate } from 'lucide-react';
import { StatusBarFrame } from './StatusBarFrame';

interface StatusBarPlaceholderProps {
  statusBarId: string;
  viewName: string;
}

export function StatusBarPlaceholder({ statusBarId, viewName }: StatusBarPlaceholderProps) {
  return (
    <StatusBarFrame
      statusBarId={statusBarId}
      left={(
        <div className="flex h-full items-center gap-2 px-2.5">
          <LayoutTemplate size={11} />
          <span className="text-[11px] font-medium">{viewName}</span>
          <span className="text-[11px] opacity-80">Placeholder</span>
        </div>
      )}
      right={(
        <div className="flex h-full items-center px-2.5">
          <span className="text-[11px] opacity-80">Status Bar Placeholder</span>
        </div>
      )}
    />
  );
}
