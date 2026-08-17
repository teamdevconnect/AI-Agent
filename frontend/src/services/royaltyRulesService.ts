import { axiosClient } from '@/api/axiosClient';

export type RoyaltyCapType = 'none' | 'min' | 'max' | 'sliding';

export interface RoyaltySlidingTier {
  fromValue: number;
  toValue?: number;
  percentage: number;
}

export interface RoyaltyRule {
  _id: string;
  organizationId: string;
  royaltyPercentage: number;
  capType: RoyaltyCapType;
  capValue?: number;
  slidingTiers: RoyaltySlidingTier[];
  marketingFeeAmount?: number;
  otherFeeAmount?: number;
  excludeTax: boolean;
  excludeShipping: boolean;
  excludeDiscount: boolean;
  effectiveDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertRoyaltyRulePayload {
  royaltyPercentage: number;
  capType: RoyaltyCapType;
  capValue?: number;
  slidingTiers?: RoyaltySlidingTier[];
  marketingFeeAmount?: number;
  otherFeeAmount?: number;
  excludeTax?: boolean;
  excludeShipping?: boolean;
  excludeDiscount?: boolean;
  effectiveDate: string;
}

// Effective-dated, append-only on the backend — create() always adds a new
// version; update() only succeeds against a version whose effectiveDate is
// still in the future (see royalty-rules.service.ts's updateFutureVersion).
export const royaltyRulesService = {
  async getCurrent(): Promise<RoyaltyRule | null> {
    const { data } = await axiosClient.get<RoyaltyRule | null>('/royalty/rules/current');
    return data;
  },

  async listHistory(): Promise<RoyaltyRule[]> {
    const { data } = await axiosClient.get<RoyaltyRule[]>('/royalty/rules/history');
    return data;
  },

  async create(payload: UpsertRoyaltyRulePayload): Promise<RoyaltyRule> {
    const { data } = await axiosClient.post<RoyaltyRule>('/royalty/rules', payload);
    return data;
  },

  async update(id: string, payload: Partial<UpsertRoyaltyRulePayload>): Promise<RoyaltyRule> {
    const { data } = await axiosClient.patch<RoyaltyRule>(`/royalty/rules/${id}`, payload);
    return data;
  },
};
