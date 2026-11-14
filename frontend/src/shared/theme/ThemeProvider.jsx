import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const THEME_STORAGE_KEY = 'travelproject-theme';
const ThemeContext = createContext(null);

function getSavedPreference() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => getSavedPreference() || 'light');

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === 'dark' ? '#17221d' : '#f7f8f6';
  }, [theme]);

  useEffect(() => {
    const handleStorage = event => {
      if (event.key !== THEME_STORAGE_KEY) return;
      setThemeState(event.newValue === 'dark' ? 'dark' : 'light');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setTheme = useCallback(nextTheme => {
    if (nextTheme !== 'light' && nextTheme !== 'dark') return;
    setThemeState(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The current tab still changes theme if storage is unavailable.
    }
  }, []);

  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [setTheme, theme]);
  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [setTheme, theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}
