import { axiosClient } from '@/api/axiosClient';

export interface Deal {
  _id: string;
  organizationId: string;
  storeId?: string;
  ownerId?: string;
  name: string;
  contactId?: string;
  accountId?: string;
  pipelineId?: string;
  stageId?: string;
  dealStatus: 'open' | 'won' | 'lost';
  monetaryValue: number;
  expectedClosingDate?: string;
  externalId?: string;
  // Phase 9a — manual-entry-only dimension fields (see backend deal.schema.ts).
  // Only ever set on natively created/edited deals; external-CRM-synced
  // deals never carry these.
  leadSource?: string;
  product?: string;
  customerType?: string;
  region?: string;
}

export const LEAD_SOURCES = ['referral', 'website', 'cold_call', 'event', 'partner', 'social_media', 'advertisement', 'other'] as const;
export const CUSTOMER_TYPES = ['individual', 'business', 'government', 'other'] as const;
export const REGIONS = ['north', 'south', 'east', 'west', 'central', 'international', 'other'] as const;

// Shared filter shape — reused by the plain deal list/export (this file) and
// the composite dashboard overview (dealPerformanceService.ts), so the two
// never drift on what a filter param is called.
export interface DealFilters {
  dateFrom?: string;
  dateTo?: string;
  ownerId?: string[];
  storeId?: string[];
  dealStatus?: ('open' | 'won' | 'lost')[];
  stageId?: string[];
  leadSource?: string[];
  product?: string[];
  customerType?: string[];
  region?: string[];
  valueMin?: number;
  valueMax?: number;
}

export interface CreateDealPayload {
  name: string;
  storeId?: string;
  ownerId?: string;
  contactId?: string;
  accountId?: string;
  pipelineId?: string;
  stageId?: string;
  dealStatus?: 'open' | 'won' | 'lost';
  monetaryValue?: number;
  expectedClosingDate?: string;
  leadSource?: string;
  product?: string;
  customerType?: string;
  region?: string;
}

export type UpdateDealPayload = Partial<CreateDealPayload>;

export interface ListDealsResult {
  items: Deal[];
  total: number;
  page: number;
  pageSize: number;
}

// Arrays are sent as a single comma-separated query param (matches
// DealFilterQueryDto's @Transform on the backend) — simpler to round-trip
// through a saved preset's JSON blob than repeated `?x=a&x=b` params.
export function toDealFilterParams(filters: DealFilters, extra?: Record<string, unknown>): Record<string, unknown> {
  const params: Record<string, unknown> = { ...extra };
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    params[key] = Array.isArray(value) ? value.join(',') : value;
  }
  return params;
}

export const dealsService = {
  async list(storeId?: string): Promise<Deal[]> {
    const { data } = await axiosClient.get<Deal[]>('/crm/deals', { params: storeId ? { storeId } : {} });
    return data;
  },

  async listFiltered(filters: DealFilters, page: number, pageSize: number, sortBy?: string, sortDir?: 'asc' | 'desc'): Promise<ListDealsResult> {
    const { data } = await axiosClient.get<ListDealsResult>('/crm/deals/query', {
      params: toDealFilterParams(filters, { page, pageSize, sortBy, sortDir }),
    });
    return data;
  },

  async getOne(id: string): Promise<Deal> {
    const { data } = await axiosClient.get<Deal>(`/crm/deals/${id}`);
    return data;
  },

  async create(payload: CreateDealPayload): Promise<Deal> {
    const { data } = await axiosClient.post<Deal>('/crm/deals', payload);
    return data;
  },

  async update(id: string, payload: UpdateDealPayload): Promise<Deal> {
    const { data } = await axiosClient.patch<Deal>(`/crm/deals/${id}`, payload);
    return data;
  },

  async assign(dealId: string, ownerId: string | null): Promise<Deal> {
    const { data } = await axiosClient.patch<Deal>(`/crm/deals/${dealId}/assign`, { ownerId });
    return data;
  },

  async downloadExport(format: 'csv' | 'xlsx' | 'pdf', filters: DealFilters): Promise<void> {
    const response = await axiosClient.get('/crm/deals/export', {
      params: toDealFilterParams(filters, { format }),
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const filename = disposition ? /filename="([^"]+)"/.exec(disposition)?.[1] : undefined;
    const url = URL.createObjectURL(response.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? `deals.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
