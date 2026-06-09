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

const diskUsageTreemapPalette = [
  '#2f55d4',
  '#5b5b5b',
  '#ff8128',
  '#18a6c8',
  '#f35a84',
  '#7e5ab8',
  '#b9d73a',
  '#e5b700',
  '#45b890',
  '#5875d9',
];

const moduleCellTree = [
  {
    name: 'retroSoC',
    value: 61_980,
    children: [
      {
        name: 'Compute',
        value: 18_560,
        itemStyle: { color: diskUsageTreemapPalette[0] },
        children: [
          {
            name: 'cpu_top',
            value: 9_580,
            children: [
              {
                name: 'frontend_cluster',
                value: 2_340,
                children: [
                  { name: 'fetch_queue', value: 510 },
                  { name: 'branch_predict', value: 420 },
                  { name: 'decode_unit', value: 620 },
                  { name: 'csr_decode', value: 790 },
                ],
              },
              {
                name: 'execute_cluster',
                value: 3_480,
                children: [
                  { name: 'alu_datapath', value: 1_120 },
                  { name: 'multiplier', value: 760 },
                  { name: 'shifter', value: 440 },
                  { name: 'bypass_mux', value: 620 },
                  { name: 'condition_flags', value: 540 },
                ],
              },
              {
                name: 'register_cluster',
                value: 2_380,
                children: [
                  { name: 'register_file', value: 1_260 },
                  { name: 'csr_block', value: 680 },
                  { name: 'scoreboard', value: 440 },
                ],
              },
              {
                name: 'control_cluster',
                value: 1_380,
                children: [
                  { name: 'control_fsm', value: 540 },
                  { name: 'interrupt_ctrl', value: 390 },
                  { name: 'trap_unit', value: 450 },
                ],
              },
            ],
          },
          {
            name: 'vector_accel',
            value: 3_520,
            children: [
              { name: 'lane0_mac', value: 920 },
              { name: 'lane1_mac', value: 920 },
              { name: 'lane2_mac', value: 760 },
              { name: 'lane3_mac', value: 760 },
              { name: 'vector_ctrl', value: 160 },
            ],
          },
          {
            name: 'crypto_unit',
            value: 2_260,
            children: [
              { name: 'aes_rounds', value: 1_140 },
              { name: 'sha_mix', value: 620 },
              { name: 'key_expand', value: 500 },
            ],
          },
          {
            name: 'pipeline_glue',
            value: 3_200,
            children: [
              { name: 'hazard_muxes', value: 1_020 },
              { name: 'valid_ready', value: 780 },
              { name: 'retire_bus', value: 680 },
              { name: 'debug_taps', value: 720 },
            ],
          },
        ],
      },
      {
        name: 'Interconnect',
        value: 11_880,
        itemStyle: { color: diskUsageTreemapPalette[1] },
        children: [
          {
            name: 'axi_fabric',
            value: 4_520,
            children: [
              { name: 'address_decoder', value: 840 },
              { name: 'read_crossbar', value: 1_240 },
              { name: 'write_crossbar', value: 1_180 },
              { name: 'response_mux', value: 760 },
              { name: 'qos_arbiter', value: 500 },
            ],
          },
          {
            name: 'noc_bridge',
            value: 3_360,
            children: [
              { name: 'route_table', value: 780 },
              { name: 'vc_allocator', value: 940 },
              { name: 'flit_buffer', value: 1_120 },
              { name: 'credit_ctrl', value: 520 },
            ],
          },
          {
            name: 'dma_crossbar',
            value: 2_400,
            children: [
              { name: 'grant_matrix', value: 860 },
              { name: 'burst_splitter', value: 620 },
              { name: 'stream_join', value: 500 },
              { name: 'backpressure', value: 420 },
            ],
          },
          {
            name: 'bus_if',
            value: 1_600,
            children: [
              { name: 'apb_shim', value: 520 },
              { name: 'axi_lite_shim', value: 620 },
              { name: 'error_slave', value: 460 },
            ],
          },
        ],
      },
      {
        name: 'Memory',
        value: 9_640,
        itemStyle: { color: diskUsageTreemapPalette[2] },
        children: [
          {
            name: 'memory_subsystem',
            value: 4_380,
            children: [
              { name: 'sram_ctrl', value: 1_240 },
              { name: 'bank_select', value: 620 },
              { name: 'ecc_encode', value: 860 },
              { name: 'ecc_decode', value: 900 },
              { name: 'scrub_fsm', value: 760 },
            ],
          },
          {
            name: 'cache_cluster',
            value: 2_720,
            children: [
              { name: 'tag_array', value: 620 },
              { name: 'data_array', value: 980 },
              { name: 'miss_queue', value: 700 },
              { name: 'refill_ctrl', value: 420 },
            ],
          },
          {
            name: 'boot_rom',
            value: 1_060,
            children: [
              { name: 'rom_decode', value: 380 },
              { name: 'rom_array', value: 500 },
              { name: 'rom_wait', value: 180 },
            ],
          },
          {
            name: 'dma_bridge',
            value: 1_480,
            children: [
              { name: 'descriptor_ram', value: 520 },
              { name: 'length_counter', value: 300 },
              { name: 'fifo_ctrl', value: 660 },
            ],
          },
        ],
      },
      {
        name: 'IO',
        value: 8_820,
        itemStyle: { color: diskUsageTreemapPalette[3] },
        children: [
          {
            name: 'xpi_core',
            value: 3_760,
            children: [
              { name: 'xpi_cmd', value: 940 },
              { name: 'xpi_dma', value: 1_180 },
              { name: 'xpi_resp', value: 760 },
              { name: 'xpi_regslice', value: 480 },
              { name: 'xpi_crc', value: 400 },
            ],
          },
          {
            name: 'peripheral_ring',
            value: 2_140,
            children: [
              { name: 'uart0', value: 420 },
              { name: 'spi0', value: 520 },
              { name: 'i2c0', value: 360 },
              { name: 'gpio', value: 560 },
              { name: 'timer', value: 280 },
            ],
          },
          {
            name: 'pad_ring',
            value: 1_640,
            children: [
              { name: 'input_cells', value: 420 },
              { name: 'output_cells', value: 500 },
              { name: 'bidir_cells', value: 460 },
              { name: 'esd_clamps', value: 260 },
            ],
          },
          {
            name: 'trace_port',
            value: 1_280,
            children: [
              { name: 'trace_fifo', value: 520 },
              { name: 'packetizer', value: 440 },
              { name: 'trigger_match', value: 320 },
            ],
          },
        ],
      },
      {
        name: 'Clock Reset',
        value: 4_880,
        itemStyle: { color: diskUsageTreemapPalette[4] },
        children: [
          { name: 'pll_adapter', value: 920 },
          { name: 'reset_tree', value: 1_160 },
          { name: 'clock_gates', value: 1_680 },
          { name: 'cdc_sync', value: 1_120 },
        ],
      },
      {
        name: 'DFT',
        value: 3_460,
        itemStyle: { color: diskUsageTreemapPalette[5] },
        children: [
          { name: 'scan_chain', value: 1_180 },
          { name: 'mbist_ctrl', value: 920 },
          { name: 'boundary_scan', value: 780 },
          { name: 'test_muxes', value: 580 },
        ],
      },
      {
        name: 'Verification',
        value: 2_780,
        itemStyle: { color: diskUsageTreemapPalette[6] },
        children: [
          { name: 'assertion_taps', value: 720 },
          { name: 'coverage_bins', value: 680 },
          { name: 'scoreboard_hooks', value: 520 },
          { name: 'formal_monitors', value: 860 },
        ],
      },
      {
        name: 'Packages',
        value: 1_960,
        itemStyle: { color: diskUsageTreemapPalette[7] },
        children: [
          { name: 'retrosoc_pkg', value: 620 },
          { name: 'bus_pkg', value: 420 },
          { name: 'xpi_pkg', value: 520 },
          { name: 'dv_pkg', value: 400 },
        ],
      },
    ],
  },
];

