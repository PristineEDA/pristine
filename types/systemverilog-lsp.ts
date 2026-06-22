export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspDiagnostic {
  range: LspRange;
  severity?: number;
  code?: string | number;
  source?: string;
  message: string;
}

export interface LspDiagnosticsEvent {
  filePath: string;
  diagnostics: LspDiagnostic[];
}

export type LspDebugValue =
  | string
  | number
  | boolean
  | null
  | LspDebugValue[]
  | { [key: string]: LspDebugValue };

export type LspDebugDirection = 'client->server' | 'server->client' | 'session';

export type LspDebugKind = 'request' | 'response' | 'notification' | 'lifecycle' | 'stderr';

export interface LspDebugEvent {
  sequence: number;
  timestamp: string;
  direction: LspDebugDirection;
  kind: LspDebugKind;
  requestId?: number;
  method?: string;
  status?: LspStateEvent['status'];
  filePath?: string;
  payload?: LspDebugValue;
  text?: string;
}

export interface LspMarkedString {
  language: string;
  value: string;
}

export interface LspMarkupContent {
  kind: string;
  value: string;
}

export type LspHoverContents = string | LspMarkedString | LspMarkupContent | Array<string | LspMarkedString | LspMarkupContent>;

export interface LspHover {
  contents: LspHoverContents;
  range?: LspRange;
}

export interface LspTextEdit {
  range: LspRange;
  newText: string;
}

export interface LspCompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string | LspMarkupContent | LspMarkedString | Array<string | LspMarkupContent | LspMarkedString>;
  insertText?: string;
  sortText?: string;
  filterText?: string;
  preselect?: boolean;
  commitCharacters?: string[];
  insertTextFormat?: number;
  textEdit?: LspTextEdit;
  additionalTextEdits?: LspTextEdit[];
  data?: LspDebugValue;
}

export interface LspCompletionList {
  isIncomplete?: boolean;
  items: LspCompletionItem[];
}

export type LspCompletionResponse = LspCompletionItem[] | LspCompletionList;

export interface WorkspaceLocation {
  filePath: string;
  range: LspRange;
}

export interface LspDocumentSymbol {
  name: string;
  detail?: string;
  kind: number;
  range: LspRange;
  selectionRange: LspRange;
  children?: LspDocumentSymbol[];
}

export interface LspDocumentHighlight {
  range: LspRange;
  kind?: number;
}

export interface LspDocumentLink {
  range: LspRange;
  target?: string;
  tooltip?: string;
}

export interface LspInlayHint {
  position: LspPosition;
  label: string;
  kind?: number;
  tooltip?: string | LspMarkupContent;
  textEdits?: LspTextEdit[];
}

export interface LspCodeAction {
  title: string;
  kind?: string;
  diagnostics?: LspDiagnostic[];
  edit?: LspWorkspaceEdit;
  isPreferred?: boolean;
}

export interface LspFoldingRange {
  startLine: number;
  startCharacter?: number;
  endLine: number;
  endCharacter?: number;
  kind?: string;
}

export interface LspSemanticTokens {
  resultId?: string;
  data: number[];
}

export interface LspSelectionRange {
  range: LspRange;
  parent?: LspSelectionRange;
}

export interface LspSignatureInformation {
  label: string;
  documentation?: string | LspMarkupContent;
  parameters?: Array<{
    label: string | [number, number];
    documentation?: string | LspMarkupContent;
  }>;
}

export interface LspSignatureHelp {
  signatures: LspSignatureInformation[];
  activeSignature?: number;
  activeParameter?: number;
}

export interface LspCallHierarchyItem {
  name: string;
  kind: number;
  uri: string;
  filePath?: string;
  range: LspRange;
  selectionRange: LspRange;
  detail?: string;
  data?: LspDebugValue;
}

export interface LspCallHierarchyIncomingCall {
  from: LspCallHierarchyItem;
  fromRanges: LspRange[];
}

export interface LspCallHierarchyOutgoingCall {
  to: LspCallHierarchyItem;
  fromRanges: LspRange[];
}

export interface LspWorkspaceSymbol {
  name: string;
  kind: number;
  location: WorkspaceLocation;
  containerName?: string;
}

export interface LspPrepareRenameResult {
  range: LspRange;
  placeholder: string;
}

