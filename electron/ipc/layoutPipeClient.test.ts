import { afterEach, describe, expect, it } from 'vitest';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import {
  closeAllLayoutPipeSessions,
  decodeLayoutEnvelope,
  encodeLayoutEnvelope,
  encodeLayoutGeometryRequestPayload,
  getOpenLayoutPipeSessionCount,
  normalizeLayoutOpenSessionMetadata,
  openLayoutPipeSession,
  parseLayoutCatalogPayload,
  parseLayoutGeometryPayload,
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
    expect(view.getUint16(4, true)).toBe(2);
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
  });

  it('parses catalog payloads into layout metadata', () => {
    const catalog = parseLayoutCatalogPayload(createCatalogPayloadFixture());

    expect(catalog.unitsPerMicron).toBe(1000);
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
      protocol: 'pristine-layout-columnar-v2',
      sessionId: '1',
      title: 'sg13g2_stdcell.lef',
      lefCount: 1,
      unitsPerMicron: 1000,
      bbox: { x0: 0, y0: 0, x1: 1, y1: 1 },
    })).toMatchObject({
      endpoint: { kind: 'namedPipe', path: '\\\\.\\pipe\\layout-test' },
      protocol: 'pristine-layout-columnar-v2',
      sessionId: '1',
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
        protocol: 'pristine-layout-columnar-v2',
        sessionId: 'layout-open-test',
        title: 'sg13g2_stdcell.lef',
        unitsPerMicron: 1000,
      });

      expect(session.catalog.layers).toHaveLength(1);
      expect(session.catalog.macros[0]?.name).toBe('sg13g2_inv_1');
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

  const output = new Array<number>(80).fill(0);
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

  const viaOffset = output.length;
  const componentOffset = output.length;
  const netOffset = output.length;
  const diagnosticOffset = output.length;
  alignTo(output, 4);
  const stringOffset = output.length;
  output.push(...strings);

  output[0] = 'P'.charCodeAt(0);
  output[1] = 'L'.charCodeAt(0);
  output[2] = 'C'.charCodeAt(0);
  output[3] = 'T'.charCodeAt(0);
  setU16(output, 4, 2);
  setU16(output, 6, 80);
  setU32(output, 8, 1000);
  setU32(output, 12, 1);
  setU32(output, 16, 1);
  setU32(output, 20, 0);
  setU32(output, 24, 0);
  setU32(output, 28, 0);
  setU32(output, 32, 0);
  setU32(output, 36, layerOffset);
  setU32(output, 40, macroOffset);
  setU32(output, 44, viaOffset);
  setU32(output, 48, componentOffset);
  setU32(output, 52, netOffset);
  setU32(output, 56, diagnosticOffset);
  setU32(output, 60, stringOffset);
  setU32(output, 64, strings.length);
  setU32(output, 68, 1);
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
  setU16(output, 4, 2);
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
