export interface OutlineItem {
  id: string;
  name: string;
  type: 'module' | 'input' | 'output' | 'inout' | 'wire' | 'reg' | 'always' | 'fsm' | 'function' | 'task' | 'parameter' | 'localparam';
  line: number;
  detail?: string;
  children?: OutlineItem[];
  expanded?: boolean;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  codeBlock?: string;
}

export interface StaticCheckItem {
  id: string;
  rule: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  fileId: string;
  line: number;
  fixable: boolean;
}

export interface Reference {
  id: string;
  file: string;
  fileId: string;
  line: number;
  column: number;
  preview: string;
  type: 'definition' | 'read' | 'write';
}

export const fileOutlines: Record<string, OutlineItem[]> = {
  uart_tx: [
    {
      id: 'o1', name: 'uart_tx', type: 'module', line: 8, expanded: true,
      children: [
        { id: 'o1-p1', name: 'CLK_FREQ', type: 'parameter', line: 9, detail: '= 100_000_000' },
        { id: 'o1-p2', name: 'BAUD_RATE', type: 'parameter', line: 10, detail: '= 115200' },
        { id: 'o1-i1', name: 'clk', type: 'input', line: 12, detail: 'wire' },
        { id: 'o1-i2', name: 'rst_n', type: 'input', line: 13, detail: 'wire' },
        { id: 'o1-i3', name: 'data_in', type: 'input', line: 14, detail: 'wire [7:0]' },
        { id: 'o1-i4', name: 'valid_in', type: 'input', line: 15, detail: 'wire' },
        { id: 'o1-o1', name: 'tx_out', type: 'output', line: 16, detail: 'reg' },
        { id: 'o1-o2', name: 'ready', type: 'output', line: 17, detail: 'wire' },
        { id: 'o1-l1', name: 'BIT_PERIOD', type: 'localparam', line: 23, detail: 'CLK_FREQ/BAUD_RATE' },
        { id: 'o1-l2', name: 'CNT_W', type: 'localparam', line: 24, detail: '$clog2(BIT_PERIOD)' },
        {
          id: 'o1-fsm', name: 'FSM States', type: 'fsm', line: 29, expanded: true,
          children: [
            { id: 'o1-s0', name: 'S_IDLE', type: 'localparam', line: 30 },
            { id: 'o1-s1', name: 'S_START', type: 'localparam', line: 31 },
            { id: 'o1-s2', name: 'S_DATA', type: 'localparam', line: 32 },
            { id: 'o1-s3', name: 'S_STOP', type: 'localparam', line: 33 },
          ],
        },
        { id: 'o1-r1', name: 'state, next_state', type: 'reg', line: 37, detail: '[1:0]' },
        { id: 'o1-r2', name: 'baud_cnt', type: 'reg', line: 38, detail: '[CNT_W-1:0]' },
        { id: 'o1-r3', name: 'bit_cnt', type: 'reg', line: 39, detail: '[3:0]' },
        { id: 'o1-r4', name: 'shift_reg', type: 'reg', line: 40, detail: '[7:0]' },
        { id: 'o1-a1', name: 'always @(posedge clk) [baud gen]', type: 'always', line: 47 },
        { id: 'o1-a2', name: 'always @(posedge clk) [state reg]', type: 'always', line: 57 },
        { id: 'o1-a3', name: 'always @(*) [next state]', type: 'always', line: 63 },
        { id: 'o1-a4', name: 'always @(posedge clk) [datapath]', type: 'always', line: 75 },
        { id: 'o1-a5', name: 'always @(*) [tx_out mux]', type: 'always', line: 92 },
      ],
    },
  ],
  alu: [
    {
      id: 'a1', name: 'alu', type: 'module', line: 8, expanded: true,
      children: [
        { id: 'a1-i1', name: 'a', type: 'input', line: 9, detail: 'wire [31:0]' },
        { id: 'a1-i2', name: 'b', type: 'input', line: 10, detail: 'wire [31:0]' },
        { id: 'a1-i3', name: 'alu_op', type: 'input', line: 11, detail: 'wire [3:0]' },
        { id: 'a1-o1', name: 'result', type: 'output', line: 12, detail: 'reg [31:0]' },
        { id: 'a1-o2', name: 'zero', type: 'output', line: 13, detail: 'wire' },
        { id: 'a1-o3', name: 'overflow', type: 'output', line: 14, detail: 'wire' },
        { id: 'a1-o4', name: 'carry_out', type: 'output', line: 15, detail: 'wire' },
        { id: 'a1-a1', name: 'always @(*) [ALU logic]', type: 'always', line: 42 },
      ],
    },
  ],
  cpu_top: [
    {
      id: 'c1', name: 'cpu_top', type: 'module', line: 8, expanded: true,
      children: [
        { id: 'c1-i1', name: 'clk', type: 'input', line: 9 },
        { id: 'c1-i2', name: 'rst_n', type: 'input', line: 10 },
        { id: 'c1-i3', name: 'imem_addr', type: 'output', line: 12, detail: '[31:0]' },
        { id: 'c1-i4', name: 'imem_data', type: 'input', line: 13, detail: '[31:0]' },
        { id: 'c1-i5', name: 'dmem_addr', type: 'output', line: 15, detail: '[31:0]' },
        { id: 'c1-i6', name: 'irq', type: 'input', line: 21 },
        { id: 'c1-a1', name: 'always @(posedge clk) [PC reg]', type: 'always', line: 38 },
        { id: 'c1-m1', name: 'imm_gen [u_imm_gen]', type: 'module', line: 56 },
        { id: 'c1-m2', name: 'ctrl_unit [u_ctrl]', type: 'module', line: 63 },
        { id: 'c1-m3', name: 'reg_file [u_regfile]', type: 'module', line: 73 },
        { id: 'c1-m4', name: 'alu [u_alu]', type: 'module', line: 83 },
      ],
    },
  ],
};

