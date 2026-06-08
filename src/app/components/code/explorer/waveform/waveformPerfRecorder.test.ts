import { describe, expect, it } from 'vitest';

import { WaveformPerfRecorder, compareWaveformPerfSummaries, type WaveformPerfSample } from './waveformPerfRecorder';

describe('WaveformPerfRecorder', () => {
  it('summarizes global and per-phase waveform performance deltas', () => {
    const recorder = new WaveformPerfRecorder();

    recorder.record(createSample({
      displayViewportUpdateCount: 10,
      displayViewportOnlyUpdateCount: 8,
      gpuBufferUpdateMs: 4,
      labelLayoutCacheHitCount: 20,
      labelLayoutCacheMissCount: 2,
      labelTextureUpdateCount: 2,
      phase: 'pan',
      idleViewportCommitCount: 0,
      reactViewportCommitCount: 3,
      renderCount: 20,
      timestampMs: 100,
    }));
    recorder.record(createSample({
      displayViewportUpdateCount: 12,
      displayViewportOnlyUpdateCount: 10,
      gpuBufferUpdateMs: 7,
      labelLayoutCacheHitCount: 24,
      labelLayoutCacheMissCount: 2,
      labelTextureUpdateCount: 2,
      phase: 'pan',
      idleViewportCommitCount: 0,
      reactViewportCommitCount: 3,
      renderCount: 22,
      timestampMs: 116,
    }));
    recorder.record(createSample({
      displayViewportUpdateCount: 16,
      displayViewportOnlyUpdateCount: 10,
      gpuBufferUpdateMs: 17,
      labelLayoutCacheHitCount: 24,
      labelLayoutCacheMissCount: 5,
      labelTextureUpdateCount: 5,
      phase: 'zoom',
      idleViewportCommitCount: 1,
      reactViewportCommitCount: 5,
      renderCount: 27,
      timestampMs: 150,
    }));

    const summary = recorder.summarize();

    expect(summary.sampleCount).toBe(3);
    expect(summary.phases.pan?.sampleCount).toBe(2);
    expect(summary.phases.zoom?.sampleCount).toBe(1);
    expect(summary.stages.displayViewportUpdateDelta.average).toBe(2);
    expect(summary.stages.displayViewportOnlyUpdateDelta.average).toBeCloseTo(2 / 3, 4);
    expect(summary.stages.gpuBufferUpdateMs.average).toBeCloseTo(13 / 3, 4);
    expect(summary.stages.idleViewportCommitDelta.average).toBeCloseTo(1 / 3, 4);
    expect(summary.stages.labelLayoutCacheHitDelta.average).toBeCloseTo(4 / 3, 4);
    expect(summary.stages.labelLayoutCacheMissDelta.average).toBe(1);
    expect(summary.stages.labelTextureUpdateDelta.average).toBe(1);
    expect(summary.stages.reactCommitDelta.average).toBeCloseTo(2 / 3, 4);
    expect(summary.stages.renderDelta.average).toBeCloseTo(7 / 3, 4);
    expect(summary.phases.pan?.stages.displayViewportUpdateDelta.average).toBe(1);
    expect(summary.phases.pan?.stages.displayViewportOnlyUpdateDelta.average).toBe(1);
    expect(summary.phases.pan?.stages.labelTextureUpdateDelta.average).toBe(0);
    expect(summary.phases.zoom?.stages.displayViewportUpdateDelta.average).toBe(0);
    expect(summary.phases.zoom?.stages.labelTextureUpdateDelta.average).toBe(0);
    expect(summary.stageShare.pixiRenderMs).toBeGreaterThan(0);

    const comparison = compareWaveformPerfSummaries(summary, {
      ...summary,
      averageFps: 90,
      averageRenderMs: 8,
      droppedFrameCount: 1,
    });

    expect(comparison.find((row) => row.metric === 'averageFps')?.delta).toBe(30);
    expect(comparison.find((row) => row.metric === 'averageRenderMs')?.delta).toBe(-4);
  });
});

function createSample(overrides: Partial<WaveformPerfSample>): WaveformPerfSample {
  return {
    averageFps: 60,
    averageRenderMs: 12,
    displayViewportOnlyUpdateCount: 0,
    displayViewportUpdateCount: 0,
    droppedFrameCount: 0,
    frameIntervalMs: 16,
    frameParseMs: 1,
    gpuBufferUpdateMs: 0,
    labelLayoutCacheHitCount: 0,
    labelLayoutCacheMissCount: 0,
    labelTextureUpdateCount: 0,
    phase: 'baseline',
    pipeRoundtripMs: 2,
    pixiRenderMs: 3,
    idleViewportCommitCount: 0,
    reactViewportCommitCount: 0,
    renderCount: 0,
    sceneUpdateMs: 4,
    timestampMs: 0,
    ...overrides,
  };
}
