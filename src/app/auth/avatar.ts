import type { DesktopAuthSession } from './types';

const DEFAULT_SUPABASE_URL = 'https://fsuyziugqxslwkaxcakv.supabase.co';
const AVATAR_BUCKET = 'avatars';
const avatarFileExtensions = ['jpg', 'png', 'webp'] as const;

function getSupabaseUrl(configuredUrl?: string | null): string {
  const nextUrl = configuredUrl?.trim();
  return (nextUrl && nextUrl.length > 0 ? nextUrl : DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
}

export function buildDesktopAvatarUrl(
  userId: string,
  extension: (typeof avatarFileExtensions)[number],
  configuredSupabaseUrl?: string | null,
): string {
  const encodedUserId = encodeURIComponent(userId);
  return `${getSupabaseUrl(configuredSupabaseUrl)}/storage/v1/object/public/${AVATAR_BUCKET}/${encodedUserId}/profile.${extension}`;
}

export function getDesktopAvatarCandidates(
  session: DesktopAuthSession | null,
  configuredSupabaseUrl?: string | null,
): string[] {
  if (!session) {
    return [];
  }

  const candidates: string[] = [];

  const addCandidate = (candidate: string | null | undefined) => {
    const normalizedCandidate = candidate?.trim();

    if (!normalizedCandidate || candidates.includes(normalizedCandidate)) {
      return;
    }

    candidates.push(normalizedCandidate);
  };

  addCandidate(session.avatarUrl);

  for (const extension of avatarFileExtensions) {
    addCandidate(buildDesktopAvatarUrl(session.userId, extension, configuredSupabaseUrl));
  }

  return candidates;
}