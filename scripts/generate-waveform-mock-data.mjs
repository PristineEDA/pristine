import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..');
const targetPath = path.join(
  workspaceRoot,
  'src',
  'app',
  'components',
  'code',
  'explorer',
  'waveform',
  'waveformMockData.generated.json',
);

const mockDuration = 200;
const denseSignalCount = 160;
const denseSignalColors = [
  '#2dd4bf',
  '#22c55e',
  '#84cc16',
  '#eab308',
  '#f97316',
  '#fb7185',
  '#a78bfa',
  '#60a5fa',
  '#38bdf8',
  '#34d399',
];

function makeClockTransitions(period, initialValue = '0') {
  const transitions = [];
  let value = initialValue;

  for (let time = 0; time <= mockDuration; time += period / 2) {
    transitions.push({ time, value });
    value = value === '0' ? '1' : '0';
  }

  return transitions;
}

function makeDenseTransitions(index, kind) {
  const transitions = [];
  let time = 0;
  let value = index % 3 === 0 && kind !== 'clock' ? 'x' : String(index % 2);

  transitions.push({ time, value });

  for (let stepIndex = 1; time < mockDuration; stepIndex += 1) {
    const step = getDenseTransitionStep(index, stepIndex, kind);
    time = Number(Math.min(mockDuration, time + step).toFixed(3));

    if (kind === 'clock') {
      value = value === '1' ? '0' : '1';
    } else if (kind === 'bus') {
      if (stepIndex % 41 === 0) {
        value = 'z';
      } else if (stepIndex % 23 === 0) {
        value = 'x';
      } else {
        value = ((stepIndex * (index + 5) + index * 13) % 4096).toString(16);
      }
    } else if (stepIndex % 53 === 0) {
      value = 'z';
    } else if (stepIndex % 37 === 0) {
      value = 'x';
    } else {
      value = String((stepIndex + index) % 2);
    }

    transitions.push({ time, value });
  }

  return transitions;
}

function getDenseTransitionStep(index, stepIndex, kind) {
  const base = kind === 'clock' ? 0.42 : kind === 'bus' ? 0.58 : 0.5;
  const burstScale = index % 7 === 0 && stepIndex % 17 < 8 ? 0.58 : 1;
  const jitter = ((index * 17 + stepIndex * 11) % 9) * 0.055;
  const drift = ((index + stepIndex) % 5) * 0.13;

  return Math.max(0.18, base * burstScale + jitter + drift);
}

function makeDenseSignals() {
  return Array.from({ length: denseSignalCount }, (_, offset) => {
    const number = String(offset + 1).padStart(2, '0');
    const globalIndex = offset + 1;
    const kind = offset % 5 === 0 ? 'bus' : offset % 4 === 0 ? 'clock' : 'logic';
    const signal = {
      id: `dense-signal-${number}`,
      groupId: 'dense_test_signals',
      name: `dense_${kind}_${number}`,
      path: `tb_top_module1.dense_test_signals.dense_${kind}_${number}`,
      kind,
      color: denseSignalColors[offset % denseSignalColors.length],
      transitions: makeDenseTransitions(globalIndex, kind),
    };

    if (kind === 'bus') {
      signal.width = offset % 10 === 0 ? 16 : 8;
    }

    return signal;
  });
}

function createMockWaveformData() {
  return {
    id: 'counter-waveform-mock',
    title: 'counter_tb',
    timescaleUnit: 'ns',
    duration: mockDuration,
    cursorTime: 84,
    groups: [
      { id: 'tb_top_module1', label: 'tb_top_module1' },
      { id: 'u_top_module1', label: 'u_top_module1' },
      { id: 'dense_test_signals', label: 'dense_test_signals' },
    ],
    signals: [
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
          { time: 188, value: 'z' },
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
          { time: 0, value: 'z' },
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
          { time: 190, value: 'z' },
        ],
      },
      ...makeDenseSignals(),
    ],
  };
}

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, `${JSON.stringify(createMockWaveformData(), null, 2)}\n`);
console.log(`Generated ${path.relative(workspaceRoot, targetPath)}.`);