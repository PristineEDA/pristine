import type { WaveformDataSet, WaveformSignal } from './waveformTypes';

const mockDuration = 200;

function makeClockTransitions(period: number, initialValue: '0' | '1' = '0') {
  const transitions: { time: number; value: string }[] = [];
  let value = initialValue;

  for (let time = 0; time <= mockDuration; time += period / 2) {
    transitions.push({ time, value });
    value = value === '0' ? '1' : '0';
  }

  return transitions;
}

const signals: WaveformSignal[] = [
  {
    id: 'tb_top_module1-clk',
    groupId: 'tb_top_module1',
    name: 'clk',
    path: 'tb_top_module1.clk',
    kind: 'clock',
    color: '#38d8ff',
    transitions: makeClockTransitions(20),
  },
  {
    id: 'tb_top_module1-data',
    groupId: 'tb_top_module1',
    name: 'data',
    path: 'tb_top_module1.data',
    kind: 'logic',
    color: '#5ee37c',
    transitions: [
      { time: 0, value: '0' },
      { time: 45, value: '1' },
      { time: 70, value: '0' },
      { time: 82, value: '1' },
      { time: 96, value: '0' },
      { time: 156, value: '1' },
      { time: 176, value: '0' },
    ],
  },
  {
    id: 'tb_top_module1-reset',
    groupId: 'tb_top_module1',
    name: 'reset',
    path: 'tb_top_module1.reset',
    kind: 'logic',
    color: '#ffcb6b',
    transitions: [
      { time: 0, value: '1' },
      { time: 18, value: '0' },
    ],
  },
  {
    id: 'tb_top_module1-done_counting',
    groupId: 'tb_top_module1',
    name: 'done_counting',
    path: 'tb_top_module1.done_counting',
    kind: 'logic',
    color: '#ac8dff',
    transitions: [
      { time: 0, value: '0' },
      { time: 142, value: '1' },
      { time: 182, value: '0' },
    ],
  },
  {
    id: 'u_top_module1-clk',
    groupId: 'u_top_module1',
    name: 'clk',
    path: 'tb_top_module1.u_top_module1.clk',
    kind: 'clock',
    color: '#ffe66d',
    transitions: makeClockTransitions(20),
  },
  {
    id: 'u_top_module1-shift_ena',
    groupId: 'u_top_module1',
    name: 'shift_ena',
    path: 'tb_top_module1.u_top_module1.shift_ena',
    kind: 'logic',
    color: '#7bdff2',
    transitions: [
      { time: 0, value: 'x' },
      { time: 10, value: '0' },
      { time: 82, value: '1' },
      { time: 128, value: '0' },
    ],
  },
  {
    id: 'u_top_module1-done',
    groupId: 'u_top_module1',
    name: 'done',
    path: 'tb_top_module1.u_top_module1.done',
    kind: 'logic',
    color: '#f78c6c',
    transitions: [
      { time: 0, value: 'x' },
      { time: 10, value: '0' },
      { time: 148, value: '1' },
    ],
  },
  {
    id: 'u_top_module1-counting',
    groupId: 'u_top_module1',
    name: 'counting',
    path: 'tb_top_module1.u_top_module1.counting',
    kind: 'bus',
    width: 4,
    color: '#88f7a6',
    transitions: [
      { time: 0, value: 'x' },
      { time: 10, value: '0' },
      { time: 52, value: '1' },
      { time: 82, value: '2' },
      { time: 112, value: '3' },
      { time: 142, value: '4' },
      { time: 172, value: '5' },
    ],
  },
];

export const mockWaveformData: WaveformDataSet = {
  id: 'counter-waveform-mock',
  title: 'counter_tb',
  timescaleUnit: 'ns',
  duration: mockDuration,
  cursorTime: 84,
  groups: [
    { id: 'tb_top_module1', label: 'tb_top_module1' },
    { id: 'u_top_module1', label: 'u_top_module1' },
  ],
  signals,
};
