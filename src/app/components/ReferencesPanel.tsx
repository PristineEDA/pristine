import {
  ExternalLink,
  FileCode2,
} from "lucide-react";
import { useReferences } from '../../data/mockDataLoader';

const typeColors: Record<string, string> = {
  definition: "var(--ide-syntax-type, #4ec9b0)",
  write: "var(--ide-error, #f48771)",
  read: "var(--ide-syntax-variable, #9cdcfe)",
};
const typeLabels: Record<string, string> = {
  definition: "DEF",
  write: "WR",
  read: "RD",
};

interface ReferencesPanelProps {
  onFileOpen: (id: string, name: string) => void;
  onLineJump: (l: number) => void;
}

export function ReferencesPanel({
  onFileOpen,
  onLineJump,
}: ReferencesPanelProps) {
  const references = useReferences();

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <ExternalLink size={13} className="text-blue-400" />
          <span
            className="text-foreground text-[12px] font-[600]"
          >
            References
          </span>
          <span
            className="text-muted-foreground ml-1 text-[11px]"
          >
            shift_reg
          </span>
        </div>
        <div
          className="text-muted-foreground mt-1 text-[11px]"
        >
          {references.length} references · uart_tx.v
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-1.5 border-b border-muted">
          <div
            className="flex items-center gap-1.5 text-foreground text-[12px]"
          >
            <FileCode2 size={12} className="text-ide-syntax-folder" />
            uart_tx.v
            <span
              className="text-muted-foreground text-[11px]"
            >
              ({references.length})
            </span>
          </div>
        </div>
        {references.map((ref) => (
          <div
            key={ref.id}
            className="flex items-start gap-2 px-3 py-1.5 hover:bg-accent cursor-pointer border-b border-background transition-colors"
            onClick={() => {
              onFileOpen(ref.fileId, ref.file);
              onLineJump(ref.line);
            }}
          >
            <span
              className="shrink-0 mt-0.5 px-1 rounded text-[9px] font-bold bg-[#2d2d2d]"
              style={{ color: typeColors[ref.type] }}
            >
              {typeLabels[ref.type]}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                   className="text-muted-foreground text-[11px] font-mono"
                >
                  L{ref.line}
                </span>
              </div>
              <div
                className="text-foreground font-mono truncate text-[11px]"
              >
                {ref.preview.split(/(shift_reg)/g).map((part, i) =>
                  part === 'shift_reg' ? (
                    <span
                      key={i}
                      className="bg-[#264f78] rounded-sm px-px"
                    >
                      {part}
                    </span>
                  ) : (
                    part
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
