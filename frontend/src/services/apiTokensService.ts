import { axiosClient } from '@/api/axiosClient';

export interface ApiTokenSummary {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface ApiTokenCreated extends ApiTokenSummary {
  // Present only in the create response — never returned again by list().
  token: string;
}

export const apiTokensService = {
  async list(): Promise<ApiTokenSummary[]> {
    const { data } = await axiosClient.get<ApiTokenSummary[]>('/api-tokens');
    return data;
  },

  async create(name: string, expiresInDays?: number): Promise<ApiTokenCreated> {
    const { data } = await axiosClient.post<ApiTokenCreated>('/api-tokens', { name, expiresInDays });
    return data;
  },

  async revoke(id: string): Promise<void> {
    await axiosClient.delete(`/api-tokens/${id}`);
  },
};
