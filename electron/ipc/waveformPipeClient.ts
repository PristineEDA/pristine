import net from 'node:net';

import type {
  LspWaveformFrameOptions,
  LspWaveformGroup,
  LspWaveformOpenResult,
  LspWaveformSignal,
  LspWaveformSignalKind,
} from '../../types/systemverilog-lsp.js';

const waveformProtocolName = 'pristine-waveform-columnar-v1';
const waveformProtocolVersion = 1;
const waveformEnvelopeHeaderByteLength = 24;
const waveformMaxPayloadByteLength = 128 * 1024 * 1024;
const waveformPipeRequestTimeoutMs = 10_000;

const waveformMessageType = {
  hello: 1,
  helloResponse: 2,
  catalogRequest: 3,
  catalogResponse: 4,
  viewportFrameRequest: 5,
  viewportFrameResponse: 6,
  errorResponse: 7,
  close: 8,
  viewportFrameRequestV2: 9,
  viewportFrameResponseV2: 10,
} as const;

interface WaveformEndpoint {
  kind: string;
  path: string;
}

export interface WaveformOpenSessionMetadata {
  duration: number;
  endpoint: WaveformEndpoint;
  protocol: string;
  sessionId: string;
  signalCount?: number;
  timescaleUnit: string;
  title: string;
}

interface WaveformEnvelope {
  flags: number;
  messageType: number;
  payload: Uint8Array;
  requestId: number;
}

interface WaveformPipeSession {
  metadata: WaveformOpenSessionMetadata;
  nextRequestId: number;
  readBuffer: Buffer;
  requestQueue: Promise<void>;
  socket: net.Socket;
}

interface CatalogPayload {
  groups: LspWaveformGroup[];
  signals: LspWaveformSignal[];
}

const waveformPipeSessions = new Map<string, WaveformPipeSession>();

export function normalizeWaveformOpenSessionMetadata(value: unknown): WaveformOpenSessionMetadata {
  if (!value || typeof value !== 'object') {
    throw new Error('Waveform open response must be an object.');
  }

  const candidate = value as {
    duration?: unknown;
    endpoint?: unknown;
    protocol?: unknown;
    sessionId?: unknown;
    signalCount?: unknown;
    timescaleUnit?: unknown;
    title?: unknown;
  };
  const endpoint = normalizeWaveformEndpoint(candidate.endpoint);
  const protocol = typeof candidate.protocol === 'string' ? candidate.protocol : '';

  if (protocol !== waveformProtocolName) {
    throw new Error(`Unsupported waveform protocol: ${protocol || '<missing>'}`);
  }

  if (typeof candidate.sessionId !== 'string' || candidate.sessionId.length === 0) {
    throw new Error('Waveform open response must include a sessionId.');
  }

  if (typeof candidate.duration !== 'number' || !Number.isFinite(candidate.duration) || candidate.duration <= 0) {
    throw new Error('Waveform open response must include a positive duration.');
  }

  return {
    duration: candidate.duration,
    endpoint,
    protocol,
    sessionId: candidate.sessionId,
    signalCount: typeof candidate.signalCount === 'number' && Number.isInteger(candidate.signalCount) && candidate.signalCount >= 0
      ? candidate.signalCount
      : undefined,
    timescaleUnit: typeof candidate.timescaleUnit === 'string' && candidate.timescaleUnit.length > 0 ? candidate.timescaleUnit : 'ns',
    title: typeof candidate.title === 'string' && candidate.title.length > 0 ? candidate.title : 'Waveform',
  };
}

export async function openWaveformPipeSession(metadata: WaveformOpenSessionMetadata): Promise<LspWaveformOpenResult> {
  await closeWaveformPipeSession(metadata.sessionId);

  const socket = await connectWaveformPipe(metadata.endpoint);
  const session: WaveformPipeSession = {
    metadata,
    nextRequestId: 1,
    readBuffer: Buffer.alloc(0),
    requestQueue: Promise.resolve(),
    socket,
  };
  waveformPipeSessions.set(metadata.sessionId, session);

  try {
    const helloResponse = await sendWaveformPipeRequest(session, waveformMessageType.hello);
    if (helloResponse.messageType !== waveformMessageType.helloResponse) {
      throw new Error(`Unexpected waveform hello response type: ${helloResponse.messageType}`);
    }

    const catalogResponse = await sendWaveformPipeRequest(session, waveformMessageType.catalogRequest);
    if (catalogResponse.messageType !== waveformMessageType.catalogResponse) {
      throw new Error(`Unexpected waveform catalog response type: ${catalogResponse.messageType}`);
    }

    const catalog = parseCatalogPayload(catalogResponse.payload);

    return {
      sessionId: metadata.sessionId,
      id: metadata.sessionId,
      title: metadata.title,
      timescaleUnit: metadata.timescaleUnit,
      duration: metadata.duration,
      cursorTime: 0,
      groups: catalog.groups,
      signals: catalog.signals,
      messages: [],
    };
  } catch (error) {
    await closeWaveformPipeSession(metadata.sessionId);
    throw error;
  }
}

