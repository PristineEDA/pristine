import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Liveline, type LivelinePoint } from 'liveline';
import {
  Bot,
  Bug,
  Cable,
  CalendarClock,
  CircuitBoard,
  Clock,
  Code2,
  Command,
  FileCode,
  FileText,
  Layers,
  Power,
  Play,
  RefreshCw,
  Settings,
  ShieldCheck,
  TerminalSquare,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useTheme } from '../app/context/ThemeContext';
import type { FloatingInfoWindowMode } from '../app/window/floatingInfoWindow';

const SAMPLE_LIMIT = 24;
const UPDATE_INTERVAL_MS = 1000;
const EXPAND_DELAY_MS = 1000;
const COLLAPSE_DELAY_MS = 160;
const SUMMARY_PERCENT = 68;
const SUMMARY_LABEL = 'SYNC';
const DETAIL_TABS = ['Overview', 'Languages', 'Models', 'Projects', 'Simulation'] as const;

type FloatingInfoDetailTab = typeof DETAIL_TABS[number];

interface DetailMetric {
  readonly label: string;
  readonly value: string;
  readonly color: string;
  readonly icon: LucideIcon;
}

interface ProgressItem {
  readonly name: string;
  readonly meta?: string;
  readonly value: string;
  readonly percent: number;
  readonly color: string;
  readonly icon: LucideIcon;
}

const overviewMetrics = [
  { label: 'RTL Files', value: '184', color: 'text-sky-400', icon: FileCode },
  { label: 'Modules', value: '62', color: 'text-blue-400', icon: CircuitBoard },
  { label: 'Interfaces', value: '14', color: 'text-cyan-400', icon: Cable },
  { label: 'Lint Issues', value: '7', color: 'text-amber-400', icon: Bug },
  { label: 'Sim Runs', value: '31', color: 'text-emerald-400', icon: Play },
  { label: 'Coverage', value: '82%', color: 'text-violet-400', icon: ShieldCheck },
] as const satisfies readonly DetailMetric[];

const compileActivityBars = [18, 24, 32, 12, 40, 28, 76, 58, 44, 62, 88, 36, 74, 118, 46, 96, 54, 80, 34, 22, 68, 72, 50, 104, 16, 10, 42, 30] as const;

const languageStats = [
  { name: 'SystemVerilog', meta: '142 files · 71%', value: '128.4K ln', percent: 71, color: 'bg-blue-500', icon: CircuitBoard },
  { name: 'Verilog', meta: '38 files · 14%', value: '25.6K ln', percent: 14, color: 'bg-cyan-500', icon: FileCode },
  { name: 'VHDL', meta: '11 files · 6%', value: '10.9K ln', percent: 6, color: 'bg-violet-500', icon: Code2 },
  { name: 'Constraints', meta: '24 files · 5%', value: '8.7K ln', percent: 5, color: 'bg-amber-400', icon: ShieldCheck },
  { name: 'Tcl', meta: '18 scripts · 4%', value: '7.1K ln', percent: 4, color: 'bg-emerald-500', icon: TerminalSquare },
] as const;

const modelStats = [
  { name: 'Claude Opus-4-6', meta: '8.366 calls', value: '$830.54', percent: 96, color: 'bg-orange-400', icon: Bot },
  { name: 'Claude Opus-4-7', meta: '4.008 calls', value: '$688.05', percent: 82, color: 'bg-red-400', icon: Bot },
  { name: 'GPT-5.5', meta: '2.850 calls', value: '$256.02', percent: 32, color: 'bg-emerald-500', icon: Bot },
  { name: 'Claude Opus-4-5', meta: '2.852 calls', value: '$218.81', percent: 25, color: 'bg-orange-300', icon: Bot },
  { name: 'GPT-5.4', meta: '136 calls', value: '$3.73', percent: 5, color: 'bg-teal-500', icon: Bot },
] as const;

