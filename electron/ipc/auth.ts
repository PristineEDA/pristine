import { BrowserWindow, app, ipcMain, net, safeStorage, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { AsyncChannels, StreamChannels } from './channels.js';
import {
  getConfigSnapshot,
  onConfigValueChanged,
  setConfigValues,
} from './config.js';
import type { AuthView, DesktopAuthSession } from '../../src/app/auth/types.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const AUTH_CALLBACK_PROTOCOL = 'pristine';
const AUTH_CALLBACK_URL = `${AUTH_CALLBACK_PROTOCOL}://auth/callback`;
const AUTH_SESSION_FILE_NAME = 'auth-session.json';
const DEFAULT_AUTH_SERVICE_URL = 'https://pristine-auth.maksyuki.workers.dev';
const DEFAULT_SUPABASE_URL = 'https://fsuyziugqxslwkaxcakv.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_i5J8TuBBSJYZwep4Blkk1w_VryyHYPc';
const CONFIG_SYNC_DEBOUNCE_MS = 1200;
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60_000;
const CONFIG_SYNC_KEYS = [
  'ui.theme',
  'window.closeActionPreference',
  'ui.floatingInfoWindow.visible',
  'editor.fontSize',
  'editor.fontFamily',
  'editor.theme',
  'editor.wordWrap',
  'editor.renderWhitespace',
  'editor.renderControlCharacters',
  'editor.fontLigatures',
  'editor.tabSize',
  'editor.cursorBlinking',
  'editor.smoothScrolling',
  'editor.scrollBeyondLastLine',
  'editor.foldingStrategy',
  'editor.lineNumbers',
  'editor.minimap.enabled',
  'editor.glyphMargin',
  'editor.guides.bracketPairs',
  'editor.guides.indentation',
] as const;
const CONFIG_SYNC_KEY_SET = new Set<string>(CONFIG_SYNC_KEYS);

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthServiceConfigResponse {
  settings: Record<string, unknown>;
  syncVersion: number;
  syncedAt: string | null;
}

interface AuthServiceExchangeResponse {
  accessToken: string;
  configSnapshot?: AuthServiceConfigResponse;
  profile: {
    avatarUrl: string | null;
    email: string;
    userId: string;
    username: string;
  };
  refreshToken: string;
  sessionExpiresAt: number | null;
}

interface StoredAuthSession {
  accessToken: string;
  profile: DesktopAuthSession;
  refreshToken: string;
}

interface StoredSessionEnvelope {
  encrypted: boolean;
  payload: string;
}

interface SupabaseRefreshResponse {
  access_token: string;
  expires_at: number | null;
  refresh_token: string;
}

// ─── State ───────────────────────────────────────────────────────────────────

let authSession: StoredAuthSession | null = null;
let authSessionLoaded = false;
let configSyncTimer: ReturnType<typeof setTimeout> | null = null;
let configSyncListenerInstalled = false;
let isApplyingCloudSnapshot = false;

// ─── Environment ─────────────────────────────────────────────────────────────

function getAuthServiceUrl(): string {
  const configuredUrl = process.env['PRISTINE_AUTH_SERVICE_URL']
    ?? process.env['VITE_PRISTINE_AUTH_SERVICE_URL']
    ?? DEFAULT_AUTH_SERVICE_URL;

  return configuredUrl.replace(/\/+$/, '');
}

function getSupabaseUrl(): string {
  const configuredUrl = process.env['PRISTINE_SUPABASE_URL']
    ?? process.env['VITE_PRISTINE_SUPABASE_URL']
    ?? DEFAULT_SUPABASE_URL;

  return configuredUrl.replace(/\/+$/, '');
}

function getSupabasePublishableKey(): string {
  return process.env['PRISTINE_SUPABASE_PUBLISHABLE_KEY']
    ?? process.env['VITE_PRISTINE_SUPABASE_PUBLISHABLE_KEY']
    ?? DEFAULT_SUPABASE_PUBLISHABLE_KEY;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

function getAuthSessionPath(): string {
  return path.join(app.getPath('userData'), AUTH_SESSION_FILE_NAME);
}

function serializeSessionEnvelope(session: StoredAuthSession): StoredSessionEnvelope {
  const json = JSON.stringify(session);

  if (safeStorage.isEncryptionAvailable()) {
    return {
      encrypted: true,
      payload: safeStorage.encryptString(json).toString('base64'),
    };
  }

  return {
    encrypted: false,
    payload: Buffer.from(json, 'utf-8').toString('base64'),
  };
}

function deserializeSessionEnvelope(envelope: StoredSessionEnvelope): StoredAuthSession | null {
  try {
    const raw = envelope.encrypted
      ? safeStorage.decryptString(Buffer.from(envelope.payload, 'base64'))
      : Buffer.from(envelope.payload, 'base64').toString('utf-8');

    return JSON.parse(raw) as StoredAuthSession;
  } catch {
    return null;
  }
}

function loadStoredSession(): StoredAuthSession | null {
  try {
    const sessionPath = getAuthSessionPath();
    const envelope = JSON.parse(fs.readFileSync(sessionPath, 'utf-8')) as StoredSessionEnvelope;
    return deserializeSessionEnvelope(envelope);
  } catch {
    return null;
  }
}

function ensureAuthSessionLoaded(): void {
  if (authSessionLoaded) {
    return;
  }

  authSession = loadStoredSession();
  authSessionLoaded = true;
}

function persistAuthSession(nextSession: StoredAuthSession | null): void {
  authSession = nextSession;
  authSessionLoaded = true;

  const sessionPath = getAuthSessionPath();

  if (!nextSession) {
    try {
      fs.unlinkSync(sessionPath);
    } catch {
      /* ignore */
    }
    return;
  }

  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(
    sessionPath,
    JSON.stringify(serializeSessionEnvelope(nextSession), null, 2),
    'utf-8',
  );
}

// ─── Broadcasts ──────────────────────────────────────────────────────────────

function broadcast(channel: string, payload?: unknown): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      return;
    }

    if (payload === undefined) {
      window.webContents.send(channel);
      return;
    }

    window.webContents.send(channel, payload);
  });
}

