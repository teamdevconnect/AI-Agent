import { axiosClient } from '@/api/axiosClient';

export type TargetScope = 'org' | 'store' | 'user';

export interface SalesTarget {
  _id: string;
  organizationId: string;
  scope: TargetScope;
  storeId?: string;
  userId?: string;
  period: string;
  targetAmount: number;
  currency: string;
}

export interface UpsertSalesTargetPayload {
  scope: TargetScope;
  storeId?: string;
  userId?: string;
  period: string;
  targetAmount: number;
  currency?: string;
}

export const salesTargetsService = {
  async list(period: string): Promise<SalesTarget[]> {
    const { data } = await axiosClient.get<SalesTarget[]>('/sales-targets', { params: { period } });
    return data;
  },

  async upsert(payload: UpsertSalesTargetPayload): Promise<SalesTarget> {
    const { data } = await axiosClient.post<SalesTarget>('/sales-targets', payload);
    return data;
  },
};