const projectStats = [
  { name: 'retroSoC', meta: '62 modules · 412 instances', value: '82% cov', percent: 82, color: 'bg-blue-500', icon: CircuitBoard },
  { name: 'xpi_core', meta: '14 modules · 3 warnings', value: 'clean', percent: 74, color: 'bg-cyan-500', icon: Cable },
  { name: 'cpu_cluster', meta: '18 modules · 96 instances', value: '78% cov', percent: 78, color: 'bg-emerald-500', icon: Layers },
  { name: 'axi_fabric', meta: '9 modules · 128 routes', value: '2 warns', percent: 58, color: 'bg-amber-400', icon: CircuitBoard },
  { name: 'ddr_ctrl', meta: '11 modules · timing watch', value: '64% cov', percent: 64, color: 'bg-violet-500', icon: ShieldCheck },
] as const;

const usageStats = [
  { name: 'Input', value: '11.9M', percent: 22, color: 'bg-sky-500', icon: FileText },
  { name: 'Output', value: '9.1M', percent: 18, color: 'bg-emerald-500', icon: FileText },
  { name: 'Cache Read', value: '2.7B', percent: 95, color: 'bg-orange-400', icon: FileText },
  { name: 'Cache Write', value: '66.4M', percent: 9, color: 'bg-fuchsia-500', icon: FileText },
  { name: 'bash', value: '9.581', percent: 72, color: 'bg-foreground', icon: TerminalSquare },
  { name: 'read', value: '4.027', percent: 42, color: 'bg-foreground', icon: FileText },
  { name: 'edit', value: '3.087', percent: 34, color: 'bg-foreground', icon: Wrench },
] as const;

const simulationMetrics = [
  { label: 'Pass Rate', value: '94%', color: 'text-emerald-400', icon: ShieldCheck },
  { label: 'Waveforms', value: '12', color: 'text-sky-400', icon: TerminalSquare },
  { label: 'Failures', value: '2', color: 'text-rose-400', icon: Bug },
] as const satisfies readonly DetailMetric[];

const simulationStats = [
  { name: 'xpi_loopback', meta: 'Verilator · 128 seeds · passed', value: 'pass', percent: 100, color: 'bg-emerald-500', icon: Play },
  { name: 'cpu_regression', meta: 'UVM smoke · 64 tests · 2 failing', value: '96%', percent: 96, color: 'bg-amber-400', icon: Bug },
  { name: 'axi_burst', meta: 'waveform saved · 18.2 ms sim', value: 'clean', percent: 88, color: 'bg-sky-500', icon: TerminalSquare },
  { name: 'ddr_training', meta: 'timing watch · coverage gap', value: '74%', percent: 74, color: 'bg-violet-500', icon: ShieldCheck },
] as const satisfies readonly ProgressItem[];

function createNextPoint(previousValue: number, now = Date.now()): LivelinePoint {
  const delta = Math.round((Math.random() - 0.5) * 12);
  const nextValue = Math.min(100, Math.max(0, previousValue + delta));

  return {
    time: Math.floor(now / 1000),
    value: nextValue,
  };
}

function createInitialSeries(now = Date.now()): LivelinePoint[] {
  const points: LivelinePoint[] = [];
  let currentValue = SUMMARY_PERCENT;

  for (let index = SAMPLE_LIMIT - 1; index >= 0; index -= 1) {
    currentValue = Math.min(100, Math.max(0, currentValue + Math.round((Math.random() - 0.5) * 8)));
    points.push({
      time: Math.floor((now - index * UPDATE_INTERVAL_MS) / 1000),
      value: currentValue,
    });
  }

  return points;
}

function getChartAccentColor(themeKind: 'light' | 'dark', colorTheme: ReturnType<typeof useTheme>['activeTheme']): string {
  return colorTheme.colors[themeKind === 'dark' ? 'charts.line' : 'button.background']
    ?? colorTheme.colors['button.background']
    ?? colorTheme.colors['focusBorder']
    ?? (themeKind === 'dark' ? '#61afef' : '#2563eb');
}

