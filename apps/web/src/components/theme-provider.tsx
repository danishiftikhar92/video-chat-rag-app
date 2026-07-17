import { useEffect } from 'react';
import { useUiStore } from '@/stores/ui-store';

function applyTheme(isDark: boolean) {
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const resolve = () => {
      if (theme === 'system') {
        applyTheme(media.matches);
      } else {
        applyTheme(theme === 'dark');
      }
    };

    resolve();

    if (theme === 'system') {
      media.addEventListener('change', resolve);
      return () => media.removeEventListener('change', resolve);
    }

    return undefined;
  }, [theme]);

  return <>{children}</>;
}
