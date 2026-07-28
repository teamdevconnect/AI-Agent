import { axiosClient } from '@/api/axiosClient';
import { randomDelay } from './mock/delay';
import type {
  AuthSession,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  User,
} from '@/types';

/** Password reset has no backend endpoint yet (see forgotPassword/resetPassword below) — this code unlocks that mock flow. */
export const MOCK_OTP = '123456';

interface BackendTokenResponse {
  accessToken: string;
}

interface BackendUserProfile {
  id: string;
  email: string;
  name: string;
  roles: string[];
<<<<<<< HEAD
=======
  assignedAgentId?: string;
>>>>>>> 6a60a8648 (Initial AI Agent source code)
}

function toUser(profile: BackendUserProfile): User {
  const [firstName, ...rest] = profile.name.trim().split(/\s+/);
  return {
    id: profile.id,
    email: profile.email,
    firstName: firstName || profile.email,
    lastName: rest.join(' '),
<<<<<<< HEAD
    role: (profile.roles?.[0] as User['role']) ?? 'member',
=======
    roles: profile.roles ?? [],
    assignedAgentId: profile.assignedAgentId,
>>>>>>> 6a60a8648 (Initial AI Agent source code)
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
    });
    const profile = await fetchProfile(data.accessToken);
    return { user: toUser(profile), accessToken: data.accessToken, refreshToken: '', expiresAt: '' };
  },

  // The backend has no password-reset endpoint yet — kept mock so the UI
  // flow stays demoable without pretending an email actually goes out.
  async forgotPassword(payload: ForgotPasswordPayload): Promise<{ maskedEmail: string }> {
    await randomDelay();
    const [name, domain] = payload.email.split('@');
    const masked = name.length > 2 ? `${name.slice(0, 2)}${'*'.repeat(name.length - 2)}` : `${name[0] ?? ''}*`;
    return { maskedEmail: `${masked}@${domain ?? 'example.com'}` };
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<{ success: true }> {
    await randomDelay();
    if (payload.otp !== MOCK_OTP) {
      throw new Error(`This demo flow isn't wired to the backend yet — use the demo code ${MOCK_OTP}.`);
    }
    return { success: true };
  },

  async fetchCurrentUser(accessToken: string): Promise<User> {
    return toUser(await fetchProfile(accessToken));
  },

  async logout(): Promise<void> {
    // Stateless JWT — nothing to invalidate server-side.
  },
};