export interface LspWorkspaceEdit {
  changes: Record<string, LspTextEdit[]>;
  documentChanges?: Array<{
    kind: 'create';
    filePath: string;
    uri: string;
    options?: {
      ignoreIfExists?: boolean;
      overwrite?: boolean;
    };
  }>;
}

export interface LspModuleHierarchyOptions {
  moduleName?: string;
  maxDepth?: number;
}

export type LspModuleHierarchyNodeKind = 'module' | 'interface';

export interface LspModuleHierarchyNode {
  moduleName: string;
  kind: LspModuleHierarchyNodeKind;
  instanceName?: string;
  filePath?: string;
  uri?: string;
  range?: LspRange;
  selectionRange?: LspRange;
  instanceRange?: LspRange;
  instanceSelectionRange?: LspRange;
  moduleSelectionRange?: LspRange;
  unresolved: boolean;
  cycle: boolean;
  truncated?: boolean;
  children: LspModuleHierarchyNode[];
}

export interface LspModuleHierarchy {
  roots: LspModuleHierarchyNode[];
  messages: string[];
}

export interface LspOutlineOptions {
  maxDepth?: number;
  limit?: number;
  includeChildren?: boolean;
  includeFlat?: boolean;
}

export interface LspOutlineItem {
  id: string;
  parentId: string | null;
  name: string;
  kind: string;
  detail?: string;
  declaration?: string;
  type?: string;
  direction?: string;
  value?: string;
  moduleName?: string;
  symbolKind: number;
  range: LspRange;
  selectionRange: LspRange;
  depth: number;
  children: LspOutlineItem[];
}

export interface LspOutlineResult {
  uri: string;
  filePath?: string;
  version: number;
  generation: number;
  roots: LspOutlineItem[];
  items: LspOutlineItem[];
  partial: boolean;
  truncated: boolean;
  messages: string[];
}

export interface LspSchematicOptions {
  moduleName?: string;
  maxDepth?: number;
}

export type LspSchematicPortDirection = 'input' | 'output' | 'inout';

export interface LspSchematicPort {
  name: string;
  direction: LspSchematicPortDirection;
  widthText: string;
  range?: LspRange;
  selectionRange?: LspRange;
}

export interface LspSchematicConnection {
  portName: string;
  portIndex: number;
  signal: string;
  range?: LspRange;
}

export interface LspSchematicCell {
  id: string;
  name: string;
  type: string;
  kind: string;
  range?: LspRange;
  selectionRange?: LspRange;
  connections: LspSchematicConnection[];
}

export interface LspSchematicEndpoint {
  nodeId: string;
  portName: string;
}

export interface LspSchematicNet {
  name: string;
  drivers: LspSchematicEndpoint[];
  loads: LspSchematicEndpoint[];
}

export interface LspSchematicModule {
  id: string;
  name: string;
  filePath?: string;
  uri?: string;
  range?: LspRange;
  selectionRange?: LspRange;
  ports: LspSchematicPort[];
  cells: LspSchematicCell[];
  nets: LspSchematicNet[];
}

export interface LspSchematic {
  rootModuleId: string | null;
  modules: LspSchematicModule[];
  messages: string[];
}

export interface LspWaveformGroup {
  id: string;
  label: string;
}

export type LspWaveformSignalKind = 'clock' | 'logic' | 'bus';

export interface LspWaveformSignal {
  id: string;
  groupId: string;
  name: string;
  path: string;
  kind: LspWaveformSignalKind;
  color: string;
  width?: number;
}

export interface LspWaveformOpenResult {
  sessionId: string;
  id?: string;
  title: string;
  timescaleUnit: string;
  duration: number;
  cursorTime: number;
  groups: LspWaveformGroup[];
  signals: LspWaveformSignal[];
  messages: string[];
}

export interface LspWaveformFrameOptions {
  sessionId: string;
  startTime: number;
  endTime: number;
  protocolVersion?: 1 | 2;
  preparedStartTime?: number;
  preparedEndTime?: number;
  viewportStartTime?: number;
  viewportEndTime?: number;
  width: number;
  height: number;
  laneHeight: number;
  headerHeight: number;
  maxSegments?: number;
  signalIds?: string[];
}

export interface LspLayoutBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LspLayoutEndpoint {
  kind: 'namedPipe' | 'unixSocket';
  path: string;
}