const timingSankeyNodes = [
  { name: 'launch_reg[0]' },
  { name: 'launch_reg[1]' },
  { name: 'csr_state_q' },
  { name: 'dma_req_q' },
  { name: 'xpi_cmd_q' },
  { name: 'irq_pending_q' },
  { name: 'fetch_stage' },
  { name: 'decode_unit' },
  { name: 'issue_mux' },
  { name: 'scoreboard' },
  { name: 'control_fsm' },
  { name: 'csr_block' },
  { name: 'operand_mux' },
  { name: 'alu' },
  { name: 'multiplier' },
  { name: 'shifter' },
  { name: 'bypass_mux' },
  { name: 'branch_unit' },
  { name: 'axi_fabric' },
  { name: 'address_decoder' },
  { name: 'read_crossbar' },
  { name: 'write_crossbar' },
  { name: 'arbiter' },
  { name: 'xpi_core' },
  { name: 'xpi_dma' },
  { name: 'xpi_resp' },
  { name: 'memory_subsystem' },
  { name: 'sram_ctrl' },
  { name: 'dma_bridge' },
  { name: 'capture_reg[0]' },
  { name: 'capture_reg[1]' },
  { name: 'resp_valid_q' },
  { name: 'xpi_done_q' },
  { name: 'irq_taken_q' },
];

