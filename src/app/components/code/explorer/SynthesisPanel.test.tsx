import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SynthesisPanel } from './SynthesisPanel';

const chartInstances = vi.hoisted(() => {
  const instances: Array<{
    dispose: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    setOption: ReturnType<typeof vi.fn>;
  }> = [];

  return {
    create() {
      const instance = {
        dispose: vi.fn(),
        resize: vi.fn(),
        setOption: vi.fn(),
      };
      instances.push(instance);
      return instance;
    },
    getAll() {
      return instances;
    },
    reset() {
      instances.length = 0;
    },
  };
});

vi.mock('echarts/core', () => ({
  default: {
    init: vi.fn(() => chartInstances.create()),
    use: vi.fn(),
  },
  init: vi.fn(() => chartInstances.create()),
  use: vi.fn(),
}));

vi.mock('echarts/charts', () => ({
  SankeyChart: {},
  TreemapChart: {},
}));

vi.mock('echarts/components', () => ({
  GridComponent: {},
  LegendComponent: {},
  TitleComponent: {},
  TooltipComponent: {},
}));

vi.mock('echarts/renderers', () => ({
  CanvasRenderer: {},
}));

class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
}

describe('SynthesisPanel', () => {
  beforeEach(() => {
    chartInstances.reset();
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  it('renders synthesis charts, nested resize panels, and timing table', async () => {
    render(<SynthesisPanel />);

    expect(screen.getByTestId('synthesis-panel')).toBeInTheDocument();
    expect(screen.getByTestId('panel-synthesis-charts')).toHaveAttribute('data-default-size', '58');
    expect(screen.getByTestId('panel-synthesis-table')).toHaveAttribute('data-default-size', '42');
    expect(screen.getByTestId('panel-synthesis-treemap')).toHaveAttribute('data-default-size', '50');
    expect(screen.getByTestId('panel-synthesis-sankey')).toHaveAttribute('data-default-size', '50');
    expect(screen.getByTestId('synthesis-main-split-handle')).toHaveAttribute('role', 'separator');
    expect(screen.getByTestId('synthesis-left-split-handle')).toHaveAttribute('role', 'separator');
    expect(screen.getByTestId('synthesis-main-split-handle')).toHaveClass('!bg-transparent', 'hover:!bg-transparent');
    expect(screen.getByTestId('synthesis-left-split-handle')).toHaveClass('!bg-transparent', 'hover:!bg-transparent');
    expect(screen.getByText('Module Cell Treemap')).toBeInTheDocument();
    expect(screen.getByText('Timing Path Sankey')).toBeInTheDocument();
    expect(screen.getByText('Timing Paths')).toBeInTheDocument();
    expect(screen.getByTestId('synthesis-treemap-header')).not.toHaveTextContent('retroSoC');
    expect(screen.getByTestId('synthesis-sankey-header')).not.toHaveTextContent(/^timing$/i);
    expect(screen.getByTestId('synthesis-timing-summary')).toHaveClass('flex', 'flex-nowrap', 'items-stretch');

    const statChips = [
      ['synthesis-timing-stat-worst', 'Worst', '5.008 ns'],
      ['synthesis-timing-stat-levels', 'Levels', '11'],
      ['synthesis-timing-stat-fanout', 'Fanout', '78'],
    ] as const;

    statChips.forEach(([testId, label, value]) => {
      const chip = screen.getByTestId(testId);

      expect(chip).toHaveClass('h-8', 'w-[132px]', 'flex-none', 'items-center');
      expect(chip).toHaveTextContent(label);
      expect(chip).toHaveTextContent(value);
      expect(screen.getByTestId(`${testId}-rail`)).toHaveClass('items-end', 'whitespace-nowrap');
      expect(screen.getByTestId(`${testId}-icon`)).toHaveClass('h-3', 'items-end', 'justify-center');
      expect(screen.getByTestId(`${testId}-label`)).toHaveClass('h-3', 'items-end', 'leading-none');
      expect(screen.getByTestId(`${testId}-value`)).toHaveClass('h-3', 'items-end', 'leading-none');
    });

    await waitFor(() => expect(chartInstances.getAll()).toHaveLength(2));

    const [treemapChart, sankeyChart] = chartInstances.getAll();
    const treemapOption = treemapChart?.setOption.mock.calls[0]?.[0] as {
      series?: Array<{
        data?: Array<{
          children?: Array<{
            children?: Array<{
              itemStyle?: { color?: string };
              name: string;
            }>;
            itemStyle?: { color?: string };
            name: string;
          }>;
          itemStyle?: { color?: string };
          name: string;
          value?: number;
        }>;
        itemStyle?: Record<string, unknown>;
        levels?: Array<Record<string, unknown>>;
        name?: string;
        visibleMin?: number;
      }>;
    };
    const sankeyOption = sankeyChart?.setOption.mock.calls[0]?.[0] as {
      color?: string[];
      series?: Array<{ data?: unknown[]; links?: unknown[] }>;
    };

    expect(treemapChart?.setOption).toHaveBeenCalledWith(expect.objectContaining({
      color: expect.arrayContaining(['#2f55d4', '#5f627f', '#ff8128']),
      series: expect.arrayContaining([
        expect.objectContaining({
          name: 'retroSoC',
          type: 'treemap',
          data: expect.arrayContaining([
            expect.objectContaining({
              name: 'Compute',
              value: 28400,
              itemStyle: { color: '#2f55d4' },
              children: expect.arrayContaining([
                expect.objectContaining({
                  name: 'cpu_top',
                  children: expect.arrayContaining([
                    expect.objectContaining({
                      name: 'execute_cluster',
                      children: expect.arrayContaining([
                        expect.objectContaining({ name: 'alu_datapath', value: 1120 }),
                      ]),
                    }),
                  ]),
                }),
              ]),
            }),
            expect.objectContaining({
              name: 'Interconnect',
              value: 14200,
              itemStyle: { color: '#5f627f' },
            }),
            expect.objectContaining({
              name: 'Memory',
              value: 10900,
              itemStyle: { color: '#ff8128' },
            }),
          ]),
          levels: expect.arrayContaining([
            expect.objectContaining({
              color: expect.arrayContaining(['#2f55d4', '#5f627f', '#ff8128']),
              colorSaturation: [0.3, 0.6],
            }),
          ]),
          breadcrumb: expect.objectContaining({
            show: true,
            itemStyle: expect.objectContaining({
              textStyle: expect.objectContaining({ color: '#ffffff' }),
            }),
          }),
          label: expect.objectContaining({
            color: '#ffffff',
            textBorderColor: 'rgba(0, 0, 0, 0.58)',
            textBorderWidth: 2,
          }),
          colorMappingBy: 'index',
          itemStyle: expect.objectContaining({
            borderColor: '#555',
            borderWidth: 4,
            gapWidth: 4,
          }),
          leafDepth: 2,
          nodeClick: 'zoomToNode',
          roam: true,
          scaleLimit: { min: 0.72, max: 4 },
          upperLabel: expect.objectContaining({
            show: true,
            color: '#ffffff',
            textBorderColor: 'rgba(0, 0, 0, 0.58)',
            textBorderWidth: 2,
          }),
          visibleMin: 300,
        }),
      ]),
    }));
    const computeGroup = treemapOption.series?.[0]?.data?.find((item) => item.name === 'Compute');
    const computeChildren = computeGroup?.children ?? [];
    const cpuTop = computeChildren.find((item) => item.name === 'cpu_top');
    const vectorAccel = computeChildren.find((item) => item.name === 'vector_accel');
    const cpuTopChildren = cpuTop?.children ?? [];
    expect(treemapOption.series?.[0]?.name).toBe('retroSoC');
    expect(computeGroup?.itemStyle?.color).toBe('#2f55d4');
    expect(cpuTop?.itemStyle?.color).toBe('#2c4fc5');
    expect(vectorAccel?.itemStyle?.color).toBe('#2543a7');
    expect(cpuTopChildren.find((item) => item.name === 'execute_cluster')?.itemStyle?.color).toBe('#2441a1');
    expect(treemapOption.series?.[0]?.data?.map((item) => item.name)).toEqual([
      'Compute',
      'Interconnect',
      'Memory',
      'IO',
      'Clock Reset',
      'DFT',
      'Verification',
      'Packages',
    ]);
    expect(treemapOption.series?.[0]?.levels).toEqual([
      {
        itemStyle: {
          borderColor: '#555',
          borderWidth: 4,
          gapWidth: 4,
        },
      },
      {
        color: ['#2f55d4', '#5f627f', '#ff8128', '#18a6c8', '#f6cc19', '#62c7a8', '#5875d9', '#b9d73a', '#f2366d', '#8a70bd'],
        colorSaturation: [0.3, 0.6],
        itemStyle: {
          borderColorSaturation: 0.7,
          borderWidth: 2,
          gapWidth: 2,
        },
        upperLabel: { show: true },
      },
      {
        colorSaturation: [0.3, 0.5],
        itemStyle: {
          borderColorSaturation: 0.6,
          borderWidth: 1,
          gapWidth: 1,
        },
      },
      {
        colorSaturation: [0.3, 0.5],
        itemStyle: { borderWidth: 1, gapWidth: 1 },
      },
    ]);
    expect(treemapOption.series?.[0]?.visibleMin).toBe(300);
    expect(sankeyChart?.setOption).toHaveBeenCalledWith(expect.objectContaining({
      color: expect.arrayContaining([
        '#d8cf23',
        '#a8db2d',
        '#35c18f',
        '#ffc400',
        '#2f79d6',
        '#ef4e86',
      ]),
      series: expect.arrayContaining([
        expect.objectContaining({
          type: 'sankey',
          data: expect.arrayContaining([
            expect.objectContaining({ name: 'core_launch_regs' }),
            expect.objectContaining({ name: 'execute_cluster' }),
            expect.objectContaining({ name: 'interconnect_grid' }),
            expect.objectContaining({ name: 'Timing Losses' }),
            expect.objectContaining({ name: 'debug_trace_q' }),
          ]),
          links: expect.arrayContaining([
            expect.objectContaining({ source: 'core_launch_regs', target: 'decode_unit', value: 112 }),
            expect.objectContaining({ source: 'interconnect_grid', target: 'Timing Losses', value: 96 }),
            expect.objectContaining({ source: 'memory_path', target: 'Timing Losses', value: 64 }),
            expect.objectContaining({ source: 'sram_ctrl', target: 'mbist_done_q', value: 7 }),
          ]),
          nodeGap: 6,
          nodeWidth: 10,
          right: 44,
        }),
      ]),
    }));
    expect(sankeyOption.color).toHaveLength(24);
    expect(sankeyOption.series?.[0]?.data).toHaveLength(33);
    expect(sankeyOption.series?.[0]?.links).toHaveLength(55);
  });

  it('renders dense timing path table columns and mock rows', () => {
    render(<SynthesisPanel />);

    const table = screen.getByTestId('synthesis-timing-table');
    const tableQueries = within(table);
    expect(table).toBeInTheDocument();

    [
      'Name',
      'Slack',
      'Levels',
      'High Fanout',
      'From',
      'To',
      'Total Delay',
      'Logic Delay',
      'Net Delay',
      'Requirement',
      'Source Clock',
      'Destination Clock',
      'Exception',
      'Clock Uncertainty',
    ].forEach((columnLabel) => {
      expect(tableQueries.getByRole('columnheader', { name: columnLabel })).toBeInTheDocument();
    });

    expect(screen.getByText('Path 1')).toBeInTheDocument();
    expect(screen.getByText('Path 32')).toBeInTheDocument();
    expect(screen.getByText('Path 100')).toBeInTheDocument();
    expect(screen.getAllByText(/Path \d+/)).toHaveLength(100);
    expect(table).toHaveClass('min-w-[1506px]', 'text-[10.5px]');
    expect(tableQueries.getByRole('columnheader', { name: 'From' })).toHaveClass('min-w-[240px]', 'px-1.5');
    expect(tableQueries.getByRole('columnheader', { name: 'To' })).toHaveClass('min-w-[220px]', 'px-1.5');
    expect(screen.getAllByText('u_retrosoc/u_xpi_core/u_cmd/cmd_valid_q/C').length).toBeGreaterThan(0);
    expect(screen.getAllByText('clk_core').length).toBeGreaterThan(10);
    expect(screen.getByText('Slack').closest('th')).toHaveClass('bg-ide-hover');
  });

  it('disposes ECharts instances on unmount', async () => {
    const { unmount } = render(<SynthesisPanel />);

    await waitFor(() => expect(chartInstances.getAll()).toHaveLength(2));
    const instances = chartInstances.getAll();

    unmount();

    expect(instances[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(instances[1]?.dispose).toHaveBeenCalledTimes(1);
  });
});
