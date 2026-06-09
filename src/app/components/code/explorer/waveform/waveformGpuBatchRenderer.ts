import {
  Buffer as PixiBuffer,
  BufferUsage,
  colorBit,
  colorBitGl,
  compileHighShaderGlProgram,
  compileHighShaderGpuProgram,
  Container,
  Geometry,
  localUniformBit,
  localUniformBitGl,
  Mesh,
  roundPixelsBit,
  roundPixelsBitGl,
  Shader,
} from 'pixi.js';

import { WaveformGlyphAtlas } from './waveformGlyphAtlas';

export type WaveformGpuBatchLayerKind =
  | 'busFill'
  | 'busOutline'
  | 'digitalStroke'
  | 'hatch'
  | 'midline'
  | 'pulseFill'
  | 'specialFill'
  | 'specialOutline';

export interface WaveformGpuBatchMetrics {
  bufferCapacityVertexCount: number;
  bufferDataReplaceCount: number;
  bufferReallocCount: number;
  bufferSubarrayCommitCount: number;
  bufferUpdateCount: number;
  bufferUpdateMs: number;
  drawLayerCount: number;
  glyphAtlasTextureCount: number;
  glyphBufferDataReplaceCount: number;
  glyphBufferReallocCount: number;
  glyphBufferSubarrayCommitCount: number;
  glyphBufferUpdateCount: number;
  glyphBufferUpdateMs: number;
  glyphVertexCount: number;
  labelLayoutCacheHitCount: number;
  labelLayoutCacheMissCount: number;
  labelPoolSize: number;
  labelTextureUpdateCount: number;
  vertexCount: number;
}

export interface WaveformGpuBatchPoint {
  x: number;
  y: number;
}

interface WaveformGpuBatchLayer {
  builder: WaveformGpuBatchBuilder;
  geometry: Geometry;
  mesh: Mesh<Geometry, Shader>;
}

const batchLayerOrder: readonly WaveformGpuBatchLayerKind[] = [
  'pulseFill',
  'busFill',
  'busOutline',
  'specialFill',
  'specialOutline',
  'hatch',
  'digitalStroke',
  'midline',
];

const emptyPositions = new Float32Array(0);
const emptyUvs = new Float32Array(0);
const emptyColors = new Float32Array(0);
const emptyIndices = new Uint32Array(0);

let sharedSolidColorShader: Shader | null = null;

export class WaveformGpuBatchRenderer {
  public readonly container: Container;

  private readonly glyphAtlas: WaveformGlyphAtlas;
  private readonly layers = new Map<WaveformGpuBatchLayerKind, WaveformGpuBatchLayer>();
  private lastMetrics: WaveformGpuBatchMetrics = createEmptyBatchMetrics();

  public constructor(label = 'waveform-gpu-batch-renderer') {
    this.container = new Container({ label });
    const shader = getWaveformSolidColorShader();

    for (const kind of batchLayerOrder) {
      const layer = createBatchLayer(kind, shader);
      this.layers.set(kind, layer);
      this.container.addChild(layer.mesh);
    }

    this.glyphAtlas = new WaveformGlyphAtlas(`${label}-glyph-atlas`);
    this.container.addChild(this.glyphAtlas.container);
  }

  public reset() {
    for (const layer of this.layers.values()) {
      layer.builder.reset();
    }
    this.glyphAtlas.beginFrame();
  }

  public prewarmGlyphs(fontSize: number, fill: number, characters?: string) {
    this.glyphAtlas.prewarm(fontSize, fill, characters);
  }

  public preallocateGlyphCapacity(glyphCount: number) {
    this.glyphAtlas.preallocateGlyphCapacity(glyphCount);
  }

  public preallocateLayerCapacity(kind: WaveformGpuBatchLayerKind, vertexCount: number, indexCount: number) {
    this.layers.get(kind)?.builder.preallocate(vertexCount, indexCount);
  }

  public preallocateBatchCapacity(vertexCount: number, indexCount: number) {
    for (const layer of this.layers.values()) {
      layer.builder.preallocate(vertexCount, indexCount);
    }
  }

  public clear() {
    this.reset();
    this.commit();
  }

  public getMetrics() {
    return this.lastMetrics;
  }

  public addPolygon(kind: WaveformGpuBatchLayerKind, points: readonly WaveformGpuBatchPoint[], color: number, alpha: number) {
    this.layers.get(kind)?.builder.addPolygon(points, color, alpha);
  }

