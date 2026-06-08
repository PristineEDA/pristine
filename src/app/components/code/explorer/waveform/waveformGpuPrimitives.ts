import { Container, Mesh, MeshGeometry, Texture } from 'pixi.js';

export interface WaveformGpuLayerMetrics {
  bufferUpdateCount: number;
  bufferUpdateMs: number;
  bufferCapacityVertexCount: number;
  bufferReallocCount: number;
  layerCount: number;
  vertexCount: number;
}

export interface WaveformGpuPrimitiveLayer {
  builder: WaveformGpuPrimitiveBuilder;
  container: Container;
  fillAlpha: number;
  mesh: Mesh<MeshGeometry>;
  strokeAlpha: number;
  tint: number;
}

export interface WaveformGpuPrimitiveGroup {
  fill: WaveformGpuPrimitiveLayer;
  stroke: WaveformGpuPrimitiveLayer;
}

export class WaveformGpuPrimitiveBuilder {
  private positions = new Float32Array(0);
  private uvs = new Float32Array(0);
  private indices = new Uint32Array(0);
  private positionLength = 0;
  private indexLength = 0;
  private reallocCount = 0;

  public reset() {
    this.positionLength = 0;
    this.indexLength = 0;
  }

  public get vertexCount() {
    return this.positionLength / 2;
  }

  public get indexCount() {
    return this.indexLength;
  }

  public get capacityVertexCount() {
    return this.positions.length / 2;
  }

  public consumeReallocCount() {
    const value = this.reallocCount;
    this.reallocCount = 0;
    return value;
  }

  public addQuad(x: number, y: number, width: number, height: number) {
    if (width <= 0 || height <= 0) {
      return;
    }

    this.addPolygon([
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ]);
  }

  public addLineQuad(x1: number, y1: number, x2: number, y2: number, width: number) {
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
    ]);
  }

  public addPolygon(points: readonly WaveformGpuPoint[]) {
    if (points.length < 3) {
      return;
    }

    const baseVertex = this.vertexCount;
    this.ensurePositionCapacity(this.positionLength + points.length * 2);
    this.ensureIndexCapacity(this.indexLength + (points.length - 2) * 3);

    for (const point of points) {
      this.positions[this.positionLength] = point.x;
      this.positions[this.positionLength + 1] = point.y;
      this.uvs[this.positionLength] = 0;
      this.uvs[this.positionLength + 1] = 0;
      this.positionLength += 2;
    }

    for (let index = 1; index < points.length - 1; index += 1) {
      this.indices[this.indexLength] = baseVertex;
      this.indices[this.indexLength + 1] = baseVertex + index;
      this.indices[this.indexLength + 2] = baseVertex + index + 1;
      this.indexLength += 3;
    }
  }

  public commit(geometry: MeshGeometry) {
    geometry.positions = this.positions.subarray(0, this.positionLength);
    geometry.uvs = this.uvs.subarray(0, this.positionLength);
    geometry.indices = this.indices.subarray(0, this.indexLength);
  }

  private ensurePositionCapacity(requiredLength: number) {
    if (this.positions.length >= requiredLength) {
      return;
    }

    const nextLength = getNextPowerOfTwo(Math.max(8, requiredLength));
    const nextPositions = new Float32Array(nextLength);
    nextPositions.set(this.positions.subarray(0, this.positionLength));
    this.positions = nextPositions;
    const nextUvs = new Float32Array(nextLength);
    nextUvs.set(this.uvs.subarray(0, this.positionLength));
    this.uvs = nextUvs;
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

export interface WaveformGpuPoint {
  x: number;
  y: number;
}

export function createWaveformGpuPrimitiveGroup(label: string, tint: number, fillAlpha: number, strokeAlpha: number): WaveformGpuPrimitiveGroup {
  return {
    fill: createWaveformGpuPrimitiveLayer(`${label}-fill`, tint, fillAlpha),
    stroke: createWaveformGpuPrimitiveLayer(`${label}-stroke`, tint, strokeAlpha),
  };
}

export function resetWaveformGpuPrimitiveGroup(group: WaveformGpuPrimitiveGroup) {
  group.fill.builder.reset();
  group.stroke.builder.reset();
}

export function commitWaveformGpuPrimitiveGroups(groups: readonly WaveformGpuPrimitiveGroup[]): WaveformGpuLayerMetrics {
  const startedAt = performance.now();
  let bufferCapacityVertexCount = 0;
  let bufferUpdateCount = 0;
  let layerCount = 0;
  let bufferReallocCount = 0;
  let vertexCount = 0;

  for (const group of groups) {
    for (const layer of [group.fill, group.stroke]) {
      const hasVertices = layer.builder.vertexCount > 0;
      const shouldCommit = hasVertices || layer.mesh.visible;
      if (shouldCommit) {
        layer.builder.commit(layer.mesh.geometry);
        bufferUpdateCount += 1;
      }
      layer.mesh.visible = hasVertices && layer.mesh.alpha > 0;
      bufferCapacityVertexCount += layer.builder.capacityVertexCount;
      bufferReallocCount += layer.builder.consumeReallocCount();
      vertexCount += layer.builder.vertexCount;
      layerCount += layer.mesh.visible ? 1 : 0;
    }
  }

  return {
    bufferUpdateCount,
    bufferUpdateMs: Math.max(0, performance.now() - startedAt),
    bufferCapacityVertexCount,
    bufferReallocCount,
    layerCount,
    vertexCount,
  };
}

export function addWaveformGpuLine(layer: WaveformGpuPrimitiveLayer, x1: number, y1: number, x2: number, y2: number, width: number) {
  layer.builder.addLineQuad(x1, y1, x2, y2, width);
}

export function addWaveformGpuRect(layer: WaveformGpuPrimitiveLayer, x: number, y: number, width: number, height: number) {
  layer.builder.addQuad(x, y, width, height);
}

export function addWaveformGpuPolygon(layer: WaveformGpuPrimitiveLayer, points: readonly WaveformGpuPoint[]) {
  layer.builder.addPolygon(points);
}

function createWaveformGpuPrimitiveLayer(label: string, tint: number, alpha: number): WaveformGpuPrimitiveLayer {
  const geometry = new MeshGeometry({
    indices: new Uint32Array(0),
    positions: new Float32Array(0),
    shrinkBuffersToFit: false,
    topology: 'triangle-list',
    uvs: new Float32Array(0),
  });
  const mesh = new Mesh({
    geometry,
    label: `${label}-mesh`,
    texture: Texture.WHITE,
  });

  mesh.alpha = alpha;
  mesh.tint = tint;
  mesh.visible = false;

  const container = new Container({ label });
  container.addChild(mesh);

  return {
    builder: new WaveformGpuPrimitiveBuilder(),
    container,
    fillAlpha: alpha,
    mesh,
    strokeAlpha: alpha,
    tint,
  };
}

function getNextPowerOfTwo(value: number) {
  let result = 1;

  while (result < value) {
    result *= 2;
  }

  return result;
}
