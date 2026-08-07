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
  // 'needs_reauth' — python-agent's refresh loop found the grant revoked/
  // expired (see outlook_store.py/gmail_store.py's _refresh) and no amount
  // of retrying fixes it; the UI should prompt to reconnect.
  status: 'connected' | 'needs_reauth';
}

export type GmailAccount = OutlookAccount;

export interface OutlookOrgAccount extends OutlookAccount {
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
}

export interface TenantAuthorizationStatus {
  authorized: boolean;
  tenantId?: string;
  authorizedByEmail?: string;
}

// Mirrors backend/src/integrations/auth-methods.ts's AuthType exactly.
// OAuth-based platforms (Salesforce, Slack, HubSpot, ...) aren't included —
// those need their own dedicated consent flow, not a credentials form.
export type AuthType = 'apiKey' | 'apiKeyBaseUrl' | 'bearer' | 'basic' | 'customHeaders';

export interface AuthCredentials {
  apiKey?: string;
  headerName?: string;
  bearerToken?: string;
  username?: string;
  password?: string;
  headers?: Record<string, string>;
}

export interface CustomIntegration {
  provider: string;
  connected: boolean;
  authType?: AuthType;
  maskedKey?: string;
  baseUrl?: string;
  connectedAt?: string;
}

export interface ConnectCustomIntegrationPayload {
  authType: AuthType;
  credentials: AuthCredentials;
  baseUrl?: string;
  healthCheckPath?: string;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
}

// Mirrors backend/src/integrations/provider-rules.ts's ProviderRule.
export interface ProviderRule {
  label: string;
  allowedAuthTypes: AuthType[];
  dedicatedFlowPath?: string;
  note?: string;
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

  // "Smart provider detection" — call as the user types a provider name in
  // the Add Integration wizard, to show only auth methods that provider
  // actually supports (unknown names get every non-OAuth method — the
  // generic Custom REST API case).
  async getProviderRule(provider: string): Promise<ProviderRule> {
    const { data } = await axiosClient.get<ProviderRule>(`/integrations/provider-rules/${provider}`);
    return data;
  },

  // Generic "connect any CRM/SaaS" flow — any auth type from AuthType above,
  // for a provider name the user types in themselves (not one of the fixed
  // Anthropic/CRM/Outlook/Gmail cards). Backed by the same /integrations
  // endpoints as connectWithApiKey above; the backend routes on whether the
  // body sets authType (see IntegrationsService.connectFromDto).
  async listCustomIntegrations(): Promise<CustomIntegration[]> {
    const { data } = await axiosClient.get<CustomIntegration[]>('/integrations');
    return data;
  },

  async connectCustomIntegration(provider: string, payload: ConnectCustomIntegrationPayload): Promise<void> {
    await axiosClient.post(`/integrations/${provider}/connect`, payload);
  },

  // Body omitted (or partial) re-tests whatever's already saved; a full
  // payload tests it before saving, from the connect wizard.
  async testCustomIntegrationConnection(
    provider: string,
    payload?: Partial<ConnectCustomIntegrationPayload>,
  ): Promise<TestConnectionResult> {
    const { data } = await axiosClient.post<TestConnectionResult>(`/integrations/${provider}/test`, payload ?? {});
    return data;
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

  // Org-wide view (every teammate's connected mailbox — sales@, support@,
  // hr@ — not just the caller's own). Read-only for any org member;
  // connect/disconnect stays scoped to each account's own owner above.
  async getOutlookOrgAccounts(): Promise<OutlookOrgAccount[]> {
    const { data } = await axiosClient.get<OutlookOrgAccount[]>('/outlook/org-accounts');
    return data;
  },

  // Tenant-wide admin consent — a separate Microsoft flow from connect-url
  // above; a tenant admin visits the returned URL once so every employee's
  // regular Connect click stops hitting Microsoft's "Need admin approval"
  // wall (see backend/src/outlook/outlook.service.ts's buildAdminConsentUrl).
  async getOutlookAdminConsentUrl(): Promise<string> {
    const { data } = await axiosClient.get<{ url: string }>('/outlook/admin-consent-url');
    return data.url;
  },

  async getOutlookTenantAuthorizationStatus(): Promise<TenantAuthorizationStatus> {
    const { data } = await axiosClient.get<TenantAuthorizationStatus>('/outlook/tenant-authorization-status');
    return data;
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
