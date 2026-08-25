import { axiosClient } from '@/api/axiosClient';
import type { BiFilters } from './emailAnalyticsService';

export interface EnquiryConversionRow {
  emailItemId: string;
  subject: string;
  fromAddress: string;
  matchedBusinessName?: string;
  receivedAt: string;
  userId: string;
  matchType: 'exact' | 'inferred' | 'unmatched';
  quote?: {
    id: string;
    quoteNumber?: string;
    quoteAmount: number;
    currency: string;
    clientApprovalStatus: string;
    quoteStatus: string;
    createdAt: string;
  };
}

export interface EnquiryConversionOverview {
  rows: EnquiryConversionRow[];
  exactCount: number;
  inferredCount: number;
  unmatchedCount: number;
}

function toParams(filters: BiFilters): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.employeeId?.length) params.employeeId = filters.employeeId.join(',');
  if (filters.storeId?.length) params.storeId = filters.storeId.join(',');
  return params;
}

export const enquiryConversionService = {
  async getOverview(filters: BiFilters): Promise<EnquiryConversionOverview> {
    const { data } = await axiosClient.get<EnquiryConversionOverview>('/business-intelligence/enquiry-conversion', {
      params: toParams(filters),
    });
    return data;
  },
};