function getPublicSession(session: StoredAuthSession | null): DesktopAuthSession | null {
  return session?.profile ?? null;
}

function emitAuthStateChanged(): void {
  broadcast(StreamChannels.AUTH_STATE_CHANGED, getPublicSession(authSession));
}

function emitAuthError(message: string): void {
  broadcast(StreamChannels.AUTH_ERROR, message);
}

// ─── Requests ────────────────────────────────────────────────────────────────

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const bodyText = await response.text();
  const parsedBody = bodyText ? JSON.parse(bodyText) as Record<string, unknown> : {};

  if (!response.ok) {
    const message = typeof parsedBody['message'] === 'string'
      ? parsedBody['message']
      : fallbackMessage;
    throw new Error(message);
  }

  return parsedBody as T;
}

async function fetchAuthService(input: string, init?: RequestInit): Promise<Response> {
  return net.fetch(input, init);
}

async function refreshAuthSessionIfNeeded(): Promise<StoredAuthSession | null> {
  ensureAuthSessionLoaded();

  if (!authSession) {
    return null;
  }

  const expiresAt = authSession.profile.sessionExpiresAt;
  if (expiresAt && expiresAt * 1000 - Date.now() > ACCESS_TOKEN_REFRESH_BUFFER_MS) {
    return authSession;
  }

  try {
    const response = await fetch(
      `${getSupabaseUrl()}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          apikey: getSupabasePublishableKey(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: authSession.refreshToken,
        }),
      },
    );
    const refreshedSession = await readJsonResponse<SupabaseRefreshResponse>(
      response,
      'The desktop session expired. Sign in again.',
    );

    const nextSession: StoredAuthSession = {
      accessToken: refreshedSession.access_token,
      profile: {
        ...authSession.profile,
        sessionExpiresAt: refreshedSession.expires_at ?? null,
      },
      refreshToken: refreshedSession.refresh_token,
    };

    persistAuthSession(nextSession);
    emitAuthStateChanged();
    return nextSession;
  } catch (error) {
    persistAuthSession(null);
    emitAuthStateChanged();
    emitAuthError(error instanceof Error ? error.message : 'The desktop session expired. Sign in again.');
    return null;
  }
}

async function bestEffortRemoteSignOut(): Promise<void> {
  const session = await refreshAuthSessionIfNeeded();

  if (!session) {
    return;
  }

  try {
    await fetch(`${getSupabaseUrl()}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        apikey: getSupabasePublishableKey(),
        Authorization: `Bearer ${session.accessToken}`,
      },
    });
  } catch {
    /* ignore */
  }
}

// ─── Config Sync ─────────────────────────────────────────────────────────────

async function pushLocalConfigToCloud(): Promise<AuthServiceConfigResponse | null> {
  const session = await refreshAuthSessionIfNeeded();

  if (!session) {
    return null;
  }

  const response = await fetchAuthService(`${getAuthServiceUrl()}/api/desktop/config`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      settings: getConfigSnapshot(CONFIG_SYNC_KEYS),
    }),
  });
  const snapshot = await readJsonResponse<AuthServiceConfigResponse>(
    response,
    'Unable to sync local settings to the cloud.',
  );

  persistAuthSession({
    ...session,
    profile: {
      ...session.profile,
      syncedAt: snapshot.syncedAt,
    },
  });
  emitAuthStateChanged();
  return snapshot;
}

async function pullCloudConfigFromCloud(): Promise<AuthServiceConfigResponse | null> {
  const session = await refreshAuthSessionIfNeeded();

  if (!session) {
    return null;
  }

  const response = await fetchAuthService(`${getAuthServiceUrl()}/api/desktop/config`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });
  const snapshot = await readJsonResponse<AuthServiceConfigResponse>(
    response,
    'Unable to pull the cloud settings snapshot.',
  );

  isApplyingCloudSnapshot = true;
  try {
    setConfigValues(snapshot.settings);
  } finally {
    isApplyingCloudSnapshot = false;
  }

  persistAuthSession({
    ...session,
    profile: {
      ...session.profile,
      syncedAt: snapshot.syncedAt,
    },
  });
  emitAuthStateChanged();
  return snapshot;
}

