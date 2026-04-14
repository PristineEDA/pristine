import { BrowserWindow, ipcMain } from 'electron';
import * as childProcess from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from 'vscode-jsonrpc/node.js';
import type {
  LspCompletionItem,
  LspCompletionList,
  LspCompletionResponse,
  LspDiagnostic,
  LspDiagnosticsEvent,
  LspHover,
  LspMarkupContent,
  LspStateEvent,
  LspTextEdit,
  WorkspaceLocation,
} from '../../types/systemverilog-lsp.js';
import { AsyncChannels, StreamChannels } from './channels.js';
import { assertNumber, assertOptionalString, assertString, validatePathWithinRoot } from './validators.js';
import { assertSlangServerPathAvailable, resolveSlangServerPath } from './slangServerPath.js';

interface TrackedDocument {
  filePath: string;
  uri: string;
  languageId: string;
  version: number;
  refCount: number;
  text: string;
}

interface LspSession {
  process: ChildProcessWithoutNullStreams;
  connection: MessageConnection;
  initialized: Promise<void>;
  documents: Map<string, TrackedDocument>;
  disposed: boolean;
}

const SYSTEMVERILOG_LANGUAGE_ID = 'systemverilog';
const CLIENT_NAME = 'Pristine Monaco LSP';
const CLIENT_VERSION = '0.0.1';

let projectRoot: string | null = null;
let activeSessionPromise: Promise<LspSession> | null = null;
let activeSession: LspSession | null = null;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const WINDOWS_FILE_URI_PATH_PATTERN = /^\/[A-Za-z]:\//;

function getProjectRoot(): string {
  if (!projectRoot) {
    throw new Error('Project root not set');
  }

  return projectRoot;
}

function normalizeWorkspaceFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
}

function isWindowsAbsolutePath(filePath: string): boolean {
  return WINDOWS_ABSOLUTE_PATH_PATTERN.test(filePath);
}

function resolveProjectRootPath(root: string): string {
  return isWindowsAbsolutePath(root)
    ? path.win32.normalize(root)
    : path.resolve(root);
}

function resolveWorkspaceFilePath(filePath: string): string {
  const root = getProjectRoot();

  if (!isWindowsAbsolutePath(root)) {
    return validatePathWithinRoot(root, filePath);
  }

  const resolvedPath = path.win32.isAbsolute(filePath)
    ? path.win32.normalize(filePath)
    : path.win32.resolve(root, filePath);
  const relativePath = path.win32.relative(root, resolvedPath);

  if (relativePath.startsWith('..') || path.win32.isAbsolute(relativePath)) {
    throw new Error(`Path traversal denied: ${filePath}`);
  }

  return resolvedPath;
}

function absolutePathToFileUri(absolutePath: string): string {
  if (!isWindowsAbsolutePath(absolutePath)) {
    return pathToFileURL(absolutePath).toString();
  }

  const url = new URL('file:///');
  url.pathname = `/${path.win32.normalize(absolutePath).replace(/\\/g, '/')}`;
  return url.toString();
}

function fileUriToAbsolutePath(uri: string): string | null {
  let parsedUri: URL;

  try {
    parsedUri = new URL(uri);
  } catch {
    return null;
  }

  if (parsedUri.protocol !== 'file:') {
    return null;
  }

  const decodedPathname = decodeURIComponent(parsedUri.pathname);
  if (WINDOWS_FILE_URI_PATH_PATTERN.test(decodedPathname)) {
    return path.win32.normalize(decodedPathname.slice(1));
  }

  try {
    return fileURLToPath(parsedUri);
  } catch {
    return null;
  }
}

function getDocumentUri(filePath: string): string {
  return absolutePathToFileUri(resolveWorkspaceFilePath(filePath));
}

function getRelativeWorkspaceFilePath(uri: string): string | null {
  const absolutePath = fileUriToAbsolutePath(uri);
  if (!absolutePath) {
    return null;
  }

  const root = getProjectRoot();
  const pathModule = isWindowsAbsolutePath(root) ? path.win32 : path;
  const relativePath = pathModule.relative(root, absolutePath);
  if (relativePath.startsWith('..') || pathModule.isAbsolute(relativePath)) {
    return null;
  }

  return normalizeWorkspaceFilePath(relativePath);
}

