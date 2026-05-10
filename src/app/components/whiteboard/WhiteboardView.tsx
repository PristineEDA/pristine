import '@toeverything/theme/style.css';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '../ui/button';
import { mountBlockSuiteWhiteboard } from '../../whiteboard/blocksuiteAdapter';
import { createWhiteboardStore } from '../../whiteboard/createWhiteboardStore';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

const whiteboardThemeStyle = {
  colorScheme: 'light',
  backgroundColor: 'var(--affine-background-primary-color, #ffffff)',
  color: 'var(--affine-text-primary-color, #121212)',
} as CSSProperties;

function getWhiteboardShadowRoot(host: HTMLDivElement) {
  return host.shadowRoot ?? host.attachShadow({ mode: 'open' });
}

export function WhiteboardView() {
  const hostRef = useRef<HTMLDivElement | null>(null);
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
      const mountRoot = getWhiteboardShadowRoot(host);
      mountRoot.replaceChildren();

      const whiteboardStore = createWhiteboardStore();
      const mountedWhiteboard = mountBlockSuiteWhiteboard({
        host: mountRoot,
        store: whiteboardStore.store,
        workspace: whiteboardStore.workspace,
      });

      cleanup = () => {
        mountedWhiteboard.dispose();
        whiteboardStore.dispose();
      };

      if (!disposed) {
        setIsReady(true);
      }
    } catch (error) {
      host.shadowRoot?.replaceChildren();
      cleanup?.();

      if (!disposed) {
        setErrorMessage(getErrorMessage(error));
      }
    }

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [mountVersion]);

  return (
    <section
      data-testid="whiteboard-view"
      data-theme="light"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground"
      style={whiteboardThemeStyle}
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
