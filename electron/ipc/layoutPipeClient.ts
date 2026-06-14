import net from 'node:net';

import type {
  LspLayoutBounds,
  LspLayoutCatalog,
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
  LspLayoutVia,
} from '../../types/systemverilog-lsp.js';

const layoutProtocolName = 'pristine-layout-columnar-v3';
const layoutProtocolVersion = 3;
const layoutEnvelopeHeaderByteLength = 24;
const layoutCatalogHeaderByteLength = 136;
const layoutPinTableEntryByteLength = 28;
const layoutDefPinTableEntryByteLength = 40;
const layoutGdsCellTableEntryByteLength = 56;
const layoutGdsReferenceTableEntryByteLength = 88;
const layoutGdsElementTableEntryByteLength = 36;
const layoutGdsPointTableEntryByteLength = 16;
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

    const catalogResponse = await sendLayoutPipeRequest(session, layoutMessageType.catalogRequest);
    if (catalogResponse.messageType !== layoutMessageType.catalogResponse) {
      throw new Error(`Unexpected layout catalog response type: ${catalogResponse.messageType}`);
    }

    const catalog = parseLayoutCatalogPayload(catalogResponse.payload);

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

function normalizeCatalogSourceKind(value: number): LspLayoutCatalog['sourceKind'] {
  if (value === 1) {
    return 'lefdef';
  }
  if (value === 2) {
    return 'gds';
  }

  throw new Error(`Unsupported layout catalog source kind: ${value}`);
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
