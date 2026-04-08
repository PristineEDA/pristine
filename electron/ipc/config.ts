import { ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { SyncChannels, AsyncChannels } from './channels.js';
import { assertString } from './validators.js';

let configData: Record<string, unknown> = {};
let configPath = '';
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 300;

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

export function setConfigValue(key: string, value: unknown): void {
  ensureConfigLoaded();

  if (value === null || value === undefined) {
    delete configData[key];
  } else {
    configData[key] = value;
  }

  debouncedSave();
}
