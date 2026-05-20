import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import { PANEL_TRANSITION_DURATION_MS } from '../../ui/resizable';

type AnimatedPresencePhase = 'hidden' | 'entering' | 'visible' | 'exiting';

export const SPLIT_PANEL_CONTENT_TRANSITION_STYLE = {
  transitionDuration: `${PANEL_TRANSITION_DURATION_MS}ms`,
  transitionProperty: 'opacity',
} satisfies CSSProperties;

export function useAnimatedSplitPanelPresence(isVisible: boolean) {
  const [phase, setPhase] = useState<AnimatedPresencePhase>(() => (isVisible ? 'visible' : 'hidden'));
  const enterTimeoutRef = useRef<number | null>(null);
  const exitTimeoutRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (enterTimeoutRef.current !== null) {
      window.clearTimeout(enterTimeoutRef.current);
      enterTimeoutRef.current = null;
    }

    if (exitTimeoutRef.current !== null) {
      window.clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }

    if (isVisible) {
      setPhase((currentPhase) => {
        if (currentPhase === 'hidden') {
          enterTimeoutRef.current = window.setTimeout(() => {
            setPhase('visible');
            enterTimeoutRef.current = null;
          }, 0);

          return 'entering';
        }

        return 'visible';
      });

      return () => {
        if (enterTimeoutRef.current !== null) {
          window.clearTimeout(enterTimeoutRef.current);
          enterTimeoutRef.current = null;
        }
      };
    }

    setPhase((currentPhase) => {
      if (currentPhase === 'hidden') {
        return currentPhase;
      }

      exitTimeoutRef.current = window.setTimeout(() => {
        setPhase('hidden');
        exitTimeoutRef.current = null;
      }, PANEL_TRANSITION_DURATION_MS);

      return 'exiting';
    });

    return () => {
      if (enterTimeoutRef.current !== null) {
        window.clearTimeout(enterTimeoutRef.current);
        enterTimeoutRef.current = null;
      }

      if (exitTimeoutRef.current !== null) {
        window.clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
    };
  }, [isVisible]);

  return {
    isExpanded: phase === 'visible',
    shouldRender: phase !== 'hidden',
  };
}