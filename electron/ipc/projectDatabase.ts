import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { loadBetterSqlite } from './betterSqlite.js';
import type {
  CreateProjectInput,
  ProjectSessionSnapshot,
  ProjectState,
} from '../../types/project.js';

const PROJECT_DATA_DIRECTORY_NAME = '.pristine';
const PROJECT_DATABASE_FILE_NAME = 'project.sqlite';
const PROJECT_SESSION_STATE_KEY = 'workspace-session';
const PROJECT_SCHEMA_VERSION = 1;

let currentDatabase: BetterSqliteDatabase | null = null;
let currentProject: Omit<ProjectState, 'session'> | null = null;

function getDatabasePath(projectRoot: string): string {
  return path.join(projectRoot, PROJECT_DATA_DIRECTORY_NAME, PROJECT_DATABASE_FILE_NAME);
}

function getProjectName(rootPath: string): string {
  return path.basename(path.resolve(rootPath));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isValidProjectDatabase(rootPath: string): boolean {
  return fs.existsSync(getDatabasePath(rootPath));
}

export function createDefaultProjectSession(): ProjectSessionSnapshot {
  return {
    activeView: 'explorer',
    editorGroups: [],
    editorLayout: null,
    focusedGroupId: null,
    mainContentView: 'code',
    panelStateByView: {
      explorer: {
        showLeftPanel: true,
        showBottomPanel: false,
        showRightPanel: false,
      },
      simulation: {
        showLeftPanel: true,
        showBottomPanel: true,
        showRightPanel: true,
      },
      synthesis: {
        showLeftPanel: true,
        showBottomPanel: true,
        showRightPanel: true,
      },
      physical: {
        showLeftPanel: true,
        showBottomPanel: true,
        showRightPanel: true,
      },
      factory: {
        showLeftPanel: false,
        showBottomPanel: false,
        showRightPanel: false,
      },
    },
    version: 1,
  };
}

function migrateDatabase(database: BetterSqliteDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_state (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.prepare(`
    INSERT OR IGNORE INTO schema_migrations (version, applied_at)
    VALUES (?, ?)
  `).run(PROJECT_SCHEMA_VERSION, new Date().toISOString());
}

function writeMetadata(database: BetterSqliteDatabase, key: string, value: unknown): void {
  database.prepare(`
    INSERT INTO metadata (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, JSON.stringify(value));
}

function writeSession(database: BetterSqliteDatabase, snapshot: ProjectSessionSnapshot): void {
  database.prepare(`
    INSERT INTO session_state (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = excluded.updated_at
  `).run(PROJECT_SESSION_STATE_KEY, JSON.stringify(snapshot), new Date().toISOString());
}

function readSession(database: BetterSqliteDatabase): ProjectSessionSnapshot | null {
  const row = database.prepare('SELECT value_json FROM session_state WHERE key = ?')
    .get(PROJECT_SESSION_STATE_KEY) as { value_json: string } | undefined;

  if (!row) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.value_json) as unknown;
    return normalizeProjectSessionSnapshot(parsed);
  } catch {
    return null;
  }
}

function normalizeProjectSessionSnapshot(value: unknown): ProjectSessionSnapshot | null {
  if (!isPlainObject(value) || value['version'] !== 1) {
    return null;
  }

  const defaultSession = createDefaultProjectSession();
  const activeView = typeof value['activeView'] === 'string' && value['activeView'] in defaultSession.panelStateByView
    ? value['activeView'] as ProjectSessionSnapshot['activeView']
    : defaultSession.activeView;
  const mainContentView = value['mainContentView'] === 'whiteboard' || value['mainContentView'] === 'workflow'
    ? value['mainContentView']
    : 'code';
  const panelStateByView = isPlainObject(value['panelStateByView'])
    ? {
        ...defaultSession.panelStateByView,
        ...value['panelStateByView'],
      } as ProjectSessionSnapshot['panelStateByView']
    : defaultSession.panelStateByView;
  const panelWidths = isPlainObject(value['panelWidths'])
    ? Object.fromEntries(
        Object.entries(value['panelWidths'])
          .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])),
      )
    : undefined;

  return {
    activeTabId: typeof value['activeTabId'] === 'string' ? value['activeTabId'] : undefined,
    activeView,
    editorGroups: Array.isArray(value['editorGroups'])
      ? value['editorGroups'] as ProjectSessionSnapshot['editorGroups']
      : defaultSession.editorGroups,
    editorLayout: isPlainObject(value['editorLayout'])
      ? value['editorLayout'] as unknown as ProjectSessionSnapshot['editorLayout']
      : null,
    focusedGroupId: typeof value['focusedGroupId'] === 'string' ? value['focusedGroupId'] : null,
    mainContentView,
    panelStateByView,
    panelWidths,
    version: 1,
  };
}

function openDatabase(projectRoot: string): BetterSqliteDatabase {
  const Database = loadBetterSqlite();
  const database = new Database(getDatabasePath(projectRoot));
  database.pragma('journal_mode = WAL');
  migrateDatabase(database);
  return database;
}

export async function createProjectDatabase(input: CreateProjectInput, rootPath: string): Promise<ProjectState> {
  await fsPromises.mkdir(path.join(rootPath, PROJECT_DATA_DIRECTORY_NAME), { recursive: true });

  const database = openDatabase(rootPath);
  const session = createDefaultProjectSession();

  writeMetadata(database, 'name', input.name);
  writeMetadata(database, 'rootPath', rootPath);
  writeMetadata(database, 'createdAt', new Date().toISOString());
  writeMetadata(database, 'template', {
    mgnt: input.mgnt,
    mode: input.mode,
    padframe: input.padframe,
    process: input.process,
    type: input.type,
  });
  writeSession(database, session);
  database.close();

  return {
    name: input.name,
    rootPath,
    session,
  };
}

export function ensureProjectDatabase(rootPath: string): void {
  if (isValidProjectDatabase(rootPath)) {
    return;
  }

  fs.mkdirSync(path.join(rootPath, PROJECT_DATA_DIRECTORY_NAME), { recursive: true });

  const database = openDatabase(rootPath);
  const session = createDefaultProjectSession();

  writeMetadata(database, 'name', getProjectName(rootPath));
  writeMetadata(database, 'rootPath', rootPath);
  writeMetadata(database, 'createdAt', new Date().toISOString());
  writeSession(database, session);
  database.close();
}

export function openCurrentProject(rootPath: string): ProjectState {
  closeCurrentProjectDatabase();

  const resolvedRoot = path.resolve(rootPath);
  const database = openDatabase(resolvedRoot);
  currentDatabase = database;
  currentProject = {
    name: getProjectName(resolvedRoot),
    rootPath: resolvedRoot,
  };

  return {
    ...currentProject,
    session: readSession(database),
  };
}

export function getCurrentProjectState(): ProjectState | null {
  if (!currentProject || !currentDatabase) {
    return null;
  }

  return {
    ...currentProject,
    session: readSession(currentDatabase),
  };
}

export function flushCurrentProjectSession(snapshot: ProjectSessionSnapshot): void {
  if (!currentDatabase) {
    return;
  }

  writeSession(currentDatabase, snapshot);
}

export function closeCurrentProjectDatabase(): void {
  if (!currentDatabase) {
    currentProject = null;
    return;
  }

  currentDatabase.close();
  currentDatabase = null;
  currentProject = null;
}

export function getProjectDatabasePath(rootPath: string): string {
  return getDatabasePath(rootPath);
}