function useFloatingInfoSeries() {
  const [series, setSeries] = useState<LivelinePoint[]>(() => createInitialSeries());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSeries((currentSeries) => {
        const previousValue = currentSeries[currentSeries.length - 1]?.value ?? SUMMARY_PERCENT;
        const nextPoint = createNextPoint(previousValue);
        const nextSeries = [...currentSeries, nextPoint];
        return nextSeries.slice(-SAMPLE_LIMIT);
      });
    }, UPDATE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return series;
}

function isPointerInsideElementBounds(event: PointerEvent<HTMLElement>): boolean {
  const bounds = event.currentTarget.getBoundingClientRect();

  if (bounds.width <= 0 || bounds.height <= 0) {
    return false;
  }

  return event.clientX >= bounds.left
    && event.clientX <= bounds.right
    && event.clientY >= bounds.top
    && event.clientY <= bounds.bottom;
}

function useFloatingInfoWindowMode() {
  const [mode, setMode] = useState<FloatingInfoWindowMode>('collapsed');
  const expandTimeoutRef = useRef<number | null>(null);
  const collapseTimeoutRef = useRef<number | null>(null);
  const dragGuardRef = useRef(false);
  const dragReleaseRef = useRef<(() => void) | null>(null);

  const clearExpandTimer = () => {
    if (expandTimeoutRef.current !== null) {
      window.clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }
  };

  const clearCollapseTimer = () => {
    if (collapseTimeoutRef.current !== null) {
      window.clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
  };

  const clearHoverTimers = () => {
    clearExpandTimer();
    clearCollapseTimer();
  };

  const releaseDragGuard = () => {
    dragGuardRef.current = false;

    if (dragReleaseRef.current !== null) {
      window.removeEventListener('pointerup', dragReleaseRef.current);
      window.removeEventListener('pointercancel', dragReleaseRef.current);
      dragReleaseRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearHoverTimers();
      releaseDragGuard();
    };
  }, []);

  const syncWindowMode = (nextMode: FloatingInfoWindowMode) => {
    if (window.electronAPI?.setFloatingInfoWindowMode) {
      void window.electronAPI.setFloatingInfoWindowMode(nextMode);
      return;
    }

    void window.electronAPI?.setFloatingInfoWindowExpanded(nextMode !== 'collapsed');
  };

  const setSyncedMode = (nextMode: FloatingInfoWindowMode) => {
    setMode((currentMode) => {
      if (currentMode !== nextMode) {
        syncWindowMode(nextMode);
      }

      return nextMode;
    });
  };

  const handlePointerEnter = () => {
    clearCollapseTimer();
    clearExpandTimer();

    if (mode === 'detail' || dragGuardRef.current) {
      return;
    }

    expandTimeoutRef.current = window.setTimeout(() => {
      expandTimeoutRef.current = null;

      if (!dragGuardRef.current) {
        setSyncedMode('expanded');
      }
    }, EXPAND_DELAY_MS);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLElement>) => {
    clearHoverTimers();

    if (mode !== 'expanded') {
      return;
    }

    if (isPointerInsideElementBounds(event)) {
      return;
    }

    collapseTimeoutRef.current = window.setTimeout(() => {
      collapseTimeoutRef.current = null;
      setSyncedMode('collapsed');
    }, COLLAPSE_DELAY_MS);
  };

  const handleDragPointerDown = () => {
    clearHoverTimers();
    releaseDragGuard();
    dragGuardRef.current = true;
    dragReleaseRef.current = releaseDragGuard;
    window.addEventListener('pointerup', releaseDragGuard);
    window.addEventListener('pointercancel', releaseDragGuard);
  };

  const handleDragPointerEnd = () => {
    releaseDragGuard();
  };

  const enterDetail = () => {
    clearHoverTimers();
    releaseDragGuard();
    setSyncedMode('detail');
  };

  const exitDetail = () => {
    clearHoverTimers();
    releaseDragGuard();
    setSyncedMode('collapsed');
  };

  return {
    mode,
    handlePointerEnter,
    handlePointerLeave,
    handleDragPointerDown,
    handleDragPointerEnd,
    enterDetail,
    exitDetail,
  };
}

