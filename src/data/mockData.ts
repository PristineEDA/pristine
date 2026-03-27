export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  language?: string;
  children?: FileNode[];
  expanded?: boolean;
  hasError?: boolean;
  hasWarning?: boolean;
}

export interface Problem {
  id: string;
  file: string;
  fileId: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  code?: string;
  source?: string;
}

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

// ─── File Tree ────────────────────────────────────────────────────────────────
export const initialFileTree: FileNode[] = [
  {
    id: 'root',
    name: 'my_soc_project',
    type: 'folder',
    expanded: true,
    children: [
      {
        id: 'rtl',
        name: 'rtl',
        type: 'folder',
        expanded: true,
        children: [
          {
            id: 'core',
            name: 'core',
            type: 'folder',
            expanded: true,
            children: [
              { id: 'cpu_top', name: 'cpu_top.v', type: 'file', language: 'verilog', hasError: true },
              { id: 'alu', name: 'alu.v', type: 'file', language: 'verilog', hasWarning: true },
              { id: 'reg_file', name: 'reg_file.v', type: 'file', language: 'verilog' },
              { id: 'ctrl', name: 'ctrl_unit.v', type: 'file', language: 'verilog' },
            ],
          },
          {
            id: 'peripherals',
            name: 'peripherals',
            type: 'folder',
            expanded: false,
            children: [
              { id: 'uart_tx', name: 'uart_tx.v', type: 'file', language: 'verilog' },
              { id: 'uart_rx', name: 'uart_rx.v', type: 'file', language: 'verilog' },
              { id: 'spi_master', name: 'spi_master.v', type: 'file', language: 'verilog', hasWarning: true },
              { id: 'i2c_ctrl', name: 'i2c_ctrl.v', type: 'file', language: 'verilog' },
            ],
          },
          {
            id: 'memory',
            name: 'memory',
            type: 'folder',
            expanded: false,
            children: [
              { id: 'sram_ctrl', name: 'sram_ctrl.v', type: 'file', language: 'verilog' },
              { id: 'rom', name: 'rom.v', type: 'file', language: 'verilog' },
              { id: 'fifo', name: 'sync_fifo.v', type: 'file', language: 'verilog' },
            ],
          },
          {
            id: 'clock',
            name: 'clock',
            type: 'folder',
            expanded: false,
            children: [
              { id: 'clk_div', name: 'clk_div.v', type: 'file', language: 'verilog' },
              { id: 'pll_ctrl', name: 'pll_ctrl.v', type: 'file', language: 'verilog' },
            ],
          },
        ],
      },
      {
        id: 'tb',
        name: 'tb',
        type: 'folder',
        expanded: false,
        children: [
          { id: 'tb_cpu', name: 'tb_cpu_top.sv', type: 'file', language: 'systemverilog' },
          { id: 'tb_uart', name: 'tb_uart.sv', type: 'file', language: 'systemverilog' },
          { id: 'tb_alu', name: 'tb_alu.sv', type: 'file', language: 'systemverilog' },
        ],
      },
      {
        id: 'constraints',
        name: 'constraints',
        type: 'folder',
        expanded: false,
        children: [
          { id: 'timing', name: 'timing.xdc', type: 'file', language: 'xdc' },
          { id: 'pinout', name: 'pinout.xdc', type: 'file', language: 'xdc' },
        ],
      },
      { id: 'proj_yml', name: 'project.yml', type: 'file', language: 'yaml' },
      { id: 'readme', name: 'README.md', type: 'file', language: 'markdown' },
    ],
  },
];

