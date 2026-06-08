export interface WaveformPerfSample {
  averageFps: number;
  averageRenderMs: number;
  displayViewportOnlyUpdateCount: number;
  displayViewportUpdateCount: number;
  droppedFrameCount: number;
  frameIntervalMs: number;
  frameParseMs: number;
  gpuBufferUpdateMs: number;
  labelLayoutCacheHitCount: number;
  labelLayoutCacheMissCount: number;
  labelTextureUpdateCount: number;
  phase: string;
  pipeRoundtripMs: number;
  pixiRenderMs: number;
  idleViewportCommitCount: number;
  reactViewportCommitCount: number;
  renderCount: number;
  sceneUpdateMs: number;
  timestampMs: number;
}

export interface WaveformPerfSummary {
  averageFps: number;
  averageRenderMs: number;
  droppedFrameCount: number;
  phases: Record<string, WaveformPerfPhaseSummary>;
  sampleCount: number;
  stages: Record<WaveformPerfStageName, WaveformPerfStageSummary>;
  stageShare: Record<WaveformPerfStageName, number>;
}

export interface WaveformPerfComparisonRow {
  after: number;
  before: number;
  delta: number;
  deltaPercent: number;
  metric: string;
}

export interface WaveformPerfPhaseSummary {
  averageFps: number;
  averageRenderMs: number;
  droppedFrameCount: number;
  sampleCount: number;
  stages: Record<WaveformPerfStageName, WaveformPerfStageSummary>;
  stageShare: Record<WaveformPerfStageName, number>;
}

export interface WaveformPerfStageSummary {
  average: number;
  p50: number;
  p95: number;
  p99: number;
}

export type WaveformPerfStageName =
  | 'displayViewportOnlyUpdateDelta'
  | 'frameIntervalMs'
  | 'frameParseMs'
  | 'gpuBufferUpdateMs'
  | 'inputToRenderDelta'
  | 'idleViewportCommitDelta'
  | 'labelLayoutCacheHitDelta'
  | 'labelLayoutCacheMissDelta'
  | 'labelTextureUpdateDelta'
  | 'pipeRoundtripMs'
  | 'pixiRenderMs'
  | 'renderDelta'
  | 'reactCommitDelta'
  | 'displayViewportUpdateDelta'
  | 'sceneUpdateMs';

export class WaveformPerfRecorder {
  private readonly samples: WaveformPerfSample[] = [];

  public record(sample: WaveformPerfSample) {
    this.samples.push(sample);
  }

  public clear() {
    this.samples.length = 0;
  }

  public summarize(): WaveformPerfSummary {
    const globalSummary = summarizeSamples(this.samples);
    const phaseSamples = new Map<string, WaveformPerfSample[]>();

    for (const sample of this.samples) {
      const samples = phaseSamples.get(sample.phase) ?? [];
      samples.push(sample);
      phaseSamples.set(sample.phase, samples);
    }

    const phases = Object.fromEntries(
      [...phaseSamples.entries()].map(([phase, samples]) => [phase, summarizeSamples(samples)]),
    );

    return {
      ...globalSummary,
      phases,
    };
  }

  public compare(before: WaveformPerfSummary): WaveformPerfComparisonRow[] {
    return compareWaveformPerfSummaries(before, this.summarize());
  }
}

export function compareWaveformPerfSummaries(before: WaveformPerfSummary, after: WaveformPerfSummary): WaveformPerfComparisonRow[] {
  return [
    createComparisonRow('averageFps', before.averageFps, after.averageFps),
    createComparisonRow('averageRenderMs', before.averageRenderMs, after.averageRenderMs),
    createComparisonRow('droppedFrameCount', before.droppedFrameCount, after.droppedFrameCount),
    createComparisonRow('p95FrameIntervalMs', before.stages.frameIntervalMs.p95, after.stages.frameIntervalMs.p95),
    createComparisonRow('avgGpuBufferUpdateMs', before.stages.gpuBufferUpdateMs.average, after.stages.gpuBufferUpdateMs.average),
    createComparisonRow('avgPixiRenderMs', before.stages.pixiRenderMs.average, after.stages.pixiRenderMs.average),
    createComparisonRow('avgReactCommitDelta', before.stages.reactCommitDelta.average, after.stages.reactCommitDelta.average),
    createComparisonRow('avgLabelTextureUpdateDelta', before.stages.labelTextureUpdateDelta.average, after.stages.labelTextureUpdateDelta.average),
  ];
}

