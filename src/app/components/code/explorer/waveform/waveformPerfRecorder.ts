export interface WaveformPerfSample {
  averageFps: number;
  averageRenderMs: number;
  droppedFrameCount: number;
  frameIntervalMs: number;
  frameParseMs: number;
  gpuBufferUpdateMs: number;
  pipeRoundtripMs: number;
  pixiRenderMs: number;
  reactViewportCommitCount: number;
  sceneUpdateMs: number;
  timestampMs: number;
}

export interface WaveformPerfSummary {
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
  | 'frameIntervalMs'
  | 'frameParseMs'
  | 'gpuBufferUpdateMs'
  | 'pipeRoundtripMs'
  | 'pixiRenderMs'
  | 'reactCommitDelta'
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
    const frameIntervals = this.samples.map((sample) => sample.frameIntervalMs);
    const pixiRenderMs = this.samples.map((sample) => sample.pixiRenderMs);
    let previousGpuBufferUpdateMs = 0;
    let previousReactViewportCommitCount = 0;
    const stageValues: Record<WaveformPerfStageName, number[]> = {
      frameIntervalMs: frameIntervals,
      frameParseMs: this.samples.map((sample) => sample.frameParseMs),
      gpuBufferUpdateMs: this.samples.map((sample) => {
        const delta = Math.max(0, sample.gpuBufferUpdateMs - previousGpuBufferUpdateMs);
        previousGpuBufferUpdateMs = sample.gpuBufferUpdateMs;
        return delta;
      }),
      pipeRoundtripMs: this.samples.map((sample) => sample.pipeRoundtripMs),
      pixiRenderMs,
      reactCommitDelta: this.samples.map((sample) => {
        const delta = Math.max(0, sample.reactViewportCommitCount - previousReactViewportCommitCount);
        previousReactViewportCommitCount = sample.reactViewportCommitCount;
        return delta;
      }),
      sceneUpdateMs: this.samples.map((sample) => sample.sceneUpdateMs),
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
      averageFps: average(this.samples.map((sample) => sample.averageFps)),
      averageRenderMs: average(this.samples.map((sample) => sample.averageRenderMs)),
      droppedFrameCount: this.samples.reduce((max, sample) => Math.max(max, sample.droppedFrameCount), 0),
      sampleCount: this.samples.length,
      stages,
      stageShare: {
        frameIntervalMs: 0,
        frameParseMs: stages.frameParseMs.average / stageTotal,
        gpuBufferUpdateMs: stages.gpuBufferUpdateMs.average / stageTotal,
        pipeRoundtripMs: stages.pipeRoundtripMs.average / stageTotal,
        pixiRenderMs: stages.pixiRenderMs.average / stageTotal,
        reactCommitDelta: stages.reactCommitDelta.average / stageTotal,
        sceneUpdateMs: stages.sceneUpdateMs.average / stageTotal,
      },
    };
  }
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