// ─── Code Content ─────────────────────────────────────────────────────────────
export const fileContents: Record<string, string> = {
  uart_tx: `// =============================================================================
// Module  : uart_tx
// Project : my_soc_project
// Author  : RTL Team
// Date    : 2026-03-25
// Desc    : UART Transmitter — configurable baud rate, 8N1 frame format
// =============================================================================

module uart_tx #(
    parameter CLK_FREQ  = 100_000_000,   // System clock frequency (Hz)
    parameter BAUD_RATE = 115200         // Target baud rate
) (
    input  wire        clk,        // System clock
    input  wire        rst_n,      // Active-low asynchronous reset
    input  wire [7:0]  data_in,    // 8-bit parallel data input
    input  wire        valid_in,   // Pulse high for one cycle to load data
    output reg         tx_out,     // UART serial output line
    output wire        ready       // High when module is idle / ready
);

    // -------------------------------------------------------------------------
    // Derived parameters
    // -------------------------------------------------------------------------
    localparam BIT_PERIOD = CLK_FREQ / BAUD_RATE;
    localparam CNT_W      = $clog2(BIT_PERIOD);

    // -------------------------------------------------------------------------
    // FSM state encoding
    // -------------------------------------------------------------------------
    localparam [1:0]
        S_IDLE  = 2'b00,
        S_START = 2'b01,
        S_DATA  = 2'b10,
        S_STOP  = 2'b11;

    // -------------------------------------------------------------------------
    // Internal signals
    // -------------------------------------------------------------------------
    reg [1:0]        state, next_state;
    reg [CNT_W-1:0]  baud_cnt;
    reg [3:0]        bit_cnt;
    reg [7:0]        shift_reg;
    wire             baud_tick;

    // -------------------------------------------------------------------------
    // Baud rate generator
    // -------------------------------------------------------------------------
    assign baud_tick = (baud_cnt == CNT_W'(BIT_PERIOD - 1));

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            baud_cnt <= '0;
        else if (baud_tick || (state == S_IDLE && !valid_in))
            baud_cnt <= '0;
        else
            baud_cnt <= baud_cnt + 1'b1;
    end

    // -------------------------------------------------------------------------
    // FSM — state register
    // -------------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) state <= S_IDLE;
        else        state <= next_state;
    end

    // -------------------------------------------------------------------------
    // FSM — next-state logic (combinational)
    // -------------------------------------------------------------------------
    always @(*) begin
        next_state = state;
        case (state)
            S_IDLE  : if (valid_in)                        next_state = S_START;
            S_START : if (baud_tick)                       next_state = S_DATA;
            S_DATA  : if (baud_tick && bit_cnt == 4'd7)   next_state = S_STOP;
            S_STOP  : if (baud_tick)                       next_state = S_IDLE;
            default :                                      next_state = S_IDLE;
        endcase
    end

    // -------------------------------------------------------------------------
    // Data path — shift register & bit counter
    // -------------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            shift_reg <= 8'h00;
            bit_cnt   <= 4'd0;
        end else begin
            case (state)
                S_IDLE  : if (valid_in) shift_reg <= data_in;
                S_DATA  : if (baud_tick) begin
                              shift_reg <= {1'b0, shift_reg[7:1]};
                              bit_cnt   <= bit_cnt + 1'b1;
                          end
                S_STOP  : bit_cnt <= 4'd0;
                default : ;
            endcase
        end
    end

    // -------------------------------------------------------------------------
    // TX output mux
    // -------------------------------------------------------------------------
    always @(*) begin
        case (state)
            S_IDLE  : tx_out = 1'b1;
            S_START : tx_out = 1'b0;
            S_DATA  : tx_out = shift_reg[0];
            S_STOP  : tx_out = 1'b1;
            default : tx_out = 1'b1;
        endcase
    end

    // -------------------------------------------------------------------------
    // Output: ready flag
    // -------------------------------------------------------------------------
    assign ready = (state == S_IDLE);

endmodule
`,

  alu: `// =============================================================================
// Module  : alu
// Project : my_soc_project
// Author  : RTL Team
// Date    : 2026-03-25
// Desc    : 32-bit Arithmetic Logic Unit for RISC-V RV32I subset
// =============================================================================

module alu (
    input  wire [31:0] a,          // Operand A
    input  wire [31:0] b,          // Operand B
    input  wire [3:0]  alu_op,     // Operation select
    output reg  [31:0] result,     // ALU result
    output wire        zero,       // Zero flag
    output wire        overflow,   // Overflow flag (signed ops)
    output wire        carry_out   // Carry out (unsigned ops)
);

    // -------------------------------------------------------------------------
    // ALU operation codes
    // -------------------------------------------------------------------------
    localparam [3:0]
        ALU_ADD  = 4'b0000,   // result = a + b
        ALU_SUB  = 4'b0001,   // result = a - b
        ALU_AND  = 4'b0010,   // result = a & b
        ALU_OR   = 4'b0011,   // result = a | b
        ALU_XOR  = 4'b0100,   // result = a ^ b
        ALU_SLL  = 4'b0101,   // result = a << b[4:0]
        ALU_SRL  = 4'b0110,   // result = a >> b[4:0]  (logical)
        ALU_SRA  = 4'b0111,   // result = a >>> b[4:0] (arithmetic)
        ALU_SLT  = 4'b1000,   // result = (signed(a) < signed(b)) ? 1 : 0
        ALU_SLTU = 4'b1001,   // result = (a < b) ? 1 : 0 (unsigned)
        ALU_NOR  = 4'b1010,   // result = ~(a | b)
        ALU_PASS = 4'b1111;   // result = b (lui / auipc)

    // -------------------------------------------------------------------------
    // Intermediate signals
    // -------------------------------------------------------------------------
    wire [32:0] add_result;   // 33-bit for carry / overflow detection
    wire [32:0] sub_result;

    assign add_result = {1'b0, a} + {1'b0, b};
    assign sub_result = {1'b0, a} - {1'b0, b};

    // -------------------------------------------------------------------------
    // ALU combinational logic
    // -------------------------------------------------------------------------
    always @(*) begin
        case (alu_op)
            ALU_ADD  : result = add_result[31:0];
            ALU_SUB  : result = sub_result[31:0];
            ALU_AND  : result = a & b;
            ALU_OR   : result = a | b;
            ALU_XOR  : result = a ^ b;
            ALU_SLL  : result = a << b[4:0];
            ALU_SRL  : result = a >> b[4:0];
            ALU_SRA  : result = $signed(a) >>> b[4:0];
            ALU_SLT  : result = ($signed(a) < $signed(b)) ? 32'd1 : 32'd0;
            ALU_SLTU : result = (a < b)                  ? 32'd1 : 32'd0;
            ALU_NOR  : result = ~(a | b);
            ALU_PASS : result = b;
            default  : result = 32'hDEAD_BEEF;  // WARNING: undefined op
        endcase
    end

    // -------------------------------------------------------------------------
    // Status flags
    // -------------------------------------------------------------------------
    assign zero      = (result == 32'd0);
    assign carry_out = (alu_op == ALU_ADD) ? add_result[32] :
                       (alu_op == ALU_SUB) ? sub_result[32] : 1'b0;
    assign overflow  = (alu_op == ALU_ADD) ?
                           (~(a[31] ^ b[31]) & (a[31] ^ add_result[31])) :
                       (alu_op == ALU_SUB) ?
                           ( (a[31] ^ b[31]) & (a[31] ^ sub_result[31])) : 1'b0;

endmodule
`,

  cpu_top: `// =============================================================================
// Module  : cpu_top
// Project : my_soc_project
// Author  : RTL Team
// Date    : 2026-03-25
// Desc    : Single-cycle RV32I CPU top-level integrating all pipeline stages
// =============================================================================

module cpu_top (
    input  wire        clk,
    input  wire        rst_n,
    // Instruction memory interface
    output wire [31:0] imem_addr,
    input  wire [31:0] imem_data,
    // Data memory interface
    output wire [31:0] dmem_addr,
    output wire [31:0] dmem_wdata,
    output wire        dmem_we,
    output wire [3:0]  dmem_be,
    input  wire [31:0] dmem_rdata,
    // Interrupt
    input  wire        irq
);

    // -------------------------------------------------------------------------
    // Internal wires
    // -------------------------------------------------------------------------
    wire [31:0] pc, pc_next, pc_plus4;
    wire [31:0] instr;
    wire [31:0] rs1_data, rs2_data, rd_data;
    wire [4:0]  rs1, rs2, rd;
    wire [31:0] imm;
    wire [31:0] alu_a, alu_b, alu_out;
    wire [3:0]  alu_op;
    wire        alu_zero;
    wire        reg_wr, mem_wr, mem_rd;
    wire [1:0]  wb_sel;
    wire        branch_taken;

    // -------------------------------------------------------------------------
    // Program Counter
    // -------------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            pc <= 32'h0000_0000;
        else
            pc <= pc_next;
    end

    assign pc_plus4  = pc + 32'd4;
    assign imem_addr = pc;
    assign instr     = imem_data;

    // -------------------------------------------------------------------------
    // Instruction Decode — field extraction
    // -------------------------------------------------------------------------
    assign rs1 = instr[19:15];
    assign rs2 = instr[24:20];
    assign rd  = instr[11:7];

    // -------------------------------------------------------------------------
    // Immediate generator
    // -------------------------------------------------------------------------
    imm_gen u_imm_gen (
        .instr (instr),
        .imm   (imm)
    );

    // -------------------------------------------------------------------------
    // Control Unit
    // -------------------------------------------------------------------------
    ctrl_unit u_ctrl (
        .instr     (instr),
        .alu_op    (alu_op),
        .reg_wr    (reg_wr),
        .mem_wr    (mem_wr),
        .mem_rd    (mem_rd),
        .wb_sel    (wb_sel),
        .alu_src_b ()
    );

    // -------------------------------------------------------------------------
    // Register File
    // -------------------------------------------------------------------------
    reg_file u_regfile (
        .clk     (clk),
        .rst_n   (rst_n),
        .rs1     (rs1),
        .rs2     (rs2),
        .rd      (rd),
        .wr_en   (reg_wr),
        .wr_data (rd_data),
        .rs1_data(rs1_data),
        .rs2_data(rs2_data)
    );

    // -------------------------------------------------------------------------
    // ALU
    // -------------------------------------------------------------------------
    assign alu_a = rs1_data;
    assign alu_b = (instr[6:0] == 7'b0110011) ? rs2_data : imm;  // R-type vs I/S/B

    alu u_alu (
        .a        (alu_a),
        .b        (alu_b),
        .alu_op   (alu_op),
        .result   (alu_out),
        .zero     (alu_zero),
        .overflow (),
        .carry_out()
    );

    // -------------------------------------------------------------------------
    // Data Memory Interface
    // -------------------------------------------------------------------------
    assign dmem_addr  = alu_out;
    assign dmem_wdata = rs2_data;
    assign dmem_we    = mem_wr;
    assign dmem_be    = 4'b1111;

    // -------------------------------------------------------------------------
    // Write-back mux
    // -------------------------------------------------------------------------
    assign rd_data = (wb_sel == 2'b00) ? alu_out    :
                     (wb_sel == 2'b01) ? dmem_rdata :
                     (wb_sel == 2'b10) ? pc_plus4   : 32'hx;

    // -------------------------------------------------------------------------
    // Branch / PC-next logic
    // -------------------------------------------------------------------------
    assign branch_taken = alu_zero & (instr[6:0] == 7'b1100011);
    assign pc_next      = branch_taken ? (pc + imm) : pc_plus4;

    // Interrupt handler — TODO: implement CSR & trap
    // synthesis translate_off
    always @(posedge clk) begin
        if (irq) $display("[CPU] IRQ received at PC = 0x%08X, time = %0t", pc, $time);
    end
    // synthesis translate_on

endmodule
`,

  reg_file: `// =============================================================================
// Module  : reg_file
// Project : my_soc_project
// Desc    : 32×32 integer register file (RV32I x0–x31)
//           x0 is hardwired to zero; dual read, single write
// =============================================================================

module reg_file (
    input  wire        clk,
    input  wire        rst_n,
    // Read ports
    input  wire [4:0]  rs1,
    input  wire [4:0]  rs2,
    output wire [31:0] rs1_data,
    output wire [31:0] rs2_data,
    // Write port
    input  wire [4:0]  rd,
    input  wire        wr_en,
    input  wire [31:0] wr_data
);

    reg [31:0] regs [0:31];
    integer i;

    // Synchronous write with reset
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            for (i = 0; i < 32; i = i + 1)
                regs[i] <= 32'd0;
        end else if (wr_en && rd != 5'd0) begin
            regs[rd] <= wr_data;
        end
    end

    // Asynchronous read; x0 always returns 0
    assign rs1_data = (rs1 == 5'd0) ? 32'd0 : regs[rs1];
    assign rs2_data = (rs2 == 5'd0) ? 32'd0 : regs[rs2];

endmodule
`,
};

