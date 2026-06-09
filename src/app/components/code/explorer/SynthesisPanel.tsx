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
  '#5f627f',
  '#ff8128',
  '#18a6c8',
  '#f6cc19',
  '#62c7a8',
  '#5875d9',
  '#b9d73a',
  '#f2366d',
  '#8a70bd',
];

const timingSankeyPalette = [
  '#d8cf23',
  '#a8db2d',
  '#8aa662',
  '#7f93bd',
  '#6c5a70',
  '#b47a57',
  '#35c18f',
  '#ffc400',
  '#8aa279',
  '#2f79d6',
  '#ff8b32',
  '#5bbfcd',
  '#a2bf2e',
  '#716179',
  '#9f6b48',
  '#4f77d5',
  '#2db8a4',
  '#f2d33b',
  '#8b79c8',
  '#ef4e86',
  '#6f8f62',
  '#d56a2b',
  '#64c8e6',
  '#9a8fdb',
];

interface TreemapNode {
  children?: TreemapNode[];
  itemStyle?: {
    color?: string;
  };
  name: string;
  value?: number;
}

function normalizeHexChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mixHexColor(hexColor: string, target: [number, number, number], amount: number) {
  const normalizedHex = hexColor.replace('#', '');
  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  const nextRed = normalizeHexChannel(red + ((target[0] - red) * amount));
  const nextGreen = normalizeHexChannel(green + ((target[1] - green) * amount));
  const nextBlue = normalizeHexChannel(blue + ((target[2] - blue) * amount));

  return `#${[nextRed, nextGreen, nextBlue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function createTreemapFamilyColor(baseColor: string, depth: number, index: number) {
  const familySteps = [-0.04, -0.18, 0.12, -0.28, 0.04, -0.12, 0.18, -0.22];
  const step = (familySteps[index % familySteps.length] ?? 0) - (depth * 0.03);

  if (step >= 0) {
    return mixHexColor(baseColor, [255, 255, 255], Math.min(0.34, step));
  }

  return mixHexColor(baseColor, [0, 0, 0], Math.min(0.42, Math.abs(step)));
}

function applyTreemapColorFamilies(nodes: TreemapNode[], familyColor?: string, depth = 0): TreemapNode[] {
  return nodes.map((node, index) => {
    const baseColor = familyColor ?? node.itemStyle?.color ?? diskUsageTreemapPalette[index % diskUsageTreemapPalette.length]!;
    const color = depth === 0 ? baseColor : createTreemapFamilyColor(baseColor, depth, index);
    const children = node.children ? applyTreemapColorFamilies(node.children, baseColor, depth + 1) : undefined;

    return {
      ...node,
      itemStyle: {
        ...node.itemStyle,
        color,
      },
      ...(children ? { children } : {}),
    };
  });
}

const moduleCellTree: TreemapNode[] = [
  {
    name: 'retroSoC',
    value: 72_900,
    children: [
      {
        name: 'Compute',
        value: 28_400,
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
        value: 14_200,
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
        value: 10_900,
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
        value: 8_600,
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
        value: 4_100,
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
        value: 3_000,
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
        value: 2_000,
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
        value: 1_700,
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

const moduleCellTreemapData = moduleCellTree[0]?.children ?? moduleCellTree;
const coloredModuleCellTreemapData = applyTreemapColorFamilies(moduleCellTreemapData);

const timingSankeyNodes = [
  { name: 'core_launch_regs' },
  { name: 'csr_state_q' },
  { name: 'dma_req_q' },
  { name: 'xpi_cmd_q' },
  { name: 'irq_pending_q' },
  { name: 'timer_tick_q' },
  { name: 'trace_timestamp_q' },
  { name: 'scan_enable_q' },
  { name: 'decode_unit' },
  { name: 'control_fsm' },
  { name: 'issue_mux' },
  { name: 'csr_block' },
  { name: 'execute_cluster' },
  { name: 'branch_unit' },
  { name: 'bypass_mux' },
  { name: 'interconnect_grid' },
  { name: 'axi_address_path' },
  { name: 'fabric_arbiter' },
  { name: 'xpi_core' },
  { name: 'xpi_dma' },
  { name: 'memory_path' },
  { name: 'sram_ctrl' },
  { name: 'cdc_sync' },
  { name: 'Timing Losses' },
  { name: 'capture_reg_bank' },
  { name: 'resp_valid_q' },
  { name: 'xpi_done_q' },
  { name: 'irq_taken_q' },
  { name: 'debug_trace_q' },
  { name: 'scan_status_q' },
  { name: 'coverage_tap_q' },
  { name: 'clock_gate_q' },
  { name: 'mbist_done_q' },
];

const timingSankeyLinks = [
  { source: 'core_launch_regs', target: 'decode_unit', value: 112 },
  { source: 'core_launch_regs', target: 'execute_cluster', value: 34 },
  { source: 'csr_state_q', target: 'control_fsm', value: 28 },
  { source: 'csr_state_q', target: 'csr_block', value: 18 },
  { source: 'dma_req_q', target: 'interconnect_grid', value: 44 },
  { source: 'dma_req_q', target: 'fabric_arbiter', value: 22 },
  { source: 'xpi_cmd_q', target: 'xpi_core', value: 40 },
  { source: 'xpi_cmd_q', target: 'xpi_dma', value: 18 },
  { source: 'irq_pending_q', target: 'control_fsm', value: 16 },
  { source: 'timer_tick_q', target: 'csr_block', value: 12 },
  { source: 'trace_timestamp_q', target: 'debug_trace_q', value: 10 },
  { source: 'scan_enable_q', target: 'scan_status_q', value: 8 },
  { source: 'decode_unit', target: 'issue_mux', value: 86 },
  { source: 'decode_unit', target: 'branch_unit', value: 22 },
  { source: 'decode_unit', target: 'Timing Losses', value: 26 },
  { source: 'control_fsm', target: 'issue_mux', value: 22 },
  { source: 'control_fsm', target: 'csr_block', value: 13 },
  { source: 'control_fsm', target: 'irq_taken_q', value: 9 },
  { source: 'issue_mux', target: 'execute_cluster', value: 92 },
  { source: 'issue_mux', target: 'bypass_mux', value: 18 },
  { source: 'csr_block', target: 'execute_cluster', value: 20 },
  { source: 'csr_block', target: 'coverage_tap_q', value: 7 },
  { source: 'execute_cluster', target: 'bypass_mux', value: 70 },
  { source: 'execute_cluster', target: 'interconnect_grid', value: 42 },
  { source: 'execute_cluster', target: 'Timing Losses', value: 48 },
  { source: 'branch_unit', target: 'bypass_mux', value: 18 },
  { source: 'branch_unit', target: 'Timing Losses', value: 8 },
  { source: 'bypass_mux', target: 'capture_reg_bank', value: 42 },
  { source: 'bypass_mux', target: 'interconnect_grid', value: 44 },
  { source: 'bypass_mux', target: 'Timing Losses', value: 24 },
  { source: 'interconnect_grid', target: 'axi_address_path', value: 46 },
  { source: 'interconnect_grid', target: 'fabric_arbiter', value: 34 },
  { source: 'interconnect_grid', target: 'xpi_core', value: 22 },
  { source: 'interconnect_grid', target: 'Timing Losses', value: 96 },
  { source: 'axi_address_path', target: 'memory_path', value: 28 },
  { source: 'axi_address_path', target: 'Timing Losses', value: 14 },
  { source: 'fabric_arbiter', target: 'xpi_core', value: 28 },
  { source: 'fabric_arbiter', target: 'memory_path', value: 18 },
  { source: 'fabric_arbiter', target: 'Timing Losses', value: 18 },
  { source: 'xpi_core', target: 'xpi_dma', value: 34 },
  { source: 'xpi_core', target: 'resp_valid_q', value: 14 },
  { source: 'xpi_core', target: 'Timing Losses', value: 52 },
  { source: 'xpi_dma', target: 'memory_path', value: 22 },
  { source: 'xpi_dma', target: 'xpi_done_q', value: 16 },
  { source: 'xpi_dma', target: 'Timing Losses', value: 20 },
  { source: 'memory_path', target: 'sram_ctrl', value: 34 },
  { source: 'memory_path', target: 'cdc_sync', value: 14 },
  { source: 'memory_path', target: 'Timing Losses', value: 64 },
  { source: 'sram_ctrl', target: 'capture_reg_bank', value: 24 },
  { source: 'sram_ctrl', target: 'mbist_done_q', value: 7 },
  { source: 'sram_ctrl', target: 'Timing Losses', value: 18 },
  { source: 'cdc_sync', target: 'clock_gate_q', value: 10 },
  { source: 'cdc_sync', target: 'Timing Losses', value: 8 },
  { source: 'trace_timestamp_q', target: 'Timing Losses', value: 4 },
  { source: 'scan_enable_q', target: 'Timing Losses', value: 5 },
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
  {
    from: 'u_retrosoc/u_crypto/u_aes/round_state_q[5]/C',
    to: 'u_retrosoc/u_cpu_top/u_csr/mstatus_q[1]/D',
    sourceClock: 'clk_core',
    destinationClock: 'clk_core',
  },
  {
    from: 'u_retrosoc/u_noc/u_vc_allocator/credit_q[2]/C',
    to: 'u_retrosoc/u_axi_fabric/u_read_xbar/rready_q/D',
    sourceClock: 'clk_bus',
    destinationClock: 'clk_bus',
  },
  {
    from: 'u_retrosoc/u_pad_ring/u_input_cells/gpio_i_q[12]/C',
    to: 'u_retrosoc/u_periph/u_gpio/edge_detect_q[3]/D',
    sourceClock: 'clk_io',
    destinationClock: 'clk_periph',
  },
  {
    from: 'u_retrosoc/u_pll_adapter/lock_sync_q/C',
    to: 'u_retrosoc/u_clock_reset/u_reset_tree/core_rst_q/D',
    sourceClock: 'clk_ref',
    destinationClock: 'clk_core',
  },
  {
    from: 'u_retrosoc/u_cache/u_miss_queue/miss_addr_q[9]/C',
    to: 'u_retrosoc/u_memory_subsystem/u_ecc/ecc_decode_q[4]/D',
    sourceClock: 'clk_mem',
    destinationClock: 'clk_mem',
  },
  {
    from: 'u_retrosoc/u_assertion_taps/protocol_seen_q/C',
    to: 'u_retrosoc/u_coverage/u_bins/path_hit_q[6]/D',
    sourceClock: 'clk_core',
    destinationClock: 'clk_core',
  },
];

const timingRows = Array.from({ length: 100 }, (_, index) => {
  const pathIndex = index + 1;
  const template = timingPathTemplates[index % timingPathTemplates.length]!;
  const slack = 4.92 + ((index % 11) * 0.017) - (Math.floor(index / 20) * 0.073);
  const logicDelay = 1.72 + ((index % 7) * 0.077) + (Math.floor(index / 25) * 0.018);
  const netDelay = 5.98 + ((index % 9) * 0.064) + (Math.floor(index / 30) * 0.022);
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
  sankeyPalette: string[];
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
      sankeyPalette: timingSankeyPalette,
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
    sankeyPalette: timingSankeyPalette,
    success,
    text: readCssColor(styles, '--ide-text', '#e5e7eb'),
    warning,
  };
}

const treemapLabelTextStyle = {
  color: '#ffffff',
  textBorderColor: 'rgba(0, 0, 0, 0.58)',
  textBorderWidth: 2,
};

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
        name: 'retroSoC',
        data: coloredModuleCellTreemapData,
        roam: true,
        scaleLimit: {
          min: 0.72,
          max: 4,
        },
        leafDepth: 2,
        nodeClick: 'zoomToNode',
        breadcrumb: {
          show: true,
          height: 18,
          top: 4,
          itemStyle: {
            color: palette.panel,
            borderColor: palette.border,
            textStyle: { color: '#ffffff', fontSize: 10 },
          },
        },
        label: {
          show: true,
          fontSize: 11,
          formatter: '{b}',
          ...treemapLabelTextStyle,
        },
        upperLabel: {
          show: true,
          height: 18,
          fontSize: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.20)',
          ...treemapLabelTextStyle,
        },
        itemStyle: {
          borderColor: '#555',
          borderWidth: 4,
          gapWidth: 4,
        },
        colorMappingBy: 'index',
        visibleMin: 300,
        levels: [
          {
            itemStyle: {
              borderColor: '#555',
              borderWidth: 4,
              gapWidth: 4,
            },
          },
          {
            color: palette.chartPalette,
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
        ],
      },
    ],
  };
}

function createSankeyOption(palette: ThemePalette): EChartsCoreOption {
  return {
    color: palette.sankeyPalette,
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
        left: 8,
        top: 8,
        right: 44,
        bottom: 8,
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
                description="retroSoC"
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