export interface LspLayoutOpenOptions {
  title?: string;
  lefUris?: string[];
  defUri?: string;
  gdsUri?: string;
  openMode?: 'sync' | 'staged' | 'auto';
  deferCatalog?: boolean;
  workspaceFilePath?: string;
}

export type LspLayoutSourceKind = 'lefdef' | 'gds';

export interface LspLayoutLayer {
  index: number;
  name: string;
  kind: number;
  pitch: number;
  width: number;
  spacing: number;
}

export interface LspLayoutMacro {
  index: number;
  name: string;
  className: string;
  originX: number;
  originY: number;
  sizeX: number;
  sizeY: number;
  pinCount: number;
}

export interface LspLayoutPin {
  macroIndex: number;
  pinIndex: number;
  name: string;
  use: string;
  direction: number;
  firstShapeIndex: number;
  shapeCount: number;
}

export interface LspLayoutDefPin {
  name: string;
  netName: string;
  status: number;
  x: number;
  y: number;
  orientation: string;
  firstShapeIndex: number;
  shapeCount: number;
}

export interface LspLayoutVia {
  index: number;
  name: string;
  shapeCount: number;
}

export interface LspLayoutComponent {
  index: number;
  name: string;
  macroName: string;
  status: number;
  x: number;
  y: number;
  orientation: string;
}

export interface LspLayoutNet {
  index: number;
  name: string;
  connectionCount: number;
  shapeCount: number;
  special: boolean;
}

export interface LspLayoutDiagnostic {
  severity: number;
  line: number;
  column: number;
  message: string;
}

export interface LspLayoutGdsCell {
  index: number;
  name: string;
  firstReferenceIndex: number;
  referenceCount: number;
  firstElementIndex: number;
  elementCount: number;
  top: boolean;
  bounds: LspLayoutBounds | null;
}

export interface LspLayoutGdsReference {
  index: number;
  parentCellIndex: number;
  targetCellIndex: number;
  kind: number;
  reflected: boolean;
  originX: number;
  originY: number;
  magnification: number;
  angle: number;
  columns: number;
  rows: number;
  columnVectorX: number;
  columnVectorY: number;
  rowVectorX: number;
  rowVectorY: number;
  targetName: string;
}

export interface LspLayoutGdsElement {
  index: number;
  cellIndex: number;
  kind: number;
  layer: number;
  datatype: number;
  texttype: number;
  referenceIndex: number | null;
  firstPointIndex: number;
  pointCount: number;
  text: string;
}

export interface LspLayoutGdsPoint {
  index: number;
  x: number;
  y: number;
}

export interface LspLayoutCatalog {
  unitsPerMicron: number;
  sourceKind: LspLayoutSourceKind;
  shapeCount: number;
  hasBounds: boolean;
  topCellIndex: number | null;
  layers: LspLayoutLayer[];
  macros: LspLayoutMacro[];
  pins: LspLayoutPin[];
  defPins: LspLayoutDefPin[];
  vias: LspLayoutVia[];
  components: LspLayoutComponent[];
  nets: LspLayoutNet[];
  gdsCells: LspLayoutGdsCell[];
  gdsReferences: LspLayoutGdsReference[];
  gdsElements: LspLayoutGdsElement[];
  gdsPoints: LspLayoutGdsPoint[];
  diagnostics: LspLayoutDiagnostic[];
}

export type LspLayoutShapeKind = 'rect' | 'polygon' | 'placement' | 'path' | 'text' | 'unknown';

export type LspLayoutOwnerKind =
  | 'unknown'
  | 'layer'
  | 'via'
  | 'macro'
  | 'pin'
  | 'obstruction'
  | 'component'
  | 'net'
  | 'blockage'
  | 'specialNet'
  | 'gdsCell'
  | 'gdsElement'
  | 'gdsReference';

export interface LspLayoutShape {
  index: number;
  layerIndex: number;
  kind: LspLayoutShapeKind;
  ownerKind: LspLayoutOwnerKind;
  ownerIndex: number;
  macroIndex: number | null;
  flags: number;
  rect: LspLayoutBounds;
  polygon?: Array<{ x: number; y: number }>;
}

export interface LspLayoutGeometry {
  unitsPerMicron: number;
  truncated: boolean;
  shapeCount: number;
  polygonPointCount: number;
  shapes: LspLayoutShape[];
}

export type LspLayoutStatusState = 'parsing' | 'ready' | 'failed' | 'closing' | 'unknown';

