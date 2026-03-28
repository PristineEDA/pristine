import { useState } from "react";
import {
  AlertCircle,
  Wrench,
  FileCode2,
} from "lucide-react";
import { staticChecks } from "../../data/mockData";

const severityConfig: Record<
  "critical" | "high" | "medium" | "low",
  { color: string; bg: string; label: string }
> = {
  critical: {
    color: "var(--ide-error)",
    bg: "var(--ide-error-bg, #3d1515)",
    label: "Critical",
  },
  high: { color: "var(--ide-error)", bg: "var(--ide-error-bg, #3d1515)", label: "High" },
  medium: { color: "var(--ide-warning)", bg: "var(--ide-warning-bg, #3d3000)", label: "Medium" },
  low: { color: "var(--ide-info)", bg: "var(--ide-info-bg, #0a2840)", label: "Low" },
};

interface StaticCheckPanelProps {
  onFileOpen: (id: string, name: string) => void;
  onLineJump: (l: number) => void;
}

export function StaticCheckPanel({
  onFileOpen,
  onLineJump,
}: StaticCheckPanelProps) {
  const [filter, setFilter] = useState<
    "all" | "critical" | "high" | "medium" | "low"
  >("all");
  const [fixedIds, setFixedIds] = useState<Set<string>>(
    new Set(),
  );

  const filtered =
    filter === "all"
      ? staticChecks
      : staticChecks.filter((c) => c.severity === filter);
  const counts: Record<"critical" | "high" | "medium" | "low", number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  staticChecks.forEach((c) => counts[c.severity]++);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-1.5 border-b border-ide-border shrink-0">
        <div className="flex items-center gap-1 mb-1.5">
          <AlertCircle size={13} className="text-ide-error" />
          <span
            className="text-ide-text text-[12px] font-[600]"
          >
            Static Check Report
          </span>
          <span
            className="ml-auto text-ide-text-muted text-[11px]"
          >
            {staticChecks.length} rules
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              "all",
              "critical",
              "high",
              "medium",
              "low",
            ] as const
          ).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-1.5 py-0.5 rounded transition-colors text-[10px] ${
                filter === f
                  ? "bg-ide-accent-dark text-white"
                  : "text-ide-text-muted hover:bg-ide-tab-bg"
              }`}
            >
              {f === "all"
                ? `All ${staticChecks.length}`
                : `${severityConfig[f].label} ${counts[f]}`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((item) => {
          const isFixed = fixedIds.has(item.id);
          const cfg = severityConfig[item.severity];
          return (
            <div
              key={item.id}
              className={`border-b border-ide-tab-bg px-3 py-2 transition-colors ${isFixed ? "opacity-40" : "hover:bg-ide-hover"}`}
            >
              <div className="flex items-start gap-2">
                <span
                  className="px-1 py-0.5 rounded shrink-0 mt-0.5 text-[9px] font-bold"
                  style={{ color: cfg.color, background: cfg.bg }}
                >
                  {cfg.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span
                      className="text-ide-text-muted text-[10px]"
                    >
                      {item.rule}
                    </span>
                  </div>
                  <div
                    className="text-ide-text mt-0.5 text-[11px] leading-[1.4]"
                  >
                    {isFixed ? (
                      <s>{item.description}</s>
                    ) : (
                      item.description
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      className="flex items-center gap-1 text-ide-text-muted hover:text-ide-text transition-colors text-[10px]"
                      onClick={() => {
                        onFileOpen(item.fileId, item.file);
                        onLineJump(item.line);
                      }}
                    >
                      <FileCode2 size={10} />
                      {item.file}:{item.line}
                    </button>
                    {item.fixable && !isFixed && (
                      <button
                        className="flex items-center gap-1 px-1.5 py-0.5 bg-ide-accent hover:bg-ide-accent-hover text-white rounded transition-colors text-[10px]"
                        onClick={() =>
                          setFixedIds(
                            (prev) =>
                              new Set([...prev, item.id]),
                          )
                        }
                      >
                        <Wrench size={9} />
                        Auto-fix
                      </button>
                    )}
                    {isFixed && (
                      <span
                        className="text-ide-success text-[10px]"
                      >
                        ✓ Fixed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