export const staticChecks: StaticCheckItem[] = [
  {
    id: 's1', rule: 'CDC-001',
    description: 'Clock domain crossing without synchronizer detected (clk → spi_clk)',
    severity: 'critical', file: 'spi_master.v', fileId: 'spi_master', line: 38, fixable: false,
  },
  {
    id: 's2', rule: 'LINT-002',
    description: "Undriven port 'alu_src_b' left open in cpu_top instantiation",
    severity: 'high', file: 'cpu_top.v', fileId: 'cpu_top', line: 65, fixable: true,
  },
  {
    id: 's3', rule: 'LINT-005',
    description: "Default case assigns 'X' propagating value — use 32'd0 as safe default",
    severity: 'high', file: 'alu.v', fileId: 'alu', line: 51, fixable: true,
  },
  {
    id: 's4', rule: 'TIMING-003',
    description: 'Combinational path from dmem_rdata to rd_data exceeds 4ns (estimated)',
    severity: 'medium', file: 'cpu_top.v', fileId: 'cpu_top', line: 96, fixable: false,
  },
  {
    id: 's5', rule: 'STYLE-001',
    description: 'Always block missing explicit sensitivity list — use always @(*)',
    severity: 'low', file: 'reg_file.v', fileId: 'reg_file', line: 20, fixable: true,
  },
  {
    id: 's6', rule: 'RESET-001',
    description: "Signal 'baud_cnt' reset value should match localparam BIT_PERIOD-1 to avoid one-cycle slip",
    severity: 'medium', file: 'uart_tx.v', fileId: 'uart_tx', line: 47, fixable: true,
  },
];

export const references: Reference[] = [
  { id: 'r1', file: 'uart_tx.v', fileId: 'uart_tx', line: 40, column: 8, preview: '    reg [7:0]        shift_reg;', type: 'definition' },
  { id: 'r2', file: 'uart_tx.v', fileId: 'uart_tx', line: 78, column: 28, preview: '                if (valid_in) shift_reg <= data_in;', type: 'write' },
  { id: 'r3', file: 'uart_tx.v', fileId: 'uart_tx', line: 81, column: 23, preview: '                    shift_reg <= {1\'b0, shift_reg[7:1]};', type: 'write' },
  { id: 'r4', file: 'uart_tx.v', fileId: 'uart_tx', line: 87, column: 24, preview: '            S_DATA  : tx_out = shift_reg[0];', type: 'read' },
];

