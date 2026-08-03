import { axiosClient } from '@/api/axiosClient';
import type { DealFilters } from './dealsService';
import { toDealFilterParams } from './dealsService';

export interface WonLostTrendPoint {
  period: string;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  lostValue: number;
}

export interface StageBucket {
  stageId: string;
  count: number;
  value: number;
}

export interface FunnelBucket {
  stageId: string;
  count: number;
}

export interface Achievement {
  period: string;
  targetAmount: number | null;
  currency: string;
  achieved: number;
  achievementPct: number | null;
  remaining: number | null;
  avgDailySalesNeeded: number | null;
  predictedMonthEnd: number;
  forecastConfidence: number;
}

export interface RevenueProgressPoint {
  period: string;
  achieved: number;
  targetAmount: number | null;
  achievementPct: number | null;
}

export interface ConsultantPerformanceEntry {
  userId: string;
  userName: string;
  wonCount: number;
  lostCount: number;
  openCount: number;
  wonValue: number;
  conversionRate: number | null;
  winRate: number | null;
  avgDealSize: number | null;
}

export interface BreakdownEntry {
  key: string;
  count: number;
  value: number;
  wonCount?: number;
}

export interface Breakdown {
  totalCount: number;
  taggedCount: number;
  coveragePct: number;
  breakdown: BreakdownEntry[];
}

export interface CustomerAcquisitionPoint {
  period: string;
  newContacts: number;
}

export interface DealPerformanceOverview {
  filtersApplied: DealFilters;
  summary: {
    totalDeals: number;
    wonCount: number;
    lostCount: number;
    openCount: number;
    wonValue: number;
    lostValue: number;
    openValue: number;
    conversionRate: number | null;
    winRate: number | null;
    avgWonDealSize: number | null;
  };
  wonLostTrend: WonLostTrendPoint[];
  pipelineByStage: StageBucket[];
  untaggedStageCount: number;
  achievement: Achievement;
  revenueProgress: RevenueProgressPoint[];
  conversionFunnel: FunnelBucket[];
  conversionFunnelNote: string;
  consultantPerformance: ConsultantPerformanceEntry[];
  leadSourcePerformance: Breakdown;
  productPerformance: Breakdown;
  geographicDistribution: Breakdown;
  customerAcquisitionTrend: CustomerAcquisitionPoint[];
  aiInsight: string;
}

export interface DealPerformancePreset {
  _id: string;
  name: string;
  filters: DealFilters;
  hiddenWidgets: string[];
}

export interface UpsertPresetPayload {
  name: string;
  filters: DealFilters;
  hiddenWidgets: string[];
}

export const dealPerformanceService = {
  async getOverview(filters: DealFilters, months?: number): Promise<DealPerformanceOverview> {
    const { data } = await axiosClient.get<DealPerformanceOverview>('/crm/deal-performance/overview', {
      params: toDealFilterParams(filters, { months }),
    });
    return data;
  },

  async listPresets(): Promise<DealPerformancePreset[]> {
    const { data } = await axiosClient.get<DealPerformancePreset[]>('/crm/deal-performance/presets');
    return data;
  },

  async createPreset(payload: UpsertPresetPayload): Promise<DealPerformancePreset> {
    const { data } = await axiosClient.post<DealPerformancePreset>('/crm/deal-performance/presets', payload);
    return data;
  },

  async updatePreset(id: string, payload: UpsertPresetPayload): Promise<DealPerformancePreset> {
    const { data } = await axiosClient.patch<DealPerformancePreset>(`/crm/deal-performance/presets/${id}`, payload);
    return data;
  },

  async deletePreset(id: string): Promise<void> {
    await axiosClient.delete(`/crm/deal-performance/presets/${id}`);
  },
};
