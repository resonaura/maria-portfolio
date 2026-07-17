import { ReactNode, useEffect, useState } from 'react';
import { Theme, ThemeContext } from './context';

const STORAGE_KEY = 'maria-portfolio-theme';

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // HeroUI v3 uses class="dark" for dark mode
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => getStoredTheme() ?? getSystemTheme()
  );
  const [isExplicit, setIsExplicit] = useState<boolean>(
    () => getStoredTheme() !== null
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (isExplicit) return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setTheme(media.matches ? 'dark' : 'light');

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [isExplicit]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
    setIsExplicit(true);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