function sendLspState(getMainWindow: () => BrowserWindow | null, payload: LspStateEvent): void {
  getMainWindow()?.webContents.send(StreamChannels.LSP_STATE, payload);
}

function sendLspDiagnostics(getMainWindow: () => BrowserWindow | null, payload: LspDiagnosticsEvent): void {
  getMainWindow()?.webContents.send(StreamChannels.LSP_DIAGNOSTICS, payload);
}

function normalizeTextEdit(value: unknown): LspTextEdit | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as {
    newText?: unknown;
    range?: LspTextEdit['range'];
    insert?: LspTextEdit['range'];
  };
  const range = candidate.range ?? candidate.insert;

  if (!range || typeof candidate.newText !== 'string') {
    return undefined;
  }

  return {
    range,
    newText: candidate.newText,
  };
}

function normalizeMarkupContent(value: unknown): LspMarkupContent | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as { kind?: unknown; value?: unknown };
  if (typeof candidate.kind !== 'string' || typeof candidate.value !== 'string') {
    return undefined;
  }

  return {
    kind: candidate.kind,
    value: candidate.value,
  };
}

function normalizeCompletionItem(value: unknown): LspCompletionItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    label?: unknown;
    kind?: unknown;
    detail?: unknown;
    documentation?: unknown;
    insertText?: unknown;
    sortText?: unknown;
    filterText?: unknown;
    preselect?: unknown;
    commitCharacters?: unknown;
    insertTextFormat?: unknown;
    textEdit?: unknown;
    additionalTextEdits?: unknown;
  };
  if (typeof candidate.label !== 'string') {
    return null;
  }

  const normalizedDocumentation = typeof candidate.documentation === 'string'
    ? candidate.documentation
    : Array.isArray(candidate.documentation)
    ? candidate.documentation.filter(
      (entry): entry is string | LspMarkupContent => typeof entry === 'string' || Boolean(normalizeMarkupContent(entry)),
    ).map((entry) => (typeof entry === 'string' ? entry : normalizeMarkupContent(entry)!))
    : normalizeMarkupContent(candidate.documentation);
  const normalizedAdditionalTextEdits = Array.isArray(candidate.additionalTextEdits)
    ? candidate.additionalTextEdits
      .map((entry) => normalizeTextEdit(entry))
      .filter((entry): entry is LspTextEdit => Boolean(entry))
    : undefined;

  return {
    label: candidate.label,
    kind: typeof candidate.kind === 'number' ? candidate.kind : undefined,
    detail: typeof candidate.detail === 'string' ? candidate.detail : undefined,
    documentation: normalizedDocumentation,
    insertText: typeof candidate.insertText === 'string' ? candidate.insertText : undefined,
    sortText: typeof candidate.sortText === 'string' ? candidate.sortText : undefined,
    filterText: typeof candidate.filterText === 'string' ? candidate.filterText : undefined,
    preselect: candidate.preselect === true,
    commitCharacters: Array.isArray(candidate.commitCharacters)
      ? candidate.commitCharacters.filter((entry): entry is string => typeof entry === 'string')
      : undefined,
    insertTextFormat: typeof candidate.insertTextFormat === 'number' ? candidate.insertTextFormat : undefined,
    textEdit: normalizeTextEdit(candidate.textEdit),
    additionalTextEdits: normalizedAdditionalTextEdits,
  };
}

function normalizeCompletionResponse(value: unknown): LspCompletionResponse | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeCompletionItem(entry))
      .filter((entry): entry is LspCompletionItem => Boolean(entry));
  }

  if (typeof value !== 'object') {
    return null;
  }

  const candidate = value as { isIncomplete?: unknown; items?: unknown };
  if (!Array.isArray(candidate.items)) {
    return null;
  }

  const items = candidate.items
    .map((entry) => normalizeCompletionItem(entry))
    .filter((entry): entry is LspCompletionItem => Boolean(entry));

  return {
    isIncomplete: candidate.isIncomplete === true,
    items,
  } satisfies LspCompletionList;
}

