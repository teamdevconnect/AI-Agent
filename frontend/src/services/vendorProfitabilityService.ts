import { axiosClient } from '@/api/axiosClient';
import type { BiFilters } from './emailAnalyticsService';

export interface VendorProfitabilityRow {
  dealId: string;
  dealName?: string;
  vendorNames: string[];
  vendorCost: number;
  vendorCostCurrency: string;
  customerRevenue: number;
  customerRevenueCurrency: string;
  customerPaid: number;
  grossProfit: number | null;
  grossMarginPct: number | null;
  currencyMismatch: boolean;
  vendorQuoteCount: number;
  quoteCount: number;
}

export interface VendorProfitabilityOverview {
  rows: VendorProfitabilityRow[];
  totals: { customerRevenue: number; vendorCost: number; grossProfit: number; grossMarginPct: number | null };
  coveragePct: number | null;
  currencyMismatchCount: number;
}

export interface VendorCustomerCompareResult {
  transactionNotes: { dealId: string; commentary: string }[];
  aggregateNarrative: string;
  flaggedTransactions: { dealId: string; reason: string }[];
}

function toParams(filters: BiFilters & { vendorId?: string[] }): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.vendorId?.length) params.vendorId = filters.vendorId.join(',');
  return params;
}

export const vendorProfitabilityService = {
  async getOverview(filters: BiFilters & { vendorId?: string[] }): Promise<VendorProfitabilityOverview> {
    const { data } = await axiosClient.get<VendorProfitabilityOverview>('/business-intelligence/vendor-profitability', {
      params: toParams(filters),
    });
    return data;
  },

  async requestAiComparison(filters: BiFilters & { vendorId?: string[] }): Promise<VendorCustomerCompareResult> {
    const { data } = await axiosClient.post<VendorCustomerCompareResult>(
      '/business-intelligence/vendor-profitability/ai-compare',
      {},
      { params: toParams(filters) },
    );
    return data;
  },
};
