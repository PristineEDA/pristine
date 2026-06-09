import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ArrowUp, Boxes, Clock3, GitBranch, Network, Route, Sigma } from 'lucide-react';
import * as echarts from 'echarts/core';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { SankeyChart, TreemapChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../ui/resizable';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { cn } from '@/lib/utils';

echarts.use([
  CanvasRenderer,
  GridComponent,
  LegendComponent,
  SankeyChart,
  TitleComponent,
  TooltipComponent,
  TreemapChart,
]);

const moduleCellTree = [
  {
    name: 'retroSoC',
    value: 18_640,
    children: [
      {
        name: 'cpu_top',
        value: 7_180,
        children: [
          { name: 'alu', value: 1_240 },
          { name: 'register_file', value: 1_960 },
          { name: 'decode_unit', value: 1_120 },
          { name: 'control_fsm', value: 980 },
          { name: 'csr_block', value: 1_880 },
        ],
      },
      {
        name: 'xpi_core',
        value: 5_460,
        children: [
          { name: 'xpi_cmd', value: 1_380 },
          { name: 'xpi_dma', value: 2_160 },
          { name: 'xpi_resp', value: 1_020 },
          { name: 'xpi_regslice', value: 900 },
        ],
      },
      {
        name: 'axi_fabric',
        value: 3_180,
        children: [
          { name: 'arbiter', value: 820 },
          { name: 'decoder', value: 610 },
          { name: 'bus_if', value: 1_260 },
          { name: 'response_mux', value: 490 },
        ],
      },
      {
        name: 'memory_subsystem',
        value: 2_820,
        children: [
          { name: 'sram_ctrl', value: 1_040 },
          { name: 'boot_rom', value: 420 },
          { name: 'dma_bridge', value: 1_360 },
        ],
      },
    ],
  },
];

const timingSankeyNodes = [
  { name: 'launch_reg' },
  { name: 'cpu_top' },
  { name: 'decode_unit' },
  { name: 'alu' },
  { name: 'axi_fabric' },
  { name: 'xpi_core' },
  { name: 'memory_subsystem' },
  { name: 'capture_reg' },
];

const timingSankeyLinks = [
  { source: 'launch_reg', target: 'cpu_top', value: 100 },
  { source: 'cpu_top', target: 'decode_unit', value: 44 },
  { source: 'cpu_top', target: 'alu', value: 36 },
  { source: 'cpu_top', target: 'axi_fabric', value: 20 },
  { source: 'decode_unit', target: 'alu', value: 31 },
  { source: 'alu', target: 'capture_reg', value: 42 },
  { source: 'axi_fabric', target: 'xpi_core', value: 14 },
  { source: 'axi_fabric', target: 'memory_subsystem', value: 6 },
  { source: 'xpi_core', target: 'capture_reg', value: 13 },
  { source: 'memory_subsystem', target: 'capture_reg', value: 5 },
];

const timingRows = Array.from({ length: 10 }, (_, index) => {
  const pathIndex = index + 1;
  const destinationBit = index % 5;

  return {
    name: `Path ${pathIndex}`,
    slack: '5.008',
    levels: '11',
    highFanout: '78',
    from: 'u_retrosoc/u_retrosoc/u_dr_dffr/dat_o_reg[28]/C',
    to: `u_retrosoc/u_retr.../dat_o_reg[${destinationBit}]/CE`,
    totalDelay: '8.419',
    logicDelay: '2.013',
    netDelay: '6.406',
    requirement: '13.884',
    sourceClock: 'clk_out1_clk_wiz_0',
    destinationClock: 'clk_out1_clk_wiz_0',
    exception: '',
    clockUncertainty: '0.110',
  };
});

type TimingRow = typeof timingRows[number];

interface TimingColumn {
  key: keyof TimingRow;
  label: string;
  numeric?: boolean;
  sorted?: boolean;
  width: string;
}

const timingColumns: readonly TimingColumn[] = [
  { key: 'name', label: 'Name', width: 'min-w-[92px]' },
  { key: 'slack', label: 'Slack', width: 'min-w-[84px]', numeric: true, sorted: true },
  { key: 'levels', label: 'Levels', width: 'min-w-[70px]', numeric: true },
  { key: 'highFanout', label: 'High Fanout', width: 'min-w-[104px]', numeric: true },
  { key: 'from', label: 'From', width: 'min-w-[360px]' },
  { key: 'to', label: 'To', width: 'min-w-[320px]' },
  { key: 'totalDelay', label: 'Total Delay', width: 'min-w-[104px]', numeric: true },
  { key: 'logicDelay', label: 'Logic Delay', width: 'min-w-[104px]', numeric: true },
  { key: 'netDelay', label: 'Net Delay', width: 'min-w-[96px]', numeric: true },
  { key: 'requirement', label: 'Requirement', width: 'min-w-[112px]', numeric: true },
  { key: 'sourceClock', label: 'Source Clock', width: 'min-w-[152px]' },
  { key: 'destinationClock', label: 'Destination Clock', width: 'min-w-[176px]' },
  { key: 'exception', label: 'Exception', width: 'min-w-[104px]' },
  { key: 'clockUncertainty', label: 'Clock Uncertainty', width: 'min-w-[160px]', numeric: true },
];

interface ThemePalette {
  accent: string;
  background: string;
  border: string;
  chartPalette: string[];
  info: string;
  muted: string;
  panel: string;
  success: string;
  text: string;
  warning: string;
}

function readCssColor(styles: CSSStyleDeclaration, name: string, fallback: string) {
  const value = styles.getPropertyValue(name).trim();

  return value || fallback;
}

function readThemePalette(): ThemePalette {
  if (typeof window === 'undefined') {
    return {
      accent: '#3b82f6',
      background: '#111827',
      border: '#334155',
      chartPalette: ['#38bdf8', '#22c55e', '#f59e0b', '#a78bfa', '#f97316', '#14b8a6'],
      info: '#38bdf8',
      muted: '#94a3b8',
      panel: '#0f172a',
      success: '#22c55e',
      text: '#e5e7eb',
      warning: '#f59e0b',
    };
  }

  const styles = window.getComputedStyle(document.documentElement);
  const accent = readCssColor(styles, '--ide-accent', '#3b82f6');
  const info = readCssColor(styles, '--ide-info', '#38bdf8');
  const success = readCssColor(styles, '--ide-success', '#22c55e');
  const warning = readCssColor(styles, '--ide-warning', '#f59e0b');

  return {
    accent,
    background: readCssColor(styles, '--ide-bg', '#111827'),
    border: readCssColor(styles, '--ide-border', '#334155'),
    chartPalette: [
      accent,
      info,
      success,
      warning,
      readCssColor(styles, '--ide-keyword', '#a78bfa'),
      readCssColor(styles, '--ide-string', '#14b8a6'),
      readCssColor(styles, '--ide-function', '#f97316'),
    ],
    info,
    muted: readCssColor(styles, '--ide-text-muted', '#94a3b8'),
    panel: readCssColor(styles, '--ide-panel-bg', '#0f172a'),
    success,
    text: readCssColor(styles, '--ide-text', '#e5e7eb'),
    warning,
  };
}

function createTreemapOption(palette: ThemePalette): EChartsCoreOption {
  return {
    color: palette.chartPalette,
    backgroundColor: 'transparent',
    tooltip: {
      confine: true,
      borderColor: palette.border,
      backgroundColor: palette.panel,
      textStyle: { color: palette.text, fontSize: 11 },
      formatter: ({ name, value }: { name: string; value: number }) => `${name}<br/>${value.toLocaleString()} cells`,
    },
    series: [
      {
        type: 'treemap',
        name: 'Cells',
        data: moduleCellTree,
        roam: false,
        nodeClick: 'zoomToNode',
        breadcrumb: {
          show: true,
          height: 18,
          top: 4,
          itemStyle: {
            color: palette.panel,
            borderColor: palette.border,
            textStyle: { color: palette.text, fontSize: 10 },
          },
        },
        label: {
          show: true,
          color: palette.text,
          fontSize: 11,
          formatter: '{b}',
        },
        upperLabel: {
          show: true,
          height: 18,
          color: palette.text,
          fontSize: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.20)',
        },
        itemStyle: {
          borderColor: palette.background,
          borderWidth: 2,
          gapWidth: 2,
        },
        levels: [
          { itemStyle: { borderWidth: 0, gapWidth: 3 } },
          { itemStyle: { borderWidth: 2, gapWidth: 2 } },
          { itemStyle: { borderWidth: 1, gapWidth: 1 } },
        ],
      },
    ],
  };
}

