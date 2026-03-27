import { ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { SyncChannels, AsyncChannels } from './channels.js';
import { assertString } from './validators.js';

let configData: Record<string, unknown> = {};
let configPath = '';

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

export function registerConfigHandlers(): void {
  loadConfig();

  ipcMain.on(SyncChannels.CONFIG_GET, (event, key: unknown) => {
    assertString(key, 'key');
    event.returnValue = configData[key] ?? null;
  });

  ipcMain.handle(AsyncChannels.CONFIG_SET, async (_event, key: unknown, value: unknown) => {
    assertString(key, 'key');
    configData[key] = value;
    saveConfig();
  });
}
