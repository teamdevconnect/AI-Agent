import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '@/types';

interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  commandPaletteOpen: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      rightPanelOpen: true,
      commandPaletteOpen: false,

      setTheme(theme) {
        set({ theme });
      },
      toggleTheme() {
        set({ theme: get().theme === 'dark' ? 'light' : 'dark' });
      },
      toggleSidebar() {
        set({ sidebarCollapsed: !get().sidebarCollapsed });
      },
      toggleRightPanel() {
        set({ rightPanelOpen: !get().rightPanelOpen });
      },
      setRightPanelOpen(open) {
        set({ rightPanelOpen: open });
      },
      setCommandPaletteOpen(open) {
        set({ commandPaletteOpen: open });
      },
    }),
    {
      name: 'enterprise-ai:ui',
      partialize: (state) => ({ theme: state.theme, sidebarCollapsed: state.sidebarCollapsed, rightPanelOpen: state.rightPanelOpen }),
    },
  ),
);
