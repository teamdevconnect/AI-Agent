import { axiosClient } from '@/api/axiosClient';

export interface Quote {
  _id: string;
  organizationId: string;
  dealId?: string;
  quoteName?: string;
  quoteNumber?: string;
  quoteStatus: string;
  clientApprovalStatus: string;
  quoteAmount: number;
  currency: string;
  clientDetails?: { companyName?: string; contactName?: string; email?: string; phone?: string };
  createdAt: string;
}

export interface ListQuotesFilters {
  dateFrom?: string;
  dateTo?: string;
  clientApprovalStatus?: string;
}

export interface ListQuotesResult {
  items: Quote[];
  total: number;
  page: number;
  pageSize: number;
}

// Phase 19 — the Unified Analytics Dashboard's quote drill-down. Mirrors
// dealsService.listFiltered's exact shape/scoping (server-side role
// branching, no client-supplied scope beyond the filters themselves).
export const quotesService = {
  async listFiltered(filters: ListQuotesFilters, page = 1, pageSize = 25): Promise<ListQuotesResult> {
    const { data } = await axiosClient.get<ListQuotesResult>('/crm/quotes/query', {
      params: { ...filters, page, pageSize },
    });
    return data;
  },
};
