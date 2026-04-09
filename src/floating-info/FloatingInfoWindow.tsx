export function FloatingInfoWindow() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div
        data-testid="floating-info-window"
        className="flex h-full w-full select-none items-center overflow-hidden border border-border/80 bg-popover text-foreground shadow-sm"
      >
        <div
          data-testid="floating-info-percent"
          className="flex h-full w-7 shrink-0 items-center justify-center border-r border-border/70 bg-muted/50 text-[10px] font-semibold leading-none"
        >
          68%
        </div>
        <div
          data-testid="floating-info-text"
          className="flex h-full min-w-0 flex-1 items-center justify-center px-1 text-[10px] font-medium leading-none"
        >
          SYNC
        </div>
      </div>
    </div>
  );
}
