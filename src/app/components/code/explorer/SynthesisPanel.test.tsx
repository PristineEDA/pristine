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
      series: expect.arrayContaining([
        expect.objectContaining({
          type: 'treemap',
          data: expect.arrayContaining([
            expect.objectContaining({
              name: 'retroSoC',
              children: expect.arrayContaining([
                expect.objectContaining({ name: 'cpu_top', value: 7180 }),
                expect.objectContaining({ name: 'xpi_core', value: 5460 }),
              ]),
            }),
          ]),
        }),
      ]),
    }));
    expect(sankeyChart?.setOption).toHaveBeenCalledWith(expect.objectContaining({
      series: expect.arrayContaining([
        expect.objectContaining({
          type: 'sankey',
          data: expect.arrayContaining([
            expect.objectContaining({ name: 'launch_reg' }),
            expect.objectContaining({ name: 'capture_reg' }),
          ]),
          links: expect.arrayContaining([
            expect.objectContaining({ source: 'cpu_top', target: 'alu', value: 36 }),
          ]),
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
    expect(screen.getByText('Path 10')).toBeInTheDocument();
    expect(screen.getAllByText('5.008')).toHaveLength(10);
    expect(screen.getAllByText('clk_out1_clk_wiz_0')).toHaveLength(20);
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
