import { BrowserWindow, Notification, app, ipcMain, nativeImage } from 'electron';
import { AsyncChannels, StreamChannels } from './channels.js';
import { getConfigValue } from './config.js';
import type { NotificationLevel, NotificationPublishInput, NotificationRecord } from '../../types/notification.js';

export const NOTIFICATION_DISMISS_SECONDS_CONFIG_KEY = 'notifications.dismissSeconds';
export const DEFAULT_NOTIFICATION_DISMISS_SECONDS = 5;
export const MIN_NOTIFICATION_DISMISS_SECONDS = 1;
export const MAX_NOTIFICATION_DISMISS_SECONDS = 10;

const activeNotifications = new Map<string, Electron.Notification>();
const closeTimers = new Map<string, ReturnType<typeof setTimeout>>();
let history: NotificationRecord[] = [];
let getMainWindowForNotifications: (() => BrowserWindow | null) | null = null;
let nextNotificationId = 1;

export function parseNotificationDismissSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_NOTIFICATION_DISMISS_SECONDS;
  }

  return Math.min(
    MAX_NOTIFICATION_DISMISS_SECONDS,
    Math.max(MIN_NOTIFICATION_DISMISS_SECONDS, Math.round(value)),
  );
}

function getConfiguredDismissSeconds(): number {
  return parseNotificationDismissSeconds(getConfigValue(NOTIFICATION_DISMISS_SECONDS_CONFIG_KEY));
}

function isNotificationLevel(value: unknown): value is NotificationLevel {
  return value === 'error' || value === 'info' || value === 'warning';
}

function normalizePublishInput(input: unknown): NotificationPublishInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Expected notification input object');
  }

  const candidate = input as Record<string, unknown>;
  if (!isNotificationLevel(candidate.level)) {
    throw new Error('Expected notification level to be info, warning, or error');
  }

  if (typeof candidate.title !== 'string' || candidate.title.trim().length === 0) {
    throw new Error('Expected notification title');
  }

  return {
    body: typeof candidate.body === 'string' ? candidate.body : '',
    level: candidate.level,
    title: candidate.title.trim(),
  };
}

function broadcastHistoryChanged(): void {
  const payload = getNotificationHistory();

  BrowserWindow.getAllWindows().forEach((window) => {
    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      return;
    }

    window.webContents.send(StreamChannels.NOTIFICATIONS_HISTORY_CHANGED, payload);
  });
}

function getNotificationIcon(level: NotificationLevel): Electron.NativeImage {
  const color = level === 'error' ? '#ef4444' : level === 'warning' ? '#f59e0b' : '#38bdf8';
  const mark = level === 'error' ? '!' : level === 'warning' ? '!' : 'i';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill="#121314"/>
      <circle cx="32" cy="32" r="19" fill="${color}"/>
      <text x="32" y="42" fill="#ffffff" font-family="Arial, sans-serif" font-size="28" font-weight="700" text-anchor="middle">${mark}</text>
    </svg>
  `.trim();

  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

function focusMainWindow(): void {
  const window = getMainWindowForNotifications?.();
  if (!window || window.isDestroyed()) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  if (!window.isVisible()) {
    window.show();
  }

  window.focus();
}

function scheduleNotificationClose(record: NotificationRecord): void {
  const timeoutMs = Math.max(0, record.expiresAt - Date.now());
  const timer = setTimeout(() => {
    closeTimers.delete(record.id);
    const notification = activeNotifications.get(record.id);
    if (!notification) {
      return;
    }

    notification.close();
    activeNotifications.delete(record.id);
  }, timeoutMs);

  closeTimers.set(record.id, timer);
}

function showNativeNotification(record: NotificationRecord): void {
  if (process.env['PRISTINE_E2E'] === '1' || !Notification.isSupported()) {
    return;
  }

  try {
    const notification = new Notification({
      body: record.body,
      icon: getNotificationIcon(record.level),
      silent: false,
      title: record.title,
    });

    activeNotifications.set(record.id, notification);
    notification.once('click', focusMainWindow);
    notification.once('close', () => {
      activeNotifications.delete(record.id);
      const timer = closeTimers.get(record.id);
      if (timer) {
        clearTimeout(timer);
        closeTimers.delete(record.id);
      }
    });
    notification.show();
    scheduleNotificationClose(record);
  } catch {
    activeNotifications.delete(record.id);
  }
}

export function publishNotification(input: unknown): NotificationRecord {
  const normalized = normalizePublishInput(input);
  const now = Date.now();
  const dismissSeconds = getConfiguredDismissSeconds();
  const record: NotificationRecord = {
    body: normalized.body ?? '',
    createdAt: now,
    expiresAt: now + dismissSeconds * 1000,
    id: `notification-${now}-${nextNotificationId++}`,
    level: normalized.level,
    title: normalized.title,
  };

  history = [record, ...history];
  showNativeNotification(record);
  broadcastHistoryChanged();
  return record;
}

export function dismissNotification(id: unknown): void {
  if (typeof id !== 'string') {
    throw new Error('Expected notification id');
  }

  history = history.filter((record) => record.id !== id);

  const timer = closeTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    closeTimers.delete(id);
  }

  const notification = activeNotifications.get(id);
  if (notification) {
    notification.close();
    activeNotifications.delete(id);
  }

  broadcastHistoryChanged();
}

export function getNotificationHistory(): NotificationRecord[] {
  return history.map((record) => ({ ...record }));
}

export function resetNotificationServiceForTests(): void {
  history = [];
  activeNotifications.forEach((notification) => notification.close());
  activeNotifications.clear();
  closeTimers.forEach((timer) => clearTimeout(timer));
  closeTimers.clear();
  nextNotificationId = 1;
}

export function registerNotificationHandlers(getMainWindow: () => BrowserWindow | null): void {
  getMainWindowForNotifications = getMainWindow;

  if (process.platform === 'win32') {
    app.setAppUserModelId('com.pristine.ide');
  }

  ipcMain.handle(AsyncChannels.NOTIFICATIONS_PUBLISH, async (_event, input: unknown) => publishNotification(input));
  ipcMain.handle(AsyncChannels.NOTIFICATIONS_DISMISS, async (_event, id: unknown) => {
    dismissNotification(id);
  });
  ipcMain.handle(AsyncChannels.NOTIFICATIONS_GET_HISTORY, async () => getNotificationHistory());
}
