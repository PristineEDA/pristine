import net from 'node:net';

import type {
  LspLayoutBounds,
  LspLayoutCatalog,
  LspLayoutCatalogPage,
  LspLayoutCatalogPageOptions,
  LspLayoutCatalogPageTableKind,
  LspLayoutCatalogSummary,
  LspLayoutComponent,
  LspLayoutDefPin,
  LspLayoutDiagnostic,
  LspLayoutGdsCell,
  LspLayoutGdsElement,
  LspLayoutGdsPoint,
  LspLayoutGdsReference,
  LspLayoutGeometry,
  LspLayoutGeometryOptions,
  LspLayoutLayer,
  LspLayoutMacro,
  LspLayoutNet,
  LspLayoutOpenResult,
  LspLayoutPin,
  LspLayoutShape,
  LspLayoutShapeKind,
  LspLayoutStatus,
  LspLayoutStatusPhase,
  LspLayoutStatusState,
  LspLayoutTileGeometry,
  LspLayoutTileGeometryOptions,
  LspLayoutVia,
} from '../../types/systemverilog-lsp.js';

const layoutProtocolName = 'pristine-layout-columnar-v3';
const layoutProtocolVersion = 3;
const layoutEnvelopeHeaderByteLength = 24;
const layoutCatalogHeaderByteLength = 136;
const layoutCatalogSummaryHeaderByteLength = 152;
const layoutCatalogPageHeaderByteLength = 40;
const layoutTileGeometryHeaderByteLength = 108;
const layoutStatusHeaderByteLength = 116;
const layoutPinTableEntryByteLength = 28;
const layoutDefPinTableEntryByteLength = 40;
const layoutGdsCellTableEntryByteLength = 56;
const layoutGdsReferenceTableEntryByteLength = 88;
const layoutGdsElementTableEntryByteLength = 36;
const layoutGdsPointTableEntryByteLength = 16;
const layoutLayerTableEntryByteLength = 32;
const layoutShapeTableEntryByteLength = 28;
const layoutNoMacroIndex = 0xffffffff;
const layoutNoIndex = 0xffffffff;
const layoutMaxPayloadByteLength = 128 * 1024 * 1024;
const layoutPipeRequestTimeoutMs = 10_000;

const layoutMessageType = {
  hello: 1,
  helloResponse: 2,
  catalogRequest: 3,
  catalogResponse: 4,
  geometryRequest: 5,
  geometryResponse: 6,
  errorResponse: 7,
  close: 8,
  tileGeometryRequest: 9,
  tileGeometryResponse: 10,
  catalogSummaryRequest: 19,
  catalogSummaryResponse: 20,
  catalogPageRequest: 21,
  catalogPageResponse: 22,
  statusRequest: 23,
  statusResponse: 24,
} as const;

interface LayoutEndpoint {
  kind: 'namedPipe' | 'unixSocket';
  path: string;
}

export interface LayoutOpenSessionMetadata {
  bbox: LspLayoutBounds | null;
  componentCount: number;
  defPresent: boolean;
  diagnosticCount: number;
  endpoint: LayoutEndpoint;
  fileUris: string[];
  layerCount: number;
  lefCount: number;
  macroCount: number;
  messages: string[];
  netCount: number;
  protocol: string;
  sessionId: string;
  title: string;
  unitsPerMicron: number;
}

interface LayoutEnvelope {
  flags: number;
  messageType: number;
  payload: Uint8Array;
  requestId: number;
}

interface LayoutPipeSession {
  metadata: LayoutOpenSessionMetadata;
  nextRequestId: number;
  readBuffer: Buffer;
  requestQueue: Promise<void>;
  socket: net.Socket;
}

const layoutPipeSessions = new Map<string, LayoutPipeSession>();

export function normalizeLayoutOpenSessionMetadata(value: unknown): LayoutOpenSessionMetadata {
  if (!value || typeof value !== 'object') {
    throw new Error('Layout open response must be an object.');
  }

  const candidate = value as {
    bbox?: unknown;
    componentCount?: unknown;
    defPresent?: unknown;
    diagnosticCount?: unknown;
    endpoint?: unknown;
    fileUris?: unknown;
    layerCount?: unknown;
    lefCount?: unknown;
    macroCount?: unknown;
    messages?: unknown;
    netCount?: unknown;
    protocol?: unknown;
    sessionId?: unknown;
    title?: unknown;
    unitsPerMicron?: unknown;
  };
  const endpoint = normalizeLayoutEndpoint(candidate.endpoint);
  const protocol = typeof candidate.protocol === 'string' ? candidate.protocol : '';

  if (protocol !== layoutProtocolName) {
    throw new Error(`Unsupported layout protocol: ${protocol || '<missing>'}`);
  }

  if (typeof candidate.sessionId !== 'string' || candidate.sessionId.length === 0) {
    throw new Error('Layout open response must include a sessionId.');
  }

  return {
    bbox: normalizeLayoutBounds(candidate.bbox),
    componentCount: normalizeCount(candidate.componentCount),
    defPresent: candidate.defPresent === true,
    diagnosticCount: normalizeCount(candidate.diagnosticCount),
    endpoint,
    fileUris: Array.isArray(candidate.fileUris)
      ? candidate.fileUris.filter((entry): entry is string => typeof entry === 'string')
      : [],
    layerCount: normalizeCount(candidate.layerCount),
    lefCount: normalizeCount(candidate.lefCount),
    macroCount: normalizeCount(candidate.macroCount),
    messages: Array.isArray(candidate.messages)
      ? candidate.messages.filter((entry): entry is string => typeof entry === 'string')
      : [],
    netCount: normalizeCount(candidate.netCount),
    protocol,
    sessionId: candidate.sessionId,
    title: typeof candidate.title === 'string' && candidate.title.length > 0 ? candidate.title : 'Layout',
    unitsPerMicron: normalizePositiveNumber(candidate.unitsPerMicron, 0),
  };
}

export async function openLayoutPipeSession(metadata: LayoutOpenSessionMetadata): Promise<LspLayoutOpenResult> {
  await closeLayoutPipeSession(metadata.sessionId);

  const socket = await connectLayoutPipe(metadata.endpoint);
  const session: LayoutPipeSession = {
    metadata,
    nextRequestId: 1,
    readBuffer: Buffer.alloc(0),
    requestQueue: Promise.resolve(),
    socket,
  };
  layoutPipeSessions.set(metadata.sessionId, session);

  try {
    const helloResponse = await sendLayoutPipeRequest(session, layoutMessageType.hello);
    if (helloResponse.messageType !== layoutMessageType.helloResponse) {
      throw new Error(`Unexpected layout hello response type: ${helloResponse.messageType}`);
    }

    const catalog = await loadInitialLayoutCatalog(session, metadata);

    return {
      sessionId: metadata.sessionId,
      id: metadata.sessionId,
      protocol: metadata.protocol,
      endpoint: metadata.endpoint,
      title: metadata.title,
      lefCount: metadata.lefCount,
      defPresent: metadata.defPresent,
      unitsPerMicron: catalog.unitsPerMicron || metadata.unitsPerMicron,
      bbox: metadata.bbox,
      layerCount: catalog.layers.length,
      macroCount: catalog.macros.length,
      componentCount: catalog.components.length,
      netCount: catalog.nets.length,
      diagnosticCount: catalog.diagnostics.length,
      fileUris: metadata.fileUris,
      messages: metadata.messages,
      catalog,
    };
  } catch (error) {
    await closeLayoutPipeSession(metadata.sessionId);
    throw error;
  }
}

