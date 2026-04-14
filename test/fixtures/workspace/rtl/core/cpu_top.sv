module cpu_top;
  logic data_ready;

  alu u_alu ();

  assign data_ready = 1'b1;
endmodule