const timingSankeyLinks = [
  { source: 'launch_reg[0]', target: 'fetch_stage', value: 38 },
  { source: 'launch_reg[1]', target: 'fetch_stage', value: 22 },
  { source: 'csr_state_q', target: 'control_fsm', value: 18 },
  { source: 'dma_req_q', target: 'axi_fabric', value: 20 },
  { source: 'xpi_cmd_q', target: 'xpi_core', value: 24 },
  { source: 'irq_pending_q', target: 'control_fsm', value: 12 },
  { source: 'fetch_stage', target: 'decode_unit', value: 56 },
  { source: 'fetch_stage', target: 'branch_unit', value: 4 },
  { source: 'decode_unit', target: 'issue_mux', value: 46 },
  { source: 'decode_unit', target: 'csr_block', value: 10 },
  { source: 'control_fsm', target: 'issue_mux', value: 18 },
  { source: 'control_fsm', target: 'csr_block', value: 8 },
  { source: 'issue_mux', target: 'scoreboard', value: 20 },
  { source: 'issue_mux', target: 'operand_mux', value: 42 },
  { source: 'scoreboard', target: 'operand_mux', value: 14 },
  { source: 'csr_block', target: 'operand_mux', value: 11 },
  { source: 'operand_mux', target: 'alu', value: 31 },
  { source: 'operand_mux', target: 'multiplier', value: 9 },
  { source: 'operand_mux', target: 'shifter', value: 7 },
  { source: 'alu', target: 'bypass_mux', value: 28 },
  { source: 'multiplier', target: 'bypass_mux', value: 8 },
  { source: 'shifter', target: 'bypass_mux', value: 6 },
  { source: 'branch_unit', target: 'bypass_mux', value: 5 },
  { source: 'bypass_mux', target: 'capture_reg[0]', value: 22 },
  { source: 'bypass_mux', target: 'axi_fabric', value: 18 },
  { source: 'bypass_mux', target: 'xpi_core', value: 7 },
  { source: 'axi_fabric', target: 'address_decoder', value: 20 },
  { source: 'axi_fabric', target: 'arbiter', value: 18 },
  { source: 'address_decoder', target: 'read_crossbar', value: 10 },
  { source: 'address_decoder', target: 'write_crossbar', value: 8 },
  { source: 'read_crossbar', target: 'memory_subsystem', value: 9 },
  { source: 'write_crossbar', target: 'memory_subsystem', value: 7 },
  { source: 'arbiter', target: 'xpi_core', value: 11 },
  { source: 'arbiter', target: 'dma_bridge', value: 7 },
  { source: 'xpi_core', target: 'xpi_dma', value: 16 },
  { source: 'xpi_core', target: 'xpi_resp', value: 12 },
  { source: 'xpi_dma', target: 'dma_bridge', value: 11 },
  { source: 'xpi_resp', target: 'resp_valid_q', value: 9 },
  { source: 'memory_subsystem', target: 'sram_ctrl', value: 14 },
  { source: 'dma_bridge', target: 'memory_subsystem', value: 8 },
  { source: 'sram_ctrl', target: 'capture_reg[1]', value: 13 },
  { source: 'dma_bridge', target: 'xpi_done_q', value: 10 },
  { source: 'xpi_dma', target: 'xpi_done_q', value: 6 },
  { source: 'csr_block', target: 'irq_taken_q', value: 7 },
  { source: 'control_fsm', target: 'irq_taken_q', value: 5 },
  { source: 'xpi_core', target: 'capture_reg[0]', value: 6 },
];