export const initialAIMessages: AIMessage[] = [
  {
    id: 'm1', role: 'assistant',
    content: 'Hello! I\'m your RTL development assistant. I can help you explain code, optimize circuit designs, generate testbenches, fix bugs, and answer Verilog / SystemVerilog / SpinalHDL questions.',
    timestamp: '10:21',
  },
  {
    id: 'm2', role: 'user',
    content: 'Explain the FSM state machine design in uart_tx',
    timestamp: '10:22',
  },
  {
    id: 'm3', role: 'assistant',
    content: '`uart_tx` uses a standard **Mealy/Moore hybrid** four-state FSM implementing 8N1 frame format serial transmission:\n\n• **S_IDLE** — line held high, waiting for `valid_in` to assert\n• **S_START** — sends start bit (low), lasting one bit_period\n• **S_DATA** — shifts out `shift_reg[0]` LSB-first, 8 bits total\n• **S_STOP** — sends stop bit (high), then returns to IDLE\n\nState transitions are driven by `baud_tick`, each transition lasting exactly one baud period. The `ready` signal is high in IDLE and can be used directly as a back-pressure handshake.',
    timestamp: '10:22',
    codeBlock: `// Key timing: baud_tick pulses high once every BIT_PERIOD clk cycles
localparam BIT_PERIOD = CLK_FREQ / BAUD_RATE;  // 868 cycles @ 100MHz/115200`,
  },
  {
    id: 'm4', role: 'user',
    content: 'If I want to support configurable stop bits (1 or 2), what changes are needed?',
    timestamp: '10:25',
  },
  {
    id: 'm5', role: 'assistant',
    content: 'Three modifications are required:\n\n1. **Add parameter** `STOP_BITS` (default 1)\n2. **S_STOP state** — add a counter, only transition to IDLE after `STOP_BITS` baud_ticks\n3. **Extend bit_cnt** or add a new `stop_cnt` register',
    timestamp: '10:25',
    codeBlock: `// 1. Add parameter
parameter STOP_BITS = 1,  // 1 or 2

// 2. Add stop bit counter
reg stop_cnt;

// 3. Modify S_STOP logic
S_STOP: if (baud_tick) begin
    if (stop_cnt == STOP_BITS - 1) begin
        stop_cnt   <= 1'b0;
        next_state <= S_IDLE;
    end else begin
        stop_cnt <= stop_cnt + 1'b1;
    end
end`,
  },
];

export const terminalHistory = [
  { type: 'prompt', text: 'rtl@soc-dev:~/my_soc_project$ ' },
  { type: 'cmd', text: 'make elaborate' },
  { type: 'output', text: '[INFO] Running Verilator 5.024 ...' },
  { type: 'output', text: '[INFO] Elaborating: cpu_top.v' },
  { type: 'output', text: '[INFO] Elaborating: alu.v' },
  { type: 'output', text: '[WARN] alu.v:51: Default case may produce X-state' },
  { type: 'output', text: '[ERROR] cpu_top.v:56: Port alu_src_b not connected' },
  { type: 'output', text: '[INFO] Elaboration completed with 1 error, 2 warnings' },
  { type: 'prompt', text: 'rtl@soc-dev:~/my_soc_project$ ' },
  { type: 'cmd', text: 'make sim TARGET=tb_uart' },
  { type: 'output', text: '[INFO] Compiling testbench: tb_uart.sv ...' },
  { type: 'output', text: '[INFO] Simulation started at time 0' },
  { type: 'output', text: '# [CPU] TX byte: 0x41 (A)  @ 8680ns' },
  { type: 'output', text: '# [CPU] TX byte: 0x42 (B)  @ 17360ns' },
  { type: 'output', text: '# [CPU] TX byte: 0x43 (C)  @ 26040ns' },
  { type: 'output', text: '# All 3 bytes verified OK' },
  { type: 'output', text: '[INFO] Simulation completed. Total time: 100us' },
  { type: 'prompt', text: 'rtl@soc-dev:~/my_soc_project$ ' },
];

export const outputLog = [
  { time: '10:20:11', level: 'info', text: 'RTL Analyzer v2.4.1 started' },
  { time: '10:20:11', level: 'info', text: 'Loading project: my_soc_project' },
  { time: '10:20:12', level: 'info', text: 'Scanning RTL sources... found 11 files' },
  { time: '10:20:13', level: 'info', text: 'Building symbol table: uart_tx, alu, cpu_top, reg_file ...' },
  { time: '10:20:15', level: 'warn', text: 'alu.v [L51]: Default case with X value detected' },
  { time: '10:20:15', level: 'error', text: 'cpu_top.v [L56]: Unconnected port alu_src_b' },
  { time: '10:20:16', level: 'info', text: 'Static analysis completed: 2 errors, 3 warnings, 1 info' },
  { time: '10:21:03', level: 'info', text: 'File saved: uart_tx.v — incremental lint pass...' },
  { time: '10:21:04', level: 'info', text: 'uart_tx.v: no issues found' },
  { time: '10:22:44', level: 'info', text: 'File saved: alu.v — incremental lint pass...' },
  { time: '10:22:45', level: 'warn', text: 'alu.v [L51]: W003 — X-propagating default branch' },
];