function FloatingInfoSummary({ compact }: { compact: boolean }) {
  return (
    <>
      <div
        data-testid="floating-info-percent"
        className={`flex shrink-0 items-center justify-center border-border/70 bg-muted/50 font-semibold leading-none ${compact ? 'h-full w-7 border-r text-[10px]' : 'h-full min-w-12 px-2 text-[18px] border-r'}`}
      >
        {SUMMARY_PERCENT}%
      </div>
      <div
        data-testid="floating-info-text"
        className={`flex min-w-0 flex-1 items-center justify-center font-medium leading-none ${compact ? 'h-full px-1 text-[10px]' : 'px-2 text-[11px] tracking-[0.14em]'}`}
      >
        {SUMMARY_LABEL}
      </div>
    </>
  );
}

function FloatingInfoLiveChart({ accentColor, points, themeKind }: {
  accentColor: string;
  points: LivelinePoint[];
  themeKind: 'light' | 'dark';
}) {
  const latestValue = points[points.length - 1]?.value ?? SUMMARY_PERCENT;

  return (
    <div
      className="flex min-h-0 flex-1 px-2 pb-2"
      data-testid="floating-info-chart-shell"
      data-app-region="no-drag"
      style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
    >
      <div
        className="h-full w-full overflow-hidden rounded-sm border border-border/70 bg-background/80"
        data-testid="floating-info-chart"
        data-app-region="no-drag"
        style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
      >
        <Liveline
          data={points}
          value={latestValue}
          theme={themeKind}
          color={accentColor}
          grid={false}
          badge={false}
          fill
          pulse={false}
          scrub={false}
          showValue={false}
          momentum
          lineWidth={1.75}
          lerpSpeed={0.12}
          padding={{ top: 8, right: 8, bottom: 8, left: 8 }}
          style={{ height: '100%', width: '100%' }}
        />
      </div>
    </div>
  );
}

const rangeOptions = [
  { label: '1d', icon: Clock },
  { label: '2d', icon: CalendarClock },
  { label: '7d', icon: CalendarClock },
  { label: 'All', icon: Layers },
] as const;

function FloatingInfoLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`grid shrink-0 grid-cols-2 grid-rows-2 gap-[2px] ${compact ? 'h-5 w-5' : 'h-7 w-7'}`}
      aria-hidden="true"
    >
      <span className="bg-foreground" />
      <span className="bg-foreground" />
      <span className="bg-foreground" />
      <span className="bg-transparent" />
    </div>
  );
}

