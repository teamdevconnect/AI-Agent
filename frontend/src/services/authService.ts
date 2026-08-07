import { axiosClient } from '@/api/axiosClient';
import type {
  AuthSession,
  ForgotPasswordPayload,
  LoginPayload,
  OAuthProvider,
  RegisterPayload,
  ResetPasswordPayload,
  User,
} from '@/types';

interface BackendTokenResponse {
  accessToken: string;
}

interface BackendUserProfile {
  id: string;
  email: string;
  name: string;
  roles: string[];
  assignedAgentId?: string;
}

function toUser(profile: BackendUserProfile): User {
  const [firstName, ...rest] = profile.name.trim().split(/\s+/);
  return {
    id: profile.id,
    email: profile.email,
    firstName: firstName || profile.email,
    lastName: rest.join(' '),
    roles: profile.roles ?? [],
    assignedAgentId: profile.assignedAgentId,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: 'en-US',
    createdAt: new Date().toISOString(),
  };
}

async function fetchProfile(accessToken: string): Promise<BackendUserProfile> {
  const { data } = await axiosClient.get<BackendUserProfile>('/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export const authService = {
  async login(payload: LoginPayload): Promise<AuthSession> {
    const { data } = await axiosClient.post<BackendTokenResponse>('/auth/login', {
      email: payload.email,
      password: payload.password,
    });
    const profile = await fetchProfile(data.accessToken);
    return { user: toUser(profile), accessToken: data.accessToken, refreshToken: '', expiresAt: '' };
  },

  async register(payload: RegisterPayload): Promise<AuthSession> {
    const { data } = await axiosClient.post<BackendTokenResponse>('/auth/register', {
      email: payload.email,
      password: payload.password,
      name: `${payload.firstName} ${payload.lastName}`.trim(),
      // Registration now always creates a new organization (multi-tenant
      // Phase 1) with this user as its owner — the form already collects
      // "Company", it just wasn't being sent before.
      organizationName: payload.company,
    });
    const profile = await fetchProfile(data.accessToken);
    return { user: toUser(profile), accessToken: data.accessToken, refreshToken: '', expiresAt: '' };
  },

  async forgotPassword(payload: ForgotPasswordPayload): Promise<{ maskedEmail: string }> {
    const { data } = await axiosClient.post<{ maskedEmail: string }>('/auth/forgot-password', {
      email: payload.email,
    });
    return data;
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<{ success: true }> {
    await axiosClient.post('/auth/reset-password', {
      email: payload.email,
      otp: payload.otp,
      password: payload.password,
    });
    return { success: true };
  },

  async fetchCurrentUser(accessToken: string): Promise<User> {
    return toUser(await fetchProfile(accessToken));
  },

  async getOAuthUrl(provider: OAuthProvider): Promise<string> {
    const { data } = await axiosClient.get<{ url: string }>(`/auth/oauth/${provider}/url`);
    return data.url;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    // Authorization header is attached automatically by axiosClient's
    // interceptor (reads the live session from authStore) — unlike
    // fetchProfile/login/register above, which run before a session exists.
    await axiosClient.post('/auth/change-password', { currentPassword, newPassword });
  },

  async logout(): Promise<void> {
    // Stateless JWT — nothing to invalidate server-side.
  },
};
