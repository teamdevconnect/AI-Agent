import { axiosClient } from '@/api/axiosClient';

export interface CredentialStatus {
  connected: boolean;
  maskedKey?: string;
  baseUrl?: string;
}

export interface OutlookAccount {
  email: string;
  isActive: boolean;
  connectedAt: string;
}

export const integrationsService = {
  // Generic API-key-backed integrations (Anthropic, CRM) — backed by the
  // NestJS /integrations module, which stores the credential in Mongo for
  // python-agent to read at call time (see backend/src/integrations).
  async connectWithApiKey(provider: string, apiKey: string, baseUrl?: string): Promise<CredentialStatus> {
    const { data } = await axiosClient.post<CredentialStatus>(`/integrations/${provider}/connect`, {
      apiKey,
      baseUrl,
    });
    return data;
  },

  async getCredentialStatus(provider: string): Promise<CredentialStatus> {
    const { data } = await axiosClient.get<CredentialStatus>(`/integrations/${provider}/status`);
    return data;
  },

  async disconnectCredential(provider: string): Promise<void> {
    await axiosClient.delete(`/integrations/${provider}`);
  },

  // Outlook has its own dedicated OAuth module on the backend (real
  // Microsoft Graph delegated auth-code flow, already configured).
  async getOutlookConnectUrl(): Promise<string> {
    const { data } = await axiosClient.get<{ url: string }>('/outlook/connect-url');
    return data.url;
  },

  async getOutlookAccounts(): Promise<OutlookAccount[]> {
    const { data } = await axiosClient.get<OutlookAccount[]>('/outlook/accounts');
    return data;
  },

  async setActiveOutlookAccount(email: string): Promise<void> {
    await axiosClient.post(`/outlook/accounts/${encodeURIComponent(email)}/activate`);
  },

  async disconnectOutlookAccount(email: string): Promise<void> {
    await axiosClient.delete(`/outlook/accounts/${encodeURIComponent(email)}`);
  },
};
