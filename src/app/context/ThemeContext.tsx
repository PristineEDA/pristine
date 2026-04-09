import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'pristine-theme';
const THEME_CONFIG_KEY = 'ui.theme';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

function getConfiguredTheme(): Theme | null {
  try {
    const configured = window.electronAPI?.config.get(THEME_CONFIG_KEY);
    if (isTheme(configured)) {
      return configured;
    }
  } catch {
    /* ignore */
  }

  return null;
}

function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) {
      return stored;
    }
  } catch {
    /* ignore */
  }

  return null;
}

function getInitialTheme(): Theme {
  return getConfiguredTheme() ?? getStoredTheme() ?? 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const applyTheme = useCallback((t: Theme) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, []);

  const persistTheme = useCallback((t: Theme) => {
    try {
      void window.electronAPI?.config.set(THEME_CONFIG_KEY, t);
    } catch {
      /* ignore */
    }

    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    persistTheme(t);
  }, [persistTheme]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [setTheme, theme]);

  useEffect(() => {
    applyTheme(theme);
  }, [applyTheme, theme]);

  useEffect(() => {
    if (!getConfiguredTheme()) {
      persistTheme(theme);
    }
  }, [persistTheme, theme]);

  return (
    <ThemeContext value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
