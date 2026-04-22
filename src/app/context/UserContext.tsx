import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthView, DesktopAuthSession } from '../auth/types';

interface UserContextValue {
  session: DesktopAuthSession | null;
  status: 'loading' | 'signed-in' | 'signed-out';
  errorMessage: string | null;
  isSyncing: boolean;
  clearError: () => void;
  openAccountPage: (view: AuthView) => Promise<boolean>;
  signOut: () => Promise<boolean>;
  syncCloudConfig: () => Promise<boolean>;
}

const UserContext = createContext<UserContextValue | null>(null);

function areDesktopSessionsEqual(
  left: DesktopAuthSession | null,
  right: DesktopAuthSession | null,
): boolean {
  if (!left || !right) {
    return left === right;
  }

  return left.avatarUrl === right.avatarUrl
    && left.email === right.email
    && left.syncedAt === right.syncedAt
    && left.userId === right.userId
    && left.username === right.username;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DesktopAuthSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'signed-in' | 'signed-out'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const applySessionUpdate = useEffectEvent((nextSession: DesktopAuthSession | null) => {
    startTransition(() => {
      setSession((currentSession) => (
        areDesktopSessionsEqual(currentSession, nextSession) ? currentSession : nextSession
      ));

      const nextStatus = nextSession ? 'signed-in' : 'signed-out';
      setStatus((currentStatus) => (currentStatus === nextStatus ? currentStatus : nextStatus));

      if (nextSession) {
        setErrorMessage((currentMessage) => (currentMessage === null ? currentMessage : null));
      }
    });
  });

  const applyErrorUpdate = useEffectEvent((message: string) => {
    startTransition(() => {
      setErrorMessage((currentMessage) => (currentMessage === message ? currentMessage : message));
    });
  });

  useEffect(() => {
    let active = true;

    void window.electronAPI?.auth.getSession()
      .then((nextSession) => {
        if (!active) {
          return;
        }

        applySessionUpdate(nextSession ?? null);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        startTransition(() => {
          setStatus('signed-out');
          setErrorMessage('Unable to load the local desktop session.');
        });
      });

    const disposeStateListener = window.electronAPI?.auth.onStateChanged((nextSession) => {
      applySessionUpdate(nextSession);
    });
    const disposeErrorListener = window.electronAPI?.auth.onError((message) => {
      applyErrorUpdate(message);
    });

    return () => {
      active = false;
      disposeStateListener?.();
      disposeErrorListener?.();
    };
  }, []);

  const value = useMemo<UserContextValue>(() => ({
    session,
    status,
    errorMessage,
    isSyncing,
    clearError: () => {
      setErrorMessage(null);
    },
    openAccountPage: async (view: AuthView) => {
      setErrorMessage(null);

      const opened = await window.electronAPI?.auth.openAccountPage(view) ?? false;

      if (!opened) {
        setErrorMessage('Unable to open the system browser for sign-in.');
        return false;
      }

      return true;
    },
    signOut: async () => {
      const signedOut = await window.electronAPI?.auth.signOut() ?? false;

      if (!signedOut) {
        setErrorMessage('Unable to sign out of the desktop session.');
        return false;
      }

      applySessionUpdate(null);
      return true;
    },
    syncCloudConfig: async () => {
      setErrorMessage(null);
      setIsSyncing(true);

      try {
        const synced = await window.electronAPI?.auth.syncCloudConfig() ?? false;

        if (!synced) {
          setErrorMessage('Unable to sync the cloud settings right now.');
          return false;
        }

        return true;
      } finally {
        setIsSyncing(false);
      }
    },
  }), [applySessionUpdate, errorMessage, isSyncing, session, status]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }

  return context;
}