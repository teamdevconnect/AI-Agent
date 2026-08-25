import { axiosClient } from '@/api/axiosClient';

export interface Session {
  jti: string;
  device: string;
  location?: string;
  ip?: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export const sessionsService = {
  async list(): Promise<Session[]> {
    const { data } = await axiosClient.get<Session[]>('/sessions');
    return data;
  },

  async revoke(jti: string): Promise<void> {
    await axiosClient.post(`/sessions/${jti}/revoke`);
  },

  async revokeAllOthers(): Promise<{ revokedCount: number }> {
    const { data } = await axiosClient.post<{ revokedCount: number }>('/sessions/revoke-all-others');
    return data;
  },
};
