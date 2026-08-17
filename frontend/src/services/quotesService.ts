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
  expirationDate?: string;
  externalId?: string;
  clientDetails?: { companyName?: string; contactName?: string; email?: string; phone?: string };
  createdAt: string;
  // Business Intelligence additions (see backend quote.schema.ts) — unset on
  // records created before these fields existed.
  sourceEmailIntelligenceItemId?: string;
  ownerUserId?: string;
  dueDate?: string;
  paidAmount: number;
}

export interface UpdateQuotePayload {
  quoteName?: string;
  quoteStatus?: string;
  clientApprovalStatus?: string;
  quoteAmount?: number;
  currency?: string;
  expirationDate?: string;
  dueDate?: string;
  requestNotes?: string;
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

  async getOne(id: string): Promise<Quote> {
    const { data } = await axiosClient.get<Quote>(`/crm/quotes/${id}`);
    return data;
  },

  // Section 7 (Business Intelligence: Customer Quote & Payment Tracking) —
  // rejects quoteAmount/clientApprovalStatus/quoteStatus edits (400) on any
  // quote synced from the external CRM (externalId set) — see the backend's
  // own SYNC_OWNED_FIELDS guard.
  async update(id: string, payload: UpdateQuotePayload): Promise<Quote> {
    const { data } = await axiosClient.patch<Quote>(`/crm/quotes/${id}`, payload);
    return data;
  },
};