// ─── File Outline ─────────────────────────────────────────────────────────────
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

// ─── Problems / Diagnostics ───────────────────────────────────────────────────
export const problemsList: Problem[] = [
  {
    id: 'p1', file: 'cpu_top.v', fileId: 'cpu_top', line: 56, column: 5,
    severity: 'error',
    message: "Port 'alu_src_b' of module 'ctrl_unit' not connected",
    code: 'V001', source: 'rtl-lint',
  },
  {
    id: 'p2', file: 'cpu_top.v', fileId: 'cpu_top', line: 100, column: 12,
    severity: 'error',
    message: "Module 'imm_gen' not found in project — missing source file",
    code: 'V002', source: 'rtl-lint',
  },
  {
    id: 'p3', file: 'alu.v', fileId: 'alu', line: 51, column: 27,
    severity: 'warning',
    message: "Default branch result '32\\'hDEAD_BEEF' may propagate X-state in simulation",
    code: 'W003', source: 'rtl-lint',
  },
  {
    id: 'p4', file: 'alu.v', fileId: 'alu', line: 14, column: 4,
    severity: 'warning',
    message: "Output 'overflow' is never read by instantiating module",
    code: 'W007', source: 'rtl-lint',
  },
  {
    id: 'p5', file: 'spi_master.v', fileId: 'spi_master', line: 38, column: 1,
    severity: 'warning',
    message: 'Potential clock domain crossing: signal crosses from clk to spi_clk without synchronizer',
    code: 'W014', source: 'cdc-check',
  },
  {
    id: 'p6', file: 'uart_tx.v', fileId: 'uart_tx', line: 17, column: 15,
    severity: 'info',
    message: "'ready' can be simplified to a registered signal to improve timing",
    code: 'I021', source: 'timing-advisor',
  },
];