async function loadInitialLayoutCatalog(
  session: LayoutPipeSession,
  metadata: LayoutOpenSessionMetadata,
): Promise<LspLayoutCatalog> {
  const shouldUsePagedGdsCatalog = metadata.protocol === layoutProtocolName && isGdsLayoutTitle(metadata.title);

  if (shouldUsePagedGdsCatalog) {
    try {
      const status = await requestLayoutPipeStatus(metadata.sessionId);
      if (status.state === 'failed') {
        throw new Error(status.error || 'GDS layout parsing failed.');
      }

      const summary = await requestLayoutPipeCatalogSummary(metadata.sessionId);
      const catalog = createCatalogFromSummary(summary);
      if (summary.gdsCellCount > 0) {
        const page = await requestLayoutPipeCatalogPage({
          sessionId: metadata.sessionId,
          tableKind: 'cells',
          offset: 0,
          limit: Math.min(summary.gdsCellCount, 4096),
          maxBytes: 8 * 1024 * 1024,
        });
        catalog.gdsCells = page.gdsCells;
      }
      if (summary.layerCount > 0) {
        const page = await requestLayoutPipeCatalogPage({
          sessionId: metadata.sessionId,
          tableKind: 'layers',
          offset: 0,
          limit: Math.min(summary.layerCount, 4096),
          maxBytes: 4 * 1024 * 1024,
        });
        catalog.layers = page.layers;
      }
      return catalog;
    } catch (error) {
      if (error instanceof Error && /pending|parsing/i.test(error.message)) {
        const summary = await waitForReadyLayoutCatalogSummary(metadata.sessionId);
        const catalog = createCatalogFromSummary(summary);
        if (summary.gdsCellCount > 0) {
          const page = await requestLayoutPipeCatalogPage({
            sessionId: metadata.sessionId,
            tableKind: 'cells',
            offset: 0,
            limit: Math.min(summary.gdsCellCount, 4096),
            maxBytes: 8 * 1024 * 1024,
          });
          catalog.gdsCells = page.gdsCells;
        }
        if (summary.layerCount > 0) {
          const page = await requestLayoutPipeCatalogPage({
            sessionId: metadata.sessionId,
            tableKind: 'layers',
            offset: 0,
            limit: Math.min(summary.layerCount, 4096),
            maxBytes: 4 * 1024 * 1024,
          });
          catalog.layers = page.layers;
        }
        return catalog;
      }
    }
  }

  const catalogResponse = await sendLayoutPipeRequest(session, layoutMessageType.catalogRequest);
  if (catalogResponse.messageType !== layoutMessageType.catalogResponse) {
    throw new Error(`Unexpected layout catalog response type: ${catalogResponse.messageType}`);
  }

  return parseLayoutCatalogPayload(catalogResponse.payload);
}

function isGdsLayoutTitle(title: string): boolean {
  const normalizedTitle = title.toLowerCase();
  return normalizedTitle.endsWith('.gds') || normalizedTitle.endsWith('.gdsii');
}

async function waitForReadyLayoutCatalogSummary(sessionId: string): Promise<LspLayoutCatalogSummary> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    const status = await requestLayoutPipeStatus(sessionId);
    if (status.state === 'failed') {
      throw new Error(status.error || 'GDS layout parsing failed.');
    }
    if (status.state === 'ready') {
      return requestLayoutPipeCatalogSummary(sessionId);
    }
    await delay(150);
  }

  throw new Error('Timed out waiting for GDS layout parsing to finish.');
}

export async function requestLayoutPipeGeometry(options: LspLayoutGeometryOptions): Promise<LspLayoutGeometry> {
  const session = layoutPipeSessions.get(options.sessionId);
  if (!session) {
    throw new Error(`Layout session is not open: ${options.sessionId}`);
  }

  const response = await runExclusiveLayoutPipeRequest(session, () => sendLayoutPipeRequest(
    session,
    layoutMessageType.geometryRequest,
    encodeLayoutGeometryRequestPayload(options),
  ));

  if (response.messageType !== layoutMessageType.geometryResponse) {
    throw new Error(`Unexpected layout geometry response type: ${response.messageType}`);
  }

  return parseLayoutGeometryPayload(response.payload);
}

export async function requestLayoutPipeStatus(sessionId: string): Promise<LspLayoutStatus> {
  const session = getLayoutPipeSession(sessionId);
  const response = await runExclusiveLayoutPipeRequest(session, () => sendLayoutPipeRequest(
    session,
    layoutMessageType.statusRequest,
    encodeLayoutStatusRequestPayload(),
  ));

  if (response.messageType !== layoutMessageType.statusResponse) {
    throw new Error(`Unexpected layout status response type: ${response.messageType}`);
  }

  return parseLayoutStatusPayload(response.payload);
}

export async function requestLayoutPipeCatalogSummary(sessionId: string): Promise<LspLayoutCatalogSummary> {
  const session = getLayoutPipeSession(sessionId);
  const response = await runExclusiveLayoutPipeRequest(session, () => sendLayoutPipeRequest(
    session,
    layoutMessageType.catalogSummaryRequest,
  ));

  if (response.messageType !== layoutMessageType.catalogSummaryResponse) {
    throw new Error(`Unexpected layout catalog summary response type: ${response.messageType}`);
  }

  return parseLayoutCatalogSummaryPayload(response.payload);
}

export async function requestLayoutPipeCatalogPage(options: LspLayoutCatalogPageOptions): Promise<LspLayoutCatalogPage> {
  const session = getLayoutPipeSession(options.sessionId);
  const response = await runExclusiveLayoutPipeRequest(session, () => sendLayoutPipeRequest(
    session,
    layoutMessageType.catalogPageRequest,
    encodeLayoutCatalogPageRequestPayload(options),
  ));

  if (response.messageType !== layoutMessageType.catalogPageResponse) {
    throw new Error(`Unexpected layout catalog page response type: ${response.messageType}`);
  }

  return parseLayoutCatalogPagePayload(response.payload);
}

export async function requestLayoutPipeTileGeometry(options: LspLayoutTileGeometryOptions): Promise<LspLayoutTileGeometry> {
  const session = getLayoutPipeSession(options.sessionId);
  const response = await runExclusiveLayoutPipeRequest(session, () => sendLayoutPipeRequest(
    session,
    layoutMessageType.tileGeometryRequest,
    encodeLayoutTileGeometryRequestPayload(options, session.metadata.unitsPerMicron),
  ));

  if (response.messageType !== layoutMessageType.tileGeometryResponse) {
    throw new Error(`Unexpected layout tile geometry response type: ${response.messageType}`);
  }

  return parseLayoutTileGeometryPayload(response.payload);
}

