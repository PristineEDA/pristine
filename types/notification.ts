export type NotificationLevel = 'error' | 'info' | 'warning';

export interface NotificationPublishInput {
  body?: string;
  level: NotificationLevel;
  title: string;
}

export interface NotificationRecord {
  body: string;
  createdAt: number;
  expiresAt: number;
  id: string;
  level: NotificationLevel;
  title: string;
}