// ─── Static Check Results ─────────────────────────────────────────────────────
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

// ─── References ───────────────────────────────────────────────────────────────
export const references: Reference[] = [
  { id: 'r1', file: 'uart_tx.v', fileId: 'uart_tx', line: 40, column: 8, preview: '    reg [7:0]        shift_reg;', type: 'definition' },
  { id: 'r2', file: 'uart_tx.v', fileId: 'uart_tx', line: 78, column: 28, preview: '                if (valid_in) shift_reg <= data_in;', type: 'write' },
  { id: 'r3', file: 'uart_tx.v', fileId: 'uart_tx', line: 81, column: 23, preview: '                    shift_reg <= {1\'b0, shift_reg[7:1]};', type: 'write' },
  { id: 'r4', file: 'uart_tx.v', fileId: 'uart_tx', line: 87, column: 24, preview: '            S_DATA  : tx_out = shift_reg[0];', type: 'read' },
];

// ─── AI Chat Messages ─────────────────────────────────────────────────────────
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
    codeBlock: `// Key timing: baud_tick pulses high once every BIT_PERIOD clk cycles\nlocalparam BIT_PERIOD = CLK_FREQ / BAUD_RATE;  // 868 cycles @ 100MHz/115200`,
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
    codeBlock: `// 1. Add parameter\nparameter STOP_BITS = 1,  // 1 or 2\n\n// 2. Add stop bit counter\nreg stop_cnt;\n\n// 3. Modify S_STOP logic\nS_STOP: if (baud_tick) begin\n    if (stop_cnt == STOP_BITS - 1) begin\n        stop_cnt   <= 1'b0;\n        next_state <= S_IDLE;\n    end else begin\n        stop_cnt <= stop_cnt + 1'b1;\n    end\nend`,
  },
];

