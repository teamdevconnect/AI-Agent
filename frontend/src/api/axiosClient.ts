import axios from 'axios';
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
