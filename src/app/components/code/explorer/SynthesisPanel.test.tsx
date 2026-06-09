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
    expect(screen.getByText('Module Cell Treemap')).toBeInTheDocument();
    expect(screen.getByText('Timing Path Sankey')).toBeInTheDocument();
    expect(screen.getByText('Timing Paths')).toBeInTheDocument();

    await waitFor(() => expect(chartInstances.getAll()).toHaveLength(2));

    const [treemapChart, sankeyChart] = chartInstances.getAll();
    expect(treemapChart?.setOption).toHaveBeenCalledWith(expect.objectContaining({
      color: expect.arrayContaining(['#2f55d4', '#5b5b5b', '#ff8128']),
      series: expect.arrayContaining([
        expect.objectContaining({
          type: 'treemap',
          data: expect.arrayContaining([
            expect.objectContaining({
              name: 'retroSoC',
              children: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Compute',
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
                  itemStyle: { color: '#5b5b5b' },
                }),
              ]),
            }),
          ]),
          levels: expect.arrayContaining([
            expect.objectContaining({
              color: expect.arrayContaining(['#2f55d4', '#5b5b5b', '#ff8128']),
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
          leafDepth: 1,
          nodeClick: 'zoomToNode',
          roam: true,
          scaleLimit: { min: 0.72, max: 4 },
          upperLabel: expect.objectContaining({
            show: true,
            color: '#ffffff',
            textBorderColor: 'rgba(0, 0, 0, 0.58)',
            textBorderWidth: 2,
          }),
        }),
      ]),
    }));
    expect(sankeyChart?.setOption).toHaveBeenCalledWith(expect.objectContaining({
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