export async function requestWaveformPipeFrame(options: LspWaveformFrameOptions): Promise<ArrayBuffer> {
  const session = waveformPipeSessions.get(options.sessionId);
  if (!session) {
    throw new Error(`Waveform session is not open: ${options.sessionId}`);
  }

  const useV2 = options.protocolVersion === 2;
  const response = await runExclusiveWaveformPipeRequest(session, () => sendWaveformPipeRequest(
    session,
    useV2 ? waveformMessageType.viewportFrameRequestV2 : waveformMessageType.viewportFrameRequest,
    useV2 ? encodeViewportFrameRequestPayloadV2(options) : encodeViewportFrameRequestPayload(options),
  ));

  const expectedResponseType = useV2 ? waveformMessageType.viewportFrameResponseV2 : waveformMessageType.viewportFrameResponse;
  if (response.messageType !== expectedResponseType) {
    throw new Error(`Unexpected waveform frame response type: ${response.messageType}`);
  }

  return copyToArrayBuffer(response.payload);
}

export async function closeWaveformPipeSession(sessionId: string): Promise<void> {
  const session = waveformPipeSessions.get(sessionId);
  if (!session) {
    return;
  }

  waveformPipeSessions.delete(sessionId);

  try {
    const envelope = encodeWaveformEnvelope(waveformMessageType.close, session.nextRequestId++, new Uint8Array());
    session.socket.write(Buffer.from(envelope));
  } catch {
    // Closing is best-effort; the following socket teardown is the actual resource release.
  } finally {
    session.socket.destroy();
  }
}

export async function closeAllWaveformPipeSessions(): Promise<void> {
  const sessionIds = [...waveformPipeSessions.keys()];
  await Promise.all(sessionIds.map((sessionId) => closeWaveformPipeSession(sessionId)));
}

export function getOpenWaveformPipeSessionCount(): number {
  return waveformPipeSessions.size;
}

export function encodeWaveformEnvelope(messageType: number, requestId: number, payload: Uint8Array<ArrayBufferLike>, flags = 0): ArrayBuffer {
  if (payload.byteLength > waveformMaxPayloadByteLength) {
    throw new Error('Waveform payload is too large.');
  }

  const buffer = new ArrayBuffer(waveformEnvelopeHeaderByteLength + payload.byteLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  bytes[0] = 0x50;
  bytes[1] = 0x57;
  bytes[2] = 0x46;
  bytes[3] = 0x31;
  view.setUint16(4, waveformProtocolVersion, true);
  view.setUint16(6, messageType, true);
  view.setUint32(8, requestId, true);
  view.setUint32(12, flags, true);
  view.setUint32(16, payload.byteLength, true);
  view.setUint32(20, 0, true);
  bytes.set(payload, waveformEnvelopeHeaderByteLength);
  return buffer;
}

export function decodeWaveformEnvelope(buffer: ArrayBuffer): WaveformEnvelope {
  if (buffer.byteLength < waveformEnvelopeHeaderByteLength) {
    throw new Error('Waveform envelope is shorter than the header.');
  }

  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x57 || bytes[2] !== 0x46 || bytes[3] !== 0x31) {
    throw new Error('Invalid waveform envelope magic.');
  }

  const version = view.getUint16(4, true);
  if (version !== waveformProtocolVersion) {
    throw new Error(`Unsupported waveform pipe protocol version: ${version}`);
  }

  const payloadLength = view.getUint32(16, true);
  if (payloadLength > waveformMaxPayloadByteLength) {
    throw new Error('Waveform payload is too large.');
  }

  const expectedLength = waveformEnvelopeHeaderByteLength + payloadLength;
  if (buffer.byteLength !== expectedLength) {
    throw new Error('Waveform envelope length does not match payload size.');
  }

  return {
    flags: view.getUint32(12, true),
    messageType: view.getUint16(6, true),
    payload: new Uint8Array(buffer, waveformEnvelopeHeaderByteLength, payloadLength),
    requestId: view.getUint32(8, true),
  };
}

