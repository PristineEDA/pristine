import { useEffect, useState, type CSSProperties } from 'react';
import { CircleUser, LogIn, LogOut, RefreshCw, UserPlus } from 'lucide-react';
import { getDesktopAvatarCandidates } from '../../../auth/avatar';
import type { DesktopAuthSession } from '../../../auth/types';
import { useUser } from '../../../context/UserContext';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';

const userPopoverActionsClassName = 'grid grid-cols-2 gap-1.5';
const userPopoverActionButtonClassName = 'h-8 w-full justify-center gap-1 whitespace-nowrap px-2.5 text-[11px] hover:cursor-pointer [&_svg]:size-3.5 disabled:cursor-not-allowed';

function getUserInitials(username: string): string {
  const initials = username
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('');

  return initials || 'PR';
}

function formatSyncTimestamp(value: string | null): string {
  if (!value) {
    return 'Not synced yet';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not synced yet';
  }

  return `Synced ${date.toLocaleString()}`;
}

function getAvatarStateKey(session: DesktopAuthSession | null): string {
  if (!session) {
    return 'signed-out';
  }

  return `${session.userId}:${session.avatarUrl ?? 'fallback'}`;
}

function SessionAvatarImage({
  alt,
  session,
}: {
  alt: string;
  session: DesktopAuthSession | null;
}) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const candidateUrls = getDesktopAvatarCandidates(
    session,
    import.meta.env.VITE_PRISTINE_SUPABASE_URL,
  );
  const currentCandidateUrl = candidateUrls[candidateIndex] ?? null;

  useEffect(() => {
    setCandidateIndex(0);
  }, [session?.avatarUrl, session?.userId]);

  if (!currentCandidateUrl) {
    return null;
  }

  return (
    <AvatarImage
      key={currentCandidateUrl}
      alt={alt}
      src={currentCandidateUrl}
      onLoadingStatusChange={(status) => {
        if (status !== 'error') {
          return;
        }

        setCandidateIndex((currentIndex) => (
          currentIndex + 1 < candidateUrls.length ? currentIndex + 1 : currentIndex
        ));
      }}
    />
  );
}

export function UserAccountPopover({
  interactiveStyle,
}: {
  interactiveStyle?: CSSProperties;
}) {
  const {
    clearError,
    errorMessage,
    isSyncing,
    openAccountPage,
    session,
    signOut,
    status,
    syncCloudConfig,
  } = useUser();
  const userAvatarFallback = getUserInitials(session?.username ?? 'Pristine User');
  const userAvatarStateKey = getAvatarStateKey(session);
  const userSyncLabel = formatSyncTimestamp(session?.syncedAt ?? null);
  const isSignedIn = status === 'signed-in' && session !== null;
  const isUserActionsDisabled = status === 'loading';

  return (
    <Popover onOpenChange={(open) => {
      if (open) {
        clearError();
      }
    }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-full" style={interactiveStyle}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="User profile"
                data-testid="user-avatar-button"
                className="relative h-full w-8 rounded-none px-0 hover:cursor-pointer"
              >
                <Avatar key={userAvatarStateKey} className="size-6 border border-border/70 bg-muted/70">
                  {isSignedIn ? <SessionAvatarImage alt={session.username} session={session} /> : null}
                  <AvatarFallback className="bg-transparent text-[10px] font-semibold text-foreground">
                    {isSignedIn ? userAvatarFallback : <CircleUser size={14} className="text-muted-foreground" />}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={[
                    'absolute bottom-1.5 right-1 rounded-full border border-background',
                    status === 'loading' ? 'h-1.5 w-1.5 bg-muted-foreground/80' : '',
                    isSignedIn ? 'h-2 w-2 bg-emerald-500' : '',
                    status === 'signed-out' ? 'h-2 w-2 bg-amber-400' : '',
                  ].join(' ')}
                />
              </Button>
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          User profile
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        className="w-72 p-0"
        data-testid="user-account-popover"
        style={interactiveStyle}
      >
        <div className="space-y-3 px-4 py-3">
          {isSignedIn && session ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar key={userAvatarStateKey} className="size-11 border border-border/80 bg-muted/70">
                  <SessionAvatarImage alt={session.username} session={session} />
                  <AvatarFallback className="text-sm font-semibold">{userAvatarFallback}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-semibold text-foreground" data-testid="user-account-name">
                    {session.username}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" data-testid="user-account-email">
                    {session.email}
                  </p>
                  <p className="text-[11px] text-muted-foreground" data-testid="user-account-sync-status">
                    {userSyncLabel}
                  </p>
                </div>
              </div>
              <div className={userPopoverActionsClassName}>
                <Button
                  variant="outline"
                  className={userPopoverActionButtonClassName}
                  data-testid="user-sync-config-button"
                  disabled={isSyncing}
                  onClick={() => {
                    void syncCloudConfig();
                  }}
                >
                  <RefreshCw className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'Syncing settings...' : 'Sync settings'}
                </Button>
                <Button
                  variant="outline"
                  className={userPopoverActionButtonClassName}
                  data-testid="user-sign-out-button"
                  onClick={() => {
                    void signOut();
                  }}
                >
                  <LogOut />
                  Sign out
                </Button>
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              <div className="rounded-md border border-dashed border-border/80 bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                {status === 'loading'
                  ? 'Checking the local desktop session...'
                  : 'No account is linked to this desktop session yet.'}
              </div>
              <div className={userPopoverActionsClassName}>
                <Button
                  className={userPopoverActionButtonClassName}
                  data-testid="user-sign-in-button"
                  disabled={isUserActionsDisabled}
                  onClick={() => {
                    void openAccountPage('login');
                  }}
                >
                  <LogIn />
                  Sign in
                </Button>
                <Button
                  variant="outline"
                  className={userPopoverActionButtonClassName}
                  data-testid="user-sign-up-button"
                  disabled={isUserActionsDisabled}
                  onClick={() => {
                    void openAccountPage('signup');
                  }}
                >
                  <UserPlus />
                  Create account
                </Button>
              </div>
            </div>
          )}

          {errorMessage ? (
            <div
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              data-testid="user-account-error"
            >
              {errorMessage}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
