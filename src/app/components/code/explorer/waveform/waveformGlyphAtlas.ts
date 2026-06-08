import { BitmapText, Container } from 'pixi.js';

export interface WaveformGlyphAtlasMetrics {
  labelLayoutCacheHitCount: number;
  labelLayoutCacheMissCount: number;
  labelPoolSize: number;
  labelTextureUpdateCount: number;
}

export interface WaveformGlyphAtlasAcquireOptions {
  cacheKey?: string;
  fill: number;
  fontSize: number;
  text: string;
  x: number;
  y: number;
}

export class WaveformGlyphAtlas {
  public readonly container: Container;

  private readonly buckets = new Map<string, BitmapText[]>();
  private readonly keyedLabels = new Map<string, BitmapText>();
  private readonly labels: BitmapText[] = [];
  private readonly usedCounts = new Map<string, number>();
  private readonly usedKeys = new Set<string>();
  private labelLayoutCacheHitCount = 0;
  private labelLayoutCacheMissCount = 0;
  private labelTextureUpdateCount = 0;

  public constructor(label = 'waveform-glyph-atlas') {
    this.container = new Container({ label });
  }

  public beginFrame() {
    this.usedCounts.clear();
    this.usedKeys.clear();
    this.labelLayoutCacheHitCount = 0;
    this.labelLayoutCacheMissCount = 0;
    this.labelTextureUpdateCount = 0;
  }

  public acquireLabel({ cacheKey, fill, fontSize, text, x, y }: WaveformGlyphAtlasAcquireOptions) {
    if (cacheKey) {
      return this.acquireKeyedLabel({ cacheKey, fill, fontSize, text, x, y });
    }

    const key = getGlyphRunKey(text, fill, fontSize);
    const usedCount = this.usedCounts.get(key) ?? 0;
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = [];
      this.buckets.set(key, bucket);
    }

    let label = bucket[usedCount];

    if (label) {
      this.labelLayoutCacheHitCount += 1;
    } else {
      label = createGlyphText(text, fill, fontSize);
      bucket.push(label);
      this.labels.push(label);
      this.container.addChild(label);
      this.labelLayoutCacheMissCount += 1;
      this.labelTextureUpdateCount += 1;
    }

    label.x = x;
    label.y = y;
    label.visible = true;
    this.usedCounts.set(key, usedCount + 1);
    return label;
  }

  public commit(): WaveformGlyphAtlasMetrics {
    for (const [key, label] of this.keyedLabels) {
      label.visible = this.usedKeys.has(key);
    }

    for (const [key, bucket] of this.buckets) {
      const usedCount = this.usedCounts.get(key) ?? 0;

      for (let index = 0; index < bucket.length; index += 1) {
        const label = bucket[index];
        if (label) {
          label.visible = index < usedCount;
        }
      }
    }

    return {
      labelLayoutCacheHitCount: this.labelLayoutCacheHitCount,
      labelLayoutCacheMissCount: this.labelLayoutCacheMissCount,
      labelPoolSize: this.labels.length,
      labelTextureUpdateCount: this.labelTextureUpdateCount,
    };
  }

  private acquireKeyedLabel({ cacheKey, fill, fontSize, text, x, y }: Required<WaveformGlyphAtlasAcquireOptions>) {
    const key = getStableGlyphRunKey(cacheKey, fill, fontSize);
    let label = this.keyedLabels.get(key);

    if (label) {
      this.labelLayoutCacheHitCount += 1;
      if (label.text !== text) {
        label.text = text;
        this.labelTextureUpdateCount += 1;
      }
    } else {
      label = createGlyphText(text, fill, fontSize);
      this.keyedLabels.set(key, label);
      this.labels.push(label);
      this.container.addChild(label);
      this.labelLayoutCacheMissCount += 1;
      this.labelTextureUpdateCount += 1;
    }

    label.x = x;
    label.y = y;
    label.visible = true;
    this.usedKeys.add(key);
    return label;
  }
}

function getGlyphRunKey(text: string, fill: number, fontSize: number) {
  return `${fontSize}:${fill}:${text}`;
}

function getStableGlyphRunKey(cacheKey: string, fill: number, fontSize: number) {
  return `${fontSize}:${fill}:${cacheKey}`;
}

function createGlyphText(text: string, fill: number, fontSize: number) {
  return new BitmapText({
    text,
    style: {
      fill,
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      fontSize,
      fontWeight: '500',
    },
  });
}