function FloatingInfoRangeControls() {
  return (
    <div
      data-testid="floating-info-range-controls"
      className="flex h-6 items-center gap-0.5 rounded-md border border-border/80 bg-muted/75 p-0.5 text-muted-foreground shadow-sm"
      style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
    >
      {rangeOptions.map(({ label, icon: Icon }) => (
        <button
          key={label}
          type="button"
          data-testid={`floating-info-range-${label.toLowerCase()}`}
          className={`flex h-5 w-5 items-center justify-center rounded leading-none ${label === 'All' ? 'bg-blue-500 text-white shadow-sm' : 'hover:bg-background/70 hover:text-foreground'}`}
          title={label}
          aria-label={label}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

function FloatingInfoDetailHeader() {
  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border/70 px-4">
      <div
        data-testid="floating-info-detail-drag-region"
        data-app-region="drag"
        className="flex min-w-0 flex-1 items-center gap-2"
        style={{ userSelect: 'none', WebkitAppRegion: 'drag' } as CSSProperties}
      >
        <FloatingInfoLogo compact />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold leading-4">Pi Stats</div>
          <div className="truncate text-[10px] font-medium leading-3 text-muted-foreground">Updated 13:27</div>
        </div>
      </div>
      <FloatingInfoRangeControls />
      <button
        type="button"
        data-testid="floating-info-detail-refresh"
        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
        aria-label="Refresh stats"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        data-testid="floating-info-detail-settings"
        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
        aria-label="Stats settings"
      >
        <Settings className="h-3.5 w-3.5" />
      </button>
    </header>
  );
}

function FloatingInfoDetailTabs({ activeTab, onTabChange }: {
  activeTab: FloatingInfoDetailTab;
  onTabChange: (tab: FloatingInfoDetailTab) => void;
}) {
  return (
    <nav
      className="flex h-7 shrink-0 items-end border-b border-border/70 px-3"
      style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
    >
      {DETAIL_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          data-testid={`floating-info-detail-tab-${tab.toLowerCase()}`}
          className={`relative flex h-full flex-1 items-center justify-center px-1 text-[11px] font-semibold ${
            activeTab === tab ? 'text-blue-500' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onTabChange(tab)}
        >
          {tab}
          {activeTab === tab ? <span className="absolute bottom-0 h-0.5 w-14 rounded-full bg-blue-500" /> : null}
        </button>
      ))}
    </nav>
  );
}

function MetricCard({ metric, compact = false }: { metric: DetailMetric; compact?: boolean }) {
  const Icon = metric.icon;

  return (
    <div
      data-testid="floating-info-metric-card"
      className={`rounded-lg border border-border/80 bg-muted/60 px-2.5 shadow-sm ${compact ? 'py-1.5' : 'py-2'}`}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
        <Icon className={`h-3 w-3 ${metric.color}`} />
        <span>{metric.label}</span>
      </div>
      <div className={`${compact ? 'text-[15px] leading-4' : 'text-[18px] leading-5'} font-bold text-foreground`}>{metric.value}</div>
    </div>
  );
}

function ProgressRow({ item, compact = false }: {
  item: ProgressItem;
  compact?: boolean;
}) {
  const Icon = item.icon;

  return (
    <div className={`${compact ? 'grid-cols-[24px_1fr] gap-1.5' : 'grid-cols-[28px_1fr] gap-2'} grid`}>
      <div className={`${compact ? 'h-6 w-6' : 'h-7 w-7'} flex items-center justify-center rounded-md border border-border/70 bg-muted/60 text-muted-foreground`}>
        <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] font-bold leading-4 text-foreground">{item.name}</span>
          <span className="shrink-0 text-[11px] font-bold text-foreground">{item.value}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/70">
          <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.percent}%` }} />
        </div>
        {item.meta ? <div className="mt-1 truncate text-[10px] font-medium text-muted-foreground">{item.meta}</div> : null}
      </div>
    </div>
  );
}

function CompileActivityChart() {
  const maxValue = Math.max(...compileActivityBars);

  return (
    <section className="mt-3">
      <div className="mb-2 flex items-end justify-between">
        <h2 className="text-[13px] font-bold leading-4">Compile Activity</h2>
        <span className="text-[11px] font-semibold text-muted-foreground">28 runs</span>
      </div>
      <div className="relative h-[118px] border-l border-border/50">
        <div className="absolute inset-0 grid grid-rows-4">
          {[120, 90, 60, 30].map((value) => (
            <div key={value} className="border-t border-border/35 text-[10px] font-medium text-muted-foreground">
              {value}s
            </div>
          ))}
        </div>
        <div className="absolute inset-x-8 bottom-0 flex h-[106px] items-end gap-1">
          {compileActivityBars.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="w-1 flex-1 rounded-t-sm bg-sky-400/80"
              style={{ height: `${Math.max(3, Math.round((value / maxValue) * 100))}%` }}
            />
          ))}
        </div>
        <div className="absolute bottom-0 left-1/2 text-[10px] font-medium text-muted-foreground">last 7d</div>
      </div>
    </section>
  );
}

function OverviewPanel() {
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {overviewMetrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>
      <CompileActivityChart />
      <section className="mt-3">
        <h2 className="mb-2 text-[13px] font-bold leading-4">Top Design Unit</h2>
        <ProgressRow item={projectStats[1]} />
      </section>
    </>
  );
}

function LanguagesPanel() {
  return (
    <>
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <div className="relative h-[120px] w-[120px] rounded-full bg-[conic-gradient(#3b82f6_0_71%,#06b6d4_71%_85%,#8b5cf6_85%_91%,#fbbf24_91%_96%,#10b981_96%_100%)]">
          <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-background text-center">
            <span className="text-[16px] font-bold leading-5">181.1K</span>
            <span className="text-[10px] font-medium text-muted-foreground">HDL lines</span>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-1.5">
          {languageStats.map((item) => (
            <div key={item.name} className="grid grid-cols-[1fr_34px] items-center gap-2 text-[10px] font-semibold">
              <span className="flex items-center gap-2 truncate">
                <span className={`h-2 w-2 rounded-full ${item.color}`} />
                {item.name}
              </span>
              <span className="text-right text-muted-foreground">{item.percent}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <h2 className="text-[13px] font-bold">Languages</h2>
        <span className="text-[10px] font-semibold text-muted-foreground">by HDL footprint</span>
      </div>
      <div className="mt-3 space-y-2.5">
        {languageStats.map((item) => (
          <ProgressRow key={item.name} item={item} />
        ))}
      </div>
    </>
  );
}

function ListPanel({ title, subtitle, items }: {
  title: string;
  subtitle: string;
  items: readonly ProgressItem[];
}) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-bold">{title}</h2>
        <span className="text-[10px] font-semibold text-muted-foreground">{subtitle}</span>
      </div>
      <div className="space-y-3.5">
        {items.map((item) => (
          <ProgressRow key={item.name} item={item} />
        ))}
      </div>
    </>
  );
}

function ModelsPanel() {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-bold">Models</h2>
        <span className="text-[10px] font-semibold text-muted-foreground">by cost</span>
      </div>
      <div className="space-y-2.5">
        {modelStats.slice(0, 3).map((item) => (
          <ProgressRow key={item.name} item={item} compact />
        ))}
      </div>
      <div className="mb-2 mt-4 flex items-center justify-between">
        <h2 className="text-[13px] font-bold">Model & Tool Usage</h2>
        <span className="text-[11px] font-bold text-muted-foreground">2.8B</span>
      </div>
      <div className="space-y-2.5">
        {usageStats.slice(0, 4).map((item) => (
          <ProgressRow key={item.name} item={item} compact />
        ))}
      </div>
      <div className="mb-2 mt-4 flex items-center justify-between">
        <h2 className="text-[13px] font-bold">Tool Calls</h2>
        <span className="text-[11px] font-bold text-muted-foreground">17.765</span>
      </div>
      <div className="space-y-2.5">
        {usageStats.slice(4).map((item) => (
          <ProgressRow key={item.name} item={item} compact />
        ))}
      </div>
    </>
  );
}

function SimulationPanel() {
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {simulationMetrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} compact />
        ))}
      </div>
      <div className="mb-3 mt-4 flex items-center justify-between">
        <h2 className="text-[13px] font-bold">Recent Simulation</h2>
        <span className="text-[10px] font-semibold text-muted-foreground">last 24h</span>
      </div>
      <div className="space-y-2.5">
        {simulationStats.map((item) => (
          <ProgressRow key={item.name} item={item} compact />
        ))}
      </div>
      <section className="mt-4 rounded-lg border border-border/80 bg-muted/60 px-3 py-2">
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span>Waveform Session</span>
          <span className="text-sky-400">active</span>
        </div>
        <div className="mt-1 text-[10px] font-medium leading-4 text-muted-foreground">
          4 traces pinned · 18 bookmarks · last opened xpi_core.vcd
        </div>
      </section>
    </>
  );
}

