import { axiosClient } from '@/api/axiosClient';
import type { BiFilters } from './emailAnalyticsService';

interface DomainBucket {
  assigned: number;
  completed: number;
  pending: number;
  overdue: number;
}

export interface EmployeeProductivityRow {
  userId: string;
  userName: string;
  emails: DomainBucket;
  quotes: DomainBucket;
  deals: DomainBucket & { wonCount: number; lostCount: number; wonValue: number };
  overallCompletionPct: number | null;
}

export interface EmployeeProductivityOverview {
  rows: EmployeeProductivityRow[];
  quoteCoveragePct: number | null;
}

function toParams(filters: BiFilters): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.employeeId?.length) params.employeeId = filters.employeeId.join(',');
  if (filters.storeId?.length) params.storeId = filters.storeId.join(',');
  return params;
}

export const employeeProductivityService = {
  async getOverview(filters: BiFilters): Promise<EmployeeProductivityOverview> {
    const { data } = await axiosClient.get<EmployeeProductivityOverview>('/business-intelligence/employee-productivity', {
      params: toParams(filters),
    });
    return data;
  },
};
