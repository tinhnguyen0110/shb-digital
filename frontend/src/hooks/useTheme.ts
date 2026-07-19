import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'shb-theme';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  let saved: string | null = null;
  try {
    saved = window.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    // Storage có thể bị tắt bởi browser privacy mode hoặc test DOM.
  }
  if (saved === 'light' || saved === 'dark') return saved;
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage?.setItem(STORAGE_KEY, theme);
    } catch {
      // Theme vẫn hoạt động trong phiên hiện tại khi storage không khả dụng.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  return { theme, setTheme, toggleTheme };
}
