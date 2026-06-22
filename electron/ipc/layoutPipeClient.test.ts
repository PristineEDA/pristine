import { afterEach, describe, expect, it } from 'vitest';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import {
  closeAllLayoutPipeSessions,
  decodeLayoutEnvelope,
  encodeLayoutEnvelope,
  encodeLayoutCatalogPageRequestPayload,
  encodeLayoutGeometryRequestPayload,
  encodeLayoutTileGeometryRequestPayload,
  getOpenLayoutPipeSessionCount,
  normalizeLayoutOpenSessionMetadata,
  openLayoutPipeSession,
  parseLayoutCatalogPayload,
  parseLayoutCatalogPagePayload,
  parseLayoutCatalogSummaryPayload,
  parseLayoutGeometryPayload,
  parseLayoutStatusPayload,
  parseLayoutTileGeometryPayload,
} from './layoutPipeClient.js';

describe('layoutPipeClient', () => {
  afterEach(async () => {
    await closeAllLayoutPipeSessions();
  });

  it('encodes and decodes PLD1 envelope headers', () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    const encoded = encodeLayoutEnvelope(5, 42, payload, 7);
    const view = new DataView(encoded);
    const bytes = new Uint8Array(encoded);

    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('PLD1');
    expect(view.getUint16(4, true)).toBe(3);
    expect(view.getUint16(6, true)).toBe(5);
    expect(view.getUint32(8, true)).toBe(42);
    expect(view.getUint32(12, true)).toBe(7);
    expect(view.getUint32(16, true)).toBe(payload.byteLength);

    const decoded = decodeLayoutEnvelope(encoded);
    expect(decoded).toMatchObject({
      flags: 7,
      messageType: 5,
      requestId: 42,
    });
    expect([...decoded.payload]).toEqual([...payload]);
  });

  it('encodes geometry requests using the engine payload layout', () => {
    const payload = encodeLayoutGeometryRequestPayload({
      sessionId: 'layout-1',
      bbox: { x0: 1, y0: 2, x1: 3, y1: 4 },
      maxShapes: 512,
      layerIndices: [2, 4],
      shapeKinds: [1, 2],
    });
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    let offset = 0;

    expect(view.getUint32(offset, true)).toBe(1);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(512);
    offset += 4;
    expect(view.getFloat64(offset, true)).toBe(1);
    offset += 8;
    expect(view.getFloat64(offset, true)).toBe(2);
    offset += 8;
    expect(view.getFloat64(offset, true)).toBe(3);
    offset += 8;
    expect(view.getFloat64(offset, true)).toBe(4);
    offset += 8;
    expect(view.getUint32(offset, true)).toBe(2);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(2);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(4);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(2);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(1);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(2);
    offset += 4;
    expect(offset).toBe(payload.byteLength);
  });

  it('encodes geometry owner filters after layer and kind filters', () => {
    const payload = encodeLayoutGeometryRequestPayload({
      sessionId: 'layout-1',
      maxShapes: 0,
      macroIndices: [3, 5],
      gdsRootCellIndices: [7],
    });
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    let offset = 0;

    expect(view.getUint32(offset, true)).toBe(2);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(0);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(0);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(0);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(2);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(3);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(5);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(1);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(7);
    offset += 4;
    expect(offset).toBe(payload.byteLength);
  });

  it('does not set owner filter flags for empty index arrays', () => {
    const payload = encodeLayoutGeometryRequestPayload({
      sessionId: 'layout-1',
      macroIndices: [],
      gdsRootCellIndices: [],
    });
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    let offset = 0;

    expect(view.getUint32(offset, true)).toBe(0);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(250_000);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(0);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(0);
    offset += 4;
    expect(offset).toBe(payload.byteLength);
  });

  it('encodes tile geometry requests with DBU bbox coordinates', () => {
    const payload = encodeLayoutTileGeometryRequestPayload({
      sessionId: 'layout-1',
      rootCellIndex: 7,
      bbox: { x0: 1.25, y0: 2, x1: 3, y1: 4.5 },
      maxShapes: 11,
      maxPoints: 22,
      maxBytes: 33,
      lod: 2,
      continuationToken: 44,
      layerIndices: [5],
      shapeKinds: [1, 4],
      datatypes: [0, 3],
    }, 1000);
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    let offset = 0;

    expect(view.getUint32(offset, true)).toBe(1);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(7);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(11);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(22);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(33);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(2);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(44);
    offset += 4;
    expect(view.getFloat64(offset, true)).toBe(1250);
    offset += 8;
    expect(view.getFloat64(offset, true)).toBe(2000);
    offset += 8;
    expect(view.getFloat64(offset, true)).toBe(3000);
    offset += 8;
    expect(view.getFloat64(offset, true)).toBe(4500);
  });

  it('encodes catalog page requests', () => {
    const payload = encodeLayoutCatalogPageRequestPayload({
      sessionId: 'layout-1',
      tableKind: 'cells',
      offset: 8,
      limit: 16,
      maxBytes: 4096,
    });
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    expect(view.getUint32(0, true)).toBe(0);
    expect(view.getUint32(4, true)).toBe(2);
    expect(view.getUint32(8, true)).toBe(8);
    expect(view.getUint32(12, true)).toBe(16);
    expect(view.getUint32(16, true)).toBe(4096);
  });

  it('parses layout status responses', () => {
    const status = parseLayoutStatusPayload(createStatusPayloadFixture());

    expect(status).toMatchObject({
      state: 'parsing',
      phase: 'records',
      fileSizeBytes: 1000,
      bytesRead: 500,
      recordCount: 12,
      cellCount: 2,
      warmupScheduled: true,
      warmupReady: false,
      error: 'still parsing',
    });
  });

  it('parses catalog summary responses', () => {
    const summary = parseLayoutCatalogSummaryPayload(createCatalogSummaryPayloadFixture());

    expect(summary).toMatchObject({
      sourceKind: 'gds',
      topCellIndex: 1,
      gdsCellCount: 2,
      layerCount: 1,
      layerSummary: [{ index: 0, name: 'GDS:5/0' }],
      bounds: { x0: 0, y0: 0, x1: 10, y1: 6 },
      parseMicros: 101,
      openMicros: 404,
    });
  });

  it('parses catalog page responses', () => {
    const page = parseLayoutCatalogPagePayload(createCatalogCellPagePayloadFixture());

    expect(page.tableKind).toBe('cells');
    expect(page.offset).toBe(1);
    expect(page.nextOffset).toBeNull();
    expect(page.gdsCells).toEqual([expect.objectContaining({
      index: 1,
      name: 'CHILD',
      bounds: { x0: 1, y0: 2, x1: 3, y1: 4 },
    })]);
  });

  it('parses catalog layer page responses', () => {
    const page = parseLayoutCatalogPagePayload(createCatalogLayerPagePayloadFixture());

    expect(page.tableKind).toBe('layers');
    expect(page.offset).toBe(0);
    expect(page.layers).toEqual([{
      index: 0,
      kind: 0,
      name: 'GDS:7/1',
      pitch: 0,
      spacing: 0,
      width: 0,
    }]);
  });

  it('parses catalog payloads into layout metadata', () => {
    const catalog = parseLayoutCatalogPayload(createCatalogPayloadFixture());

    expect(catalog.unitsPerMicron).toBe(1000);
    expect(catalog.sourceKind).toBe('lefdef');
    expect(catalog.shapeCount).toBe(2);
    expect(catalog.topCellIndex).toBeNull();
    expect(catalog.layers).toEqual([{
      index: 0,
      kind: 1,
      name: 'Metal1',
      pitch: 0.48,
      spacing: 0.16,
      width: 0.16,
    }]);
    expect(catalog.macros).toEqual([{
      index: 0,
      className: 'CORE',
      name: 'sg13g2_inv_1',
      originX: 0,
      originY: 0,
      pinCount: 3,
      sizeX: 1.2,
      sizeY: 3.78,
    }]);
    expect(catalog.pins).toEqual([
      {
        macroIndex: 0,
        pinIndex: 0,
        name: 'A',
        use: 'SIGNAL',
        direction: 1,
        firstShapeIndex: 0,
        shapeCount: 1,
      },
      {
        macroIndex: 0,
        pinIndex: 1,
        name: 'VDD',
        use: 'POWER',
        direction: 3,
        firstShapeIndex: 1,
        shapeCount: 2,
      },
    ]);
    expect(catalog.defPins).toEqual([]);
    expect(catalog.gdsCells).toEqual([]);
  });

  it('rejects catalog payloads without the v3 superset header fields', () => {
    const payload = createCatalogPayloadFixture();
    const legacyPayload = new Uint8Array(payload);
    legacyPayload[6] = 80;
    legacyPayload[7] = 0;

    expect(() => parseLayoutCatalogPayload(legacyPayload)).toThrow('Unsupported layout catalog header size: 80');
  });

  it('rejects truncated catalog pin tables', () => {
    const payload = createCatalogPayloadFixture();
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    view.setUint32(56, payload.byteLength - 4, true);

    expect(() => parseLayoutCatalogPayload(payload)).toThrow('Layout pin table is truncated.');
  });

  it('parses v3 DEF pins and GDS catalog tables', () => {
    const catalog = parseLayoutCatalogPayload(createGdsCatalogPayloadFixture());

    expect(catalog.sourceKind).toBe('gds');
    expect(catalog.shapeCount).toBe(3);
    expect(catalog.topCellIndex).toBe(0);
    expect(catalog.defPins).toEqual([{
      firstShapeIndex: 0,
      name: 'VDD',
      netName: 'VDD',
      orientation: 'N',
      shapeCount: 1,
      status: 1,
      x: 1.25,
      y: 2.5,
    }]);
    expect(catalog.gdsCells).toEqual([{
      bounds: { x0: 0, y0: 0, x1: 10, y1: 6 },
      elementCount: 1,
      firstElementIndex: 0,
      firstReferenceIndex: 0,
      index: 0,
      name: 'TOP',
      referenceCount: 1,
      top: true,
    }]);
    expect(catalog.gdsReferences).toEqual([expect.objectContaining({
      parentCellIndex: 0,
      targetCellIndex: 1,
      targetName: 'CHILD',
    })]);
    expect(catalog.gdsElements).toEqual([{
      cellIndex: 0,
      datatype: 0,
      firstPointIndex: 0,
      index: 0,
      kind: 3,
      layer: 7,
      pointCount: 2,
      referenceIndex: 0,
      text: 'VSS',
      texttype: 0,
    }]);
    expect(catalog.gdsPoints).toEqual([
      { index: 0, x: 1, y: 2 },
      { index: 1, x: 3, y: 4 },
    ]);
  });

  it('parses geometry payloads into shape objects', () => {
    const geometry = parseLayoutGeometryPayload(createGeometryPayloadFixture());

    expect(geometry).toMatchObject({
      unitsPerMicron: 1000,
      truncated: false,
      shapeCount: 2,
      polygonPointCount: 3,
    });
    expect(geometry.shapes[0]).toMatchObject({
      index: 0,
      kind: 'rect',
      ownerKind: 'pin',
      layerIndex: 0,
      macroIndex: 0,
      rect: { x0: 0.1, y0: 0.2, x1: 0.3, y1: 0.4 },
    });
    expect(geometry.shapes[1]).toMatchObject({
      index: 1,
      kind: 'polygon',
      ownerKind: 'obstruction',
      ownerIndex: 0,
      macroIndex: null,
      polygon: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
    });
  });

  it('parses tile geometry responses with metrics and embedded PLGE', () => {
    const tile = parseLayoutTileGeometryPayload(createTileGeometryPayloadFixture());

    expect(tile.truncated).toBe(true);
    expect(tile.nextToken).toBe(99);
    expect(tile.tileShapeCount).toBe(2);
    expect(tile.geometry.shapes).toHaveLength(2);
    expect(tile.metrics).toMatchObject({
      indexBuildMicros: 1,
      queryMicros: 2,
      encodeMicros: 3,
      cacheHitCount: 8,
      cacheMissCount: 9,
      gridBinCount: 14,
    });
  });

  it('rejects older geometry payload versions', () => {
    const payload = createGeometryPayloadFixture();
    const legacyPayload = new Uint8Array(payload);
    legacyPayload[4] = 1;
    legacyPayload[5] = 0;

    expect(() => parseLayoutGeometryPayload(legacyPayload)).toThrow('Unsupported layout geometry version: 1');
  });

  it('validates LSP layout open metadata before connecting to the pipe', () => {
    expect(normalizeLayoutOpenSessionMetadata({
      endpoint: { kind: 'namedPipe', path: '\\\\.\\pipe\\layout-test' },
      protocol: 'pristine-layout-columnar-v3',
      sessionId: '1',
      title: 'sg13g2_stdcell.lef',
      lefCount: 1,
      unitsPerMicron: 1000,
      bbox: { x0: 0, y0: 0, x1: 1, y1: 1 },
    })).toMatchObject({
      endpoint: { kind: 'namedPipe', path: '\\\\.\\pipe\\layout-test' },
      protocol: 'pristine-layout-columnar-v3',
      sessionId: '1',
      sourceKind: 'lefdef',
      status: 'unknown',
      title: 'sg13g2_stdcell.lef',
      lefCount: 1,
    });

    expect(() => normalizeLayoutOpenSessionMetadata({
      endpoint: { kind: 'namedPipe', path: '\\\\.\\pipe\\layout-test' },
      protocol: 'json',
      sessionId: '1',
    })).toThrow('Unsupported layout protocol');
  });

  it('clears any tracked pipe sessions when asked to close all', async () => {
    await closeAllLayoutPipeSessions();
    expect(getOpenLayoutPipeSessionCount()).toBe(0);
  });

  it('opens a pipe session and reads catalog metadata', async () => {
    const endpointPath = createPipeEndpointPath();
    const server = net.createServer((socket) => {
      void (async () => {
        const hello = await readTestEnvelope(socket);
        socket.write(Buffer.from(encodeLayoutEnvelope(2, hello.requestId, createHelloPayloadFixture())));

        const catalog = await readTestEnvelope(socket);
        socket.write(Buffer.from(encodeLayoutEnvelope(4, catalog.requestId, createCatalogPayloadFixture())));
      })().catch((error) => {
        socket.destroy(error);
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(endpointPath, resolve);
    });

    try {
      const session = await openLayoutPipeSession({
        bbox: { x0: 0, y0: 0, x1: 1.2, y1: 3.78 },
        componentCount: 0,
        defPresent: false,
        deferred: false,
        diagnosticCount: 0,
        endpoint: {
          kind: process.platform === 'win32' ? 'namedPipe' : 'unixSocket',
          path: endpointPath,
        },
        fileUris: ['file:///workspace/sg13g2_stdcell.lef'],
        layerCount: 1,
        lefCount: 1,
        macroCount: 1,
        messages: [],
        netCount: 0,
        protocol: 'pristine-layout-columnar-v3',
        sessionId: 'layout-open-test',
        sourceKind: 'lefdef',
        status: 'unknown',
        title: 'sg13g2_stdcell.lef',
        unitsPerMicron: 1000,
      });

      expect(session.catalog.layers).toHaveLength(1);
      expect(session.catalog.macros[0]?.name).toBe('sg13g2_inv_1');
      expect(session.catalog.pins.map((pin) => pin.name)).toEqual(['A', 'VDD']);
    } finally {
      await closeAllLayoutPipeSessions();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });

  it('opens a deferred GDS pipe session without reading the catalog', async () => {
    const endpointPath = createPipeEndpointPath();
    const messageTypes: number[] = [];
    const server = net.createServer((socket) => {
      void (async () => {
        const hello = await readTestEnvelope(socket);
        messageTypes.push(hello.messageType);
        socket.write(Buffer.from(encodeLayoutEnvelope(2, hello.requestId, createHelloPayloadFixture())));
      })().catch((error) => {
        socket.destroy(error);
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(endpointPath, resolve);
    });

    try {
      const session = await openLayoutPipeSession({
        bbox: { x0: 0, y0: 0, x1: 10, y1: 4 },
        componentCount: 0,
        defPresent: false,
        deferred: true,
        diagnosticCount: 0,
        endpoint: {
          kind: process.platform === 'win32' ? 'namedPipe' : 'unixSocket',
          path: endpointPath,
        },
        fileUris: ['file:///workspace/tiny.gds'],
        layerCount: 0,
        lefCount: 0,
        macroCount: 0,
        messages: [],
        netCount: 0,
        protocol: 'pristine-layout-columnar-v3',
        sessionId: 'layout-deferred-open-test',
        sourceKind: 'gds',
        status: 'parsing',
        title: 'tiny.gds',
        unitsPerMicron: 1000,
      }, { deferCatalog: true });

      expect(messageTypes).toEqual([1]);
      expect(session.deferred).toBe(true);
      expect(session.initialStatus).toBe('parsing');
      expect(session.catalog.sourceKind).toBe('gds');
      expect(session.catalog.gdsCells).toHaveLength(0);
      expect(session.catalog.layers).toHaveLength(0);
    } finally {
      await closeAllLayoutPipeSessions();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });
});

function createCatalogPayloadFixture(): Uint8Array {
  const strings: number[] = [];
  const textEncoder = new TextEncoder();
  const addString = (value: string) => {
    const offset = strings.length;
    const encoded = textEncoder.encode(value);
    pushU32(strings, encoded.byteLength);
    strings.push(...encoded);
    return offset;
  };

  const output = new Array<number>(136).fill(0);
  const layerOffset = output.length;
  pushU32(output, addString('Metal1'));
  pushU16(output, 1);
  pushU16(output, 0);
  pushF64(output, 0.48);
  pushF64(output, 0.16);
  pushF64(output, 0.16);

  const macroOffset = output.length;
  pushU32(output, addString('sg13g2_inv_1'));
  pushU32(output, addString('CORE'));
  pushF64(output, 0);
  pushF64(output, 0);
  pushF64(output, 1.2);
  pushF64(output, 3.78);
  pushU32(output, 3);

  const pinOffset = output.length;
  pushU32(output, 0);
  pushU32(output, 0);
  pushU32(output, addString('A'));
  pushU32(output, addString('SIGNAL'));
  pushU16(output, 1);
  pushU16(output, 0);
  pushU32(output, 0);
  pushU32(output, 1);
  pushU32(output, 0);
  pushU32(output, 1);
  pushU32(output, addString('VDD'));
  pushU32(output, addString('POWER'));
  pushU16(output, 3);
  pushU16(output, 0);
  pushU32(output, 1);
  pushU32(output, 2);

  const viaOffset = output.length;
  const componentOffset = output.length;
  const defPinOffset = output.length;
  const netOffset = output.length;
  const gdsCellOffset = output.length;
  const gdsReferenceOffset = output.length;
  const gdsElementOffset = output.length;
  const gdsPointOffset = output.length;
  const diagnosticOffset = output.length;
  alignTo(output, 4);
  const stringOffset = output.length;
  output.push(...strings);

  output[0] = 'P'.charCodeAt(0);
  output[1] = 'L'.charCodeAt(0);
  output[2] = 'C'.charCodeAt(0);
  output[3] = 'T'.charCodeAt(0);
  setU16(output, 4, 3);
  setU16(output, 6, 136);
  setU32(output, 8, 1000);
  setU32(output, 12, 1);
  setU32(output, 16, 2);
  setU32(output, 20, 1);
  setU32(output, 24, 0xffffffff);
  setU32(output, 28, stringOffset);
  setU32(output, 32, strings.length);
  setU32(output, 36, 1);
  setU32(output, 40, layerOffset);
  setU32(output, 44, 1);
  setU32(output, 48, macroOffset);
  setU32(output, 52, 2);
  setU32(output, 56, pinOffset);
  setU32(output, 60, 0);
  setU32(output, 64, viaOffset);
  setU32(output, 68, 0);
  setU32(output, 72, componentOffset);
  setU32(output, 76, 0);
  setU32(output, 80, defPinOffset);
  setU32(output, 84, 0);
  setU32(output, 88, netOffset);
  setU32(output, 92, 0);
  setU32(output, 96, gdsCellOffset);
  setU32(output, 100, 0);
  setU32(output, 104, gdsReferenceOffset);
  setU32(output, 108, 0);
  setU32(output, 112, gdsElementOffset);
  setU32(output, 116, 0);
  setU32(output, 120, gdsPointOffset);
  setU32(output, 124, 0);
  setU32(output, 128, diagnosticOffset);
  return Uint8Array.from(output);
}

function createGdsCatalogPayloadFixture(): Uint8Array {
  const strings: number[] = [];
  const textEncoder = new TextEncoder();
  const addString = (value: string) => {
    const offset = strings.length;
    const encoded = textEncoder.encode(value);
    pushU32(strings, encoded.byteLength);
    strings.push(...encoded);
    return offset;
  };

  const output = new Array<number>(136).fill(0);
  const layerOffset = output.length;
  pushU32(output, addString('GDS-7'));
  pushU16(output, 0);
  pushU16(output, 0);
  pushF64(output, 0);
  pushF64(output, 0);
  pushF64(output, 0);

  const macroOffset = output.length;
  const macroPinOffset = output.length;
  const viaOffset = output.length;
  const componentOffset = output.length;

  const defPinOffset = output.length;
  pushU32(output, addString('VDD'));
  pushU32(output, addString('VDD'));
  pushU16(output, 1);
  pushU16(output, 0);
  pushF64(output, 1.25);
  pushF64(output, 2.5);
  pushU32(output, addString('N'));
  pushU32(output, 0);
  pushU32(output, 1);

  const netOffset = output.length;

  const gdsCellOffset = output.length;
  pushU32(output, addString('TOP'));
  pushU32(output, 0);
  pushU32(output, 1);
  pushU32(output, 0);
  pushU32(output, 1);
  pushU32(output, 1);
  pushF64(output, 0);
  pushF64(output, 0);
  pushF64(output, 10);
  pushF64(output, 6);

  const gdsReferenceOffset = output.length;
  pushU32(output, 0);
  pushU32(output, 1);
  pushU16(output, 1);
  pushU16(output, 0);
  pushF64(output, 0.5);
  pushF64(output, 0.75);
  pushF64(output, 1);
  pushF64(output, 0);
  pushU32(output, 1);
  pushU32(output, 1);
  pushF64(output, 0);
  pushF64(output, 0);
  pushF64(output, 0);
  pushF64(output, 0);
  pushU32(output, addString('CHILD'));

  const gdsElementOffset = output.length;
  pushU32(output, 0);
  pushU16(output, 3);
  pushU16(output, 0);
  pushU32(output, 7);
  pushU32(output, 0);
  pushU32(output, 0);
  pushU32(output, 0);
  pushU32(output, 0);
  pushU32(output, 2);
  pushU32(output, addString('VSS'));

  const gdsPointOffset = output.length;
  pushF64(output, 1);
  pushF64(output, 2);
  pushF64(output, 3);
  pushF64(output, 4);

  const diagnosticOffset = output.length;
  alignTo(output, 4);
  const stringOffset = output.length;
  output.push(...strings);

  output[0] = 'P'.charCodeAt(0);
  output[1] = 'L'.charCodeAt(0);
  output[2] = 'C'.charCodeAt(0);
  output[3] = 'T'.charCodeAt(0);
  setU16(output, 4, 3);
  setU16(output, 6, 136);
  setU32(output, 8, 1000);
  setU32(output, 12, 2);
  setU32(output, 16, 3);
  setU32(output, 20, 1);
  setU32(output, 24, 0);
  setU32(output, 28, stringOffset);
  setU32(output, 32, strings.length);
  setU32(output, 36, 1);
  setU32(output, 40, layerOffset);
  setU32(output, 44, 0);
  setU32(output, 48, macroOffset);
  setU32(output, 52, 0);
  setU32(output, 56, macroPinOffset);
  setU32(output, 60, 0);
  setU32(output, 64, viaOffset);
  setU32(output, 68, 0);
  setU32(output, 72, componentOffset);
  setU32(output, 76, 1);
  setU32(output, 80, defPinOffset);
  setU32(output, 84, 0);
  setU32(output, 88, netOffset);
  setU32(output, 92, 1);
  setU32(output, 96, gdsCellOffset);
  setU32(output, 100, 1);
  setU32(output, 104, gdsReferenceOffset);
  setU32(output, 108, 1);
  setU32(output, 112, gdsElementOffset);
  setU32(output, 116, 2);
  setU32(output, 120, gdsPointOffset);
  setU32(output, 124, 0);
  setU32(output, 128, diagnosticOffset);
  return Uint8Array.from(output);
}

function createGeometryPayloadFixture(): Uint8Array {
  const output = new Array<number>(96).fill(0);
  const shapeTableOffset = output.length;

  pushU32(output, 0);
  pushU16(output, 1);
  pushU16(output, 4);
  pushU32(output, 0);
  pushU32(output, 0);
  pushU32(output, 0);
  pushU32(output, 0);
  pushU32(output, 0);

  pushU32(output, 0);
  pushU16(output, 2);
  pushU16(output, 5);
  pushU32(output, 0);
  pushU32(output, 0xffffffff);
  pushU32(output, 0);
  pushU32(output, 0);
  pushU32(output, 3);

  const x0Offset = output.length;
  pushF64(output, 0.1);
  pushF64(output, 0);
  const y0Offset = output.length;
  pushF64(output, 0.2);
  pushF64(output, 0);
  const x1Offset = output.length;
  pushF64(output, 0.3);
  pushF64(output, 1);
  const y1Offset = output.length;
  pushF64(output, 0.4);
  pushF64(output, 1);
  const polygonXOffset = output.length;
  pushF64(output, 0);
  pushF64(output, 1);
  pushF64(output, 1);
  const polygonYOffset = output.length;
  pushF64(output, 0);
  pushF64(output, 0);
  pushF64(output, 1);

  output[0] = 'P'.charCodeAt(0);
  output[1] = 'L'.charCodeAt(0);
  output[2] = 'G'.charCodeAt(0);
  output[3] = 'E'.charCodeAt(0);
  setU16(output, 4, 3);
  setU16(output, 6, 96);
  setU32(output, 8, 1000);
  setU32(output, 12, 2);
  setU32(output, 16, 3);
  setU32(output, 20, 0);
  setU32(output, 24, shapeTableOffset);
  setU32(output, 28, x0Offset);
  setU32(output, 32, y0Offset);
  setU32(output, 36, x1Offset);
  setU32(output, 40, y1Offset);
  setU32(output, 44, polygonXOffset);
  setU32(output, 48, polygonYOffset);
  setU32(output, 52, output.length);
  return Uint8Array.from(output);
}

function createHelloPayloadFixture(): Uint8Array {
  const output: number[] = [];
  pushU16(output, 2);
  pushU16(output, 0);
  pushU32(output, 1000);
  pushU32(output, 1);
  pushU32(output, 1);
  pushU32(output, 0);
  pushU32(output, 0);
  pushU32(output, 2);
  pushU32(output, 0);
  pushF64(output, 0);
  pushF64(output, 0);
  pushF64(output, 1.2);
  pushF64(output, 3.78);
  pushString(output, 'layout-open-test');
  pushString(output, 'sg13g2_stdcell.lef');
  return Uint8Array.from(output);
}

function createStatusPayloadFixture(): Uint8Array {
  const strings: number[] = [];
  const errorOffset = strings.length;
  pushString(strings, 'still parsing');
  const output = new Array<number>(116).fill(0);
  const stringOffset = output.length;
  output.push(...strings);
  writeMagic(output, 'PLST');
  setU16(output, 4, 3);
  setU16(output, 6, 116);
  setU32(output, 8, 1);
  setU32(output, 12, 2);
  setU64(output, 16, 1000);
  setU64(output, 24, 500);
  setU32(output, 32, 12);
  setU32(output, 36, 2);
  setU32(output, 40, 3);
  setU32(output, 44, 4);
  setU32(output, 48, 5);
  setU32(output, 52, 6);
  setU32(output, 56, 7);
  setU64(output, 60, 100);
  setU64(output, 68, 20);
  setU64(output, 76, 80);
  setU32(output, 84, 1);
  setU32(output, 88, 0);
  setU32(output, 92, stringOffset);
  setU32(output, 96, strings.length);
  setU32(output, 100, errorOffset);
  return Uint8Array.from(output);
}

function createCatalogSummaryPayloadFixture(): Uint8Array {
  const strings: number[] = [];
  const textEncoder = new TextEncoder();
  const addString = (value: string) => {
    const offset = strings.length;
    const encoded = textEncoder.encode(value);
    pushU32(strings, encoded.byteLength);
    strings.push(...encoded);
    return offset;
  };
  const output = new Array<number>(152).fill(0);
  const layerOffset = output.length;
  pushU32(output, addString('GDS:5/0'));
  pushU16(output, 0);
  pushU16(output, 0);
  pushF64(output, 0);
  pushF64(output, 0);
  pushF64(output, 0);
  alignTo(output, 4);
  const stringOffset = output.length;
  output.push(...strings);

  writeMagic(output, 'PLCS');
  setU16(output, 4, 3);
  setU16(output, 6, 152);
  setU32(output, 8, 1000);
  setU32(output, 12, 2);
  setU32(output, 16, 12);
  setU32(output, 20, 1);
  setU32(output, 24, 1);
  setF64(output, 28, 0);
  setF64(output, 36, 0);
  setF64(output, 44, 10);
  setF64(output, 52, 6);
  setU32(output, 60, 1);
  setU32(output, 64, layerOffset);
  setU32(output, 68, 1);
  setU32(output, 88, 2);
  setU32(output, 92, 3);
  setU32(output, 96, 4);
  setU32(output, 100, 5);
  setU32(output, 104, 6);
  setU32(output, 108, 7);
  setU32(output, 112, stringOffset);
  setU32(output, 116, strings.length);
  setU64(output, 120, 101);
  setU64(output, 128, 202);
  setU64(output, 136, 303);
  setU64(output, 144, 404);
  return Uint8Array.from(output);
}

function createCatalogCellPagePayloadFixture(): Uint8Array {
  const strings: number[] = [];
  const textEncoder = new TextEncoder();
  const addString = (value: string) => {
    const offset = strings.length;
    const encoded = textEncoder.encode(value);
    pushU32(strings, encoded.byteLength);
    strings.push(...encoded);
    return offset;
  };
  const output = new Array<number>(40).fill(0);
  pushU32(output, addString('CHILD'));
  pushU32(output, 0);
  pushU32(output, 0);
  pushU32(output, 2);
  pushU32(output, 3);
  pushU32(output, 0);
  pushF64(output, 1);
  pushF64(output, 2);
  pushF64(output, 3);
  pushF64(output, 4);
  alignTo(output, 4);
  const stringOffset = output.length;
  output.push(...strings);

  writeMagic(output, 'PLCP');
  setU16(output, 4, 3);
  setU16(output, 6, 40);
  setU32(output, 8, 2);
  setU32(output, 12, 1);
  setU32(output, 16, 1);
  setU32(output, 20, 2);
  setU32(output, 24, 0xffffffff);
  setU32(output, 28, stringOffset);
  setU32(output, 32, strings.length);
  return Uint8Array.from(output);
}

function createCatalogLayerPagePayloadFixture(): Uint8Array {
  const strings: number[] = [];
  const textEncoder = new TextEncoder();
  const addString = (value: string) => {
    const offset = strings.length;
    const encoded = textEncoder.encode(value);
    pushU32(strings, encoded.byteLength);
    strings.push(...encoded);
    return offset;
  };
  const output = new Array<number>(40).fill(0);
  pushU32(output, addString('GDS:7/1'));
  pushU16(output, 0);
  pushU16(output, 0);
  pushF64(output, 0);
  pushF64(output, 0);
  pushF64(output, 0);
  alignTo(output, 4);
  const stringOffset = output.length;
  output.push(...strings);

  writeMagic(output, 'PLCP');
  setU16(output, 4, 3);
  setU16(output, 6, 40);
  setU32(output, 8, 1);
  setU32(output, 12, 0);
  setU32(output, 16, 1);
  setU32(output, 20, 1);
  setU32(output, 24, 0xffffffff);
  setU32(output, 28, stringOffset);
  setU32(output, 32, strings.length);
  return Uint8Array.from(output);
}

function createTileGeometryPayloadFixture(): Uint8Array {
  const geometry = createGeometryPayloadFixture();
  const output = new Array<number>(108).fill(0);
  const geometryOffset = output.length;
  output.push(...geometry);
  writeMagic(output, 'PLTG');
  setU16(output, 4, 3);
  setU16(output, 6, 108);
  setU32(output, 8, 1);
  setU32(output, 12, 99);
  setU32(output, 16, geometryOffset);
  setU32(output, 20, geometry.byteLength);
  setU32(output, 24, 2);
  setU32(output, 28, output.length);
  setU64(output, 32, 1);
  setU64(output, 40, 2);
  setU64(output, 48, 3);
  setU32(output, 56, 4);
  setU32(output, 60, 5);
  setU32(output, 64, 6);
  setU32(output, 68, 7);
  setU32(output, 72, 2);
  setU32(output, 76, 8);
  setU32(output, 80, 9);
  setU64(output, 84, 10);
  setU32(output, 92, 11);
  setU32(output, 96, 12);
  setU32(output, 100, 13);
  setU32(output, 104, 14);
  return Uint8Array.from(output);
}

function createPipeEndpointPath(): string {
  const suffix = `pristine-layout-client-test-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\${suffix}`
    : path.join(os.tmpdir(), `${suffix}.sock`);
}

async function readTestEnvelope(socket: net.Socket) {
  const header = await readTestExact(socket, 24);
  const payloadLength = header.readUInt32LE(16);
  const payload = payloadLength > 0 ? await readTestExact(socket, payloadLength) : Buffer.alloc(0);
  const bytes = Buffer.concat([header, payload]);
  return decodeLayoutEnvelope(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

async function readTestExact(socket: net.Socket, byteLength: number): Promise<Buffer> {
  let buffer = Buffer.alloc(0);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.off('data', handleData);
      socket.off('error', handleError);
      socket.off('close', handleClose);
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const handleClose = () => {
      cleanup();
      reject(new Error('test socket closed while reading'));
    };
    const handleData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.byteLength < byteLength) {
        return;
      }

      cleanup();
      const output = buffer.subarray(0, byteLength);
      const rest = buffer.subarray(byteLength);
      if (rest.byteLength > 0) {
        socket.unshift(rest);
      }
      resolve(output);
    };

    socket.on('data', handleData);
    socket.once('error', handleError);
    socket.once('close', handleClose);
  });
}

function alignTo(output: number[], alignment: number) {
  while (output.length % alignment !== 0) {
    output.push(0);
  }
}

function pushU32(output: number[], value: number) {
  output.push(
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff,
  );
}

function pushU16(output: number[], value: number) {
  output.push(
    value & 0xff,
    (value >> 8) & 0xff,
  );
}

function pushF64(output: number[], value: number) {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, value, true);
  output.push(...new Uint8Array(buffer));
}

function pushString(output: number[], value: string) {
  const encoded = new TextEncoder().encode(value);
  pushU32(output, encoded.byteLength);
  output.push(...encoded);
}

function writeMagic(output: number[], magic: string) {
  for (let index = 0; index < magic.length; index += 1) {
    output[index] = magic.charCodeAt(index);
  }
}

function setU32(output: number[], offset: number, value: number) {
  output[offset] = value & 0xff;
  output[offset + 1] = (value >> 8) & 0xff;
  output[offset + 2] = (value >> 16) & 0xff;
  output[offset + 3] = (value >> 24) & 0xff;
}

function setU16(output: number[], offset: number, value: number) {
  output[offset] = value & 0xff;
  output[offset + 1] = (value >> 8) & 0xff;
}

function setU64(output: number[], offset: number, value: number) {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigUint64(0, BigInt(value), true);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    output[offset + index] = bytes[index] ?? 0;
  }
}

function setF64(output: number[], offset: number, value: number) {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, value, true);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    output[offset + index] = bytes[index] ?? 0;
  }
}