function FloatingInfoDetailContent({ activeTab }: { activeTab: FloatingInfoDetailTab }) {
  return (
    <main
      data-testid="floating-info-detail-content"
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {activeTab === 'Overview' ? <OverviewPanel /> : null}
      {activeTab === 'Languages' ? <LanguagesPanel /> : null}
      {activeTab === 'Models' ? <ModelsPanel /> : null}
      {activeTab === 'Projects' ? <ListPanel title="Projects" subtitle="by design block" items={projectStats} /> : null}
      {activeTab === 'Simulation' ? <SimulationPanel /> : null}
    </main>
  );
}

function FloatingInfoDetail({ activeTab, onTabChange, onQuit }: {
  activeTab: FloatingInfoDetailTab;
  onTabChange: (tab: FloatingInfoDetailTab) => void;
  onQuit: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-popover" data-testid="floating-info-detail">
      <FloatingInfoDetailHeader />
      <FloatingInfoDetailTabs activeTab={activeTab} onTabChange={onTabChange} />
      <FloatingInfoDetailContent activeTab={activeTab} />
      <footer
        className="flex h-10 shrink-0 items-center justify-between border-t border-border/70 px-4 text-[11px] font-semibold leading-none"
        style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
      >
        <button
          type="button"
          data-testid="floating-info-detail-quit"
          className="flex h-5 items-center gap-1 rounded px-1 text-foreground hover:bg-muted/70"
          onClick={(event) => {
            event.stopPropagation();
            onQuit();
          }}
        >
          <Power className="h-3.5 w-3.5" />
          Quit
        </button>
        <span
          data-testid="floating-info-detail-shortcut"
          className="flex h-5 items-center gap-1 rounded px-1 text-muted-foreground"
        >
          <Command className="h-3.5 w-3.5" />
          Q
        </span>
      </footer>
    </div>
  );
}

