import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useUiStore } from '@/stores/uiStore';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return children;
}
