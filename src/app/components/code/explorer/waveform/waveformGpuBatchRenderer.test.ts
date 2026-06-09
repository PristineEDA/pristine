import { describe, expect, it } from 'vitest';

import { WaveformGpuBatchRenderer } from './waveformGpuBatchRenderer';

describe('WaveformGpuBatchRenderer', () => {
  it('keeps GPU batch layers fixed and reuses buffers and labels after warmup', () => {
    const renderer = new WaveformGpuBatchRenderer();

    addRepresentativeWaveformGeometry(renderer);
    renderer.acquireLabel('abcd', 0xd6d6d6, 10, 12, 6);
    const warmup = renderer.commit();

    expect(warmup.drawLayerCount).toBeGreaterThan(0);
    expect(warmup.drawLayerCount).toBeLessThanOrEqual(8);
    expect(warmup.activeIndexCount).toBeGreaterThan(0);
    expect(warmup.vertexCount).toBeGreaterThan(0);
    expect(warmup.bufferCapacityVertexCount).toBeGreaterThanOrEqual(warmup.vertexCount);
    expect(warmup.bufferReallocCount).toBeGreaterThan(0);
    expect(warmup.glyphAtlasTextureCount).toBe(1);
    expect(warmup.glyphVertexCount).toBeGreaterThan(0);
    expect(warmup.glyphBufferUpdateCount).toBe(1);
    expect(warmup.labelPoolSize).toBe(1);
    expect(warmup.labelTextureUpdateCount).toBe(1);
    expect(warmup.labelLayoutCacheHitCount).toBe(0);
    expect(warmup.labelLayoutCacheMissCount).toBe(1);

    renderer.reset();
    addRepresentativeWaveformGeometry(renderer);
    renderer.acquireLabel('abcd', 0xd6d6d6, 10, 32, 6);
    const preparedHitUpdate = renderer.commit();

    expect(preparedHitUpdate.drawLayerCount).toBe(warmup.drawLayerCount);
    expect(preparedHitUpdate.activeIndexCount).toBe(warmup.activeIndexCount);
    expect(preparedHitUpdate.vertexCount).toBe(warmup.vertexCount);
    expect(preparedHitUpdate.bufferCapacityVertexCount).toBe(warmup.bufferCapacityVertexCount);
    expect(preparedHitUpdate.bufferReallocCount).toBe(0);
    expect(preparedHitUpdate.bufferDataReplaceCount).toBe(0);
    expect(preparedHitUpdate.bufferSubarrayCommitCount).toBe(0);
    expect(preparedHitUpdate.glyphAtlasTextureCount).toBe(1);
    expect(preparedHitUpdate.glyphVertexCount).toBe(warmup.glyphVertexCount);
    expect(preparedHitUpdate.glyphBufferUpdateCount).toBe(1);
    expect(preparedHitUpdate.glyphBufferDataReplaceCount).toBe(0);
    expect(preparedHitUpdate.glyphBufferSubarrayCommitCount).toBe(0);
    expect(preparedHitUpdate.labelPoolSize).toBe(1);
    expect(preparedHitUpdate.labelTextureUpdateCount).toBe(0);
    expect(preparedHitUpdate.labelLayoutCacheHitCount).toBe(1);
    expect(preparedHitUpdate.labelLayoutCacheMissCount).toBe(0);
  });

  it('preallocates batch and glyph buffers before the measured interaction path', () => {
    const renderer = new WaveformGpuBatchRenderer();

    renderer.prewarmGlyphs(10, 0xd6d6d6, 'abcd');
    renderer.preallocateBatchCapacity(8, 12);
    renderer.preallocateGlyphCapacity(4);
    const preallocation = renderer.commit();

    expect(preallocation.bufferReallocCount).toBeGreaterThan(0);
    expect(preallocation.glyphBufferReallocCount).toBeGreaterThan(0);

    renderer.bindPreallocatedBuffers();
    renderer.reset();
    addRepresentativeWaveformGeometry(renderer);
    renderer.acquireLabel('abcd', 0xd6d6d6, 10, 12, 6);
    const sampledInteraction = renderer.commit();

    expect(sampledInteraction.bufferReallocCount).toBe(0);
    expect(sampledInteraction.bufferDataReplaceCount).toBe(0);
    expect(sampledInteraction.bufferSubarrayCommitCount).toBe(0);
    expect(sampledInteraction.glyphBufferReallocCount).toBe(0);
    expect(sampledInteraction.glyphBufferDataReplaceCount).toBe(0);
    expect(sampledInteraction.glyphBufferSubarrayCommitCount).toBe(0);
    expect(sampledInteraction.labelTextureUpdateCount).toBe(0);
    expect(sampledInteraction.drawLayerCount).toBeLessThanOrEqual(8);

    renderer.reset();
    addRepresentativeWaveformGeometry(renderer);
    renderer.acquireLabel('abcd', 0xd6d6d6, 10, 24, 6);
    const repeatedInteraction = renderer.commit();

    expect(repeatedInteraction.bufferReallocCount).toBe(0);
    expect(repeatedInteraction.bufferDataReplaceCount).toBe(0);
    expect(repeatedInteraction.bufferSubarrayCommitCount).toBe(0);
    expect(repeatedInteraction.glyphBufferReallocCount).toBe(0);
    expect(repeatedInteraction.glyphBufferDataReplaceCount).toBe(0);
    expect(repeatedInteraction.glyphBufferSubarrayCommitCount).toBe(0);
  });
});

function addRepresentativeWaveformGeometry(renderer: WaveformGpuBatchRenderer) {
  renderer.addRect('pulseFill', 0, 0, 40, 12, 0x38d68c, 0.18);
  renderer.addLine('digitalStroke', 0, 6, 80, 6, 2, 0x38d68c, 0.96);
  renderer.addPolygon('busFill', [
    { x: 0, y: 20 },
    { x: 60, y: 20 },
    { x: 64, y: 28 },
    { x: 60, y: 36 },
    { x: 0, y: 36 },
    { x: -4, y: 28 },
  ], 0x6ee7b7, 0.16);
  renderer.addLine('busOutline', 0, 20, 60, 20, 1.2, 0x6ee7b7, 0.84);
  renderer.addRect('specialFill', 82, 0, 24, 16, 0xff6b8a, 0.22);
  renderer.addLine('specialOutline', 82, 0, 106, 16, 2, 0xff6b8a, 0.86);
  renderer.addLine('hatch', 84, 1, 96, 15, 1, 0xff6b8a, 0.54);
  renderer.addLine('midline', 0, 44, 120, 44, 1, 0xffffff, 0.04);
}
