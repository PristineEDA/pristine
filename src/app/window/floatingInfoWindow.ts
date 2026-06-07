export const FLOATING_INFO_WINDOW_MODES = ['collapsed', 'expanded', 'detail'] as const;

export type FloatingInfoWindowMode = typeof FLOATING_INFO_WINDOW_MODES[number];

export function isFloatingInfoWindowMode(value: unknown): value is FloatingInfoWindowMode {
  return typeof value === 'string' && FLOATING_INFO_WINDOW_MODES.includes(value as FloatingInfoWindowMode);
}