export function encodeViewportFrameRequestPayload(options: LspWaveformFrameOptions): Uint8Array {
  const signalIds = options.signalIds ?? [];
  const encodedSignalIds = signalIds.map((signalId) => new TextEncoder().encode(signalId));
  const byteLength = 8 + 8 + 4 + 4 + 4 + 4 + 4
    + encodedSignalIds.reduce((sum, encoded) => sum + 4 + encoded.byteLength, 0);
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  const output = new Uint8Array(buffer);
  let offset = 0;

  view.setFloat64(offset, options.startTime, true);
  offset += 8;
  view.setFloat64(offset, options.endTime, true);
  offset += 8;
  view.setFloat32(offset, options.width, true);
  offset += 4;
  view.setFloat32(offset, options.laneHeight, true);
  offset += 4;
  view.setFloat32(offset, options.headerHeight, true);
  offset += 4;
  view.setUint32(offset, options.maxSegments ?? 0, true);
  offset += 4;
  view.setUint32(offset, encodedSignalIds.length, true);
  offset += 4;

  for (const encoded of encodedSignalIds) {
    view.setUint32(offset, encoded.byteLength, true);
    offset += 4;
    output.set(encoded, offset);
    offset += encoded.byteLength;
  }

  return output;
}

export function encodeViewportFrameRequestPayloadV2(options: LspWaveformFrameOptions): Uint8Array {
  const signalIds = options.signalIds ?? [];
  const encodedSignalIds = signalIds.map((signalId) => new TextEncoder().encode(signalId));
  const byteLength = 8 + 8 + 8 + 8 + 4 + 4 + 4 + 4 + 4
    + encodedSignalIds.reduce((sum, encoded) => sum + 4 + encoded.byteLength, 0);
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  const output = new Uint8Array(buffer);
  const preparedStartTime = options.preparedStartTime ?? options.startTime;
  const preparedEndTime = options.preparedEndTime ?? options.endTime;
  const viewportStartTime = options.viewportStartTime ?? options.startTime;
  const viewportEndTime = options.viewportEndTime ?? options.endTime;
  let offset = 0;

  view.setFloat64(offset, preparedStartTime, true);
  offset += 8;
  view.setFloat64(offset, preparedEndTime, true);
  offset += 8;
  view.setFloat64(offset, viewportStartTime, true);
  offset += 8;
  view.setFloat64(offset, viewportEndTime, true);
  offset += 8;
  view.setFloat32(offset, options.width, true);
  offset += 4;
  view.setFloat32(offset, options.laneHeight, true);
  offset += 4;
  view.setFloat32(offset, options.headerHeight, true);
  offset += 4;
  view.setUint32(offset, options.maxSegments ?? 0, true);
  offset += 4;
  view.setUint32(offset, encodedSignalIds.length, true);
  offset += 4;

  for (const encoded of encodedSignalIds) {
    view.setUint32(offset, encoded.byteLength, true);
    offset += 4;
    output.set(encoded, offset);
    offset += encoded.byteLength;
  }

  return output;
}

