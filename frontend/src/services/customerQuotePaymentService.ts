import { axiosClient } from '@/api/axiosClient';
import type { BiFilters } from './emailAnalyticsService';
import type { Quote } from './quotesService';

export interface QuotePaymentSummary {
  byStatus: { status: string; count: number; value: number }[];
  totalQuoted: number;
  totalPaid: number;
  totalOutstanding: number;
  agingBuckets: { bucket: string; amount: number }[];
}

export interface ListBiQuotesResult {
  items: Quote[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CustomerDetailQuote {
  id: string;
  quoteNumber: string | null;
  quoteName: string | null;
  quoteStatus: string;
  quoteAmount: number;
  currency: string;
  clientDetails: { companyName?: string; contactName?: string; email?: string; phone?: string } | null;
  dealId: string | null;
  createdAt: string | null;
  paidAmount: number;
  outstandingAmount: number;
  payments: { id: string; amount: number; paymentDate: string; paymentMethod?: string; reference?: string; voided: boolean }[];
}

export interface CustomerDetail {
  key: string;
  businessName: string;
  quotes: CustomerDetailQuote[];
  deals: { id: string; name: string; dealStatus: string; monetaryValue: number; expectedClosingDate?: string }[];
  correlatedEmails: unknown[];
}

function toParams(filters: BiFilters, extra?: Record<string, unknown>): Record<string, unknown> {
  const params: Record<string, unknown> = { ...extra };
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.employeeId?.length) params.employeeId = filters.employeeId.join(',');
  if (filters.storeId?.length) params.storeId = filters.storeId.join(',');
  return params;
}

export const customerQuotePaymentService = {
  async getSummary(filters: BiFilters): Promise<QuotePaymentSummary> {
    const { data } = await axiosClient.get<QuotePaymentSummary>('/business-intelligence/customer-quote-payment/summary', {
      params: toParams(filters),
    });
    return data;
  },

  async listQuotes(
    filters: BiFilters,
    page: number,
    pageSize: number,
    clientApprovalStatus?: string[],
  ): Promise<ListBiQuotesResult> {
    const { data } = await axiosClient.get<ListBiQuotesResult>('/business-intelligence/customer-quote-payment/quotes', {
      params: toParams(filters, { page, pageSize, clientApprovalStatus: clientApprovalStatus?.length ? clientApprovalStatus.join(',') : undefined }),
    });
    return data;
  },

  async getCustomerDetail(businessKey: string): Promise<CustomerDetail> {
    const { data } = await axiosClient.get<CustomerDetail>(
      `/business-intelligence/customer-quote-payment/customer/${encodeURIComponent(businessKey)}`,
    );
    return data;
  },
};
