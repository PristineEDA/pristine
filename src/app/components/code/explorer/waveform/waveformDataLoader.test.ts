import { describe, expect, it } from 'vitest';

import { parseWaveformDataJson } from './waveformDataLoader';

describe('waveformDataLoader', () => {
  it('parses JSON waveform data and normalizes special states', () => {
    const data = parseWaveformDataJson(createJsonFixture());
    const bus = data.signals.find((signal) => signal.id === 'bus');
    const busTransitions = bus?.transitions ?? [];
    const lastBusTransition = busTransitions[busTransitions.length - 1];

    expect(data.title).toBe('json-fixture');
    expect(data.groups.map((group) => group.label)).toEqual(['top']);
    expect(data.signals).toHaveLength(2);
    expect(bus?.width).toBe(8);
    expect(busTransitions[0]?.value).toBe('x');
    expect(lastBusTransition?.value).toBe('z');
  });

  it('rejects malformed waveform data before rendering', () => {
    const invalid = structuredClone(createJsonFixture()) as { signals: Array<Record<string, unknown>> };
    const firstSignal = invalid.signals[0];

    expect(firstSignal).toBeDefined();

    if (!firstSignal) {
      return;
    }

    invalid.signals[0] = { ...firstSignal, color: 'cyan' };

    expect(() => parseWaveformDataJson(invalid)).toThrow('signals[0].color must be a #RRGGBB color.');
  });
});

function createJsonFixture() {
  return {
    id: 'json-fixture',
    title: 'json-fixture',
    timescaleUnit: 'ns',
    duration: 100,
    cursorTime: 20,
    groups: [{ id: 'top', label: 'top' }],
    signals: [
      {
        id: 'clk',
        groupId: 'top',
        name: 'clk',
        path: 'top.clk',
        kind: 'clock',
        color: '#38d68c',
        transitions: [
          { time: 0, value: '0' },
          { time: 10, value: '1' },
        ],
      },
      {
        id: 'bus',
        groupId: 'top',
        name: 'bus',
        path: 'top.bus',
        kind: 'bus',
        color: '#6ee7b7',
        width: 8,
        transitions: [
          { time: 0, value: 'X' },
          { time: 25, value: 'a5' },
          { time: 75, value: 'Z' },
        ],
      },
    ],
  };
}
