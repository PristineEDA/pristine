import { afterEach, describe, expect, it } from 'vitest';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import type { LspWaveformFrameOptions } from '../../types/systemverilog-lsp.js';
import {
  closeAllWaveformPipeSessions,
  decodeWaveformEnvelope,
  encodeViewportFrameRequestPayload,
  encodeWaveformEnvelope,
  getOpenWaveformPipeSessionCount,
  normalizeWaveformOpenSessionMetadata,
  openWaveformPipeSession,
  parseCatalogPayload,
} from './waveformPipeClient.js';

describe('waveformPipeClient', () => {
  afterEach(async () => {
    await closeAllWaveformPipeSessions();
  });

  it('encodes and decodes PWF1 envelope headers', () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    const encoded = encodeWaveformEnvelope(5, 42, payload, 7);
    const view = new DataView(encoded);
    const bytes = new Uint8Array(encoded);

    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('PWF1');
    expect(view.getUint16(4, true)).toBe(1);
    expect(view.getUint16(6, true)).toBe(5);
    expect(view.getUint32(8, true)).toBe(42);
    expect(view.getUint32(12, true)).toBe(7);
    expect(view.getUint32(16, true)).toBe(payload.byteLength);

    const decoded = decodeWaveformEnvelope(encoded);
    expect(decoded).toMatchObject({
      flags: 7,
      messageType: 5,
      requestId: 42,
    });
    expect([...decoded.payload]).toEqual([...payload]);
  });

  it('encodes viewport frame requests using the engine payload layout', () => {
    const options: LspWaveformFrameOptions = {
      sessionId: 'session-1',
      startTime: 12,
      endTime: 88,
      width: 640,
      height: 360,
      laneHeight: 30,
      headerHeight: 22,
      maxSegments: 512,
      signalIds: ['clk', 'u_top.counting'],
    };
    const payload = encodeViewportFrameRequestPayload(options);
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    let offset = 0;

    expect(view.getFloat64(offset, true)).toBe(12);
    offset += 8;
    expect(view.getFloat64(offset, true)).toBe(88);
    offset += 8;
    expect(view.getFloat32(offset, true)).toBe(640);
    offset += 4;
    expect(view.getFloat32(offset, true)).toBe(30);
    offset += 4;
    expect(view.getFloat32(offset, true)).toBe(22);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(512);
    offset += 4;
    expect(view.getUint32(offset, true)).toBe(2);
    offset += 4;

    const firstLength = view.getUint32(offset, true);
    offset += 4;
    expect(new TextDecoder().decode(payload.subarray(offset, offset + firstLength))).toBe('clk');
    offset += firstLength;
    const secondLength = view.getUint32(offset, true);
    offset += 4;
    expect(new TextDecoder().decode(payload.subarray(offset, offset + secondLength))).toBe('u_top.counting');
  });

  it('parses catalog payloads into renderer waveform metadata', () => {
    const payload = createCatalogPayloadFixture();
    const catalog = parseCatalogPayload(payload);

    expect(catalog.groups).toEqual([{ id: 'tb', label: 'tb' }]);
    expect(catalog.signals).toEqual([{
      id: 'tb-count',
      groupId: 'tb',
      name: 'count',
      path: 'tb.count',
      kind: 'bus',
      color: '#12abef',
      width: 16,
    }]);
  });

  it('validates LSP waveform open metadata before connecting to the pipe', () => {
    expect(normalizeWaveformOpenSessionMetadata({
      duration: 200,
      endpoint: { kind: 'namedPipe', path: '\\\\.\\pipe\\waveform-test' },
      protocol: 'pristine-waveform-columnar-v1',
      sessionId: '1',
      timescaleUnit: 'ns',
      title: 'counter_tb',
    })).toMatchObject({
      duration: 200,
      endpoint: { kind: 'namedPipe', path: '\\\\.\\pipe\\waveform-test' },
      protocol: 'pristine-waveform-columnar-v1',
      sessionId: '1',
      timescaleUnit: 'ns',
      title: 'counter_tb',
    });

    expect(() => normalizeWaveformOpenSessionMetadata({
      duration: 200,
      endpoint: { kind: 'namedPipe', path: '\\\\.\\pipe\\waveform-test' },
      protocol: 'json',
      sessionId: '1',
    })).toThrow('Unsupported waveform protocol');
  });

  it('clears any tracked pipe sessions when asked to close all', async () => {
    await closeAllWaveformPipeSessions();
    expect(getOpenWaveformPipeSessionCount()).toBe(0);
  });

  it('opens a pipe session when response header and payload arrive together', async () => {
    const endpointPath = createPipeEndpointPath();
    const server = net.createServer((socket) => {
      void (async () => {
        const hello = await readTestEnvelope(socket);
        socket.write(Buffer.from(encodeWaveformEnvelope(2, hello.requestId, createHelloPayloadFixture())));

        const catalog = await readTestEnvelope(socket);
        socket.write(Buffer.from(encodeWaveformEnvelope(4, catalog.requestId, createCatalogPayloadFixture())));
      })().catch((error) => {
        socket.destroy(error);
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(endpointPath, resolve);
    });

    try {
      const session = await openWaveformPipeSession({
        duration: 200,
        endpoint: {
          kind: process.platform === 'win32' ? 'namedPipe' : 'unixSocket',
          path: endpointPath,
        },
        protocol: 'pristine-waveform-columnar-v1',
        sessionId: 'coalesced-response-test',
        timescaleUnit: 'ns',
        title: 'counter_tb',
      });

      expect(session.signals).toHaveLength(1);
      expect(session.groups).toEqual([{ id: 'tb', label: 'tb' }]);
    } finally {
      await closeAllWaveformPipeSessions();
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
  const groupTable: number[] = [];
  const signalTable: number[] = [];
  const textEncoder = new TextEncoder();
  const addString = (value: string) => {
    const offset = strings.length;
    const encoded = textEncoder.encode(value);
    pushU32(strings, encoded.byteLength);
    strings.push(...encoded);
    return offset;
  };

  pushU32(groupTable, addString('tb'));
  pushU32(groupTable, addString('tb'));

  pushU32(signalTable, addString('tb-count'));
  pushU32(signalTable, addString('count'));
  pushU32(signalTable, addString('tb.count'));
  pushU32(signalTable, 0);
  signalTable.push(3, 0, 0, 0);
  pushU32(signalTable, 0x12abef);
  pushU32(signalTable, 16);

  const output: number[] = [];
  pushU32(output, 1);
  pushU32(output, 1);
  pushU32(output, groupTable.length);
  pushU32(output, signalTable.length);
  pushU32(output, strings.length);
  output.push(...groupTable, ...signalTable, ...strings);
  return Uint8Array.from(output);
}

function createHelloPayloadFixture(): Uint8Array {
  const output: number[] = [];
  pushU16(output, 1);
  pushU16(output, 0);
  pushF64(output, 200);
  pushU32(output, 1);
  pushU32(output, 1);
  pushString(output, 'counter_tb');
  pushString(output, 'counter_tb');
  pushString(output, 'ns');
  return Uint8Array.from(output);
}

function createPipeEndpointPath(): string {
  const suffix = `pristine-waveform-client-test-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\${suffix}`
    : path.join(os.tmpdir(), `${suffix}.sock`);
}

async function readTestEnvelope(socket: net.Socket) {
  const header = await readTestExact(socket, 24);
  const payloadLength = header.readUInt32LE(16);
  const payload = payloadLength > 0 ? await readTestExact(socket, payloadLength) : Buffer.alloc(0);
  const bytes = Buffer.concat([header, payload]);
  return decodeWaveformEnvelope(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
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
