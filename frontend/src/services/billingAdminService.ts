import { axiosClient } from '@/api/axiosClient';

// Haive-internal only — every method here hits a @Roles('platform_admin')
// route (backend/src/billing/billing-admin.controller.ts). Never called
// from any customer-facing page; only from features/platform-admin.
export interface AdminOverview {
  days: number;
  revenueUsd: number;
  providerCostUsd: number;
  grossProfitUsd: number;
  realizedMarginPct: number;
  creditsSold: number;
  creditsUsed: number;
  totalAiRequests: number;
}

export interface OrganizationBilling {
  organizationId: string;
  name: string;
  slug: string;
  revenueUsd: number;
  providerCostUsd: number;
  grossProfitUsd: number;
  totalRequests: number;
}

export interface AdminWalletTransaction {
  _id: string;
  organizationId: string;
  type: string;
  amountCredits: number;
  balanceAfterCredits: number;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface AdminPaymentRecord {
  _id: string;
  organizationId: string;
  type: 'purchase' | 'autopay';
  provider: 'razorpay' | 'stripe' | 'cashfree';
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  amount: number;
  currency: string;
  creditsGranted: number;
  status: string;
  simulated: boolean;
  createdAt: string;
}

export const billingAdminService = {
  async getOverview(days?: number): Promise<AdminOverview> {
    const { data } = await axiosClient.get<AdminOverview>('/billing/admin/overview', { params: { days } });
    return data;
  },

  async getOrganizations(days?: number): Promise<OrganizationBilling[]> {
    const { data } = await axiosClient.get<OrganizationBilling[]>('/billing/admin/organizations', { params: { days } });
    return data;
  },

  async listTransactions(params?: { organizationId?: string; type?: string; limit?: number }): Promise<AdminWalletTransaction[]> {
    const { data } = await axiosClient.get<AdminWalletTransaction[]>('/billing/admin/transactions', { params });
    return data;
  },

  async listPayments(params?: { organizationId?: string; status?: string; limit?: number }): Promise<AdminPaymentRecord[]> {
    const { data } = await axiosClient.get<AdminPaymentRecord[]>('/billing/admin/payments', { params });
    return data;
  },
};
