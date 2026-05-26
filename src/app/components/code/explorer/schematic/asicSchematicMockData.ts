import type { AsicModule, AsicPort, AsicSchematicGraph } from './asicSchematicTypes';

const clockResetPorts: AsicPort[] = [
  { id: 'clk', name: 'clk', direction: 'input' },
  { id: 'rst_n', name: 'rst_n', direction: 'input' },
];

export const mockAsicSchematicGraph: AsicSchematicGraph = {
  rootModuleId: 'soc_top',
  modules: {
    soc_top: {
      id: 'soc_top',
      name: 'soc_top',
      description: 'Top-level ASIC integration shell with CPU, memory subsystem, fabric, and IO bridge.',
      ports: [
        ...clockResetPorts,
        { id: 'irq', name: 'irq[7:0]', direction: 'input', width: 8 },
        { id: 'gpio_i', name: 'gpio_i[15:0]', direction: 'input', width: 16 },
        { id: 'gpio_o', name: 'gpio_o[15:0]', direction: 'output', width: 16 },
        { id: 'axi_m', name: 'axi_m', direction: 'inout', width: 128 },
      ],
      instances: [
        { id: 'u_cpu', name: 'u_cpu', moduleId: 'cpu_cluster', role: 'RISC-V cluster' },
        { id: 'u_sram', name: 'u_sram', moduleId: 'sram_bank', role: 'Local SRAM' },
        { id: 'u_dma', name: 'u_dma', moduleId: 'dma_engine', role: 'DMA engine' },
        { id: 'u_fabric', name: 'u_fabric', moduleId: 'noc_fabric', role: 'NoC fabric' },
        { id: 'u_axi', name: 'u_axi', moduleId: 'axi_bridge', role: 'AXI bridge' },
        { id: 'u_gpio', name: 'u_gpio', moduleId: 'gpio_ctrl', role: 'GPIO controller' },
      ],
      nets: [
        { id: 'clk_tree', name: 'clk', from: { portId: 'clk' }, to: [{ instanceId: 'u_cpu', portId: 'clk' }, { instanceId: 'u_sram', portId: 'clk' }, { instanceId: 'u_dma', portId: 'clk' }, { instanceId: 'u_fabric', portId: 'clk' }, { instanceId: 'u_axi', portId: 'clk' }, { instanceId: 'u_gpio', portId: 'clk' }], kind: 'clock' },
        { id: 'reset_tree', name: 'rst_n', from: { portId: 'rst_n' }, to: [{ instanceId: 'u_cpu', portId: 'rst_n' }, { instanceId: 'u_sram', portId: 'rst_n' }, { instanceId: 'u_dma', portId: 'rst_n' }, { instanceId: 'u_fabric', portId: 'rst_n' }, { instanceId: 'u_gpio', portId: 'rst_n' }], kind: 'reset' },
        { id: 'cpu_imem', name: 'i_bus', from: { instanceId: 'u_cpu', portId: 'i_bus' }, to: [{ instanceId: 'u_fabric', portId: 'cpu_i' }], kind: 'bus' },
        { id: 'cpu_dmem', name: 'd_bus', from: { instanceId: 'u_cpu', portId: 'd_bus' }, to: [{ instanceId: 'u_fabric', portId: 'cpu_d' }], kind: 'bus' },
        { id: 'fabric_sram', name: 'sram_bus', from: { instanceId: 'u_fabric', portId: 'sram_m' }, to: [{ instanceId: 'u_sram', portId: 'bus' }], kind: 'data' },
        { id: 'dma_to_fabric', name: 'dma_m', from: { instanceId: 'u_dma', portId: 'bus_m' }, to: [{ instanceId: 'u_fabric', portId: 'dma_s' }], kind: 'bus' },
        { id: 'fabric_axi', name: 'axi_stream', from: { instanceId: 'u_fabric', portId: 'axi_m' }, to: [{ instanceId: 'u_axi', portId: 'fabric_s' }], kind: 'bus' },
        { id: 'axi_out', name: 'axi_m', from: { instanceId: 'u_axi', portId: 'axi_m' }, to: [{ portId: 'axi_m' }], kind: 'bus' },
        { id: 'irq_to_cpu', name: 'irq', from: { portId: 'irq' }, to: [{ instanceId: 'u_cpu', portId: 'irq' }], kind: 'control' },
        { id: 'gpio_in', name: 'gpio_i', from: { portId: 'gpio_i' }, to: [{ instanceId: 'u_gpio', portId: 'gpio_i' }], kind: 'data' },
        { id: 'gpio_out', name: 'gpio_o', from: { instanceId: 'u_gpio', portId: 'gpio_o' }, to: [{ portId: 'gpio_o' }], kind: 'data' },
        { id: 'gpio_bus', name: 'apb_gpio', from: { instanceId: 'u_fabric', portId: 'periph_m' }, to: [{ instanceId: 'u_gpio', portId: 'apb_s' }], kind: 'bus' },
      ],
    },
    cpu_cluster: {
      id: 'cpu_cluster',
      name: 'cpu_cluster',
      description: 'Five-stage CPU pipeline with local control and memory bus interfaces.',
      ports: [
        ...clockResetPorts,
        { id: 'irq', name: 'irq[7:0]', direction: 'input', width: 8 },
        { id: 'i_bus', name: 'i_bus', direction: 'output', width: 64 },
        { id: 'd_bus', name: 'd_bus', direction: 'output', width: 64 },
      ],
      instances: [
        { id: 'u_fetch', name: 'u_fetch', moduleId: 'fetch_stage', role: 'Fetch' },
        { id: 'u_decode', name: 'u_decode', moduleId: 'decode_stage', role: 'Decode' },
        { id: 'u_regfile', name: 'u_regfile', moduleId: 'regfile', role: 'Register file' },
        { id: 'u_execute', name: 'u_execute', moduleId: 'execute_stage', role: 'Execute' },
        { id: 'u_lsu', name: 'u_lsu', moduleId: 'load_store_unit', role: 'Load/store' },
      ],
      nets: [
        { id: 'clk_cpu', name: 'clk', from: { portId: 'clk' }, to: [{ instanceId: 'u_fetch', portId: 'clk' }, { instanceId: 'u_decode', portId: 'clk' }, { instanceId: 'u_regfile', portId: 'clk' }, { instanceId: 'u_execute', portId: 'clk' }, { instanceId: 'u_lsu', portId: 'clk' }], kind: 'clock' },
        { id: 'rst_cpu', name: 'rst_n', from: { portId: 'rst_n' }, to: [{ instanceId: 'u_fetch', portId: 'rst_n' }, { instanceId: 'u_decode', portId: 'rst_n' }, { instanceId: 'u_execute', portId: 'rst_n' }], kind: 'reset' },
        { id: 'pc_to_fetch', name: 'next_pc', from: { instanceId: 'u_execute', portId: 'branch_pc' }, to: [{ instanceId: 'u_fetch', portId: 'next_pc' }], kind: 'control' },
        { id: 'instr_bus', name: 'instr', from: { instanceId: 'u_fetch', portId: 'instr' }, to: [{ instanceId: 'u_decode', portId: 'instr' }], kind: 'data' },
        { id: 'decode_rs', name: 'rs_addr', from: { instanceId: 'u_decode', portId: 'rs_addr' }, to: [{ instanceId: 'u_regfile', portId: 'rs_addr' }], kind: 'control' },
        { id: 'reg_operands', name: 'operands', from: { instanceId: 'u_regfile', portId: 'rs_data' }, to: [{ instanceId: 'u_execute', portId: 'operands' }], kind: 'data' },
        { id: 'alu_result', name: 'alu_result', from: { instanceId: 'u_execute', portId: 'result' }, to: [{ instanceId: 'u_lsu', portId: 'addr' }, { instanceId: 'u_regfile', portId: 'wr_data' }], kind: 'data' },
        { id: 'lsu_bus', name: 'd_bus', from: { instanceId: 'u_lsu', portId: 'd_bus' }, to: [{ portId: 'd_bus' }], kind: 'bus' },
        { id: 'fetch_bus', name: 'i_bus', from: { instanceId: 'u_fetch', portId: 'i_bus' }, to: [{ portId: 'i_bus' }], kind: 'bus' },
        { id: 'irq_ctrl', name: 'irq', from: { portId: 'irq' }, to: [{ instanceId: 'u_execute', portId: 'irq' }], kind: 'control' },
      ],
    },
    fetch_stage: leafModule('fetch_stage', 'fetch_stage', 'Instruction fetch and branch target selection.', ['clk', 'rst_n', 'next_pc'], ['instr', 'i_bus']),
    decode_stage: leafModule('decode_stage', 'decode_stage', 'Instruction decode, immediate extraction, and hazard flags.', ['clk', 'rst_n', 'instr'], ['rs_addr']),
    regfile: leafModule('regfile', 'regfile', 'Dual-read, single-write register file.', ['clk', 'rs_addr', 'wr_data'], ['rs_data']),
    execute_stage: leafModule('execute_stage', 'execute_stage', 'ALU, branch compare, and writeback selection.', ['clk', 'rst_n', 'operands', 'irq'], ['result', 'branch_pc']),
    load_store_unit: leafModule('load_store_unit', 'load_store_unit', 'Load/store alignment and memory bus command generation.', ['clk', 'rst_n', 'addr'], ['d_bus']),
    sram_bank: leafModule('sram_bank', 'sram_bank', 'Banked SRAM macro wrapper with parity check.', ['clk', 'rst_n', 'bus'], ['rdata']),
    dma_engine: leafModule('dma_engine', 'dma_engine', 'Scatter-gather DMA command streamer.', ['clk', 'rst_n'], ['bus_m']),
    noc_fabric: leafModule('noc_fabric', 'noc_fabric', 'Lightweight crossbar between CPU, DMA, SRAM, peripherals, and AXI.', ['clk', 'rst_n', 'cpu_i', 'cpu_d', 'dma_s'], ['sram_m', 'axi_m', 'periph_m']),
    axi_bridge: leafModule('axi_bridge', 'axi_bridge', 'Protocol bridge from internal fabric to external AXI.', ['clk', 'rst_n', 'fabric_s'], ['axi_m']),
    gpio_ctrl: leafModule('gpio_ctrl', 'gpio_ctrl', 'APB controlled GPIO block with interrupt-ready synchronizers.', ['clk', 'rst_n', 'gpio_i', 'apb_s'], ['gpio_o']),
  },
};

function leafModule(
  id: string,
  name: string,
  description: string,
  inputs: readonly string[],
  outputs: readonly string[],
): AsicModule {
  return {
    id,
    name,
    description,
    ports: [
      ...inputs.map((portId) => ({ id: portId, name: portId.replace(/_/g, ' '), direction: 'input' as const })),
      ...outputs.map((portId) => ({ id: portId, name: portId.replace(/_/g, ' '), direction: 'output' as const })),
    ],
    instances: [],
    nets: [],
  };
}
