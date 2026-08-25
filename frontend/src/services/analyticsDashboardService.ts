import { axiosClient } from '@/api/axiosClient';

export interface AnalyticsScopeInfo {
  level: 'org' | 'store' | 'user';
  storeId?: string;
  storeName?: string;
  userId?: string;
}

export interface AiInsightItem {
  message: string;
  severity: 'critical' | 'warning' | 'info';
  actionTabId?: string;
  actionLabel?: string;
}

export interface AnalyticsDashboardOverview {
  dateFrom: string;
  dateTo: string;
  scope: AnalyticsScopeInfo;
  emailActivity: {
    totalRelevantCount: number;
    sentCount: number;
    missedCount: number;
    newEnquiryCount: number;
    byIntent: { intent: string; label: string; count: number }[];
  };
  deals: { wonCount: number; lostCount: number; openCount: number; wonValue: number; lostValue: number; openValue: number };
  revenue: {
    period: string;
    targetAmount: number | null;
    currency: string;
    achieved: number;
    achievementPct: number | null;
    remaining: number | null;
    avgDailySalesNeeded: number | null;
    predictedMonthEnd: number;
    forecastConfidence: number;
    businessHealthScore: number | null;
  };
  employeeLeaderboard: { userId: string; userName: string; revenue: number; wonCount: number }[];
  workBreakdown: {
    userId: string;
    userName: string;
    wonCount: number;
    lostCount: number;
    openCount: number;
    conversionRate: number | null;
  }[];
  quotes: { acceptedCount: number; acceptedValue: number; notAcceptedCount: number; notAcceptedValue: number };
  revenueTrend: { period: string; achieved: number; targetAmount: number | null; achievementPct: number | null }[];
  customers: { newCount: number; existingCount: number; lostCount: number; totalConsidered: number };
  aiInsight: string;
  insights: AiInsightItem[];
}

export const analyticsDashboardService = {
  async getOverview(dateFrom: string, dateTo: string, storeId?: string): Promise<AnalyticsDashboardOverview> {
    const { data } = await axiosClient.get<AnalyticsDashboardOverview>('/analytics-dashboard/overview', {
      params: { dateFrom, dateTo, ...(storeId ? { storeId } : {}) },
    });
    return data;
  },
};
