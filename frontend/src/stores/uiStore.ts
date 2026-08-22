import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  commandPaletteOpen: boolean;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      rightPanelOpen: true,
      commandPaletteOpen: false,

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
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed, rightPanelOpen: state.rightPanelOpen }),
    },
  ),
);
