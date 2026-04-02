const DEFAULT_LEFT_PANEL_MIN_WIDTH_PX = 232;

export function getLeftPanelTargetSizePercent(containerWidth: number, minWidthPx = DEFAULT_LEFT_PANEL_MIN_WIDTH_PX): number {
  if (containerWidth <= 0) {
    return 12;
  }

  return Math.min(35, Number(((minWidthPx / containerWidth) * 100).toFixed(2)));
}

export { DEFAULT_LEFT_PANEL_MIN_WIDTH_PX };