function summarizeSamples(samples: readonly WaveformPerfSample[]): Omit<WaveformPerfSummary, 'phases'> {
  const frameIntervals = samples.map((sample) => sample.frameIntervalMs);
  const pixiRenderMs = samples.map((sample) => sample.pixiRenderMs);
  const stageValues: Record<WaveformPerfStageName, number[]> = {
    displayViewportOnlyUpdateDelta: getDeltaSeries(samples, (sample) => sample.displayViewportOnlyUpdateCount),
    displayViewportUpdateDelta: getDeltaSeries(samples, (sample) => sample.displayViewportUpdateCount),
    frameIntervalMs: frameIntervals,
    frameParseMs: samples.map((sample) => sample.frameParseMs),
    gpuBufferUpdateMs: getDeltaSeries(samples, (sample) => sample.gpuBufferUpdateMs),
    inputToRenderDelta: getDeltaSeries(samples, (sample) => sample.timestampMs),
    idleViewportCommitDelta: getDeltaSeries(samples, (sample) => sample.idleViewportCommitCount),
    labelLayoutCacheHitDelta: getDeltaSeries(samples, (sample) => sample.labelLayoutCacheHitCount),
    labelLayoutCacheMissDelta: getDeltaSeries(samples, (sample) => sample.labelLayoutCacheMissCount),
    labelTextureUpdateDelta: getDeltaSeries(samples, (sample) => sample.labelTextureUpdateCount),
    pipeRoundtripMs: samples.map((sample) => sample.pipeRoundtripMs),
    pixiRenderMs,
    renderDelta: getDeltaSeries(samples, (sample) => sample.renderCount),
    reactCommitDelta: getDeltaSeries(samples, (sample) => sample.reactViewportCommitCount),
    sceneUpdateMs: samples.map((sample) => sample.sceneUpdateMs),
  };
  const stages = Object.fromEntries(
    Object.entries(stageValues).map(([name, values]) => [name, summarizeNumbers(values)]),
  ) as Record<WaveformPerfStageName, WaveformPerfStageSummary>;
  const stageTotal = Math.max(
    0.001,
    stages.frameParseMs.average
      + stages.gpuBufferUpdateMs.average
      + stages.pipeRoundtripMs.average
      + stages.pixiRenderMs.average
      + stages.reactCommitDelta.average
      + stages.sceneUpdateMs.average,
  );

    return {
      averageFps: average(samples.map((sample) => sample.averageFps)),
      averageRenderMs: average(samples.map((sample) => sample.averageRenderMs)),
      droppedFrameCount: samples.reduce((max, sample) => Math.max(max, sample.droppedFrameCount), 0),
      sampleCount: samples.length,
      stages,
      stageShare: {
        displayViewportOnlyUpdateDelta: 0,
        displayViewportUpdateDelta: 0,
        frameIntervalMs: 0,
        frameParseMs: stages.frameParseMs.average / stageTotal,
        gpuBufferUpdateMs: stages.gpuBufferUpdateMs.average / stageTotal,
        inputToRenderDelta: 0,
        idleViewportCommitDelta: 0,
        labelLayoutCacheHitDelta: 0,
        labelLayoutCacheMissDelta: 0,
        labelTextureUpdateDelta: 0,
        pipeRoundtripMs: stages.pipeRoundtripMs.average / stageTotal,
        pixiRenderMs: stages.pixiRenderMs.average / stageTotal,
        renderDelta: 0,
        reactCommitDelta: stages.reactCommitDelta.average / stageTotal,
        sceneUpdateMs: stages.sceneUpdateMs.average / stageTotal,
      },
    };
}

function createComparisonRow(metric: string, before: number, after: number): WaveformPerfComparisonRow {
  const delta = after - before;
  return {
    after,
    before,
    delta,
    deltaPercent: before === 0 ? 0 : delta / before,
    metric,
  };
}

function getDeltaSeries(samples: readonly WaveformPerfSample[], readValue: (sample: WaveformPerfSample) => number) {
  let previousValue: number | null = null;

  return samples.map((sample) => {
    const nextValue = readValue(sample);

    if (previousValue === null) {
      previousValue = nextValue;
      return 0;
    }

    const delta = Math.max(0, nextValue - previousValue);
    previousValue = nextValue;
    return delta;
  });
}

function summarizeNumbers(values: readonly number[]): WaveformPerfStageSummary {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);

  if (sorted.length === 0) {
    return {
      average: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    };
  }

  return {
    average: average(sorted),
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

function average(values: readonly number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(sortedValues: readonly number[], value: number) {
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * value) - 1));
  return sortedValues[index] ?? 0;
}