export function parseCatalogPayload(payload: Uint8Array): CatalogPayload {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const groupCount = readU32(view, 0);
  const signalCount = readU32(view, 4);
  const groupTableByteLength = readU32(view, 8);
  const signalTableByteLength = readU32(view, 12);
  const stringTableByteLength = readU32(view, 16);
  const groupTableOffset = 20;
  const signalTableOffset = groupTableOffset + groupTableByteLength;
  const stringTableOffset = signalTableOffset + signalTableByteLength;

  requirePayloadRange(payload.byteLength, groupTableOffset, groupTableByteLength, 'group table');
  requirePayloadRange(payload.byteLength, signalTableOffset, signalTableByteLength, 'signal table');
  requirePayloadRange(payload.byteLength, stringTableOffset, stringTableByteLength, 'string table');

  const expectedGroupTableLength = groupCount * 8;
  const expectedSignalTableLength = signalCount * 28;
  if (groupTableByteLength !== expectedGroupTableLength) {
    throw new Error('Waveform catalog group table has an invalid length.');
  }
  if (signalTableByteLength !== expectedSignalTableLength) {
    throw new Error('Waveform catalog signal table has an invalid length.');
  }

  const strings = new Uint8Array(payload.buffer, payload.byteOffset + stringTableOffset, stringTableByteLength);
  const groups: LspWaveformGroup[] = [];
  const signals: LspWaveformSignal[] = [];

  for (let index = 0; index < groupCount; index += 1) {
    const entryOffset = groupTableOffset + index * 8;
    groups.push({
      id: readCatalogString(strings, readU32(view, entryOffset)),
      label: readCatalogString(strings, readU32(view, entryOffset + 4)),
    });
  }

  for (let index = 0; index < signalCount; index += 1) {
    const entryOffset = signalTableOffset + index * 28;
    const id = readCatalogString(strings, readU32(view, entryOffset));
    const name = readCatalogString(strings, readU32(view, entryOffset + 4));
    const signalPath = readCatalogString(strings, readU32(view, entryOffset + 8));
    const groupIndex = readU32(view, entryOffset + 12);
    const kind = normalizePipeSignalKind(payload[entryOffset + 16]);
    const colorRgb = readU32(view, entryOffset + 20);
    const width = readU32(view, entryOffset + 24);
    const group = groups[groupIndex];

    if (!group) {
      throw new Error(`Waveform catalog signal references unknown group index: ${groupIndex}`);
    }

    signals.push({
      id,
      groupId: group.id,
      name,
      path: signalPath,
      kind,
      color: `#${colorRgb.toString(16).padStart(6, '0').slice(-6)}`,
      width: width > 0 ? width : undefined,
    });
  }

  return { groups, signals };
}

async function sendWaveformPipeRequest(
  session: WaveformPipeSession,
  messageType: number,
  payload: Uint8Array<ArrayBufferLike> = new Uint8Array(),
): Promise<WaveformEnvelope> {
  const requestId = session.nextRequestId++;
  const request = encodeWaveformEnvelope(messageType, requestId, payload);

  await withWaveformPipeTimeout(writeAll(session.socket, new Uint8Array(request)), messageType);
  const response = await withWaveformPipeTimeout(readWaveformEnvelope(session), messageType);

  if (response.messageType === waveformMessageType.errorResponse) {
    throw new Error(parseErrorPayload(response.payload));
  }

  if (response.requestId !== requestId) {
    throw new Error(`Unexpected waveform response request id: ${response.requestId}`);
  }

  return response;
}

async function runExclusiveWaveformPipeRequest<T>(session: WaveformPipeSession, callback: () => Promise<T>): Promise<T> {
  const previousRequest = session.requestQueue;
  let releaseCurrentRequest: () => void = () => undefined;
  session.requestQueue = new Promise((resolve) => {
    releaseCurrentRequest = resolve;
  });

  await previousRequest.catch(() => undefined);

  try {
    return await callback();
  } finally {
    releaseCurrentRequest();
  }
}

