import { describe, expect, it } from 'vitest';
import { getLeftPanelTargetSizePercent } from './panelSizing';

describe('panelSizing', () => {
  it('calculates a responsive left panel target size from pixels', () => {
    expect(getLeftPanelTargetSizePercent(1920)).toBe(12.08);
    expect(getLeftPanelTargetSizePercent(1280)).toBe(18.13);
  });

  it('falls back safely when the container width is unavailable', () => {
    expect(getLeftPanelTargetSizePercent(0)).toBe(12);
  });

  it('clamps oversized values to the left panel maximum', () => {
    expect(getLeftPanelTargetSizePercent(400)).toBe(35);
  });
});