export type LspLayoutStatusPhase = 'unknown' | 'read' | 'records' | 'finalize' | 'resolve' | 'ready' | 'failed';

export interface LspLayoutStatus {
  state: LspLayoutStatusState;
  phase: LspLayoutStatusPhase;
  fileSizeBytes: number;
  bytesRead: number;
  recordCount: number;
  cellCount: number;
  referenceCount: number;
  elementCount: number;
  pointCount: number;
  stringCount: number;
  diagnosticCount: number;
  elapsedMicros: number;
  openMicros: number;
  parseMicros: number;
  warmupScheduled: boolean;
  warmupReady: boolean;
  error: string;
}

export interface LspLayoutCatalogSummary {
  unitsPerMicron: number;
  sourceKind: LspLayoutSourceKind;
  shapeCount: number;
  hasBounds: boolean;
  topCellIndex: number | null;
  bounds: LspLayoutBounds | null;
  layerCount: number;
  layerSummary: LspLayoutLayer[];
  macroCount: number;
  componentCount: number;
  defPinCount: number;
  netCount: number;
  gdsCellCount: number;
  gdsReferenceCount: number;
  gdsElementCount: number;
  gdsPointCount: number;
  stringCount: number;
  diagnosticCount: number;
  parseMicros: number;
  layerRegisterMicros: number;
  boundsMicros: number;
  openMicros: number;
}

export type LspLayoutCatalogPageTableKind =
  | 'layers'
  | 'cells'
  | 'references'
  | 'elements'
  | 'points'
  | 'strings'
  | 'diagnostics';

export interface LspLayoutCatalogPageOptions {
  sessionId: string;
  tableKind: LspLayoutCatalogPageTableKind;
  offset?: number;
  limit?: number;
  maxBytes?: number;
}

export interface LspLayoutCatalogPage {
  tableKind: LspLayoutCatalogPageTableKind;
  offset: number;
  count: number;
  totalCount: number;
  nextOffset: number | null;
  layers: LspLayoutLayer[];
  gdsCells: LspLayoutGdsCell[];
  gdsReferences: LspLayoutGdsReference[];
  gdsElements: LspLayoutGdsElement[];
  gdsPoints: LspLayoutGdsPoint[];
  strings: string[];
  diagnostics: LspLayoutDiagnostic[];
}

export interface LspLayoutTileMetrics {
  indexBuildMicros: number;
  queryMicros: number;
  encodeMicros: number;
  visitedCellCount: number;
  elementCandidateCount: number;
  referenceCandidateCount: number;
  traversedReferenceCount: number;
  lodShapeCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  gridBuildMicros: number;
  gridHitCount: number;
  gridMissCount: number;
  gridCandidateCount: number;
  gridBinCount: number;
}

export interface LspLayoutTileGeometryOptions {
  sessionId: string;
  bbox?: LspLayoutBounds;
  rootCellIndex: number;
  maxShapes?: number;
  maxPoints?: number;
  maxBytes?: number;
  lod?: number;
  continuationToken?: number;
  layerIndices?: number[];
  shapeKinds?: number[];
  datatypes?: number[];
}

export interface LspLayoutTileGeometry {
  geometry: LspLayoutGeometry;
  truncated: boolean;
  nextToken: number | null;
  payloadSize: number;
  tileShapeCount: number;
  metrics: LspLayoutTileMetrics;
}

export interface LspLayoutGeometryOptions {
  sessionId: string;
  bbox?: LspLayoutBounds;
  maxShapes?: number;
  layerIndices?: number[];
  shapeKinds?: number[];
  macroIndices?: number[];
  gdsRootCellIndices?: number[];
}

export interface LspLayoutOpenResult {
  sessionId: string;
  id?: string;
  protocol: string;
  endpoint?: LspLayoutEndpoint;
  deferred?: boolean;
  sourceKind?: LspLayoutSourceKind;
  initialStatus?: LspLayoutStatusState;
  title: string;
  lefCount: number;
  defPresent: boolean;
  unitsPerMicron: number;
  bbox: LspLayoutBounds | null;
  layerCount: number;
  macroCount: number;
  componentCount: number;
  netCount: number;
  cellCount?: number;
  diagnosticCount: number;
  fileUris: string[];
  messages: string[];
  catalog: LspLayoutCatalog;
}

export interface LspStateEvent {
  status: 'starting' | 'ready' | 'stopped' | 'error';
  message?: string;
}
