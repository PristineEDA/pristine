import {
  Buffer as PixiBuffer,
  BufferUsage,
  Container,
  Geometry,
  Mesh,
  Texture,
} from 'pixi.js';

export interface WaveformGlyphAtlasMetrics {
  glyphAtlasTextureCount: number;
  glyphBufferReallocCount: number;
  glyphBufferUpdateCount: number;
  glyphBufferUpdateMs: number;
  glyphVertexCount: number;
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

interface GlyphMetrics {
  advance: number;
  height: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  width: number;
}

interface GlyphRunState {
  fill: number;
  fontSize: number;
  text: string;
}

const atlasResolution = 2;
const atlasSize = 1024;
const glyphPadding = 3;
const defaultGlyphCharacters = '0123456789abcdefABCDEFxzXZ.-_:[]() psnµumkMGTP';
const emptyPositions = new Float32Array(0);
const emptyUvs = new Float32Array(0);
const emptyIndices = new Uint32Array(0);

export class WaveformGlyphAtlas {
  public readonly container: Container;

  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly geometry: Geometry;
  private readonly mesh: Mesh<Geometry>;
  private readonly texture: Texture;
  private readonly glyphs = new Map<string, GlyphMetrics>();
  private readonly keyedRuns = new Map<string, GlyphRunState>();
  private readonly unkeyedRuns = new Map<string, number>();
  private readonly usedUnkeyedRuns = new Map<string, number>();
  private indices = new Uint32Array(0);
  private positions = new Float32Array(0);
  private uvs = new Float32Array(0);
  private indexLength = 0;
  private nextAtlasX = glyphPadding;
  private nextAtlasY = glyphPadding;
  private rowHeight = 0;
  private positionLength = 0;
  private uvLength = 0;
  private glyphBufferReallocCount = 0;
  private labelLayoutCacheHitCount = 0;
  private labelLayoutCacheMissCount = 0;
  private labelTextureUpdateCount = 0;
  private atlasTextureDirty = false;

  public constructor(label = 'waveform-glyph-atlas') {
    this.container = new Container({ label });
    this.canvas = document.createElement('canvas');
    this.canvas.width = atlasSize;
    this.canvas.height = atlasSize;
    this.context = this.canvas.getContext('2d');
    this.texture = Texture.from(this.canvas, true);
    this.texture.label = `${label}-texture`;
    this.geometry = new Geometry({
      attributes: {
        aPosition: {
          buffer: new PixiBuffer({
            data: emptyPositions,
            shrinkToFit: false,
            usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
          }),
          format: 'float32x2',
          stride: 2 * 4,
        },
        aUV: {
          buffer: new PixiBuffer({
            data: emptyUvs,
            shrinkToFit: false,
            usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
          }),
          format: 'float32x2',
          stride: 2 * 4,
        },
      },
      indexBuffer: new PixiBuffer({
        data: emptyIndices,
        shrinkToFit: false,
        usage: BufferUsage.INDEX | BufferUsage.COPY_DST,
      }),
      label: `${label}-geometry`,
      topology: 'triangle-list',
    });
    this.mesh = new Mesh({
      geometry: this.geometry,
      label: `${label}-mesh`,
      texture: this.texture,
    });
    this.mesh.visible = false;
    this.container.addChild(this.mesh);
  }

  public beginFrame() {
    this.indexLength = 0;
    this.positionLength = 0;
    this.uvLength = 0;
    this.usedUnkeyedRuns.clear();
    this.labelLayoutCacheHitCount = 0;
    this.labelLayoutCacheMissCount = 0;
    this.labelTextureUpdateCount = 0;
  }

  public prewarm(fontSize: number, fill: number, characters = defaultGlyphCharacters) {
    this.ensureGlyphSet(fontSize, fill, characters);
  }

  public preallocateGlyphCapacity(glyphCount: number) {
    const safeGlyphCount = Math.max(0, Math.ceil(glyphCount));

    if (safeGlyphCount <= 0) {
      return;
    }

    this.ensureVertexCapacity(safeGlyphCount * 4);
    this.ensureIndexCapacity(safeGlyphCount * 6);
  }

  public acquireLabel({ cacheKey, fill, fontSize, text, x, y }: WaveformGlyphAtlasAcquireOptions) {
    if (!text) {
      return this.container;
    }

    this.ensureGlyphSet(fontSize, fill, text);

    if (cacheKey) {
      this.recordKeyedRun(cacheKey, fill, fontSize, text);
    } else {
      this.recordUnkeyedRun(text, fill, fontSize);
    }

    this.addGlyphRun(text, fill, fontSize, x, y);
    return this.container;
  }