function getLayoutPipeSession(sessionId: string): LayoutPipeSession {
  const session = layoutPipeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Layout session is not open: ${sessionId}`);
  }
  return session;
}

export async function closeLayoutPipeSession(sessionId: string): Promise<void> {
  const session = layoutPipeSessions.get(sessionId);
  if (!session) {
    return;
  }

  layoutPipeSessions.delete(sessionId);

  try {
    const envelope = encodeLayoutEnvelope(layoutMessageType.close, session.nextRequestId++, new Uint8Array());
    session.socket.write(Buffer.from(envelope));
  } catch {
    // Closing is best-effort; the socket teardown below releases the resource.
  } finally {
    session.socket.destroy();
  }
}

export async function closeAllLayoutPipeSessions(): Promise<void> {
  const sessionIds = [...layoutPipeSessions.keys()];
  await Promise.all(sessionIds.map((sessionId) => closeLayoutPipeSession(sessionId)));
}

export function getOpenLayoutPipeSessionCount(): number {
  return layoutPipeSessions.size;
}

export function encodeLayoutEnvelope(messageType: number, requestId: number, payload: Uint8Array<ArrayBufferLike>, flags = 0): ArrayBuffer {
  if (payload.byteLength > layoutMaxPayloadByteLength) {
    throw new Error('Layout payload is too large.');
  }

  const buffer = new ArrayBuffer(layoutEnvelopeHeaderByteLength + payload.byteLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  bytes[0] = 0x50;
  bytes[1] = 0x4c;
  bytes[2] = 0x44;
  bytes[3] = 0x31;
  view.setUint16(4, layoutProtocolVersion, true);
  view.setUint16(6, messageType, true);
  view.setUint32(8, requestId, true);
  view.setUint32(12, flags, true);
  view.setUint32(16, payload.byteLength, true);
  view.setUint32(20, 0, true);
  bytes.set(payload, layoutEnvelopeHeaderByteLength);
  return buffer;
}

export function decodeLayoutEnvelope(buffer: ArrayBuffer): LayoutEnvelope {
  if (buffer.byteLength < layoutEnvelopeHeaderByteLength) {
    throw new Error('Layout envelope is shorter than the header.');
  }

  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4c || bytes[2] !== 0x44 || bytes[3] !== 0x31) {
    throw new Error('Invalid layout envelope magic.');
  }

  const version = view.getUint16(4, true);
  if (version !== layoutProtocolVersion) {
    throw new Error(`Unsupported layout pipe protocol version: ${version}`);
  }

  const payloadLength = view.getUint32(16, true);
  if (payloadLength > layoutMaxPayloadByteLength) {
    throw new Error('Layout payload is too large.');
  }

  const expectedLength = layoutEnvelopeHeaderByteLength + payloadLength;
  if (buffer.byteLength !== expectedLength) {
    throw new Error('Layout envelope length does not match payload size.');
  }

  return {
    flags: view.getUint32(12, true),
    messageType: view.getUint16(6, true),
    payload: new Uint8Array(buffer, layoutEnvelopeHeaderByteLength, payloadLength),
    requestId: view.getUint32(8, true),
  };
}

export function encodeLayoutGeometryRequestPayload(options: LspLayoutGeometryOptions): Uint8Array {
  const layerIndices = options.layerIndices ?? [];
  const shapeKinds = options.shapeKinds ?? [];
  const macroIndices = options.macroIndices ?? [];
  const gdsRootCellIndices = options.gdsRootCellIndices ?? [];
  const hasBbox = Boolean(options.bbox);
  const hasOwnerFilters = macroIndices.length > 0 || gdsRootCellIndices.length > 0;
  const bboxByteLength = hasBbox ? 32 : 0;
  const ownerFilterByteLength = hasOwnerFilters
    ? 4 + macroIndices.length * 4 + 4 + gdsRootCellIndices.length * 4
    : 0;
  const byteLength = 4 + 4 + bboxByteLength
    + 4 + layerIndices.length * 4
    + 4 + shapeKinds.length * 4
    + ownerFilterByteLength;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  let offset = 0;

  view.setUint32(offset, (hasBbox ? 1 : 0) | (hasOwnerFilters ? 2 : 0), true);
  offset += 4;
  view.setUint32(offset, normalizeMaxShapes(options.maxShapes), true);
  offset += 4;

  if (options.bbox) {
    view.setFloat64(offset, options.bbox.x0, true);
    offset += 8;
    view.setFloat64(offset, options.bbox.y0, true);
    offset += 8;
    view.setFloat64(offset, options.bbox.x1, true);
    offset += 8;
    view.setFloat64(offset, options.bbox.y1, true);
    offset += 8;
  }

  view.setUint32(offset, layerIndices.length, true);
  offset += 4;
  for (const layerIndex of layerIndices) {
    view.setUint32(offset, layerIndex, true);
    offset += 4;
  }

  view.setUint32(offset, shapeKinds.length, true);
  offset += 4;
  for (const shapeKind of shapeKinds) {
    view.setUint32(offset, shapeKind, true);
    offset += 4;
  }

  if (hasOwnerFilters) {
    view.setUint32(offset, macroIndices.length, true);
    offset += 4;
    for (const macroIndex of macroIndices) {
      view.setUint32(offset, macroIndex, true);
      offset += 4;
    }

    view.setUint32(offset, gdsRootCellIndices.length, true);
    offset += 4;
    for (const gdsRootCellIndex of gdsRootCellIndices) {
      view.setUint32(offset, gdsRootCellIndex, true);
      offset += 4;
    }
  }

  return new Uint8Array(buffer);
}

export function encodeLayoutStatusRequestPayload(): Uint8Array {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, 0, true);
  return new Uint8Array(buffer);
}

export function encodeLayoutCatalogPageRequestPayload(options: LspLayoutCatalogPageOptions): Uint8Array {
  const buffer = new ArrayBuffer(20);
  const view = new DataView(buffer);
  view.setUint32(0, 0, true);
  view.setUint32(4, catalogPageTableKindToCode(options.tableKind), true);
  view.setUint32(8, normalizeNonNegativeUint32(options.offset ?? 0, 'catalog page offset'), true);
  view.setUint32(12, normalizeNonNegativeUint32(options.limit ?? 4096, 'catalog page limit'), true);
  view.setUint32(16, normalizeNonNegativeUint32(options.maxBytes ?? 8 * 1024 * 1024, 'catalog page maxBytes'), true);
  return new Uint8Array(buffer);
}

export function encodeLayoutTileGeometryRequestPayload(
  options: LspLayoutTileGeometryOptions,
  unitsPerMicron: number,
): Uint8Array {
  const layerIndices = options.layerIndices ?? [];
  const shapeKinds = options.shapeKinds ?? [];
  const datatypes = options.datatypes ?? [];
  const hasBbox = Boolean(options.bbox);
  const bboxByteLength = hasBbox ? 32 : 0;
  const byteLength = 4 + 4 + 4 + 4 + 4 + 4 + 4 + bboxByteLength
    + 4 + layerIndices.length * 4
    + 4 + shapeKinds.length * 4
    + 4 + datatypes.length * 4;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  let offset = 0;

  view.setUint32(offset, hasBbox ? 1 : 0, true);
  offset += 4;
  view.setUint32(offset, normalizeNonNegativeUint32(options.rootCellIndex, 'tile rootCellIndex'), true);
  offset += 4;
  view.setUint32(offset, normalizeNonNegativeUint32(options.maxShapes ?? 100_000, 'tile maxShapes'), true);
  offset += 4;
  view.setUint32(offset, normalizeNonNegativeUint32(options.maxPoints ?? 500_000, 'tile maxPoints'), true);
  offset += 4;
  view.setUint32(offset, normalizeNonNegativeUint32(options.maxBytes ?? 8 * 1024 * 1024, 'tile maxBytes'), true);
  offset += 4;
  view.setUint32(offset, normalizeNonNegativeUint32(options.lod ?? 0, 'tile lod'), true);
  offset += 4;
  view.setUint32(offset, normalizeNonNegativeUint32(options.continuationToken ?? 0, 'tile continuationToken'), true);
  offset += 4;

  if (options.bbox) {
    const scale = unitsPerMicron > 0 ? unitsPerMicron : 1;
    view.setFloat64(offset, options.bbox.x0 * scale, true);
    offset += 8;
    view.setFloat64(offset, options.bbox.y0 * scale, true);
    offset += 8;
    view.setFloat64(offset, options.bbox.x1 * scale, true);
    offset += 8;
    view.setFloat64(offset, options.bbox.y1 * scale, true);
    offset += 8;
  }

  offset = writeU32List(view, offset, layerIndices, 'tile layer index');
  offset = writeU32List(view, offset, shapeKinds, 'tile shape kind');
  offset = writeU32List(view, offset, datatypes, 'tile datatype');
  return new Uint8Array(buffer);
}

export function parseLayoutCatalogPayload(payload: Uint8Array): LspLayoutCatalog {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  requireMagic(payload, 0, 'PLCT', 'catalog');
  const version = readU16(view, 4);
  if (version !== layoutProtocolVersion) {
    throw new Error(`Unsupported layout catalog version: ${version}`);
  }

  const headerSize = readU16(view, 6);
  requirePayloadRange(payload.byteLength, 0, headerSize, 'catalog header');
  if (headerSize < layoutCatalogHeaderByteLength) {
    throw new Error(`Unsupported layout catalog header size: ${headerSize}`);
  }

  const unitsPerMicron = readU32(view, 8);
  const sourceKind = normalizeCatalogSourceKind(readU32(view, 12));
  const shapeCount = readU32(view, 16);
  const hasBounds = readU32(view, 20) !== 0;
  const rawTopCellIndex = readU32(view, 24);
  const stringOffset = readU32(view, 28);
  const stringSize = readU32(view, 32);
  const layerCount = readU32(view, 36);
  const layerOffset = readU32(view, 40);
  const macroCount = readU32(view, 44);
  const macroOffset = readU32(view, 48);
  const pinCount = readU32(view, 52);
  const pinTableOffset = readU32(view, 56);
  const viaCount = readU32(view, 60);
  const viaOffset = readU32(view, 64);
  const componentCount = readU32(view, 68);
  const componentOffset = readU32(view, 72);
  const defPinCount = readU32(view, 76);
  const defPinOffset = readU32(view, 80);
  const netCount = readU32(view, 84);
  const netOffset = readU32(view, 88);
  const gdsCellCount = readU32(view, 92);
  const gdsCellOffset = readU32(view, 96);
  const gdsReferenceCount = readU32(view, 100);
  const gdsReferenceOffset = readU32(view, 104);
  const gdsElementCount = readU32(view, 108);
  const gdsElementOffset = readU32(view, 112);
  const gdsPointCount = readU32(view, 116);
  const gdsPointOffset = readU32(view, 120);
  const diagnosticCount = readU32(view, 124);
  const diagnosticOffset = readU32(view, 128);
  const strings = readTable(payload, stringOffset, stringSize, 'string table');

  const layers: LspLayoutLayer[] = [];
  for (let index = 0; index < layerCount; index += 1) {
    const offset = layerOffset + index * 32;
    requirePayloadRange(payload.byteLength, offset, 32, 'layer table');
    layers.push({
      index,
      name: readLayoutString(strings, readU32(view, offset)),
      kind: readU16(view, offset + 4),
      pitch: readF64(view, offset + 8),
      width: readF64(view, offset + 16),
      spacing: readF64(view, offset + 24),
    });
  }

  const macros: LspLayoutMacro[] = [];
  for (let index = 0; index < macroCount; index += 1) {
    const offset = macroOffset + index * 44;
    requirePayloadRange(payload.byteLength, offset, 44, 'macro table');
    macros.push({
      index,
      name: readLayoutString(strings, readU32(view, offset)),
      className: readLayoutString(strings, readU32(view, offset + 4)),
      originX: readF64(view, offset + 8),
      originY: readF64(view, offset + 16),
      sizeX: readF64(view, offset + 24),
      sizeY: readF64(view, offset + 32),
      pinCount: readU32(view, offset + 40),
    });
  }

  const vias: LspLayoutVia[] = [];
  for (let index = 0; index < viaCount; index += 1) {
    const offset = viaOffset + index * 8;
    requirePayloadRange(payload.byteLength, offset, 8, 'via table');
    vias.push({
      index,
      name: readLayoutString(strings, readU32(view, offset)),
      shapeCount: readU32(view, offset + 4),
    });
  }

  const pins: LspLayoutPin[] = [];
  requirePayloadRange(payload.byteLength, pinTableOffset, pinCount * layoutPinTableEntryByteLength, 'pin table');
  for (let index = 0; index < pinCount; index += 1) {
    const offset = pinTableOffset + index * layoutPinTableEntryByteLength;
    pins.push({
      macroIndex: readU32(view, offset),
      pinIndex: readU32(view, offset + 4),
      name: readLayoutString(strings, readU32(view, offset + 8)),
      use: readLayoutString(strings, readU32(view, offset + 12)),
      direction: readU16(view, offset + 16),
      firstShapeIndex: readU32(view, offset + 20),
      shapeCount: readU32(view, offset + 24),
    });
  }

  const defPins: LspLayoutDefPin[] = [];
  requirePayloadRange(payload.byteLength, defPinOffset, defPinCount * layoutDefPinTableEntryByteLength, 'DEF pin table');
  for (let index = 0; index < defPinCount; index += 1) {
    const offset = defPinOffset + index * layoutDefPinTableEntryByteLength;
    defPins.push({
      name: readLayoutString(strings, readU32(view, offset)),
      netName: readLayoutString(strings, readU32(view, offset + 4)),
      status: readU16(view, offset + 8),
      x: readF64(view, offset + 12),
      y: readF64(view, offset + 20),
      orientation: readLayoutString(strings, readU32(view, offset + 28)),
      firstShapeIndex: readU32(view, offset + 32),
      shapeCount: readU32(view, offset + 36),
    });
  }

  const components: LspLayoutComponent[] = [];
  for (let index = 0; index < componentCount; index += 1) {
    const offset = componentOffset + index * 32;
    requirePayloadRange(payload.byteLength, offset, 32, 'component table');
    components.push({
      index,
      name: readLayoutString(strings, readU32(view, offset)),
      macroName: readLayoutString(strings, readU32(view, offset + 4)),
      status: readU16(view, offset + 8),
      x: readF64(view, offset + 12),
      y: readF64(view, offset + 20),
      orientation: readLayoutString(strings, readU32(view, offset + 28)),
    });
  }

  const nets: LspLayoutNet[] = [];
  for (let index = 0; index < netCount; index += 1) {
    const offset = netOffset + index * 16;
    requirePayloadRange(payload.byteLength, offset, 16, 'net table');
    nets.push({
      index,
      name: readLayoutString(strings, readU32(view, offset)),
      connectionCount: readU32(view, offset + 4),
      shapeCount: readU32(view, offset + 8),
      special: readU32(view, offset + 12) !== 0,
    });
  }

  const gdsCells: LspLayoutGdsCell[] = [];
  requirePayloadRange(payload.byteLength, gdsCellOffset, gdsCellCount * layoutGdsCellTableEntryByteLength, 'GDS cell table');
  for (let index = 0; index < gdsCellCount; index += 1) {
    const offset = gdsCellOffset + index * layoutGdsCellTableEntryByteLength;
    const bounds = {
      x0: readF64(view, offset + 24),
      y0: readF64(view, offset + 32),
      x1: readF64(view, offset + 40),
      y1: readF64(view, offset + 48),
    };
    gdsCells.push({
      index,
      name: readLayoutString(strings, readU32(view, offset)),
      firstReferenceIndex: readU32(view, offset + 4),
      referenceCount: readU32(view, offset + 8),
      firstElementIndex: readU32(view, offset + 12),
      elementCount: readU32(view, offset + 16),
      top: readU32(view, offset + 20) !== 0,
      bounds: bounds.x0 === 0 && bounds.y0 === 0 && bounds.x1 === 0 && bounds.y1 === 0 ? null : bounds,
    });
  }

  const gdsReferences: LspLayoutGdsReference[] = [];
  requirePayloadRange(payload.byteLength, gdsReferenceOffset, gdsReferenceCount * layoutGdsReferenceTableEntryByteLength, 'GDS reference table');
  for (let index = 0; index < gdsReferenceCount; index += 1) {
    const offset = gdsReferenceOffset + index * layoutGdsReferenceTableEntryByteLength;
    gdsReferences.push({
      index,
      parentCellIndex: readU32(view, offset),
      targetCellIndex: readU32(view, offset + 4),
      kind: readU16(view, offset + 8),
      reflected: readU16(view, offset + 10) !== 0,
      originX: readF64(view, offset + 12),
      originY: readF64(view, offset + 20),
      magnification: readF64(view, offset + 28),
      angle: readF64(view, offset + 36),
      columns: readU32(view, offset + 44),
      rows: readU32(view, offset + 48),
      columnVectorX: readF64(view, offset + 52),
      columnVectorY: readF64(view, offset + 60),
      rowVectorX: readF64(view, offset + 68),
      rowVectorY: readF64(view, offset + 76),
      targetName: readLayoutString(strings, readU32(view, offset + 84)),
    });
  }

  const gdsElements: LspLayoutGdsElement[] = [];
  requirePayloadRange(payload.byteLength, gdsElementOffset, gdsElementCount * layoutGdsElementTableEntryByteLength, 'GDS element table');
  for (let index = 0; index < gdsElementCount; index += 1) {
    const offset = gdsElementOffset + index * layoutGdsElementTableEntryByteLength;
    const referenceIndex = readU32(view, offset + 20);
    gdsElements.push({
      index,
      cellIndex: readU32(view, offset),
      kind: readU16(view, offset + 4),
      layer: readU32(view, offset + 8),
      datatype: readU32(view, offset + 12),
      texttype: readU32(view, offset + 16),
      referenceIndex: referenceIndex === layoutNoIndex ? null : referenceIndex,
      firstPointIndex: readU32(view, offset + 24),
      pointCount: readU32(view, offset + 28),
      text: readLayoutString(strings, readU32(view, offset + 32)),
    });
  }

  const gdsPoints: LspLayoutGdsPoint[] = [];
  requirePayloadRange(payload.byteLength, gdsPointOffset, gdsPointCount * layoutGdsPointTableEntryByteLength, 'GDS point table');
  for (let index = 0; index < gdsPointCount; index += 1) {
    const offset = gdsPointOffset + index * layoutGdsPointTableEntryByteLength;
    gdsPoints.push({
      index,
      x: readF64(view, offset),
      y: readF64(view, offset + 8),
    });
  }

  const diagnostics: LspLayoutDiagnostic[] = [];
  for (let index = 0; index < diagnosticCount; index += 1) {
    const offset = diagnosticOffset + index * 16;
    requirePayloadRange(payload.byteLength, offset, 16, 'diagnostic table');
    diagnostics.push({
      severity: readU16(view, offset),
      line: readU32(view, offset + 4),
      column: readU32(view, offset + 8),
      message: readLayoutString(strings, readU32(view, offset + 12)),
    });
  }

  return {
    unitsPerMicron,
    sourceKind,
    shapeCount,
    hasBounds,
    topCellIndex: rawTopCellIndex === layoutNoIndex ? null : rawTopCellIndex,
    layers,
    macros,
    pins,
    defPins,
    vias,
    components,
    nets,
    gdsCells,
    gdsReferences,
    gdsElements,
    gdsPoints,
    diagnostics,
  };
}

export function parseLayoutStatusPayload(payload: Uint8Array): LspLayoutStatus {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  requireMagic(payload, 0, 'PLST', 'status');
  const version = readU16(view, 4);
  if (version !== layoutProtocolVersion) {
    throw new Error(`Unsupported layout status version: ${version}`);
  }

  const headerSize = readU16(view, 6);
  requirePayloadRange(payload.byteLength, 0, headerSize, 'status header');
  if (headerSize < layoutStatusHeaderByteLength) {
    throw new Error(`Unsupported layout status header size: ${headerSize}`);
  }

  const stringOffset = readU32(view, 92);
  const stringSize = readU32(view, 96);
  const strings = readTable(payload, stringOffset, stringSize, 'status string table');
  return {
    state: normalizeStatusState(readU32(view, 8)),
    phase: normalizeStatusPhase(readU32(view, 12)),
    fileSizeBytes: readU64Number(view, 16),
    bytesRead: readU64Number(view, 24),
    recordCount: readU32(view, 32),
    cellCount: readU32(view, 36),
    referenceCount: readU32(view, 40),
    elementCount: readU32(view, 44),
    pointCount: readU32(view, 48),
    stringCount: readU32(view, 52),
    diagnosticCount: readU32(view, 56),
    elapsedMicros: readU64Number(view, 60),
    openMicros: readU64Number(view, 68),
    parseMicros: readU64Number(view, 76),
    warmupScheduled: readU32(view, 84) !== 0,
    warmupReady: readU32(view, 88) !== 0,
    error: readLayoutString(strings, readU32(view, 100)),
  };
}

export function parseLayoutCatalogSummaryPayload(payload: Uint8Array): LspLayoutCatalogSummary {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  requireMagic(payload, 0, 'PLCS', 'catalog summary');
  const version = readU16(view, 4);
  if (version !== layoutProtocolVersion) {
    throw new Error(`Unsupported layout catalog summary version: ${version}`);
  }

  const headerSize = readU16(view, 6);
  requirePayloadRange(payload.byteLength, 0, headerSize, 'catalog summary header');
  if (headerSize < layoutCatalogSummaryHeaderByteLength) {
    throw new Error(`Unsupported layout catalog summary header size: ${headerSize}`);
  }

  const hasBounds = readU32(view, 20) !== 0;
  const layerCount = readU32(view, 60);
  const layerOffset = readU32(view, 64);
  const layerSummaryCount = readU32(view, 68);
  const stringOffset = readU32(view, 112);
  const stringSize = readU32(view, 116);
  const strings = readTable(payload, stringOffset, stringSize, 'catalog summary string table');
  return {
    unitsPerMicron: readU32(view, 8),
    sourceKind: normalizeCatalogSourceKind(readU32(view, 12)),
    shapeCount: readU32(view, 16),
    hasBounds,
    topCellIndex: readU32(view, 24) === layoutNoIndex ? null : readU32(view, 24),
    bounds: hasBounds
      ? { x0: readF64(view, 28), y0: readF64(view, 36), x1: readF64(view, 44), y1: readF64(view, 52) }
      : null,
    layerCount,
    layerSummary: parseLayerRows(payload, view, strings, layerOffset, layerSummaryCount),
    macroCount: readU32(view, 72),
    componentCount: readU32(view, 76),
    defPinCount: readU32(view, 80),
    netCount: readU32(view, 84),
    gdsCellCount: readU32(view, 88),
    gdsReferenceCount: readU32(view, 92),
    gdsElementCount: readU32(view, 96),
    gdsPointCount: readU32(view, 100),
    stringCount: readU32(view, 104),
    diagnosticCount: readU32(view, 108),
    parseMicros: readU64Number(view, 120),
    layerRegisterMicros: readU64Number(view, 128),
    boundsMicros: readU64Number(view, 136),
    openMicros: readU64Number(view, 144),
  };
}

export function parseLayoutCatalogPagePayload(payload: Uint8Array): LspLayoutCatalogPage {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  requireMagic(payload, 0, 'PLCP', 'catalog page');
  const version = readU16(view, 4);
  if (version !== layoutProtocolVersion) {
    throw new Error(`Unsupported layout catalog page version: ${version}`);
  }

  const headerSize = readU16(view, 6);
  requirePayloadRange(payload.byteLength, 0, headerSize, 'catalog page header');
  if (headerSize < layoutCatalogPageHeaderByteLength) {
    throw new Error(`Unsupported layout catalog page header size: ${headerSize}`);
  }

  const tableKind = catalogPageCodeToTableKind(readU32(view, 8));
  const offset = readU32(view, 12);
  const count = readU32(view, 16);
  const totalCount = readU32(view, 20);
  const rawNextOffset = readU32(view, 24);
  const stringOffset = readU32(view, 28);
  const stringSize = readU32(view, 32);
  const strings = readTable(payload, stringOffset, stringSize, 'catalog page string table');
  const rowOffset = headerSize;

  return {
    tableKind,
    offset,
    count,
    totalCount,
    nextOffset: rawNextOffset === layoutNoIndex ? null : rawNextOffset,
    layers: tableKind === 'layers' ? parseLayerRows(payload, view, strings, rowOffset, count, offset) : [],
    gdsCells: tableKind === 'cells' ? parseGdsCellRows(payload, view, strings, rowOffset, offset, count) : [],
    gdsReferences: tableKind === 'references' ? parseGdsReferenceRows(payload, view, strings, rowOffset, offset, count) : [],
    gdsElements: tableKind === 'elements' ? parseGdsElementRows(payload, view, strings, rowOffset, offset, count) : [],
    gdsPoints: tableKind === 'points' ? parseGdsPointRows(payload, view, rowOffset, offset, count) : [],
    strings: tableKind === 'strings' ? parseStringRows(payload, rowOffset, stringOffset, count) : [],
    diagnostics: tableKind === 'diagnostics' ? parseDiagnosticRows(payload, view, strings, rowOffset, count) : [],
  };
}

export function parseLayoutTileGeometryPayload(payload: Uint8Array): LspLayoutTileGeometry {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  requireMagic(payload, 0, 'PLTG', 'tile geometry');
  const version = readU16(view, 4);
  if (version !== layoutProtocolVersion) {
    throw new Error(`Unsupported layout tile geometry version: ${version}`);
  }

  const headerSize = readU16(view, 6);
  requirePayloadRange(payload.byteLength, 0, headerSize, 'tile geometry header');
  if (headerSize < layoutTileGeometryHeaderByteLength) {
    throw new Error(`Unsupported layout tile geometry header size: ${headerSize}`);
  }

  const geometryOffset = readU32(view, 16);
  const geometrySize = readU32(view, 20);
  const geometryPayload = readTable(payload, geometryOffset, geometrySize, 'tile geometry payload');
  return {
    geometry: parseLayoutGeometryPayload(geometryPayload),
    truncated: (readU32(view, 8) & 1) !== 0,
    nextToken: readU32(view, 12) === 0 ? null : readU32(view, 12),
    payloadSize: readU32(view, 28),
    tileShapeCount: readU32(view, 24),
    metrics: {
      indexBuildMicros: readU64Number(view, 32),
      queryMicros: readU64Number(view, 40),
      encodeMicros: readU64Number(view, 48),
      visitedCellCount: readU32(view, 56),
      elementCandidateCount: readU32(view, 60),
      referenceCandidateCount: readU32(view, 64),
      traversedReferenceCount: readU32(view, 68),
      lodShapeCount: readU32(view, 72),
      cacheHitCount: readU32(view, 76),
      cacheMissCount: readU32(view, 80),
      gridBuildMicros: readU64Number(view, 84),
      gridHitCount: readU32(view, 92),
      gridMissCount: readU32(view, 96),
      gridCandidateCount: readU32(view, 100),
      gridBinCount: readU32(view, 104),
    },
  };
}

export function parseLayoutGeometryPayload(payload: Uint8Array): LspLayoutGeometry {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  requireMagic(payload, 0, 'PLGE', 'geometry');
  const version = readU16(view, 4);
  if (version !== layoutProtocolVersion) {
    throw new Error(`Unsupported layout geometry version: ${version}`);
  }

  const headerSize = readU16(view, 6);
  requirePayloadRange(payload.byteLength, 0, headerSize, 'geometry header');

  const unitsPerMicron = readU32(view, 8);
  const shapeCount = readU32(view, 12);
  const polygonPointCount = readU32(view, 16);
  const truncated = readU32(view, 20) !== 0;
  const shapeTableOffset = readU32(view, 24);
  const x0Offset = readU32(view, 28);
  const y0Offset = readU32(view, 32);
  const x1Offset = readU32(view, 36);
  const y1Offset = readU32(view, 40);
  const polygonXOffset = readU32(view, 44);
  const polygonYOffset = readU32(view, 48);

  requirePayloadRange(payload.byteLength, shapeTableOffset, shapeCount * layoutShapeTableEntryByteLength, 'shape table');
  requirePayloadRange(payload.byteLength, x0Offset, shapeCount * 8, 'x0 column');
  requirePayloadRange(payload.byteLength, y0Offset, shapeCount * 8, 'y0 column');
  requirePayloadRange(payload.byteLength, x1Offset, shapeCount * 8, 'x1 column');
  requirePayloadRange(payload.byteLength, y1Offset, shapeCount * 8, 'y1 column');
  requirePayloadRange(payload.byteLength, polygonXOffset, polygonPointCount * 8, 'polygon x column');
  requirePayloadRange(payload.byteLength, polygonYOffset, polygonPointCount * 8, 'polygon y column');

  const shapes: LspLayoutShape[] = [];
  for (let index = 0; index < shapeCount; index += 1) {
    const shapeOffset = shapeTableOffset + index * layoutShapeTableEntryByteLength;
    const macroIndex = readU32(view, shapeOffset + 12);
    const polygonOffset = readU32(view, shapeOffset + 20);
    const polygonPointLength = readU32(view, shapeOffset + 24);
    const polygon = polygonPointLength > 0
      ? readPolygonPoints(view, polygonXOffset, polygonYOffset, polygonPointCount, polygonOffset, polygonPointLength)
      : undefined;

    shapes.push({
      index,
      layerIndex: readU32(view, shapeOffset),
      kind: normalizeShapeKind(readU16(view, shapeOffset + 4)),
      ownerKind: normalizeOwnerKind(readU16(view, shapeOffset + 6)),
      ownerIndex: readU32(view, shapeOffset + 8),
      macroIndex: macroIndex === layoutNoMacroIndex ? null : macroIndex,
      flags: readU32(view, shapeOffset + 16),
      rect: {
        x0: readF64(view, x0Offset + index * 8),
        y0: readF64(view, y0Offset + index * 8),
        x1: readF64(view, x1Offset + index * 8),
        y1: readF64(view, y1Offset + index * 8),
      },
      polygon,
    });
  }

  return {
    unitsPerMicron,
    truncated,
    shapeCount,
    polygonPointCount,
    shapes,
  };
}

async function sendLayoutPipeRequest(
  session: LayoutPipeSession,
  messageType: number,
  payload: Uint8Array<ArrayBufferLike> = new Uint8Array(),
): Promise<LayoutEnvelope> {
  const requestId = session.nextRequestId++;
  const request = encodeLayoutEnvelope(messageType, requestId, payload);

  await withLayoutPipeTimeout(writeAll(session.socket, new Uint8Array(request)), messageType);
  const response = await withLayoutPipeTimeout(readLayoutEnvelope(session), messageType);

  if (response.messageType === layoutMessageType.errorResponse) {
    throw new Error(parseErrorPayload(response.payload));
  }

  if (response.requestId !== requestId) {
    throw new Error(`Unexpected layout response request id: ${response.requestId}`);
  }

  return response;
}

async function runExclusiveLayoutPipeRequest<T>(session: LayoutPipeSession, callback: () => Promise<T>): Promise<T> {
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

async function connectLayoutPipe(endpoint: LayoutEndpoint): Promise<net.Socket> {
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
          reject(new Error(`Timed out connecting to layout pipe: ${endpoint.path}`));
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

  throw new Error(`Failed to connect layout pipe ${endpoint.path}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function readLayoutEnvelope(session: LayoutPipeSession): Promise<LayoutEnvelope> {
  const header = await readExact(session, layoutEnvelopeHeaderByteLength);
  const headerView = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const payloadLength = headerView.getUint32(16, true);
  if (payloadLength > layoutMaxPayloadByteLength) {
    throw new Error('Layout payload is too large.');
  }

  const payload = payloadLength > 0 ? await readExact(session, payloadLength) : new Uint8Array();
  const envelopeBytes = new Uint8Array(layoutEnvelopeHeaderByteLength + payloadLength);
  envelopeBytes.set(header, 0);
  envelopeBytes.set(payload, layoutEnvelopeHeaderByteLength);
  return decodeLayoutEnvelope(envelopeBytes.buffer);
}

async function readExact(session: LayoutPipeSession, byteLength: number): Promise<Uint8Array> {
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
      reject(new Error('Layout pipe closed while reading.'));
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

function consumeReadBuffer(session: LayoutPipeSession, byteLength: number): Uint8Array | null {
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
  const message = payload.byteLength >= 8 ? readLengthPrefixedString(payload, 4) : 'Unknown layout pipe error.';
  return `Layout pipe error ${code}: ${message}`;
}

function readPolygonPoints(
  view: DataView,
  polygonXOffset: number,
  polygonYOffset: number,
  polygonPointCount: number,
  polygonOffset: number,
  polygonPointLength: number,
): Array<{ x: number; y: number }> {
  if (polygonOffset > polygonPointCount || polygonPointLength > polygonPointCount - polygonOffset) {
    throw new Error('Layout geometry polygon columns are truncated.');
  }

  const points: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < polygonPointLength; index += 1) {
    const pointIndex = polygonOffset + index;
    points.push({
      x: readF64(view, polygonXOffset + pointIndex * 8),
      y: readF64(view, polygonYOffset + pointIndex * 8),
    });
  }

  return points;
}

function readLayoutString(strings: Uint8Array, offset: number): string {
  return readLengthPrefixedString(strings, offset);
}

function createCatalogFromSummary(summary: LspLayoutCatalogSummary): LspLayoutCatalog {
  return {
    unitsPerMicron: summary.unitsPerMicron,
    sourceKind: summary.sourceKind,
    shapeCount: summary.shapeCount,
    hasBounds: summary.hasBounds,
    topCellIndex: summary.topCellIndex,
    layers: summary.layerSummary,
    macros: [],
    pins: [],
    defPins: [],
    vias: [],
    components: [],
    nets: [],
    gdsCells: [],
    gdsReferences: [],
    gdsElements: [],
    gdsPoints: [],
    diagnostics: [],
  };
}

function parseLayerRows(
  payload: Uint8Array,
  view: DataView,
  strings: Uint8Array,
  rowOffset: number,
  count: number,
  baseIndex = 0,
): LspLayoutLayer[] {
  requirePayloadRange(payload.byteLength, rowOffset, count * layoutLayerTableEntryByteLength, 'layer rows');
  const layers: LspLayoutLayer[] = [];
  for (let row = 0; row < count; row += 1) {
    const offset = rowOffset + row * layoutLayerTableEntryByteLength;
    layers.push({
      index: baseIndex + row,
      name: readLayoutString(strings, readU32(view, offset)),
      kind: readU16(view, offset + 4),
      pitch: readF64(view, offset + 8),
      width: readF64(view, offset + 16),
      spacing: readF64(view, offset + 24),
    });
  }
  return layers;
}

function parseGdsCellRows(
  payload: Uint8Array,
  view: DataView,
  strings: Uint8Array,
  rowOffset: number,
  baseIndex: number,
  count: number,
): LspLayoutGdsCell[] {
  requirePayloadRange(payload.byteLength, rowOffset, count * layoutGdsCellTableEntryByteLength, 'GDS cell rows');
  const cells: LspLayoutGdsCell[] = [];
  for (let row = 0; row < count; row += 1) {
    const offset = rowOffset + row * layoutGdsCellTableEntryByteLength;
    const bounds = {
      x0: readF64(view, offset + 24),
      y0: readF64(view, offset + 32),
      x1: readF64(view, offset + 40),
      y1: readF64(view, offset + 48),
    };
    cells.push({
      index: baseIndex + row,
      name: readLayoutString(strings, readU32(view, offset)),
      firstReferenceIndex: readU32(view, offset + 4),
      referenceCount: readU32(view, offset + 8),
      firstElementIndex: readU32(view, offset + 12),
      elementCount: readU32(view, offset + 16),
      top: readU32(view, offset + 20) !== 0,
      bounds: bounds.x0 === 0 && bounds.y0 === 0 && bounds.x1 === 0 && bounds.y1 === 0 ? null : bounds,
    });
  }
  return cells;
}

function parseGdsReferenceRows(
  payload: Uint8Array,
  view: DataView,
  strings: Uint8Array,
  rowOffset: number,
  baseIndex: number,
  count: number,
): LspLayoutGdsReference[] {
  requirePayloadRange(payload.byteLength, rowOffset, count * layoutGdsReferenceTableEntryByteLength, 'GDS reference rows');
  const references: LspLayoutGdsReference[] = [];
  for (let row = 0; row < count; row += 1) {
    const offset = rowOffset + row * layoutGdsReferenceTableEntryByteLength;
    references.push({
      index: baseIndex + row,
      parentCellIndex: readU32(view, offset),
      targetCellIndex: readU32(view, offset + 4),
      kind: readU16(view, offset + 8),
      reflected: readU16(view, offset + 10) !== 0,
      originX: readF64(view, offset + 12),
      originY: readF64(view, offset + 20),
      magnification: readF64(view, offset + 28),
      angle: readF64(view, offset + 36),
      columns: readU32(view, offset + 44),
      rows: readU32(view, offset + 48),
      columnVectorX: readF64(view, offset + 52),
      columnVectorY: readF64(view, offset + 60),
      rowVectorX: readF64(view, offset + 68),
      rowVectorY: readF64(view, offset + 76),
      targetName: readLayoutString(strings, readU32(view, offset + 84)),
    });
  }
  return references;
}

function parseGdsElementRows(
  payload: Uint8Array,
  view: DataView,
  strings: Uint8Array,
  rowOffset: number,
  baseIndex: number,
  count: number,
): LspLayoutGdsElement[] {
  requirePayloadRange(payload.byteLength, rowOffset, count * layoutGdsElementTableEntryByteLength, 'GDS element rows');
  const elements: LspLayoutGdsElement[] = [];
  for (let row = 0; row < count; row += 1) {
    const offset = rowOffset + row * layoutGdsElementTableEntryByteLength;
    const referenceIndex = readU32(view, offset + 20);
    elements.push({
      index: baseIndex + row,
      cellIndex: readU32(view, offset),
      kind: readU16(view, offset + 4),
      layer: readU32(view, offset + 8),
      datatype: readU32(view, offset + 12),
      texttype: readU32(view, offset + 16),
      referenceIndex: referenceIndex === layoutNoIndex ? null : referenceIndex,
      firstPointIndex: readU32(view, offset + 24),
      pointCount: readU32(view, offset + 28),
      text: readLayoutString(strings, readU32(view, offset + 32)),
    });
  }
  return elements;
}

function parseGdsPointRows(
  payload: Uint8Array,
  view: DataView,
  rowOffset: number,
  baseIndex: number,
  count: number,
): LspLayoutGdsPoint[] {
  requirePayloadRange(payload.byteLength, rowOffset, count * layoutGdsPointTableEntryByteLength, 'GDS point rows');
  const points: LspLayoutGdsPoint[] = [];
  for (let row = 0; row < count; row += 1) {
    const offset = rowOffset + row * layoutGdsPointTableEntryByteLength;
    points.push({
      index: baseIndex + row,
      x: readF64(view, offset),
      y: readF64(view, offset + 8),
    });
  }
  return points;
}

function parseStringRows(
  payload: Uint8Array,
  rowOffset: number,
  stringOffset: number,
  count: number,
): string[] {
  const strings: string[] = [];
  let offset = rowOffset;
  for (let row = 0; row < count && offset < stringOffset; row += 1) {
    const value = readLengthPrefixedString(payload, offset);
    strings.push(value);
    offset += 4 + new TextEncoder().encode(value).byteLength;
  }
  return strings;
}

function parseDiagnosticRows(
  payload: Uint8Array,
  view: DataView,
  strings: Uint8Array,
  rowOffset: number,
  count: number,
): LspLayoutDiagnostic[] {
  const rowByteLength = 16;
  requirePayloadRange(payload.byteLength, rowOffset, count * rowByteLength, 'diagnostic rows');
  const diagnostics: LspLayoutDiagnostic[] = [];
  for (let row = 0; row < count; row += 1) {
    const offset = rowOffset + row * rowByteLength;
    diagnostics.push({
      severity: readU16(view, offset),
      line: readU32(view, offset + 4),
      column: readU32(view, offset + 8),
      message: readLayoutString(strings, readU32(view, offset + 12)),
    });
  }
  return diagnostics;
}

function readLengthPrefixedString(bytes: Uint8Array, offset: number): string {
  requirePayloadRange(bytes.byteLength, offset, 4, 'string length');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const byteLength = view.getUint32(offset, true);
  const start = offset + 4;
  requirePayloadRange(bytes.byteLength, start, byteLength, 'string bytes');
  return new TextDecoder().decode(bytes.subarray(start, start + byteLength));
}

function normalizeLayoutEndpoint(value: unknown): LayoutEndpoint {
  if (!value || typeof value !== 'object') {
    throw new Error('Layout open response must include an endpoint.');
  }

  const candidate = value as { kind?: unknown; path?: unknown };
  if (typeof candidate.kind !== 'string' || typeof candidate.path !== 'string' || candidate.path.length === 0) {
    throw new Error('Layout endpoint must include kind and path strings.');
  }

  if (candidate.kind !== 'namedPipe' && candidate.kind !== 'unixSocket') {
    throw new Error(`Unsupported layout endpoint kind: ${candidate.kind}`);
  }

  return {
    kind: candidate.kind,
    path: candidate.path,
  };
}

function normalizeLayoutBounds(value: unknown): LspLayoutBounds | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as { x0?: unknown; y0?: unknown; x1?: unknown; y1?: unknown };
  if (
    typeof candidate.x0 !== 'number'
    || typeof candidate.y0 !== 'number'
    || typeof candidate.x1 !== 'number'
    || typeof candidate.y1 !== 'number'
  ) {
    return null;
  }

  return {
    x0: candidate.x0,
    y0: candidate.y0,
    x1: candidate.x1,
    y1: candidate.y1,
  };
}

