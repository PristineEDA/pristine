import {
  GitBranch, AlertCircle, AlertTriangle, Bell, CheckCircle2,
  Zap,
} from 'lucide-react';
import { useProblemsList } from '../../data/mockDataLoader';
import { getEditorLanguageLabel } from '../workspace/workspaceFiles';
import { StatusBarFrame } from './statusBars/StatusBarFrame';

export interface StatusBarProps {
  activeFileId: string;
  cursorLine: number;
  cursorCol: number;
}

export function StatusBar({ activeFileId, cursorLine, cursorCol }: StatusBarProps) {
  const problemsList = useProblemsList();
  const errorCount = problemsList.filter((p) => p.severity === 'error').length;
  const warnCount = problemsList.filter((p) => p.severity === 'warning').length;
  const lang = activeFileId ? getEditorLanguageLabel(activeFileId) : 'Plain Text';

  return (
    <StatusBarFrame
      statusBarId="code-explorer"
      left={(
        <>
          <div className="flex items-center gap-1 px-2.5 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <GitBranch size={12} />
            <span className="text-[11px]">main</span>
          </div>
          <div className="flex items-center gap-1 px-2 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <CheckCircle2 size={11} />
            <span className="text-[11px]">Sync</span>
          </div>
          <div className="flex items-center gap-2.5 px-2 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <div className="flex items-center gap-1">
              <AlertCircle size={11} />
              <span className="text-[11px]">{errorCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle size={11} />
              <span className="text-[11px]">{warnCount}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <Zap size={11} />
            <span className="text-[11px]">Verilator 5.024</span>
          </div>
        </>
      )}
      right={(
        <>
          <div className="flex items-center px-2.5 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <span className="text-[11px]">
              Ln {cursorLine}, Col {cursorCol}
            </span>
          </div>
          <div className="flex items-center px-2 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <span className="text-[11px]">Spaces: 4</span>
          </div>
          <div className="flex items-center px-2 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <span className="text-[11px]">UTF-8</span>
          </div>
          <div className="flex items-center px-2 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <span className="text-[11px]">LF</span>
          </div>
          <div className="flex items-center px-2.5 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <span className="text-[11px]">{lang}</span>
          </div>
          <div className="flex items-center px-2 h-full hover:bg-primary-foreground/10 cursor-pointer transition-colors">
            <Bell size={12} />
          </div>
        </>
      )}
    />
  );
}
