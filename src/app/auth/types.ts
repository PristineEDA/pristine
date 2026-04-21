export type AuthView = 'login' | 'signup';

export interface DesktopAuthSession {
  avatarUrl: string | null;
  email: string;
  syncedAt: string | null;
  userId: string;
  username: string;
}