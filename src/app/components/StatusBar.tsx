import {
  GitBranch, AlertCircle, AlertTriangle, Bell, CheckCircle2,
  Zap,
} from 'lucide-react';
import { problemsList } from '../../data/mockData';

interface StatusBarProps {
  activeFileId: string;
  cursorLine: number;
  cursorCol: number;
}

export function StatusBar({ activeFileId, cursorLine, cursorCol }: StatusBarProps) {
  const errorCount = problemsList.filter((p) => p.severity === 'error').length;
  const warnCount = problemsList.filter((p) => p.severity === 'warning').length;

  const langMap: Record<string, string> = {
    uart_tx: 'Verilog',
    alu: 'Verilog',
    cpu_top: 'Verilog',
    reg_file: 'Verilog',
    ctrl: 'Verilog',
    tb_cpu: 'SystemVerilog',
    tb_uart: 'SystemVerilog',
    tb_alu: 'SystemVerilog',
    timing: 'XDC',
    proj_yml: 'YAML',
    readme: 'Markdown',
    spi_master: 'Verilog',
  };

  const lang = langMap[activeFileId] || 'Verilog';

  return (
    <div
      className="flex items-center h-6 bg-ide-accent text-white shrink-0 overflow-hidden select-none"
    >
      {/* Left section */}
      <div className="flex items-center h-full">
        {/* Branch */}
        <div className="flex items-center gap-1 px-2.5 h-full hover:bg-ide-status-hover cursor-pointer transition-colors">
          <GitBranch size={12} />
          <span className="text-[11px]">main</span>
        </div>
        {/* Sync */}
        <div className="flex items-center gap-1 px-2 h-full hover:bg-ide-status-hover cursor-pointer transition-colors">
          <CheckCircle2 size={11} />
          <span className="text-[11px]">Sync</span>
        </div>
        {/* Errors / Warnings */}
        <div className="flex items-center gap-2.5 px-2 h-full hover:bg-ide-status-hover cursor-pointer transition-colors">
          <div className="flex items-center gap-1">
            <AlertCircle size={11} />
            <span className="text-[11px]">{errorCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle size={11} />
            <span className="text-[11px]">{warnCount}</span>
          </div>
        </div>
        {/* Verilator status */}
        <div className="flex items-center gap-1 px-2 h-full hover:bg-ide-status-hover cursor-pointer transition-colors">
          <Zap size={11} />
          <span className="text-[11px]">Verilator 5.024</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center h-full">
        {/* Cursor position */}
        <div className="flex items-center px-2.5 h-full hover:bg-ide-status-hover cursor-pointer transition-colors">
          <span className="text-[11px]">
            Ln {cursorLine}, Col {cursorCol}
          </span>
        </div>
        {/* Indentation */}
        <div className="flex items-center px-2 h-full hover:bg-ide-status-hover cursor-pointer transition-colors">
          <span className="text-[11px]">Spaces: 4</span>
        </div>
        {/* Encoding */}
        <div className="flex items-center px-2 h-full hover:bg-ide-status-hover cursor-pointer transition-colors">
          <span className="text-[11px]">UTF-8</span>
        </div>
        {/* EOL */}
        <div className="flex items-center px-2 h-full hover:bg-ide-status-hover cursor-pointer transition-colors">
          <span className="text-[11px]">LF</span>
        </div>
        {/* Language */}
        <div className="flex items-center px-2.5 h-full hover:bg-ide-status-hover cursor-pointer transition-colors">
          <span className="text-[11px]">{lang}</span>
        </div>
        {/* Notifications */}
        <div className="flex items-center px-2 h-full hover:bg-ide-status-hover cursor-pointer transition-colors">
          <Bell size={12} />
        </div>
      </div>
    </div>
  );
}