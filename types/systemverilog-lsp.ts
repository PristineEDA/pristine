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

export interface LspStateEvent {
  status: 'starting' | 'ready' | 'stopped' | 'error';
  message?: string;
}
