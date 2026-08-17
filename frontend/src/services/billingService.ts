import { axiosClient } from '@/api/axiosClient';

// "Auto Recharge" is the customer-facing name (matches OpenAI's API billing
// terminology) — kept as AutoPay* internally, this is purely a copy choice.
export interface AutoPaySettings {
  enabled: boolean;
  thresholdCredits: number;
  rechargeAmountCredits: number;
  paymentMethodId?: string;
  dailyCapCredits?: number;
  monthlyCapCredits?: number;
  lastTriggeredAt?: string;
  consecutiveFailures: number;
}

export interface WalletSummary {
  balanceCredits: number;
  reservedCredits: number;
  availableCredits: number;
  lowBalanceThresholdCredits: number;
  lowBalance: boolean;
  autoPay: AutoPaySettings;
}

export interface CreditPackage {
  _id: string;
  key: string;
  name: string;
  credits: number;
  bonusCredits: number;
  price: number;
  currency: string;
  active: boolean;
  sortOrder: number;
}

export type WalletTransactionType =
  | 'PURCHASE'
  | 'AI_USAGE'
  | 'AUTO_RECHARGE'
  | 'BONUS'
  | 'PROMOTION'
  | 'REFUND'
  | 'MANUAL_ADJUSTMENT';

// Deliberately narrower than the backend's internal ledger row — no
// provider/model/cost fields exist here at all, matching what
// billing.service.ts's listCustomerTransactions actually returns.
// inputTokens/outputTokens ARE shown (Haive Input/Output Tokens per the
// spec) — only provider/model identity and provider cost are withheld.
export interface CustomerTransaction {
  id: string;
  type: WalletTransactionType;
  amountCredits: number;
  balanceAfterCredits: number;
  createdAt: string;
  description: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface UsageSummary {
  availableCredits: number;
  creditsUsedTotal: number;
  totalPurchasedCredits: number;
  aiRequestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  usageTodayCredits: number;
  usageThisMonthCredits: number;
}

export type PaymentProviderKey = 'razorpay' | 'stripe' | 'cashfree';

export interface PaymentMethod {
  _id: string;
  provider: PaymentProviderKey;
  cardLast4: string;
  cardNetwork: string;
  isDefault: boolean;
  createdAt: string;
}

export interface InitiatePurchaseResult {
  paymentRecordId: string;
  orderId: string;
  checkoutParams: Record<string, unknown>;
  simulated: boolean;
  creditedImmediately: boolean;
  wallet?: WalletSummary;
}

export interface AutoPaySettingsUpdate {
  enabled: boolean;
  thresholdCredits?: number;
  rechargeAmountCredits?: number;
  paymentMethodId?: string;
  monthlyCapCredits?: number;
}

export const billingService = {
  async getWallet(): Promise<WalletSummary> {
    const { data } = await axiosClient.get<WalletSummary>('/billing/wallet');
    return data;
  },

  async listPackages(): Promise<CreditPackage[]> {
    const { data } = await axiosClient.get<CreditPackage[]>('/billing/packages');
    return data;
  },

  async getUsageSummary(): Promise<UsageSummary> {
    const { data } = await axiosClient.get<UsageSummary>('/billing/usage/summary');
    return data;
  },

  async listTransactions(limit?: number): Promise<CustomerTransaction[]> {
    const { data } = await axiosClient.get<CustomerTransaction[]>('/billing/transactions', { params: { limit } });
    return data;
  },

  async listPaymentMethods(): Promise<PaymentMethod[]> {
    const { data } = await axiosClient.get<PaymentMethod[]>('/billing/payment-methods');
    return data;
  },

  async savePaymentMethod(payload: {
    gatewayCustomerId: string;
    gatewayPaymentId?: string;
    signature?: string;
    gatewayOrderId?: string;
  }): Promise<PaymentMethod> {
    const { data } = await axiosClient.post<PaymentMethod>('/billing/payment-methods', payload);
    return data;
  },

  async deletePaymentMethod(id: string): Promise<void> {
    await axiosClient.delete(`/billing/payment-methods/${id}`);
  },

  async purchasePackage(packageKey: string): Promise<InitiatePurchaseResult> {
    const { data } = await axiosClient.post<InitiatePurchaseResult>('/billing/credits/purchase', { packageKey });
    return data;
  },

  // Called right after a real (non-simulated) checkout's success handler
  // fires, closing the loop without a publicly reachable webhook URL — see
  // backend/src/billing/billing.service.ts's confirmPurchase.
  async confirmPurchase(payload: {
    paymentRecordId: string;
    gatewayPaymentId: string;
    signature?: string;
  }): Promise<{ confirmed: boolean; wallet: WalletSummary }> {
    const { data } = await axiosClient.post<{ confirmed: boolean; wallet: WalletSummary }>('/billing/credits/confirm-purchase', payload);
    return data;
  },

  async getAutoPay(): Promise<AutoPaySettings> {
    const { data } = await axiosClient.get<AutoPaySettings>('/billing/autopay');
    return data;
  },

  async updateAutoPay(payload: AutoPaySettingsUpdate): Promise<AutoPaySettings> {
    const { data } = await axiosClient.put<AutoPaySettings>('/billing/autopay', payload);
    return data;
  },
};
