import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Liveline, type LivelinePoint } from 'liveline';
import { useTheme } from '../app/context/ThemeContext';

const SAMPLE_LIMIT = 24;
const UPDATE_INTERVAL_MS = 1000;
const COLLAPSE_DELAY_MS = 160;
const SUMMARY_PERCENT = 68;
const SUMMARY_LABEL = 'SYNC';

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

function useFloatingInfoExpansion() {
  const [isExpanded, setIsExpanded] = useState(false);
  const collapseTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current !== null) {
        window.clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, []);

  const syncWindowExpansion = (expanded: boolean) => {
    void window.electronAPI?.setFloatingInfoWindowExpanded(expanded);
  };

  const handlePointerEnter = () => {
    if (collapseTimeoutRef.current !== null) {
      window.clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }

    setIsExpanded((currentExpanded) => {
      if (!currentExpanded) {
        syncWindowExpansion(true);
      }

      return true;
    });
  };

  const handlePointerLeave = () => {
    if (collapseTimeoutRef.current !== null) {
      window.clearTimeout(collapseTimeoutRef.current);
    }

    collapseTimeoutRef.current = window.setTimeout(() => {
      collapseTimeoutRef.current = null;
      setIsExpanded(false);
      syncWindowExpansion(false);
    }, COLLAPSE_DELAY_MS);
  };

  return {
    isExpanded,
    handlePointerEnter,
    handlePointerLeave,
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
    <div className="flex min-h-0 flex-1 px-2 pb-2" data-testid="floating-info-chart-shell">
      <div className="h-full w-full overflow-hidden rounded-sm border border-border/70 bg-background/80" data-testid="floating-info-chart">
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

export function FloatingInfoWindow() {
  const { activeTheme, theme } = useTheme();
  const points = useFloatingInfoSeries();
  const { isExpanded, handlePointerEnter, handlePointerLeave } = useFloatingInfoExpansion();

  const accentColor = useMemo(() => getChartAccentColor(theme, activeTheme), [activeTheme, theme]);
  const latestPoint = points[points.length - 1] ?? null;
  const latestValue = latestPoint?.value ?? SUMMARY_PERCENT;
  const latestTime = latestPoint?.time ?? 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <div
        data-testid="floating-info-window"
        data-expanded={isExpanded ? 'true' : 'false'}
        data-theme={theme}
        data-series-count={String(points.length)}
        data-latest-value={String(latestValue)}
        data-latest-time={String(latestTime)}
        className={`relative flex h-full w-full select-none overflow-hidden border border-border/80 bg-popover text-foreground shadow-sm ${isExpanded ? 'flex-col' : 'items-center'}`}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <div
          aria-hidden="true"
          data-testid="floating-info-drag-handle"
          className={`absolute right-0 top-0 z-10 ${isExpanded ? 'h-3 w-10' : 'h-full w-2'}`}
          style={{ WebkitAppRegion: 'drag' } as CSSProperties}
        />
        <div className={`flex shrink-0 ${isExpanded ? 'h-8 w-full border-b border-border/70' : 'h-full w-full items-center'}`}>
          <FloatingInfoSummary compact={!isExpanded} />
        </div>

        {isExpanded ? <FloatingInfoLiveChart accentColor={accentColor} points={points} themeKind={theme} /> : null}
      </div>
    </div>
  );
}