function scheduleLocalConfigSync(): void {
  if (configSyncTimer) {
    clearTimeout(configSyncTimer);
  }

  configSyncTimer = setTimeout(() => {
    configSyncTimer = null;
    void pushLocalConfigToCloud().catch((error) => {
      emitAuthError(
        error instanceof Error
          ? error.message
          : 'Unable to sync local settings to the cloud.',
      );
    });
  }, CONFIG_SYNC_DEBOUNCE_MS);
}

function installConfigSyncListener(): void {
  if (configSyncListenerInstalled) {
    return;
  }

  onConfigValueChanged((key) => {
    if (!CONFIG_SYNC_KEY_SET.has(key) || isApplyingCloudSnapshot) {
      return;
    }

    ensureAuthSessionLoaded();

    if (!authSession) {
      return;
    }

    scheduleLocalConfigSync();
  });

  configSyncListenerInstalled = true;
}

async function syncCloudConfig(): Promise<boolean> {
  try {
    const pushedSnapshot = await pushLocalConfigToCloud();
    if (!pushedSnapshot) {
      return false;
    }

    await pullCloudConfigFromCloud();
    return true;
  } catch (error) {
    emitAuthError(
      error instanceof Error
        ? error.message
        : 'Unable to sync cloud settings.',
    );
    return false;
  }
}

// ─── Browser Flow ────────────────────────────────────────────────────────────

function buildAccountPageUrl(view: AuthView): string {
  const url = new URL(`/${view}`, getAuthServiceUrl());

  url.searchParams.set('desktop', '1');
  url.searchParams.set('returnTo', AUTH_CALLBACK_URL);

  return url.toString();
}

async function openAccountPage(view: AuthView): Promise<boolean> {
  try {
    await shell.openExternal(buildAccountPageUrl(view));
    return true;
  } catch {
    return false;
  }
}

function isAuthCallbackUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === `${AUTH_CALLBACK_PROTOCOL}:`
      && parsedUrl.host === 'auth'
      && parsedUrl.pathname === '/callback';
  } catch {
    return false;
  }
}

export async function handleAuthCallbackUrl(url: string): Promise<boolean> {
  if (!isAuthCallbackUrl(url)) {
    return false;
  }

  const callbackUrl = new URL(url);
  const exchangeCode = callbackUrl.searchParams.get('code');

  if (!exchangeCode) {
    emitAuthError('The desktop callback did not contain an exchange code.');
    return true;
  }

  try {
    const response = await fetchAuthService(`${getAuthServiceUrl()}/api/desktop/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: exchangeCode,
      }),
    });
    const exchangedSession = await readJsonResponse<AuthServiceExchangeResponse>(
      response,
      'Unable to redeem the desktop sign-in code.',
    );

    persistAuthSession({
      accessToken: exchangedSession.accessToken,
      profile: {
        avatarUrl: exchangedSession.profile.avatarUrl,
        email: exchangedSession.profile.email,
        sessionExpiresAt: exchangedSession.sessionExpiresAt,
        syncedAt: exchangedSession.configSnapshot?.syncedAt ?? null,
        userId: exchangedSession.profile.userId,
        username: exchangedSession.profile.username,
      },
      refreshToken: exchangedSession.refreshToken,
    });
    emitAuthStateChanged();

    const remoteSettings = exchangedSession.configSnapshot?.settings ?? {};
    if (Object.keys(remoteSettings).length > 0) {
      isApplyingCloudSnapshot = true;
      try {
        setConfigValues(remoteSettings);
      } finally {
        isApplyingCloudSnapshot = false;
      }
    } else {
      void pushLocalConfigToCloud().catch(() => {
        /* ignore */
      });
    }

    return true;
  } catch (error) {
    emitAuthError(
      error instanceof Error
        ? error.message
        : 'Unable to redeem the desktop sign-in code.',
    );
    return true;
  }
}

export function isAuthProtocolUrl(url: string): boolean {
  return isAuthCallbackUrl(url);
}

// ─── IPC Registration ────────────────────────────────────────────────────────

export function registerAuthHandlers(): void {
  ensureAuthSessionLoaded();
  installConfigSyncListener();

  ipcMain.handle(AsyncChannels.AUTH_OPEN_ACCOUNT_PAGE, async (_event, view: unknown) => {
    if (view !== 'login' && view !== 'signup') {
      throw new Error('Expected auth view to be "login" or "signup"');
    }

    return openAccountPage(view);
  });

  ipcMain.handle(AsyncChannels.AUTH_GET_SESSION, async () => {
    const session = await refreshAuthSessionIfNeeded();
    return getPublicSession(session);
  });

  ipcMain.handle(AsyncChannels.AUTH_SIGN_OUT, async () => {
    await bestEffortRemoteSignOut();
    persistAuthSession(null);
    emitAuthStateChanged();
    return true;
  });

  ipcMain.handle(AsyncChannels.AUTH_SYNC_CONFIG, async () => {
    return syncCloudConfig();
  });
}