export function FloatingInfoWindow() {
  const { activeTheme, theme } = useTheme();
  const points = useFloatingInfoSeries();
  const {
    mode,
    handlePointerEnter,
    handlePointerLeave,
    handleDragPointerDown,
    handleDragPointerEnd,
    enterDetail,
    exitDetail,
  } = useFloatingInfoWindowMode();
  const [activeDetailTab, setActiveDetailTab] = useState<FloatingInfoDetailTab>('Overview');

  const accentColor = useMemo(() => getChartAccentColor(theme, activeTheme), [activeTheme, theme]);
  const latestPoint = points[points.length - 1] ?? null;
  const latestValue = latestPoint?.value ?? SUMMARY_PERCENT;
  const latestTime = latestPoint?.time ?? 0;
  const isExpanded = mode !== 'collapsed';
  const isDetail = mode === 'detail';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <div
        data-testid="floating-info-window"
        data-expanded={isExpanded ? 'true' : 'false'}
        data-mode={mode}
        data-theme={theme}
        data-series-count={String(points.length)}
        data-latest-value={String(latestValue)}
        data-latest-time={String(latestTime)}
        className={`relative flex h-full w-full select-none overflow-hidden border border-border/80 bg-popover text-foreground shadow-sm ${isExpanded ? 'flex-col' : 'items-center'} ${isDetail ? 'rounded-xl' : ''}`}
        onDoubleClick={() => {
          if (!isDetail) {
            enterDetail();
          }
        }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerUp={handleDragPointerEnd}
        onPointerCancel={handleDragPointerEnd}
      >
        <div
          aria-hidden="true"
          data-testid="floating-info-drag-handle"
          data-app-region="drag"
          className={`absolute right-0 top-0 z-10 ${isExpanded ? 'h-3 w-10' : 'h-full w-2'}`}
          style={{ WebkitAppRegion: 'drag' } as CSSProperties}
          onPointerDown={handleDragPointerDown}
        />

        {isDetail ? (
          <FloatingInfoDetail activeTab={activeDetailTab} onTabChange={setActiveDetailTab} onQuit={exitDetail} />
        ) : (
          <>
            <div
              className={`flex shrink-0 ${isExpanded ? 'h-8 w-full border-b border-border/70' : 'h-full w-full items-center'}`}
              data-testid={isExpanded ? 'floating-info-expanded-drag-region' : undefined}
              data-app-region={isExpanded ? 'drag' : undefined}
              style={isExpanded ? ({ WebkitAppRegion: 'drag' } as CSSProperties) : undefined}
              onPointerDown={isExpanded ? handleDragPointerDown : undefined}
            >
              <FloatingInfoSummary compact={!isExpanded} />
            </div>

            {isExpanded ? <FloatingInfoLiveChart accentColor={accentColor} points={points} themeKind={theme} /> : null}
          </>
        )}
      </div>
    </div>
  );
}
