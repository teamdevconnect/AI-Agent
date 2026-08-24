import { axiosClient } from '@/api/axiosClient';

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt?: string;
  backupCodesRemaining: number;
}

export interface TwoFactorSetup {
  secret: string;
  qrCodeDataUrl: string;
}

export const twoFactorService = {
  async getStatus(): Promise<TwoFactorStatus> {
    const { data } = await axiosClient.get<TwoFactorStatus>('/auth/2fa/status');
    return data;
  },

  async setup(): Promise<TwoFactorSetup> {
    const { data } = await axiosClient.post<TwoFactorSetup>('/auth/2fa/setup');
    return data;
  },

  async enable(code: string): Promise<{ backupCodes: string[] }> {
    const { data } = await axiosClient.post<{ backupCodes: string[] }>('/auth/2fa/enable', { code });
    return data;
  },

  async disable(reauth: { password?: string; code?: string }): Promise<void> {
    await axiosClient.post('/auth/2fa/disable', reauth);
  },

  async regenerateBackupCodes(reauth: { password?: string; code?: string }): Promise<{ backupCodes: string[] }> {
    const { data } = await axiosClient.post<{ backupCodes: string[] }>(
      '/auth/2fa/backup-codes/regenerate',
      reauth,
    );
    return data;
  },

  // Public/unguarded on the backend — no session exists yet at this point in
  // the login flow, only the short-lived challengeToken from the initial
  // login/OAuth-callback response (see authStore.verifyTwoFactor).
  async verifyLoginChallenge(challengeToken: string, code: string): Promise<{ accessToken: string }> {
    const { data } = await axiosClient.post<{ accessToken: string }>('/auth/2fa/login-verify', {
      challengeToken,
      code,
    });
    return data;
  },
};
