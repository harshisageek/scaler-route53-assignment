'use client';

import { Mode, applyMode } from '@cloudscape-design/global-styles';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type ColorMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ColorMode;
  toggleMode: () => void;
}

const STORAGE_KEY = 'route53-color-mode';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function systemMode(): ColorMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function initialMode(): ColorMode {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === 'light' || saved === 'dark' ? saved : systemMode();
}

function applyColorMode(mode: ColorMode) {
  applyMode(mode === 'dark' ? Mode.Dark : Mode.Light);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ColorMode>(initialMode);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    applyColorMode(initialMode());

    if (saved === 'light' || saved === 'dark') return;
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const followSystem = (event: MediaQueryListEvent) => {
      const next = event.matches ? 'dark' : 'light';
      setMode(next);
      applyColorMode(next);
    };
    preference.addEventListener('change', followSystem);
    return () => preference.removeEventListener('change', followSystem);
  }, []);

  const toggleMode = () => {
    setMode((current) => {
      const next = current === 'light' ? 'dark' : 'light';
      window.localStorage.setItem(STORAGE_KEY, next);
      applyColorMode(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider.');
  return context;
}
