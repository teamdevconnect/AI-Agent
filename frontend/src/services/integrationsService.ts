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

export type GmailAccount = OutlookAccount;

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

  // Gmail mirrors Outlook's OAuth shape exactly (real Google OAuth
  // delegated auth-code flow) — see backend/src/gmail.
  async getGmailConnectUrl(): Promise<string> {
    const { data } = await axiosClient.get<{ url: string }>('/gmail/connect-url');
    return data.url;
  },

  async getGmailAccounts(): Promise<GmailAccount[]> {
    const { data } = await axiosClient.get<GmailAccount[]>('/gmail/accounts');
    return data;
  },

  async setActiveGmailAccount(email: string): Promise<void> {
    await axiosClient.post(`/gmail/accounts/${encodeURIComponent(email)}/activate`);
  },

  async disconnectGmailAccount(email: string): Promise<void> {
    await axiosClient.delete(`/gmail/accounts/${encodeURIComponent(email)}`);
  },
};