const timingPathTemplates = [
  {
    from: 'u_retrosoc/u_cpu_top/u_exec/u_alu/result_q[28]/C',
    to: 'u_retrosoc/u_xpi_core/u_resp/dat_o_reg[0]/CE',
    sourceClock: 'clk_core',
    destinationClock: 'clk_bus',
  },
  {
    from: 'u_retrosoc/u_cpu_top/u_issue/u_scoreboard/ready_q[3]/C',
    to: 'u_retrosoc/u_cpu_top/u_exec/u_bypass/src_a_reg[1]/D',
    sourceClock: 'clk_core',
    destinationClock: 'clk_core',
  },
  {
    from: 'u_retrosoc/u_dma/u_desc_fifo/addr_q[17]/C',
    to: 'u_retrosoc/u_axi_fabric/u_arbiter/grant_q[2]/D',
    sourceClock: 'clk_bus',
    destinationClock: 'clk_bus',
  },
  {
    from: 'u_retrosoc/u_xpi_core/u_cmd/cmd_valid_q/C',
    to: 'u_retrosoc/u_xpi_core/u_dma/burst_len_q[5]/D',
    sourceClock: 'clk_xpi',
    destinationClock: 'clk_xpi',
  },
  {
    from: 'u_retrosoc/u_mem/u_sram_ctrl/ecc_syndrome_q[6]/C',
    to: 'u_retrosoc/u_cpu_top/u_csr/mcause_q[2]/D',
    sourceClock: 'clk_mem',
    destinationClock: 'clk_core',
  },
  {
    from: 'u_retrosoc/u_cpu_top/u_fetch/pc_q[15]/C',
    to: 'u_retrosoc/u_cpu_top/u_decode/branch_taken_q/D',
    sourceClock: 'clk_core',
    destinationClock: 'clk_core',
  },
  {
    from: 'u_retrosoc/u_axi_fabric/u_read_xbar/route_q[4]/C',
    to: 'u_retrosoc/u_mem/u_cache/refill_state_q[1]/D',
    sourceClock: 'clk_bus',
    destinationClock: 'clk_mem',
  },
  {
    from: 'u_retrosoc/u_periph/u_timer/counter_q[31]/C',
    to: 'u_retrosoc/u_cpu_top/u_irq/irq_pending_q[0]/D',
    sourceClock: 'clk_periph',
    destinationClock: 'clk_core',
  },
  {
    from: 'u_retrosoc/u_trace/u_packetizer/timestamp_q[19]/C',
    to: 'u_retrosoc/u_xpi_core/u_resp/trace_ready_q/D',
    sourceClock: 'clk_trace',
    destinationClock: 'clk_xpi',
  },
  {
    from: 'u_retrosoc/u_clock_reset/u_cdc_sync/core_req_q/C',
    to: 'u_retrosoc/u_axi_fabric/u_write_xbar/wvalid_q/D',
    sourceClock: 'clk_core',
    destinationClock: 'clk_bus',
  },
  {
    from: 'u_retrosoc/u_vector/u_lane0/mac_acc_q[23]/C',
    to: 'u_retrosoc/u_cpu_top/u_retire/wb_data_q[7]/D',
    sourceClock: 'clk_core',
    destinationClock: 'clk_core',
  },
  {
    from: 'u_retrosoc/u_dft/u_scan_chain/scan_enable_q/C',
    to: 'u_retrosoc/u_memory_subsystem/u_mbist/status_q[0]/D',
    sourceClock: 'clk_test',
    destinationClock: 'clk_mem',
  },
];

