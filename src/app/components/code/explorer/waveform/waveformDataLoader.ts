import type { WaveformDataSet, WaveformSignal, WaveformSignalGroup, WaveformSignalKind, WaveformTransition } from './waveformTypes';

const signalKinds = new Set<WaveformSignalKind>(['clock', 'logic', 'bus']);
const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

export function parseWaveformDataJson(input: unknown): WaveformDataSet {
  const root = readObject(input, 'waveform data');
  const groups = readArray(root.groups, 'groups').map((group, index) => parseGroup(group, `groups[${index}]`));
  const groupIds = new Set<string>();

  for (const group of groups) {
    if (groupIds.has(group.id)) {
      throw new Error(`Duplicate waveform group id '${group.id}'.`);
    }
    groupIds.add(group.id);
  }

  const duration = readFiniteNumber(root.duration, 'duration');
  if (duration <= 0) {
    throw new Error('duration must be greater than 0.');
  }

  const signals = readArray(root.signals, 'signals').map((signal, index) => parseSignal(signal, `signals[${index}]`, groupIds));
  const cursorTime = clamp(readFiniteNumber(root.cursorTime, 'cursorTime'), 0, duration);

  return {
    id: readString(root.id, 'id'),
    title: readString(root.title, 'title'),
    timescaleUnit: readString(root.timescaleUnit, 'timescaleUnit'),
    duration,
    cursorTime,
    groups,
    signals,
  };
}

function parseGroup(input: unknown, path: string): WaveformSignalGroup {
  const group = readObject(input, path);

  return {
    id: readString(group.id, `${path}.id`),
    label: readString(group.label, `${path}.label`),
  };
}

function parseSignal(input: unknown, path: string, groupIds: ReadonlySet<string>): WaveformSignal {
  const signal = readObject(input, path);
  const groupId = readString(signal.groupId, `${path}.groupId`);
  const kind = readSignalKind(signal.kind, `${path}.kind`);
  const color = readString(signal.color, `${path}.color`);
  const width = signal.width === undefined ? undefined : readPositiveInteger(signal.width, `${path}.width`);
  const transitions = readArray(signal.transitions, `${path}.transitions`)
    .map((transition, index) => parseTransition(transition, `${path}.transitions[${index}]`))
    .sort((left, right) => left.time - right.time);

  if (!groupIds.has(groupId)) {
    throw new Error(`${path}.groupId references unknown group '${groupId}'.`);
  }
  if (!hexColorPattern.test(color)) {
    throw new Error(`${path}.color must be a #RRGGBB color.`);
  }
  if (transitions.length === 0) {
    throw new Error(`${path}.transitions must contain at least one transition.`);
  }

  return {
    id: readString(signal.id, `${path}.id`),
    groupId,
    name: readString(signal.name, `${path}.name`),
    path: readString(signal.path, `${path}.path`),
    kind,
    color,
    width,
    transitions,
  };
}

function parseTransition(input: unknown, path: string): WaveformTransition {
  const transition = readObject(input, path);
  const value = readString(transition.value, `${path}.value`).trim();

  if (value.length === 0) {
    throw new Error(`${path}.value must not be empty.`);
  }

  return {
    time: readFiniteNumber(transition.time, `${path}.time`),
    value: value.toLowerCase(),
  };
}

function readSignalKind(input: unknown, path: string): WaveformSignalKind {
  const kind = readString(input, path);

  if (!signalKinds.has(kind as WaveformSignalKind)) {
    throw new Error(`${path} must be one of clock, logic, or bus.`);
  }

  return kind as WaveformSignalKind;
}

function readObject(input: unknown, path: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error(`${path} must be an object.`);
  }

  return input as Record<string, unknown>;
}

function readArray(input: unknown, path: string): unknown[] {
  if (!Array.isArray(input)) {
    throw new Error(`${path} must be an array.`);
  }

  return input;
}

function readString(input: unknown, path: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }

  return input;
}

function readFiniteNumber(input: unknown, path: string): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    throw new Error(`${path} must be a finite number.`);
  }

  return input;
}

function readPositiveInteger(input: unknown, path: string): number {
  const value = readFiniteNumber(input, path);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${path} must be a positive integer.`);
  }

  return value;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