function normalizeCount(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeMaxShapes(value: unknown): number {
  if (value === undefined) {
    return 250_000;
  }

  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 250_000;
}

function normalizeNonNegativeUint32(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`Layout ${name} must be a non-negative uint32.`);
  }
  return value;
}

function writeU32List(view: DataView, offset: number, values: readonly number[], name: string): number {
  view.setUint32(offset, values.length, true);
  offset += 4;
  for (const value of values) {
    view.setUint32(offset, normalizeNonNegativeUint32(value, name), true);
    offset += 4;
  }
  return offset;
}

function normalizeCatalogSourceKind(value: number): LspLayoutCatalog['sourceKind'] {
  if (value === 1) {
    return 'lefdef';
  }
  if (value === 2) {
    return 'gds';
  }

  throw new Error(`Unsupported layout catalog source kind: ${value}`);
}

function normalizeStatusState(value: number): LspLayoutStatusState {
  if (value === 1) {
    return 'parsing';
  }
  if (value === 2) {
    return 'ready';
  }
  if (value === 3) {
    return 'failed';
  }
  if (value === 4) {
    return 'closing';
  }
  return 'unknown';
}

function normalizeStatusPhase(value: number): LspLayoutStatusPhase {
  if (value === 1) {
    return 'read';
  }
  if (value === 2) {
    return 'records';
  }
  if (value === 3) {
    return 'finalize';
  }
  if (value === 4) {
    return 'resolve';
  }
  if (value === 5) {
    return 'ready';
  }
  if (value === 6) {
    return 'failed';
  }
  return 'unknown';
}

