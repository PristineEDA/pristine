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