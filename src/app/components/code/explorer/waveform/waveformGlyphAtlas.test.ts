import { describe, expect, it } from 'vitest';

import { WaveformGlyphAtlas } from './waveformGlyphAtlas';

describe('WaveformGlyphAtlas', () => {
  it('reuses glyph runs during pan without updating label textures', () => {
    const atlas = new WaveformGlyphAtlas();

    atlas.beginFrame();
    const first = atlas.acquireLabel({
      fill: 0xd6d6d6,
      fontSize: 10,
      text: 'abc.',
      x: 10,
      y: 4,
    });
    const warmup = atlas.commit();

    expect(warmup.labelPoolSize).toBe(1);
    expect(warmup.labelTextureUpdateCount).toBe(1);
    expect(warmup.labelLayoutCacheHitCount).toBe(0);
    expect(warmup.labelLayoutCacheMissCount).toBe(1);

    atlas.beginFrame();
    const reused = atlas.acquireLabel({
      fill: 0xd6d6d6,
      fontSize: 10,
      text: 'abc.',
      x: 40,
      y: 4,
    });
    const pan = atlas.commit();

    expect(reused).toBe(first);
    expect(reused.x).toBe(40);
    expect(pan.labelPoolSize).toBe(1);
    expect(pan.labelTextureUpdateCount).toBe(0);
    expect(pan.labelLayoutCacheHitCount).toBe(1);
    expect(pan.labelLayoutCacheMissCount).toBe(0);
  });

  it('allocates a new glyph run only when fitted text changes during zoom', () => {
    const atlas = new WaveformGlyphAtlas();

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
    expect(zoom.labelTextureUpdateCount).toBe(1);
    expect(zoom.labelLayoutCacheHitCount).toBe(0);
    expect(zoom.labelLayoutCacheMissCount).toBe(1);
  });

  it('keeps a stable keyed glyph run and updates texture only when text changes', () => {
    const atlas = new WaveformGlyphAtlas();

    atlas.beginFrame();
    const first = atlas.acquireLabel({
      cacheKey: 'signal-a:42:value',
      fill: 0xd6d6d6,
      fontSize: 10,
      text: 'abcd',
      x: 10,
      y: 4,
    });
    atlas.commit();

    atlas.beginFrame();
    const sameSegment = atlas.acquireLabel({
      cacheKey: 'signal-a:42:value',
      fill: 0xd6d6d6,
      fontSize: 10,
      text: 'abc.',
      x: 12,
      y: 4,
    });
    const zoom = atlas.commit();

    expect(sameSegment).toBe(first);
    expect(sameSegment.text).toBe('abc.');
    expect(zoom.labelPoolSize).toBe(1);
    expect(zoom.labelTextureUpdateCount).toBe(1);
    expect(zoom.labelLayoutCacheHitCount).toBe(1);
    expect(zoom.labelLayoutCacheMissCount).toBe(0);
  });
});