function createSankeyOption(palette: ThemePalette): EChartsCoreOption {
  return {
    color: palette.chartPalette,
    backgroundColor: 'transparent',
    tooltip: {
      confine: true,
      trigger: 'item',
      borderColor: palette.border,
      backgroundColor: palette.panel,
      textStyle: { color: palette.text, fontSize: 11 },
      formatter: ({ name, value }: { name: string; value?: number }) => (
        typeof value === 'number' ? `${name}<br/>${value}% path share` : name
      ),
    },
    series: [
      {
        type: 'sankey',
        data: timingSankeyNodes,
        links: timingSankeyLinks,
        left: 10,
        top: 16,
        right: 18,
        bottom: 10,
        nodeWidth: 12,
        nodeGap: 11,
        draggable: false,
        label: {
          color: palette.text,
          fontSize: 10,
        },
        lineStyle: {
          color: 'gradient',
          curveness: 0.5,
          opacity: 0.32,
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            opacity: 0.58,
          },
        },
      },
    ],
  };
}

interface EchartsPanelProps {
  description: string;
  icon: ReactNode;
  optionFactory: (palette: ThemePalette) => EChartsCoreOption;
  subtitle: string;
  testId: string;
  title: string;
}

function EchartsPanel({ description, icon, optionFactory, subtitle, testId, title }: EchartsPanelProps) {
  const chartElementRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    const chartElement = chartElementRef.current;

    if (!chartElement) {
      return undefined;
    }

    const palette = readThemePalette();
    const chart = echarts.init(chartElement, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    chart.setOption(optionFactory(palette));

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(chartElement);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [optionFactory]);

  return (
    <section
      data-testid={testId}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-ide-border bg-ide-bg"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-ide-border bg-ide-tab-bg px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded border border-ide-border bg-ide-hover text-ide-info">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium leading-4 text-ide-text">{title}</div>
            <div className="truncate text-[10px] leading-3 text-ide-text-muted">{subtitle}</div>
          </div>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-ide-text-dim">{description}</span>
      </div>
      <div
        ref={chartElementRef}
        data-testid={`${testId}-chart`}
        className="min-h-0 flex-1"
      />
    </section>
  );
}

function StatChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-ide-border bg-ide-bg px-2 py-1">
      <span className="text-ide-info">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.06em] text-ide-text-dim">{label}</div>
        <div className="truncate text-[12px] font-semibold text-ide-text">{value}</div>
      </div>
    </div>
  );
}

function TimingPathTable() {
  return (
    <section
      data-testid="synthesis-timing-table-panel"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-ide-border bg-ide-bg"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-ide-border bg-ide-tab-bg px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded border border-ide-border bg-ide-hover text-ide-warning">
            <Clock3 size={12} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium leading-4 text-ide-text">Timing Paths</div>
            <div className="truncate text-[10px] leading-3 text-ide-text-muted">post-synthesis report mock</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <StatChip icon={<Sigma size={11} />} label="Worst" value="5.008 ns" />
          <StatChip icon={<GitBranch size={11} />} label="Levels" value="11" />
          <StatChip icon={<Boxes size={11} />} label="Fanout" value="78" />
        </div>
      </div>
      <div className="bottom-panel-scrollbar min-h-0 flex-1 overflow-auto">
        <Table data-testid="synthesis-timing-table" className="min-w-[2110px] border-separate border-spacing-0 text-[11px]">
          <TableHeader className="sticky top-0 z-10 bg-ide-tab-bg text-ide-text">
            <TableRow className="border-b border-ide-border hover:bg-ide-tab-bg">
              {timingColumns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    'h-7 border-r border-ide-border px-2 py-0 text-[11px] font-medium text-ide-text last:border-r-0',
                    column.width,
                    column.numeric && 'text-right',
                    column.sorted && 'bg-ide-hover',
                  )}
                >
                  <span className={cn('inline-flex items-center gap-1', column.numeric && 'justify-end')}>
                    {column.label}
                    {column.sorted ? <ArrowUp size={11} className="text-ide-text-muted" aria-hidden="true" /> : null}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {timingRows.map((row) => (
              <TableRow key={row.name} className="border-b border-ide-border/80 hover:bg-ide-hover/80">
                {timingColumns.map((column) => {
                  const value = row[column.key];

                  return (
                    <TableCell
                      key={`${row.name}-${column.key}`}
                      title={value}
                      className={cn(
                        'h-6 max-w-[360px] border-r border-ide-border/80 px-2 py-0 text-ide-text last:border-r-0',
                        column.width,
                        column.numeric && 'text-right tabular-nums',
                      )}
                    >
                      <span className="block truncate">
                        {column.key === 'name' ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Route size={11} className="text-ide-warning" />
                            {value}
                          </span>
                        ) : value}
                      </span>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export function SynthesisPanel() {
  const treemapOptionFactory = useMemo(() => createTreemapOption, []);
  const sankeyOptionFactory = useMemo(() => createSankeyOption, []);

  return (
    <div data-testid="synthesis-panel" className="h-full min-h-0 bg-ide-panel-bg p-2">
      <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0 min-w-0" layoutGapPx={8}>
        <ResizablePanel id="synthesis-charts" defaultSize={58} minSize={34} minSizePx={360}>
          <ResizablePanelGroup orientation="vertical" className="h-full min-h-0 min-w-0" layoutGapPx={8}>
            <ResizablePanel id="synthesis-treemap" defaultSize={50} minSize={24} minSizePx={96}>
              <EchartsPanel
                description="cells"
                icon={<Network size={12} />}
                optionFactory={treemapOptionFactory}
                subtitle="hierarchy module cell count"
                testId="synthesis-treemap"
                title="Module Cell Treemap"
              />
            </ResizablePanel>
            <ResizableHandle data-testid="synthesis-left-split-handle" />
            <ResizablePanel id="synthesis-sankey" defaultSize={50} minSize={24} minSizePx={96}>
              <EchartsPanel
                description="timing"
                icon={<GitBranch size={12} />}
                optionFactory={sankeyOptionFactory}
                subtitle="path module share"
                testId="synthesis-sankey"
                title="Timing Path Sankey"
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle data-testid="synthesis-main-split-handle" />
        <ResizablePanel id="synthesis-table" defaultSize={42} minSize={28} minSizePx={420}>
          <TimingPathTable />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