const timingRows = Array.from({ length: 36 }, (_, index) => {
  const pathIndex = index + 1;
  const template = timingPathTemplates[index % timingPathTemplates.length]!;
  const slack = 4.92 + ((index % 9) * 0.017) - (Math.floor(index / 12) * 0.081);
  const logicDelay = 1.72 + ((index % 6) * 0.083);
  const netDelay = 5.98 + ((index % 8) * 0.071);
  const totalDelay = logicDelay + netDelay;
  const requirement = totalDelay + slack;

  return {
    name: `Path ${pathIndex}`,
    slack: slack.toFixed(3),
    levels: String(9 + (index % 8)),
    highFanout: String(64 + ((index * 7) % 63)),
    from: template.from,
    to: template.to,
    totalDelay: totalDelay.toFixed(3),
    logicDelay: logicDelay.toFixed(3),
    netDelay: netDelay.toFixed(3),
    requirement: requirement.toFixed(3),
    sourceClock: template.sourceClock,
    destinationClock: template.destinationClock,
    exception: index % 11 === 0 ? 'false path' : '',
    clockUncertainty: (0.082 + ((index % 5) * 0.007)).toFixed(3),
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
  { key: 'name', label: 'Name', width: 'min-w-[76px]' },
  { key: 'slack', label: 'Slack', width: 'min-w-[64px]', numeric: true, sorted: true },
  { key: 'levels', label: 'Levels', width: 'min-w-[58px]', numeric: true },
  { key: 'highFanout', label: 'High Fanout', width: 'min-w-[78px]', numeric: true },
  { key: 'from', label: 'From', width: 'min-w-[240px]' },
  { key: 'to', label: 'To', width: 'min-w-[220px]' },
  { key: 'totalDelay', label: 'Total Delay', width: 'min-w-[82px]', numeric: true },
  { key: 'logicDelay', label: 'Logic Delay', width: 'min-w-[82px]', numeric: true },
  { key: 'netDelay', label: 'Net Delay', width: 'min-w-[76px]', numeric: true },
  { key: 'requirement', label: 'Requirement', width: 'min-w-[92px]', numeric: true },
  { key: 'sourceClock', label: 'Source Clock', width: 'min-w-[112px]' },
  { key: 'destinationClock', label: 'Destination Clock', width: 'min-w-[132px]' },
  { key: 'exception', label: 'Exception', width: 'min-w-[76px]' },
  { key: 'clockUncertainty', label: 'Clock Uncertainty', width: 'min-w-[118px]', numeric: true },
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
      chartPalette: diskUsageTreemapPalette,
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
    chartPalette: diskUsageTreemapPalette,
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
        colorMappingBy: 'id',
        visibleMin: 8,
        levels: [
          { itemStyle: { borderWidth: 0, gapWidth: 3 } },
          {
            color: palette.chartPalette,
            colorSaturation: [0.55, 0.95],
            itemStyle: { borderWidth: 2, gapWidth: 2 },
            upperLabel: { show: true },
          },
          {
            colorSaturation: [0.38, 0.72],
            itemStyle: { borderWidth: 1, gapWidth: 1 },
          },
          {
            colorSaturation: [0.25, 0.58],
            itemStyle: { borderWidth: 1, gapWidth: 1 },
          },
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
        nodeWidth: 10,
        nodeGap: 6,
        draggable: false,
        label: {
          color: palette.text,
          fontSize: 9,
        },
        lineStyle: {
          color: 'gradient',
          curveness: 0.5,
          opacity: 0.28,
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
        <Table data-testid="synthesis-timing-table" className="min-w-[1506px] border-separate border-spacing-0 text-[10.5px]">
          <TableHeader className="sticky top-0 z-10 bg-ide-tab-bg text-ide-text">
            <TableRow className="border-b border-ide-border hover:bg-ide-tab-bg">
              {timingColumns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    'h-6 border-r border-ide-border px-1.5 py-0 text-[10.5px] font-medium text-ide-text last:border-r-0',
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
                        'h-5 max-w-[240px] border-r border-ide-border/80 px-1.5 py-0 text-ide-text last:border-r-0',
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