function normalizeHover(value: unknown): LspHover | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as { contents?: unknown; range?: LspHover['range'] };
  if (candidate.contents === undefined) {
    return null;
  }

  const normalizedContents = Array.isArray(candidate.contents)
    ? candidate.contents.map((entry) => normalizeMarkupContent(entry) ?? entry)
    : normalizeMarkupContent(candidate.contents) ?? candidate.contents;

  return {
    contents: normalizedContents as LspHover['contents'],
    range: candidate.range,
  };
}

function normalizeWorkspaceLocation(value: unknown): WorkspaceLocation | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    uri?: unknown;
    range?: WorkspaceLocation['range'];
    targetUri?: unknown;
    targetRange?: WorkspaceLocation['range'];
    targetSelectionRange?: WorkspaceLocation['range'];
  };
  const uri = typeof candidate.targetUri === 'string'
    ? candidate.targetUri
    : typeof candidate.uri === 'string'
    ? candidate.uri
    : null;
  const range = candidate.targetSelectionRange ?? candidate.targetRange ?? candidate.range;

  if (!uri || !range) {
    return null;
  }

  const filePath = getRelativeWorkspaceFilePath(uri);
  if (!filePath) {
    return null;
  }

  return {
    filePath,
    range,
  };
}

function normalizeWorkspaceLocations(value: unknown): WorkspaceLocation[] {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  return values
    .map((entry) => normalizeWorkspaceLocation(entry))
    .filter((entry): entry is WorkspaceLocation => Boolean(entry));
}

function createInitializeParams() {
  const root = getProjectRoot();
  const rootUri = absolutePathToFileUri(root);

  return {
    processId: process.pid,
    clientInfo: {
      name: CLIENT_NAME,
      version: CLIENT_VERSION,
    },
    rootPath: root,
    rootUri,
    workspaceFolders: [{ name: path.basename(root), uri: rootUri }],
    capabilities: {
      textDocument: {
        completion: {
          completionItem: {
            documentationFormat: ['markdown', 'plaintext'],
            snippetSupport: true,
          },
        },
        hover: {
          contentFormat: ['markdown', 'plaintext'],
        },
        definition: {
          linkSupport: true,
        },
        references: {},
        publishDiagnostics: {},
      },
      workspace: {
        workspaceFolders: true,
      },
    },
  };
}

function cleanupSession(session: LspSession): void {
  if (session.disposed) {
    return;
  }

  session.disposed = true;
  session.documents.clear();

  try {
    session.connection.dispose();
  } catch {
    // Ignore disposal failures during shutdown.
  }

  if (!session.process.killed) {
    session.process.kill();
  }

  if (activeSession === session) {
    activeSession = null;
    activeSessionPromise = null;
  }
}

function createTrackedDocument(filePath: string, text: string, languageId = SYSTEMVERILOG_LANGUAGE_ID): TrackedDocument {
  return {
    filePath,
    uri: getDocumentUri(filePath),
    languageId,
    version: 1,
    refCount: 0,
    text,
  };
}

