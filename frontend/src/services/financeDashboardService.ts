import { axiosClient } from '@/api/axiosClient';
import type { FinanceDocument, FinanceFilters } from './financeDocumentsService';
import { toFinanceFilterParams } from './financeDocumentsService';

export interface AmountSummary {
  count: number;
  value: number;
}

export interface MonthlyExpensePoint {
  period: string;
  amount: number;
}

export interface BreakdownEntry {
  key: string;
  count: number;
  value: number;
}

export interface Breakdown {
  totalCount: number;
  taggedCount: number;
  coveragePct: number;
  breakdown: BreakdownEntry[];
}

export interface SubscriptionCosts {
  totalCount: number;
  totalAmount: number;
  microsoftCount: number;
  microsoftAmount: number;
  breakdown: BreakdownEntry[];
}

export interface FinanceSummaryResult {
  prioritizedPayments: { vendorName: string; documentId: string; amount?: number; rationale: string }[];
  flaggedAnomalies: { documentId?: string; vendorName: string; anomalyType: string; note: string }[];
  aiSummary: string;
  generatedAt: string;
}

export interface FinanceDashboardOverview {
  period: string;
  filtersApplied: FinanceFilters;
  summary: {
    totalVendorPayments: AmountSummary;
    totalExpenses: AmountSummary;
    paymentsMade: AmountSummary;
    pendingPayments: AmountSummary;
    upcomingDuePayments: AmountSummary;
  };
  monthlyExpenseTrend: MonthlyExpensePoint[];
  vendorSpending: Breakdown;
  categorySpending: Breakdown;
  microsoftSubscriptionCosts: SubscriptionCosts;
  deliveryShippingCosts: AmountSummary;
  taxBreakdown: Breakdown;
  paymentMethodBreakdown: Breakdown;
  recentDocuments: FinanceDocument[];
  reviewQueueCount: number;
  aiInsight: string;
  // Genuine on-demand LLM summary (Phase 12) — distinct from the always-on
  // rule-based aiInsight string above; null until "Generate AI Summary" has
  // been triggered at least once today. Named distinctly from `summary`
  // above (the aggregate stats block) to avoid colliding with it.
  aiGeneratedSummary: FinanceSummaryResult | null;
}

export interface FinancePreset {
  _id: string;
  name: string;
  filters: FinanceFilters;
  hiddenWidgets: string[];
}

export interface UpsertFinancePresetPayload {
  name: string;
  filters: FinanceFilters;
  hiddenWidgets: string[];
}

export const financeDashboardService = {
  async getOverview(filters: FinanceFilters, months?: number): Promise<FinanceDashboardOverview> {
    const { data } = await axiosClient.get<FinanceDashboardOverview>('/finance/dashboard/overview', {
      params: toFinanceFilterParams(filters, { months }),
    });
    return data;
  },

  async generateSummary(regenerate = false): Promise<{ summary: FinanceSummaryResult; cached: boolean }> {
    const { data } = await axiosClient.post<{ summary: FinanceSummaryResult; cached: boolean }>(
      '/finance/dashboard/generate-summary',
      { regenerate },
    );
    return data;
  },

  async listPresets(): Promise<FinancePreset[]> {
    const { data } = await axiosClient.get<FinancePreset[]>('/finance/presets');
    return data;
  },

  async createPreset(payload: UpsertFinancePresetPayload): Promise<FinancePreset> {
    const { data } = await axiosClient.post<FinancePreset>('/finance/presets', payload);
    return data;
  },

  async updatePreset(id: string, payload: UpsertFinancePresetPayload): Promise<FinancePreset> {
    const { data } = await axiosClient.patch<FinancePreset>(`/finance/presets/${id}`, payload);
    return data;
  },

  async deletePreset(id: string): Promise<void> {
    await axiosClient.delete(`/finance/presets/${id}`);
  },
};
