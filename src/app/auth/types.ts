export type AuthView = 'login' | 'signup';

export interface DesktopAuthSession {
  avatarUrl: string | null;
  email: string;
  sessionExpiresAt: number | null;
  syncedAt: string | null;
  userId: string;
  username: string;
}