  public addRect(kind: WaveformGpuBatchLayerKind, x: number, y: number, width: number, height: number, color: number, alpha: number) {
    this.layers.get(kind)?.builder.addQuad(x, y, width, height, color, alpha);
  }

  public addLine(kind: WaveformGpuBatchLayerKind, x1: number, y1: number, x2: number, y2: number, width: number, color: number, alpha: number) {
    this.layers.get(kind)?.builder.addLineQuad(x1, y1, x2, y2, width, color, alpha);
  }

  public acquireLabel(text: string, fill: number, fontSize: number, x: number, y: number, cacheKey?: string) {
    return this.glyphAtlas.acquireLabel({ cacheKey, fill, fontSize, text, x, y });
  }

  public commit(): WaveformGpuBatchMetrics {
    const startedAt = performance.now();
    let bufferCapacityVertexCount = 0;
    let bufferDataReplaceCount = 0;
    let bufferReallocCount = 0;
    let bufferSubarrayCommitCount = 0;
    let bufferUpdateCount = 0;
    let drawLayerCount = 0;
    let vertexCount = 0;

    for (const layer of this.layers.values()) {
      const hadVisibleMesh = layer.mesh.visible;
      const hasVertices = layer.builder.vertexCount > 0;

      if (hasVertices || hadVisibleMesh) {
        const commitMetrics = layer.builder.commit(layer.geometry);
        bufferDataReplaceCount += commitMetrics.dataReplaceCount;
        bufferSubarrayCommitCount += commitMetrics.subarrayCommitCount;
        bufferUpdateCount += 1;
      }

      layer.mesh.visible = hasVertices;
      if (hasVertices) {
        drawLayerCount += 1;
      }

      bufferCapacityVertexCount += layer.builder.capacityVertexCount;
      bufferReallocCount += layer.builder.consumeReallocCount();
      vertexCount += layer.builder.vertexCount;
    }

    const glyphMetrics = this.glyphAtlas.commit();

    this.lastMetrics = {
      bufferCapacityVertexCount,
      bufferDataReplaceCount,
      bufferReallocCount,
      bufferSubarrayCommitCount,
      bufferUpdateCount,
      bufferUpdateMs: Math.max(0, performance.now() - startedAt),
      drawLayerCount,
      glyphAtlasTextureCount: glyphMetrics.glyphAtlasTextureCount,
      glyphBufferDataReplaceCount: glyphMetrics.glyphBufferDataReplaceCount,
      glyphBufferReallocCount: glyphMetrics.glyphBufferReallocCount,
      glyphBufferSubarrayCommitCount: glyphMetrics.glyphBufferSubarrayCommitCount,
      glyphBufferUpdateCount: glyphMetrics.glyphBufferUpdateCount,
      glyphBufferUpdateMs: glyphMetrics.glyphBufferUpdateMs,
      glyphVertexCount: glyphMetrics.glyphVertexCount,
      labelLayoutCacheHitCount: glyphMetrics.labelLayoutCacheHitCount,
      labelLayoutCacheMissCount: glyphMetrics.labelLayoutCacheMissCount,
      labelPoolSize: glyphMetrics.labelPoolSize,
      labelTextureUpdateCount: glyphMetrics.labelTextureUpdateCount,
      vertexCount,
    };

    return this.lastMetrics;
  }
}

function createEmptyBatchMetrics(): WaveformGpuBatchMetrics {
  return {
    bufferCapacityVertexCount: 0,
    bufferDataReplaceCount: 0,
    bufferReallocCount: 0,
    bufferSubarrayCommitCount: 0,
    bufferUpdateCount: 0,
    bufferUpdateMs: 0,
    drawLayerCount: 0,
    glyphAtlasTextureCount: 0,
    glyphBufferDataReplaceCount: 0,
    glyphBufferReallocCount: 0,
    glyphBufferSubarrayCommitCount: 0,
    glyphBufferUpdateCount: 0,
    glyphBufferUpdateMs: 0,
    glyphVertexCount: 0,
    labelLayoutCacheHitCount: 0,
    labelLayoutCacheMissCount: 0,
    labelPoolSize: 0,
    labelTextureUpdateCount: 0,
    vertexCount: 0,
  };
}

