import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '@/services/authService';
import { extractErrorMessage } from '@/utils/errors';
import type { AuthSession, LoginPayload, RegisterPayload, User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

function applySession(session: AuthSession) {
  return { user: session.user, accessToken: session.accessToken, isAuthenticated: true, error: null };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      async login(payload) {
        set({ isLoading: true, error: null });
        try {
          const session = await authService.login(payload);
          set({ ...applySession(session), isLoading: false });
        } catch (error) {
          set({ isLoading: false, error: extractErrorMessage(error) });
          throw error;
        }
      },

      async register(payload) {
        set({ isLoading: true, error: null });
        try {
          const session = await authService.register(payload);
          set({ ...applySession(session), isLoading: false });
        } catch (error) {
          set({ isLoading: false, error: extractErrorMessage(error) });
          throw error;
        }
      },

      async logout() {
        await authService.logout();
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      clearError() {
        set({ error: null });
      },
    }),
    {
      name: 'enterprise-ai:auth',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
