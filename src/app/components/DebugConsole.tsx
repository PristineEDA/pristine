export function DebugConsole() {
  const logs = [
    { type: 'info', text: 'Debug session not started' },
    { type: 'info', text: 'Set a breakpoint first, then click "Start Debugging"' },
    { type: 'hint', text: 'Tip: click in the gutter next to a line number to add a breakpoint' },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px]">
      {logs.map((log, i) => (
        <div key={i} className={`leading-6 ${
          log.type === 'info' ? 'text-blue-400' : 'text-muted-foreground'
        }`}>
          {log.text}
        </div>
      ))}
      <div className="flex items-center mt-2 text-muted-foreground">
        <span className="mr-2">&gt;</span>
        <span className="w-2 h-4 bg-foreground animate-pulse" />
      </div>
    </div>
  );
}