class WaveformGpuBatchBuilder {
  private colors = new Float32Array(0);
  private indices = new Uint32Array(0);
  private positions = new Float32Array(0);
  private uvs = new Float32Array(0);
  private activeColorView = emptyColors;
  private activeIndexView = emptyIndices;
  private activePositionView = emptyPositions;
  private activeUvView = emptyUvs;
  private colorLength = 0;
  private indexLength = 0;
  private positionLength = 0;
  private reallocCount = 0;
  private uvLength = 0;

  public reset() {
    this.colorLength = 0;
    this.indexLength = 0;
    this.positionLength = 0;
    this.uvLength = 0;
  }

  public get vertexCount() {
    return this.positionLength / 2;
  }

  public get capacityVertexCount() {
    return this.positions.length / 2;
  }

  public consumeReallocCount() {
    const value = this.reallocCount;
    this.reallocCount = 0;
    return value;
  }

  public preallocate(vertexCount: number, indexCount: number) {
    this.ensureVertexCapacity(Math.max(0, Math.ceil(vertexCount)));
    this.ensureIndexCapacity(Math.max(0, Math.ceil(indexCount)));
  }

  public addQuad(x: number, y: number, width: number, height: number, color: number, alpha: number) {
    if (width <= 0 || height <= 0) {
      return;
    }

    this.addPolygon([
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ], color, alpha);
  }

  public addLineQuad(x1: number, y1: number, x2: number, y2: number, width: number, color: number, alpha: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);

    if (length <= 0 || width <= 0) {
      return;
    }

    const half = width / 2;
    const nx = -dy / length * half;
    const ny = dx / length * half;

    this.addPolygon([
      { x: x1 + nx, y: y1 + ny },
      { x: x2 + nx, y: y2 + ny },
      { x: x2 - nx, y: y2 - ny },
      { x: x1 - nx, y: y1 - ny },
    ], color, alpha);
  }

  public addPolygon(points: readonly WaveformGpuBatchPoint[], color: number, alpha: number) {
    if (points.length < 3 || alpha <= 0) {
      return;
    }

    const baseVertex = this.vertexCount;
    this.ensureVertexCapacity(this.vertexCount + points.length);
    this.ensureIndexCapacity(this.indexLength + (points.length - 2) * 3);

    const rgba = colorToRgba(color, alpha);

    for (const point of points) {
      this.positions[this.positionLength] = point.x;
      this.positions[this.positionLength + 1] = point.y;
      this.positionLength += 2;

      this.uvs[this.uvLength] = 0;
      this.uvs[this.uvLength + 1] = 0;
      this.uvLength += 2;

      this.colors[this.colorLength] = rgba.r;
      this.colors[this.colorLength + 1] = rgba.g;
      this.colors[this.colorLength + 2] = rgba.b;
      this.colors[this.colorLength + 3] = rgba.a;
      this.colorLength += 4;
    }

    for (let index = 1; index < points.length - 1; index += 1) {
      this.indices[this.indexLength] = baseVertex;
      this.indices[this.indexLength + 1] = baseVertex + index;
      this.indices[this.indexLength + 2] = baseVertex + index + 1;
      this.indexLength += 3;
    }
  }

  public commit(geometry: Geometry) {
    const metrics = {
      dataReplaceCount: 0,
      subarrayCommitCount: 0,
    };
    const recordCommit = (delta: BufferViewCommitDelta) => {
      metrics.dataReplaceCount += delta.dataReplaceCount;
      metrics.subarrayCommitCount += delta.subarrayCommitCount;
    };

    this.activePositionView = commitActiveBufferView(geometry.getBuffer('aPosition'), this.activePositionView, this.positions, this.positionLength, recordCommit);
    this.activeUvView = commitActiveBufferView(geometry.getBuffer('aUV'), this.activeUvView, this.uvs, this.uvLength, recordCommit);
    this.activeColorView = commitActiveBufferView(geometry.getBuffer('aColor'), this.activeColorView, this.colors, this.colorLength, recordCommit);
    this.activeIndexView = commitActiveBufferView(geometry.indexBuffer, this.activeIndexView, this.indices, this.indexLength, recordCommit);

    return metrics;
  }

  private ensureVertexCapacity(requiredVertexCount: number) {
    if (this.capacityVertexCount >= requiredVertexCount) {
      return;
    }

    const nextVertexCount = getNextPowerOfTwo(Math.max(8, requiredVertexCount));
    const nextPositionLength = nextVertexCount * 2;
    const nextColorLength = nextVertexCount * 4;

    const nextPositions = new Float32Array(nextPositionLength);
    nextPositions.set(this.positions.subarray(0, this.positionLength));
    this.positions = nextPositions;

    const nextUvs = new Float32Array(nextPositionLength);
    nextUvs.set(this.uvs.subarray(0, this.uvLength));
    this.uvs = nextUvs;

    const nextColors = new Float32Array(nextColorLength);
    nextColors.set(this.colors.subarray(0, this.colorLength));
    this.colors = nextColors;

    this.reallocCount += 1;
  }

  private ensureIndexCapacity(requiredLength: number) {
    if (this.indices.length >= requiredLength) {
      return;
    }

    const nextLength = getNextPowerOfTwo(Math.max(6, requiredLength));
    const nextIndices = new Uint32Array(nextLength);
    nextIndices.set(this.indices.subarray(0, this.indexLength));
    this.indices = nextIndices;
    this.reallocCount += 1;
  }
}