function catalogPageTableKindToCode(tableKind: LspLayoutCatalogPageTableKind): number {
  switch (tableKind) {
    case 'layers':
      return 1;
    case 'cells':
      return 2;
    case 'references':
      return 3;
    case 'elements':
      return 4;
    case 'points':
      return 5;
    case 'strings':
      return 6;
    case 'diagnostics':
      return 7;
  }
}

function catalogPageCodeToTableKind(value: number): LspLayoutCatalogPageTableKind {
  if (value === 1) {
    return 'layers';
  }
  if (value === 2) {
    return 'cells';
  }
  if (value === 3) {
    return 'references';
  }
  if (value === 4) {
    return 'elements';
  }
  if (value === 5) {
    return 'points';
  }
  if (value === 6) {
    return 'strings';
  }
  if (value === 7) {
    return 'diagnostics';
  }
  throw new Error(`Unsupported layout catalog page table kind: ${value}`);
}

function normalizeShapeKind(value: number): LspLayoutShapeKind {
  if (value === 1) {
    return 'rect';
  }
  if (value === 2) {
    return 'polygon';
  }
  if (value === 3) {
    return 'placement';
  }
  if (value === 4) {
    return 'path';
  }
  if (value === 5) {
    return 'text';
  }

  return 'unknown';
}

