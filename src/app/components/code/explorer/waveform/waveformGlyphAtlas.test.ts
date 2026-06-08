import { describe, expect, it } from 'vitest';

import { WaveformGlyphAtlas } from './waveformGlyphAtlas';

describe('WaveformGlyphAtlas', () => {
  it('renders labels through one glyph mesh and pans without updating the atlas texture', () => {
    const atlas = new WaveformGlyphAtlas();

    atlas.beginFrame();
    const firstContainer = atlas.acquireLabel({
      fill: 0xd6d6d6,
      fontSize: 10,
      text: 'abc.',
      x: 10,
      y: 4,
    });
    const warmup = atlas.commit();

    expect(firstContainer).toBe(atlas.container);
    expect(warmup.glyphAtlasTextureCount).toBe(1);
    expect(warmup.glyphVertexCount).toBe(16);
    expect(warmup.glyphBufferUpdateCount).toBe(1);
    expect(warmup.labelPoolSize).toBe(1);
    expect(warmup.labelTextureUpdateCount).toBe(1);
    expect(warmup.labelLayoutCacheHitCount).toBe(0);
    expect(warmup.labelLayoutCacheMissCount).toBe(1);

    atlas.beginFrame();
    const reusedContainer = atlas.acquireLabel({
      fill: 0xd6d6d6,
      fontSize: 10,
      text: 'abc.',
      x: 40,
      y: 4,
    });
    const pan = atlas.commit();

    expect(reusedContainer).toBe(atlas.container);
    expect(pan.glyphAtlasTextureCount).toBe(1);
    expect(pan.glyphVertexCount).toBe(warmup.glyphVertexCount);
    expect(pan.glyphBufferUpdateCount).toBe(1);
    expect(pan.labelPoolSize).toBe(1);
    expect(pan.labelTextureUpdateCount).toBe(0);
    expect(pan.labelLayoutCacheHitCount).toBe(1);
    expect(pan.labelLayoutCacheMissCount).toBe(0);
  });

  it('uses layout misses for fitted text changes without requiring a new texture when glyphs already exist', () => {
    const atlas = new WaveformGlyphAtlas();
    atlas.prewarm(10, 0xd6d6d6, 'abcd.');

    atlas.beginFrame();
    atlas.acquireLabel({
      fill: 0xd6d6d6,
      fontSize: 10,
      text: 'abcd',
      x: 10,
      y: 4,
    });
    atlas.commit();

    atlas.beginFrame();
    atlas.acquireLabel({
      fill: 0xd6d6d6,
      fontSize: 10,
      text: 'abc.',
      x: 10,
      y: 4,
    });
    const zoom = atlas.commit();

    expect(zoom.labelPoolSize).toBe(2);
    expect(zoom.labelTextureUpdateCount).toBe(0);
    expect(zoom.labelLayoutCacheHitCount).toBe(0);
    expect(zoom.labelLayoutCacheMissCount).toBe(1);
  });

  it('keeps a stable keyed glyph run while text changes only rewrite glyph vertices', () => {
    const atlas = new WaveformGlyphAtlas();
    atlas.prewarm(10, 0xd6d6d6, 'abcd.');

    atlas.beginFrame();
    atlas.acquireLabel({
      cacheKey: 'signal-a:42:value',
      fill: 0xd6d6d6,
      fontSize: 10,
      text: 'abcd',
      x: 10,
      y: 4,
    });
    atlas.commit();

    atlas.beginFrame();
    atlas.acquireLabel({
      cacheKey: 'signal-a:42:value',
      fill: 0xd6d6d6,
      fontSize: 10,
      text: 'abc.',
      x: 12,
      y: 4,
    });
    const zoom = atlas.commit();

    expect(zoom.labelPoolSize).toBe(1);
    expect(zoom.labelTextureUpdateCount).toBe(0);
    expect(zoom.labelLayoutCacheHitCount).toBe(1);
    expect(zoom.labelLayoutCacheMissCount).toBe(0);
    expect(zoom.glyphBufferUpdateCount).toBe(1);
  });

  it('can preallocate glyph buffers before interaction sampling', () => {
    const atlas = new WaveformGlyphAtlas();

    atlas.prewarm(10, 0xd6d6d6, 'abcd');
    atlas.preallocateGlyphCapacity(4);
    atlas.beginFrame();
    const preallocation = atlas.commit();

    expect(preallocation.glyphBufferReallocCount).toBeGreaterThan(0);

    atlas.beginFrame();
    atlas.acquireLabel({
      fill: 0xd6d6d6,
      fontSize: 10,
      text: 'abcd',
      x: 10,
      y: 4,
    });
    const sampledInteraction = atlas.commit();

    expect(sampledInteraction.glyphVertexCount).toBe(16);
    expect(sampledInteraction.glyphBufferReallocCount).toBe(0);
    expect(sampledInteraction.labelTextureUpdateCount).toBe(0);
  });
});
