import '@toeverything/theme/style.css';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/button';
import {
  mountBlockSuiteWhiteboard,
  type BlockSuiteWhiteboardTheme,
  type MountedBlockSuiteWhiteboard,
} from '../../whiteboard/blocksuiteAdapter';
import { createWhiteboardStore } from '../../whiteboard/createWhiteboardStore';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getWhiteboardThemeStyle(themeKind: BlockSuiteWhiteboardTheme): CSSProperties {
  return {
    colorScheme: themeKind,
    backgroundColor: themeKind === 'dark'
      ? 'var(--affine-background-primary-color, #1e1e1e)'
      : 'var(--affine-background-primary-color, #ffffff)',
    color: themeKind === 'dark'
      ? 'var(--affine-text-primary-color, #f5f5f5)'
      : 'var(--affine-text-primary-color, #121212)',
  };
}

interface WhiteboardViewProps {
  isActive?: boolean;
}

export function WhiteboardView({ isActive = true }: WhiteboardViewProps) {
  const { theme } = useTheme();
  const whiteboardThemeKind: BlockSuiteWhiteboardTheme = theme === 'dark' ? 'dark' : 'light';
  const hostRef = useRef<HTMLDivElement | null>(null);
  const activateWhiteboardRef = useRef<(() => void) | null>(null);
  const mountedWhiteboardRef = useRef<MountedBlockSuiteWhiteboard | null>(null);
  const mountedThemeKindRef = useRef<BlockSuiteWhiteboardTheme | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [mountVersion, setMountVersion] = useState(0);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return undefined;
    }

    let disposed = false;
    let cleanup: (() => void) | undefined;

    setIsReady(false);
    setErrorMessage(null);

    try {
      host.replaceChildren();

      const whiteboardStore = createWhiteboardStore();
      const mountedWhiteboard = mountBlockSuiteWhiteboard({
        host,
        store: whiteboardStore.store,
        themeKind: whiteboardThemeKind,
        workspace: whiteboardStore.workspace,
      });

      cleanup = () => {
        mountedWhiteboard.dispose();
        whiteboardStore.dispose();
      };
      mountedWhiteboardRef.current = mountedWhiteboard;
      mountedThemeKindRef.current = whiteboardThemeKind;
      activateWhiteboardRef.current = mountedWhiteboard.activate;

      if (!disposed) {
        setIsReady(true);
      }
    } catch (error) {
      host.replaceChildren();
      cleanup?.();

      if (!disposed) {
        setErrorMessage(getErrorMessage(error));
      }
    }

    return () => {
      disposed = true;
      activateWhiteboardRef.current = null;
      mountedWhiteboardRef.current = null;
      mountedThemeKindRef.current = null;
      cleanup?.();
    };
  }, [mountVersion]);

  useEffect(() => {
    const mountedWhiteboard = mountedWhiteboardRef.current;

    if (!mountedWhiteboard || mountedThemeKindRef.current === whiteboardThemeKind) {
      return;
    }

    mountedWhiteboard.updateTheme(whiteboardThemeKind);
    mountedThemeKindRef.current = whiteboardThemeKind;
  }, [whiteboardThemeKind]);

  useEffect(() => {
    if (!isActive || !isReady || errorMessage) {
      return undefined;
    }

    let animationFrameId = window.requestAnimationFrame(() => {
      activateWhiteboardRef.current?.();
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [errorMessage, isActive, isReady]);

  return (
    <section
      data-testid="whiteboard-view"
      data-theme={whiteboardThemeKind}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground"
      style={getWhiteboardThemeStyle(whiteboardThemeKind)}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="min-w-0 truncate text-sm font-medium">Whiteboard</div>
        {errorMessage ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Retry whiteboard"
            title="Retry whiteboard"
            onClick={() => setMountVersion((version) => version + 1)}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
        <div ref={hostRef} data-testid="whiteboard-host" className="h-full w-full min-w-0 min-h-0" />

        {!isReady && !errorMessage ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background text-sm text-muted-foreground">
            Loading whiteboard...
          </div>
        ) : null}

        {errorMessage ? (
          <div
            data-testid="whiteboard-error"
            role="alert"
            className="absolute inset-0 flex items-center justify-center bg-background p-4 text-sm text-destructive"
          >
            <div className="flex max-w-xl items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{errorMessage}</span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