  public commit(): WaveformGlyphAtlasMetrics {
    const startedAt = performance.now();
    const hasGlyphs = this.positionLength > 0;
    const atlasTextureWasDirty = this.atlasTextureDirty;

    if (atlasTextureWasDirty) {
      this.texture.source.update();
      this.atlasTextureDirty = false;
    }
    this.geometry.getBuffer('aPosition').data = hasGlyphs ? this.positions.subarray(0, this.positionLength) : emptyPositions;
    this.geometry.getBuffer('aUV').data = hasGlyphs ? this.uvs.subarray(0, this.uvLength) : emptyUvs;
    this.geometry.indexBuffer.data = hasGlyphs ? this.indices.subarray(0, this.indexLength) : emptyIndices;
    this.mesh.visible = hasGlyphs;
    const metrics = {
      glyphAtlasTextureCount: this.texture.destroyed ? 0 : 1,
      glyphBufferReallocCount: this.glyphBufferReallocCount,
      glyphBufferUpdateCount: hasGlyphs ? 1 : 0,
      glyphBufferUpdateMs: Math.max(0, performance.now() - startedAt),
      glyphVertexCount: this.positionLength / 2,
      labelLayoutCacheHitCount: this.labelLayoutCacheHitCount,
      labelLayoutCacheMissCount: this.labelLayoutCacheMissCount,
      labelPoolSize: this.getActiveRunCount(),
      labelTextureUpdateCount: atlasTextureWasDirty ? 1 : this.labelTextureUpdateCount,
    };

    this.glyphBufferReallocCount = 0;
    this.labelTextureUpdateCount = 0;
    return metrics;
  }

  private recordKeyedRun(cacheKey: string, fill: number, fontSize: number, text: string) {
    const key = getStableGlyphRunKey(cacheKey, fill, fontSize);
    const previous = this.keyedRuns.get(key);

    if (!previous) {
      this.keyedRuns.set(key, { fill, fontSize, text });
      this.labelLayoutCacheMissCount += 1;
    } else {
      this.labelLayoutCacheHitCount += 1;
      if (previous.text !== text || previous.fill !== fill || previous.fontSize !== fontSize) {
        previous.text = text;
        previous.fill = fill;
        previous.fontSize = fontSize;
      }
    }
  }

  private recordUnkeyedRun(text: string, fill: number, fontSize: number) {
    const key = getGlyphRunKey(text, fill, fontSize);
    const usedCount = this.usedUnkeyedRuns.get(key) ?? 0;
    const existingCount = this.unkeyedRuns.get(key) ?? 0;

    if (usedCount < existingCount) {
      this.labelLayoutCacheHitCount += 1;
    } else {
      this.unkeyedRuns.set(key, existingCount + 1);
      this.labelLayoutCacheMissCount += 1;
    }

    this.usedUnkeyedRuns.set(key, usedCount + 1);
  }

  private addGlyphRun(text: string, fill: number, fontSize: number, x: number, y: number) {
    let cursorX = x;

    for (const character of text) {
      const glyph = this.glyphs.get(getGlyphKey(character, fill, fontSize));

      if (!glyph) {
        continue;
      }

      this.ensureVertexCapacity(this.positionLength / 2 + 4);
      this.ensureIndexCapacity(this.indexLength + 6);
      const baseVertex = this.positionLength / 2;
      const width = glyph.width / atlasResolution;
      const height = glyph.height / atlasResolution;

      this.positions[this.positionLength] = cursorX;
      this.positions[this.positionLength + 1] = y;
      this.positions[this.positionLength + 2] = cursorX + width;
      this.positions[this.positionLength + 3] = y;
      this.positions[this.positionLength + 4] = cursorX + width;
      this.positions[this.positionLength + 5] = y + height;
      this.positions[this.positionLength + 6] = cursorX;
      this.positions[this.positionLength + 7] = y + height;
      this.positionLength += 8;

      this.uvs[this.uvLength] = glyph.u0;
      this.uvs[this.uvLength + 1] = glyph.v0;
      this.uvs[this.uvLength + 2] = glyph.u1;
      this.uvs[this.uvLength + 3] = glyph.v0;
      this.uvs[this.uvLength + 4] = glyph.u1;
      this.uvs[this.uvLength + 5] = glyph.v1;
      this.uvs[this.uvLength + 6] = glyph.u0;
      this.uvs[this.uvLength + 7] = glyph.v1;
      this.uvLength += 8;

      this.indices[this.indexLength] = baseVertex;
      this.indices[this.indexLength + 1] = baseVertex + 1;
      this.indices[this.indexLength + 2] = baseVertex + 2;
      this.indices[this.indexLength + 3] = baseVertex;
      this.indices[this.indexLength + 4] = baseVertex + 2;
      this.indices[this.indexLength + 5] = baseVertex + 3;
      this.indexLength += 6;

      cursorX += glyph.advance / atlasResolution;
    }
  }