function normalizeOwnerKind(value: number): LspLayoutShape['ownerKind'] {
  if (value === 1) {
    return 'layer';
  }
  if (value === 2) {
    return 'via';
  }
  if (value === 3) {
    return 'macro';
  }
  if (value === 4) {
    return 'pin';
  }
  if (value === 5) {
    return 'obstruction';
  }
  if (value === 6) {
    return 'component';
  }
  if (value === 7) {
    return 'net';
  }
  if (value === 8) {
    return 'blockage';
  }
  if (value === 9) {
    return 'specialNet';
  }
  if (value === 10) {
    return 'gdsCell';
  }
  if (value === 11) {
    return 'gdsElement';
  }
  if (value === 12) {
    return 'gdsReference';
  }

  return 'unknown';
}

function readTable(payload: Uint8Array, offset: number, byteLength: number, name: string): Uint8Array {
  requirePayloadRange(payload.byteLength, offset, byteLength, name);
  return new Uint8Array(payload.buffer, payload.byteOffset + offset, byteLength);
}

function requireMagic(payload: Uint8Array, offset: number, magic: string, name: string): void {
  requirePayloadRange(payload.byteLength, offset, magic.length, `${name} magic`);
  const actual = new TextDecoder().decode(payload.subarray(offset, offset + magic.length));
  if (actual !== magic) {
    throw new Error(`Invalid layout ${name} magic.`);
  }
}

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function readU64Number(view: DataView, offset: number): number {
  const value = view.getBigUint64(offset, true);
  return value > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(value);
}

function readF64(view: DataView, offset: number): number {
  return view.getFloat64(offset, true);
}

function requirePayloadRange(size: number, offset: number, byteLength: number, name: string): void {
  if (offset > size || byteLength > size - offset) {
    throw new Error(`Layout ${name} is truncated.`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withLayoutPipeTimeout<T>(promise: Promise<T>, messageType: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Layout pipe request ${messageType} timed out after ${layoutPipeRequestTimeoutMs}ms.`));
    }, layoutPipeRequestTimeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  });
}