async function createSession(getMainWindow: () => BrowserWindow | null): Promise<LspSession> {
  const root = getProjectRoot();
  const binaryPath = assertSlangServerPathAvailable(resolveSlangServerPath());
  const serverProcess = childProcess.spawn(binaryPath, [], {
    cwd: root,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const connection = createMessageConnection(
    new StreamMessageReader(serverProcess.stdout),
    new StreamMessageWriter(serverProcess.stdin),
  );
  const session: LspSession = {
    process: serverProcess,
    connection,
    initialized: Promise.resolve(),
    documents: new Map<string, TrackedDocument>(),
    disposed: false,
  };

  activeSession = session;
  sendLspState(getMainWindow, { status: 'starting' });

  serverProcess.on('error', (error) => {
    sendLspState(getMainWindow, { status: 'error', message: error.message });
    cleanupSession(session);
  });

  serverProcess.on('close', (code) => {
    if (session.disposed) {
      return;
    }

    const message = code === null ? 'Language server exited unexpectedly' : `Language server exited with code ${code}`;
    sendLspState(getMainWindow, { status: 'stopped', message });
    cleanupSession(session);
  });

  connection.onNotification('textDocument/publishDiagnostics', (params: { uri: string; diagnostics: LspDiagnostic[] }) => {
    const filePath = getRelativeWorkspaceFilePath(params.uri);
    if (!filePath) {
      return;
    }

    sendLspDiagnostics(getMainWindow, {
      filePath,
      diagnostics: params.diagnostics,
    });
  });

  connection.onClose(() => {
    if (!session.disposed) {
      sendLspState(getMainWindow, { status: 'stopped' });
    }
  });

  connection.listen();
  session.initialized = connection.sendRequest('initialize', createInitializeParams())
    .then(() => {
      connection.sendNotification('initialized', {});
      sendLspState(getMainWindow, { status: 'ready' });
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to initialize SystemVerilog LSP server';
      sendLspState(getMainWindow, { status: 'error', message });
      cleanupSession(session);
      throw error;
    });

  return session;
}

async function getSession(getMainWindow: () => BrowserWindow | null): Promise<LspSession> {
  if (!activeSessionPromise) {
    activeSessionPromise = createSession(getMainWindow).catch((error) => {
      activeSessionPromise = null;
      activeSession = null;
      throw error;
    });
  }

  return activeSessionPromise;
}

async function withInitializedSession<T>(
  getMainWindow: () => BrowserWindow | null,
  callback: (session: LspSession) => Promise<T>,
): Promise<T> {
  const session = await getSession(getMainWindow);
  await session.initialized;
  return callback(session);
}

function getOrCreateDocument(session: LspSession, filePath: string, text: string, languageId = SYSTEMVERILOG_LANGUAGE_ID): TrackedDocument {
  const normalizedFilePath = normalizeWorkspaceFilePath(filePath);
  const existing = session.documents.get(normalizedFilePath);
  if (existing) {
    return existing;
  }

  const document = createTrackedDocument(normalizedFilePath, text, languageId);
  session.documents.set(normalizedFilePath, document);
  return document;
}

function updateDocumentText(session: LspSession, filePath: string, text: string): TrackedDocument {
  const document = getOrCreateDocument(session, filePath, text);
  if (document.text !== text) {
    document.text = text;
    document.version += 1;
  }

  return document;
}

export function setLspProjectRoot(root: string): void {
  projectRoot = resolveProjectRootPath(root);
}

export function disposeLspSession(): void {
  if (activeSession) {
    cleanupSession(activeSession);
  }
}

export function registerLspHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(AsyncChannels.LSP_OPEN_DOCUMENT, async (_event, filePath: unknown, languageId: unknown, text: unknown) => {
    assertString(filePath, 'filePath');
    assertString(languageId, 'languageId');
    assertString(text, 'text');

    await withInitializedSession(getMainWindow, async (session) => {
      const document = getOrCreateDocument(session, filePath, text, languageId);
      document.refCount += 1;

      if (document.refCount === 1) {
        await session.connection.sendNotification('textDocument/didOpen', {
          textDocument: {
            uri: document.uri,
            languageId: document.languageId,
            version: document.version,
            text: document.text,
          },
        });
        return;
      }

      if (document.text !== text) {
        document.text = text;
        document.version += 1;
        await session.connection.sendNotification('textDocument/didChange', {
          textDocument: {
            uri: document.uri,
            version: document.version,
          },
          contentChanges: [{ text: document.text }],
        });
      }
    });
  });

  ipcMain.handle(AsyncChannels.LSP_CHANGE_DOCUMENT, async (_event, filePath: unknown, text: unknown) => {
    assertString(filePath, 'filePath');
    assertString(text, 'text');

    await withInitializedSession(getMainWindow, async (session) => {
      const document = updateDocumentText(session, filePath, text);
      if (document.refCount === 0) {
        document.refCount = 1;
        await session.connection.sendNotification('textDocument/didOpen', {
          textDocument: {
            uri: document.uri,
            languageId: document.languageId,
            version: document.version,
            text: document.text,
          },
        });
        return;
      }

      await session.connection.sendNotification('textDocument/didChange', {
        textDocument: {
          uri: document.uri,
          version: document.version,
        },
        contentChanges: [{ text: document.text }],
      });
    });
  });

  ipcMain.handle(AsyncChannels.LSP_CLOSE_DOCUMENT, async (_event, filePath: unknown) => {
    assertString(filePath, 'filePath');

    await withInitializedSession(getMainWindow, async (session) => {
      const normalizedFilePath = normalizeWorkspaceFilePath(filePath);
      const document = session.documents.get(normalizedFilePath);
      if (!document) {
        return;
      }

      document.refCount = Math.max(document.refCount - 1, 0);
      if (document.refCount > 0) {
        return;
      }

      session.documents.delete(normalizedFilePath);
      await session.connection.sendNotification('textDocument/didClose', {
        textDocument: {
          uri: document.uri,
        },
      });
    });
  });

  ipcMain.handle(
    AsyncChannels.LSP_COMPLETION,
    async (
      _event,
      filePath: unknown,
      line: unknown,
      character: unknown,
      triggerCharacter?: unknown,
      triggerKind?: unknown,
    ) => {
      assertString(filePath, 'filePath');
      assertNumber(line, 'line');
      assertNumber(character, 'character');
      assertOptionalString(triggerCharacter, 'triggerCharacter');
      if (triggerKind !== undefined) {
        assertNumber(triggerKind, 'triggerKind');
      }

      return withInitializedSession(getMainWindow, async (session) => {
        const result = await session.connection.sendRequest('textDocument/completion', {
          textDocument: { uri: getDocumentUri(filePath) },
          position: { line, character },
          context: triggerKind === undefined
            ? undefined
            : {
              triggerKind,
              triggerCharacter,
            },
        });

        return normalizeCompletionResponse(result);
      });
    },
  );

  ipcMain.handle(AsyncChannels.LSP_HOVER, async (_event, filePath: unknown, line: unknown, character: unknown) => {
    assertString(filePath, 'filePath');
    assertNumber(line, 'line');
    assertNumber(character, 'character');

    return withInitializedSession(getMainWindow, async (session) => {
      const result = await session.connection.sendRequest('textDocument/hover', {
        textDocument: { uri: getDocumentUri(filePath) },
        position: { line, character },
      });

      return normalizeHover(result);
    });
  });

  ipcMain.handle(AsyncChannels.LSP_DEFINITION, async (_event, filePath: unknown, line: unknown, character: unknown) => {
    assertString(filePath, 'filePath');
    assertNumber(line, 'line');
    assertNumber(character, 'character');

    return withInitializedSession(getMainWindow, async (session) => {
      const result = await session.connection.sendRequest('textDocument/definition', {
        textDocument: { uri: getDocumentUri(filePath) },
        position: { line, character },
      });

      return normalizeWorkspaceLocations(result);
    });
  });

  ipcMain.handle(
    AsyncChannels.LSP_REFERENCES,
    async (_event, filePath: unknown, line: unknown, character: unknown, includeDeclaration?: unknown) => {
      assertString(filePath, 'filePath');
      assertNumber(line, 'line');
      assertNumber(character, 'character');
      if (includeDeclaration !== undefined && typeof includeDeclaration !== 'boolean') {
        throw new Error(`Expected boolean or undefined for "includeDeclaration", got ${typeof includeDeclaration}`);
      }

      return withInitializedSession(getMainWindow, async (session) => {
        const result = await session.connection.sendRequest('textDocument/references', {
          textDocument: { uri: getDocumentUri(filePath) },
          position: { line, character },
          context: { includeDeclaration: includeDeclaration !== false },
        });

        return normalizeWorkspaceLocations(result);
      });
    },
  );
}