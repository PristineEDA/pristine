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

export interface LspStateEvent {
  status: 'starting' | 'ready' | 'stopped' | 'error';
  message?: string;
}