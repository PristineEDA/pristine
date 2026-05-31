import { describe, expect, it } from 'vitest';

import rawMockWaveformData from './waveformMockData.generated.json';
import { parseWaveformDataJson } from './waveformDataLoader';

describe('waveformDataLoader', () => {
  it('parses JSON waveform data and normalizes special states', () => {
    const data = parseWaveformDataJson(rawMockWaveformData);
    const counting = data.signals.find((signal) => signal.id === 'u_top_module1-counting');
    const denseSignals = data.signals.filter((signal) => signal.groupId === 'dense_test_signals');
    const lastCountingTransition = counting?.transitions[counting.transitions.length - 1];

    expect(data.title).toBe('counter_tb');
    expect(data.groups.map((group) => group.label)).toEqual(['tb_top_module1', 'u_top_module1', 'dense_test_signals']);
    expect(data.signals).toHaveLength(48);
    expect(denseSignals).toHaveLength(40);
    expect(Math.min(...denseSignals.map((signal) => signal.transitions.length))).toBeGreaterThanOrEqual(50);
    expect(counting?.width).toBe(4);
    expect(counting?.transitions[0]?.value).toBe('x');
    expect(lastCountingTransition?.value).toBe('z');
  });

  it('rejects malformed waveform data before rendering', () => {
    const invalid = structuredClone(rawMockWaveformData) as { signals: Array<Record<string, unknown>> };
    const firstSignal = invalid.signals[0];

    expect(firstSignal).toBeDefined();

    if (!firstSignal) {
      return;
    }

    invalid.signals[0] = { ...firstSignal, color: 'cyan' };

    expect(() => parseWaveformDataJson(invalid)).toThrow('signals[0].color must be a #RRGGBB color.');
  });
});
