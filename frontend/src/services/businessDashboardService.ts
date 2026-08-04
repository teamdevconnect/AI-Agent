import { axiosClient } from '@/api/axiosClient';

export interface RevenueTrendPoint {
  period: string;
  revenue: number;
}

export interface StoreRanking {
  storeId: string;
  storeName: string;
  revenue: number;
}

export interface EmployeeLeaderboardEntry {
  userId: string;
  userName: string;
  revenue: number;
  wonCount: number;
}

export interface DealSummary {
  dealId: string;
  name: string;
  monetaryValue: number;
  stageId?: string;
  expectedClosingDate?: string;
}

// Fields with no backing data model yet (calendar, per-person tasks) come
// back shaped like this instead of being omitted — lets views render a
// consistent "coming later" empty state rather than branching on undefined.
export interface NotYetAvailable {
  available: false;
  message: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
}

// Phase 8: teamCalendar/todaysMeetings are real Outlook data now, wired
// through python-agent's Graph calendar-events read — they share
// NotYetAvailable's shape only for the "not connected" case (a real,
// actionable prompt now, not a permanent "coming later" placeholder).
export type TeamCalendarResult = NotYetAvailable | { available: true; events: (CalendarEvent & { userName: string })[] };
export type TodaysMeetingsResult = NotYetAvailable | { available: true; events: CalendarEvent[] };

export interface OwnerOverview {
  period: string;
  totalRevenue: number;
  monthlyTarget: number | null;
  achievementPct: number | null;
  remaining: number | null;
  forecast: { predictedMonthEnd: number; confidence: number };
  revenueTrend: RevenueTrendPoint[];
  storeRankings: StoreRanking[];
  employeeLeaderboard: EmployeeLeaderboardEntry[];
  businessHealthScore: number;
  missedTasks: number;
  pendingApprovals: unknown[];
  riskAlerts: DealSummary[];
  aiInsight: string;
}

export interface ManagerOverview {
  period: string;
  storeId: string;
  storeTarget: number | null;
  storeAchievement: number | null;
  revenue: number;
  conversionRate: number | null;
  teamPerformance: EmployeeLeaderboardEntry[];
  followUps: DealSummary[];
  missedEodReportToday: boolean;
  aiRecommendation: string;
  teamCalendar: TeamCalendarResult;
  pendingTasks: NotYetAvailable;
}

export interface ConsultantOverview {
  period: string;
  personalTarget: number | null;
  currentSales: number;
  achievementPct: number | null;
  remainingTarget: number | null;
  customerPipeline: DealSummary[];
  followUps: DealSummary[];
  aiCoaching: string;
  todaysMeetings: TodaysMeetingsResult;
  todaysTasks: NotYetAvailable;
  missedTasks: NotYetAvailable;
}

export const businessDashboardService = {
  async getOwnerOverview(period?: string): Promise<OwnerOverview> {
    const { data } = await axiosClient.get<OwnerOverview>('/crm/dashboard/owner', { params: { period } });
    return data;
  },

  async getManagerOverview(storeId?: string, period?: string): Promise<ManagerOverview> {
    const { data } = await axiosClient.get<ManagerOverview>('/crm/dashboard/manager', { params: { storeId, period } });
    return data;
  },

  async getConsultantOverview(period?: string): Promise<ConsultantOverview> {
    const { data } = await axiosClient.get<ConsultantOverview>('/crm/dashboard/consultant', { params: { period } });
    return data;
  },
};