function createBatchLayer(kind: WaveformGpuBatchLayerKind, shader: Shader): WaveformGpuBatchLayer {
  const geometry = new Geometry({
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
      aColor: {
        buffer: new PixiBuffer({
          data: emptyColors,
          shrinkToFit: false,
          usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
        }),
        format: 'float32x4',
        stride: 4 * 4,
      },
    },
    indexBuffer: new PixiBuffer({
      data: emptyIndices,
      shrinkToFit: false,
      usage: BufferUsage.INDEX | BufferUsage.COPY_DST,
    }),
    label: `waveform-gpu-batch-${kind}`,
    topology: 'triangle-list',
  });
  const mesh = new Mesh({
    geometry,
    label: `waveform-gpu-batch-${kind}-mesh`,
    shader,
  });

  mesh.visible = false;

  return {
    builder: new WaveformGpuBatchBuilder(),
    geometry,
    mesh,
  };
}

function getWaveformSolidColorShader() {
  if (!sharedSolidColorShader) {
    const glProgram = compileHighShaderGlProgram({
      bits: [
        localUniformBitGl,
        colorBitGl,
        roundPixelsBitGl,
        {
          fragment: {
            main: 'outColor = vec4(1.0, 1.0, 1.0, 1.0);',
          },
          name: 'waveform-solid-fragment',
        },
      ],
      name: 'waveform-gpu-batch-solid-gl',
    });
    const gpuProgram = compileHighShaderGpuProgram({
      bits: [
        localUniformBit,
        colorBit,
        roundPixelsBit,
        {
          fragment: {
            main: 'outColor = vec4<f32>(1.0, 1.0, 1.0, 1.0);',
          },
          name: 'waveform-solid-fragment',
        },
      ],
      name: 'waveform-gpu-batch-solid-gpu',
    });

    sharedSolidColorShader = new Shader({
      glProgram,
      gpuProgram,
      resources: {},
    });
  }

  return sharedSolidColorShader;
}

function colorToRgba(color: number, alpha: number) {
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  return {
    a: safeAlpha,
    b: (color & 0xff) / 255,
    g: ((color >> 8) & 0xff) / 255,
    r: ((color >> 16) & 0xff) / 255,
  };
}

function getNextPowerOfTwo(value: number) {
  let result = 1;

  while (result < value) {
    result *= 2;
  }

  return result;
}

interface BufferViewCommitDelta {
  dataReplaceCount: number;
  subarrayCommitCount: number;
}

function commitActiveBufferView<T extends Float32Array | Uint32Array>(
  buffer: PixiBuffer,
  previousView: T,
  source: T,
  activeLength: number,
  onCommit: (delta: BufferViewCommitDelta) => void,
) {
  if (activeLength <= 0) {
    if (previousView.length === 0 && buffer.data === previousView) {
      buffer.update(0);
      return previousView;
    }

    const nextEmptyView = source.subarray(0, 0) as T;
    buffer.data = nextEmptyView;
    onCommit({ dataReplaceCount: 1, subarrayCommitCount: 1 });
    return nextEmptyView;
  }

  if (previousView.buffer === source.buffer && previousView.byteOffset === source.byteOffset && previousView.length === activeLength) {
    buffer.update(activeLength * source.BYTES_PER_ELEMENT);
    return previousView;
  }

  const nextView = source.subarray(0, activeLength) as T;
  buffer.data = nextView;
  onCommit({ dataReplaceCount: 1, subarrayCommitCount: 1 });
  return nextView;
}