  private ensureGlyphSet(fontSize: number, fill: number, text: string) {
    let addedGlyph = false;

    for (const character of text) {
      if (character === ' ') {
        continue;
      }

      const key = getGlyphKey(character, fill, fontSize);
      if (!this.glyphs.has(key)) {
        this.addGlyph(character, fill, fontSize);
        addedGlyph = true;
      }
    }

    this.atlasTextureDirty ||= addedGlyph;
  }

  private addGlyph(character: string, fill: number, fontSize: number) {
    if (!this.context) {
      this.glyphs.set(getGlyphKey(character, fill, fontSize), {
        advance: fontSize * atlasResolution * 0.6,
        height: fontSize * atlasResolution,
        u0: 0,
        u1: 0,
        v0: 0,
        v1: 0,
        width: fontSize * atlasResolution * 0.6,
      });
      return;
    }

    const font = getCanvasFont(fontSize * atlasResolution);
    this.context.font = font;
    this.context.textBaseline = 'top';
    const measuredWidth = Math.max(1, Math.ceil(this.context.measureText(character).width));
    const glyphWidth = measuredWidth + glyphPadding * 2;
    const glyphHeight = Math.ceil(fontSize * atlasResolution * 1.35) + glyphPadding * 2;

    if (this.nextAtlasX + glyphWidth >= atlasSize) {
      this.nextAtlasX = glyphPadding;
      this.nextAtlasY += this.rowHeight + glyphPadding;
      this.rowHeight = 0;
    }

    if (this.nextAtlasY + glyphHeight >= atlasSize) {
      throw new Error('Waveform glyph atlas capacity exceeded.');
    }

    this.context.fillStyle = `#${fill.toString(16).padStart(6, '0')}`;
    this.context.font = font;
    this.context.textBaseline = 'top';
    this.context.fillText(character, this.nextAtlasX + glyphPadding, this.nextAtlasY + glyphPadding);

    this.glyphs.set(getGlyphKey(character, fill, fontSize), {
      advance: Math.max(1, measuredWidth),
      height: glyphHeight,
      u0: this.nextAtlasX / atlasSize,
      u1: (this.nextAtlasX + glyphWidth) / atlasSize,
      v0: this.nextAtlasY / atlasSize,
      v1: (this.nextAtlasY + glyphHeight) / atlasSize,
      width: glyphWidth,
    });
    this.nextAtlasX += glyphWidth + glyphPadding;
    this.rowHeight = Math.max(this.rowHeight, glyphHeight);
  }

  private ensureVertexCapacity(requiredVertexCount: number) {
    const currentVertexCount = this.positions.length / 2;
    if (currentVertexCount >= requiredVertexCount) {
      return;
    }

    const nextVertexCount = getNextPowerOfTwo(Math.max(32, requiredVertexCount));
    const nextPositions = new Float32Array(nextVertexCount * 2);
    nextPositions.set(this.positions.subarray(0, this.positionLength));
    this.positions = nextPositions;

    const nextUvs = new Float32Array(nextVertexCount * 2);
    nextUvs.set(this.uvs.subarray(0, this.uvLength));
    this.uvs = nextUvs;
    this.glyphBufferReallocCount += 1;
  }

  private ensureIndexCapacity(requiredLength: number) {
    if (this.indices.length >= requiredLength) {
      return;
    }

    const nextIndices = new Uint32Array(getNextPowerOfTwo(Math.max(48, requiredLength)));
    nextIndices.set(this.indices.subarray(0, this.indexLength));
    this.indices = nextIndices;
    this.glyphBufferReallocCount += 1;
  }

  private getActiveRunCount() {
    let unkeyedCount = 0;

    for (const count of this.unkeyedRuns.values()) {
      unkeyedCount += count;
    }

    return this.keyedRuns.size + unkeyedCount;
  }
}

function getGlyphRunKey(text: string, fill: number, fontSize: number) {
  return `${fontSize}:${fill}:${text}`;
}

function getStableGlyphRunKey(cacheKey: string, fill: number, fontSize: number) {
  return `${fontSize}:${fill}:${cacheKey}`;
}

function getGlyphKey(character: string, fill: number, fontSize: number) {
  return `${fontSize}:${fill}:${character}`;
}

function getCanvasFont(fontSize: number) {
  return `500 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
}

function getNextPowerOfTwo(value: number) {
  let result = 1;

  while (result < value) {
    result *= 2;
  }

  return result;
}
