/**
 * Central place reading Vite env vars. Phase 1 runs entirely on mock
 * services (see src/services/mock), but API_URL/SOCKET_URL/USE_MOCKS are
 * already wired so swapping to the real NestJS backend later is a one-line
 * change here, not a rewrite of every call site.
 */
export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  socketUrl: import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000',
  useMocks: (import.meta.env.VITE_USE_MOCKS ?? 'true') !== 'false',
};
