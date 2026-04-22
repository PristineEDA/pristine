import { describe, expect, it } from 'vitest';
import { buildDesktopAvatarUrl, getDesktopAvatarCandidates } from './avatar';
import type { DesktopAuthSession } from './types';

function createSession(overrides: Partial<DesktopAuthSession> = {}): DesktopAuthSession {
  return {
    avatarUrl: null,
    email: 'alice@example.com',
    syncedAt: null,
    userId: 'user-1',
    username: 'Alice',
    ...overrides,
  };
}

describe('desktop avatar helpers', () => {
  it('builds a public Supabase avatar URL for a specific file extension', () => {
    expect(buildDesktopAvatarUrl('user-1', 'jpg', 'https://example.supabase.co/')).toBe(
      'https://example.supabase.co/storage/v1/object/public/avatars/user-1/profile.jpg',
    );
  });

  it('returns the session avatar URL first, followed by public storage fallbacks', () => {
    const candidates = getDesktopAvatarCandidates(
      createSession({ avatarUrl: 'https://cdn.example.com/custom-avatar.png' }),
      'https://example.supabase.co',
    );

    expect(candidates).toEqual([
      'https://cdn.example.com/custom-avatar.png',
      'https://example.supabase.co/storage/v1/object/public/avatars/user-1/profile.jpg',
      'https://example.supabase.co/storage/v1/object/public/avatars/user-1/profile.png',
      'https://example.supabase.co/storage/v1/object/public/avatars/user-1/profile.webp',
    ]);
  });

  it('falls back to public storage candidates when the session avatar URL is missing', () => {
    const candidates = getDesktopAvatarCandidates(createSession(), 'https://example.supabase.co');

    expect(candidates).toEqual([
      'https://example.supabase.co/storage/v1/object/public/avatars/user-1/profile.jpg',
      'https://example.supabase.co/storage/v1/object/public/avatars/user-1/profile.png',
      'https://example.supabase.co/storage/v1/object/public/avatars/user-1/profile.webp',
    ]);
  });

  it('de-duplicates the public jpg candidate when it already matches the session avatar URL', () => {
    const session = createSession({
      avatarUrl: 'https://example.supabase.co/storage/v1/object/public/avatars/user-1/profile.jpg',
    });

    expect(getDesktopAvatarCandidates(session, 'https://example.supabase.co')).toEqual([
      'https://example.supabase.co/storage/v1/object/public/avatars/user-1/profile.jpg',
      'https://example.supabase.co/storage/v1/object/public/avatars/user-1/profile.png',
      'https://example.supabase.co/storage/v1/object/public/avatars/user-1/profile.webp',
    ]);
  });
});