async function connectWaveformPipe(endpoint: WaveformEndpoint): Promise<net.Socket> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < 5_000) {
    try {
      return await new Promise<net.Socket>((resolve, reject) => {
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        const socket = endpoint.kind === 'namedPipe'
          ? net.createConnection(endpoint.path)
          : net.createConnection({ path: endpoint.path });
        const cleanup = () => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = undefined;
          }
          socket.setTimeout(0);
          socket.off('connect', handleConnect);
          socket.off('error', handleError);
          socket.off('timeout', handleTimeout);
        };
        const handleConnect = () => {
          cleanup();
          resolve(socket);
        };
        const handleError = (error: Error) => {
          cleanup();
          socket.destroy();
          reject(error);
        };
        const handleTimeout = () => {
          cleanup();
          socket.destroy();
          reject(new Error(`Timed out connecting to waveform pipe: ${endpoint.path}`));
        };

        socket.once('connect', handleConnect);
        socket.once('error', handleError);
        socket.once('timeout', handleTimeout);
        socket.setTimeout(1_000);
        timeoutHandle = setTimeout(handleTimeout, 1_000);
      });
    } catch (error) {
      lastError = error;
      await delay(50);
    }
  }

  throw new Error(`Failed to connect waveform pipe ${endpoint.path}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function readWaveformEnvelope(session: WaveformPipeSession): Promise<WaveformEnvelope> {
  const header = await readExact(session, waveformEnvelopeHeaderByteLength);
  const headerView = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const payloadLength = headerView.getUint32(16, true);
  if (payloadLength > waveformMaxPayloadByteLength) {
    throw new Error('Waveform payload is too large.');
  }

  const payload = payloadLength > 0 ? await readExact(session, payloadLength) : new Uint8Array();
  const envelopeBytes = new Uint8Array(waveformEnvelopeHeaderByteLength + payloadLength);
  envelopeBytes.set(header, 0);
  envelopeBytes.set(payload, waveformEnvelopeHeaderByteLength);
  return decodeWaveformEnvelope(envelopeBytes.buffer);
}

async function readExact(session: WaveformPipeSession, byteLength: number): Promise<Uint8Array> {
  const immediate = consumeReadBuffer(session, byteLength);
  if (immediate) {
    return immediate;
  }

  return new Promise((resolve, reject) => {
    const socket = session.socket;
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
      reject(new Error('Waveform pipe closed while reading.'));
    };
    const handleData = (chunk: Buffer) => {
      session.readBuffer = Buffer.concat([session.readBuffer, chunk]);
      const output = consumeReadBuffer(session, byteLength);
      if (!output) {
        return;
      }

      cleanup();
      resolve(output);
    };

    socket.on('data', handleData);
    socket.once('error', handleError);
    socket.once('close', handleClose);
  });
}

function consumeReadBuffer(session: WaveformPipeSession, byteLength: number): Uint8Array | null {
  if (session.readBuffer.byteLength < byteLength) {
    return null;
  }

  const output = session.readBuffer.subarray(0, byteLength);
  session.readBuffer = session.readBuffer.subarray(byteLength);
  return new Uint8Array(output.buffer, output.byteOffset, output.byteLength);
}

async function writeAll(socket: net.Socket, bytes: Uint8Array<ArrayBufferLike>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    socket.write(Buffer.from(bytes), (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function parseErrorPayload(payload: Uint8Array): string {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const code = payload.byteLength >= 4 ? view.getUint32(0, true) : 0;
  const message = payload.byteLength >= 8 ? readLengthPrefixedString(payload, 4) : 'Unknown waveform pipe error.';
  return `Waveform pipe error ${code}: ${message}`;
}

function readCatalogString(strings: Uint8Array, offset: number): string {
  return readLengthPrefixedString(strings, offset);
}

function readLengthPrefixedString(bytes: Uint8Array, offset: number): string {
  requirePayloadRange(bytes.byteLength, offset, 4, 'string length');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const byteLength = view.getUint32(offset, true);
  const start = offset + 4;
  requirePayloadRange(bytes.byteLength, start, byteLength, 'string bytes');
  return new TextDecoder().decode(bytes.subarray(start, start + byteLength));
}

function normalizeWaveformEndpoint(value: unknown): WaveformEndpoint {
  if (!value || typeof value !== 'object') {
    throw new Error('Waveform open response must include an endpoint.');
  }

  const candidate = value as { kind?: unknown; path?: unknown };
  if (typeof candidate.kind !== 'string' || typeof candidate.path !== 'string' || candidate.path.length === 0) {
    throw new Error('Waveform endpoint must include kind and path strings.');
  }

  if (candidate.kind !== 'namedPipe' && candidate.kind !== 'unixSocket') {
    throw new Error(`Unsupported waveform endpoint kind: ${candidate.kind}`);
  }

  return {
    kind: candidate.kind,
    path: candidate.path,
  };
}

function normalizePipeSignalKind(value: number | undefined): LspWaveformSignalKind {
  if (value === 1) {
    return 'clock';
  }

  if (value === 3) {
    return 'bus';
  }

  return 'logic';
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function requirePayloadRange(size: number, offset: number, byteLength: number, name: string): void {
  if (offset > size || byteLength > size - offset) {
    throw new Error(`Waveform catalog ${name} is truncated.`);
  }
}

function copyToArrayBuffer(bytes: Uint8Array<ArrayBufferLike>): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withWaveformPipeTimeout<T>(promise: Promise<T>, messageType: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Waveform pipe request ${messageType} timed out after ${waveformPipeRequestTimeoutMs}ms.`));
    }, waveformPipeRequestTimeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  });
}
