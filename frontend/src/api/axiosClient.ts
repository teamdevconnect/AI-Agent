import axios from 'axios';
import toast from 'react-hot-toast';
import { env } from '@/config/env';
import { useAuthStore } from '@/stores/authStore';

export const axiosClient = axios.create({ baseURL: env.apiUrl });

axiosClient.interceptors.request.use((config) => {
  // Read the live in-memory store rather than a separately-mirrored
  // localStorage key — zustand's `persist` already rehydrates this on load,
  // so this is always correct for any authenticated session without needing
  // a manual sync step anywhere else.
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 on an *authenticated* request always means the token it carried is
// no longer valid (expired, or the account was deactivated/role-changed —
// see jwt.strategy.ts's own re-check on every request) — never a failed
// login attempt, since login/register/etc. never carry a token to begin
// with. Previously nothing cleared the session here, so every call after
// expiry just kept failing with its own error toast forever instead of
// returning the user to /login. Clearing `isAuthenticated` is enough —
// ProtectedRoute already redirects to /login the instant it flips to
// false, no manual navigation needed from here.
axiosClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const wasAuthenticated = useAuthStore.getState().isAuthenticated;
    if (axios.isAxiosError(error) && error.response?.status === 401 && wasAuthenticated) {
      useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
      toast.error('Your session has expired — please sign in again.');
    }
    return Promise.reject(error);
  },
);
