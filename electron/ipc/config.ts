import { BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { StreamChannels, SyncChannels, AsyncChannels } from './channels.js';
import { assertString } from './validators.js';

let configData: Record<string, unknown> = {};
let configPath = '';
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 300;
const configChangeListeners = new Set<(key: string, value: unknown) => void>();

function ensureConfigLoaded(): void {
  if (!configPath) {
    loadConfig();
  }
}

function loadConfig(): void {
  configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    configData = JSON.parse(raw);
  } catch {
    configData = {};
  }
}

function saveConfig(): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf-8');
}

function debouncedSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveConfig();
    saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

function broadcastConfigChange(key: string, value: unknown): void {
  configChangeListeners.forEach((listener) => listener(key, value));

  BrowserWindow.getAllWindows().forEach((window) => {
    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      return;
    }

    window.webContents.send(StreamChannels.CONFIG_CHANGED, { key, value });
  });
}

export function flushPendingConfigSave(): void {
  ensureConfigLoaded();

  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    saveConfig();
  }
}

export function registerConfigHandlers(): void {
  ensureConfigLoaded();

  ipcMain.on(SyncChannels.CONFIG_GET, (event, key: unknown) => {
    assertString(key, 'key');
    event.returnValue = getConfigValue(key);
  });

  ipcMain.handle(AsyncChannels.CONFIG_SET, async (_event, key: unknown, value: unknown) => {
    assertString(key, 'key');
    setConfigValue(key, value);
  });
}

export function getConfigValue(key: string): unknown {
  ensureConfigLoaded();
  return configData[key] ?? null;
}

export function getConfigSnapshot(keys: readonly string[]): Record<string, unknown> {
  ensureConfigLoaded();

  return Object.fromEntries(
    keys
      .map((key) => [key, getConfigValue(key)] as const)
      .filter((entry) => entry[1] !== null),
  );
}

export function onConfigValueChanged(listener: (key: string, value: unknown) => void): () => void {
  configChangeListeners.add(listener);

  return () => {
    configChangeListeners.delete(listener);
  };
}

export function setConfigValues(entries: Record<string, unknown>): void {
  Object.entries(entries).forEach(([key, value]) => {
    setConfigValue(key, value);
  });
}

export function setConfigValue(key: string, value: unknown): void {
  ensureConfigLoaded();

  const normalizedCurrentValue = configData[key] ?? null;
  const normalizedNextValue = value ?? null;

  if (Object.is(normalizedCurrentValue, normalizedNextValue)) {
    return;
  }

  if (value === null || value === undefined) {
    delete configData[key];
  } else {
    configData[key] = value;
  }

  debouncedSave();
  broadcastConfigChange(key, normalizedNextValue);
}