// ─── Terminal History ─────────────────────────────────────────────────────────
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

// ─── Output Log ───────────────────────────────────────────────────────────────
export const outputLog = [
  { time: '10:20:11', level: 'info',  text: 'RTL Analyzer v2.4.1 started' },
  { time: '10:20:11', level: 'info',  text: 'Loading project: my_soc_project' },
  { time: '10:20:12', level: 'info',  text: 'Scanning RTL sources... found 11 files' },
  { time: '10:20:13', level: 'info',  text: 'Building symbol table: uart_tx, alu, cpu_top, reg_file ...' },
  { time: '10:20:15', level: 'warn',  text: 'alu.v [L51]: Default case with X value detected' },
  { time: '10:20:15', level: 'error', text: 'cpu_top.v [L56]: Unconnected port alu_src_b' },
  { time: '10:20:16', level: 'info',  text: 'Static analysis completed: 2 errors, 3 warnings, 1 info' },
  { time: '10:21:03', level: 'info',  text: 'File saved: uart_tx.v — incremental lint pass...' },
  { time: '10:21:04', level: 'info',  text: 'uart_tx.v: no issues found' },
  { time: '10:22:44', level: 'info',  text: 'File saved: alu.v — incremental lint pass...' },
  { time: '10:22:45', level: 'warn',  text: 'alu.v [L51]: W003 — X-propagating default branch' },
];