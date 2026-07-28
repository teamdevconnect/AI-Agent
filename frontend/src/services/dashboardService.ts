import { axiosClient } from '@/api/axiosClient';

export interface DashboardAgent {
  id: string;
  name: string;
  avatarColor: string;
  status: 'reported' | 'pending';
  todaysTaskCount: number;
  lastReportType?: 'morning' | 'eod';
  lastReportAt?: string;
}

export interface DashboardTask {
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  category?: string;
  isOverdue: boolean;
  agentId: string;
  reportId: string;
}

export interface DashboardReport {
  id: string;
  agentId: string;
  reportType: 'morning' | 'eod';
  summary: string;
  taskCount: number;
  sourceConversationId: string;
  createdAt: string;
}

export interface DashboardOverview {
  date: string;
  agents: DashboardAgent[];
  stats: {
    totalTasks: number;
    urgentCount: number;
    overdueCount: number;
    reportsGenerated: number;
    followUpHealthPct: number | null;
  };
  criticalAlerts: DashboardTask[];
  recentReports: DashboardReport[];
}

export interface TrendPoint {
  date: string;
  totalTasks: number;
  urgentCount: number;
  overdueCount: number;
  followUpHealthPct: number | null;
}

export interface DashboardTrend {
  agentId: string;
  days: 7 | 30;
  points: TrendPoint[];
}

export const dashboardService = {
  async getOverview(agentId?: string): Promise<DashboardOverview> {
    const { data } = await axiosClient.get<DashboardOverview>('/dashboard/overview', {
      params: agentId ? { agentId } : undefined,
    });
    return data;
  },

  async getTrend(agentId: string, days: 7 | 30 = 7): Promise<DashboardTrend> {
    const { data } = await axiosClient.get<DashboardTrend>('/dashboard/trend', { params: { agentId, days } });
    return data;
  },
};
