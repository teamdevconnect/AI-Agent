import { axiosClient } from '@/api/axiosClient';

export interface AiRecommendation {
  id: string;
  text: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface CriticalAlertItem {
  id: string;
  title: string;
  meta: string;
  valueLabel?: string;
}

export type CriticalAlertKey = 'deals_at_risk' | 'overdue_tasks' | 'missed_eod' | 'urgent_emails';

export interface CriticalAlertGroup {
  key: CriticalAlertKey;
  label: string;
  count: number;
  items: CriticalAlertItem[];
}

export interface EmailSummaryBucket {
  bucket: string;
  count: number;
}

export interface EmailSummaryItem {
  id: string;
  subject: string;
  from: string;
  intent: string;
  priority: string;
  receivedAt: string;
}

export interface TodaysEmailSummary {
  connected: boolean;
  mailboxEmail?: string;
  pendingCount: number;
  byIntentBucket: EmailSummaryBucket[];
  topItems: EmailSummaryItem[];
}

export interface CompactTimelineEvent {
  id: string;
  type: string;
  title: string;
  occurredAt: string;
}

export interface HomeDashboardOverview {
  generatedAt: string;
  aiRecommendations: AiRecommendation[];
  criticalAlerts: CriticalAlertGroup[];
  emailSummary: TodaysEmailSummary;
  timeline: CompactTimelineEvent[];
}

export const homeDashboardService = {
  async getOwnerHome(): Promise<HomeDashboardOverview> {
    const { data } = await axiosClient.get<HomeDashboardOverview>('/home-dashboard/owner');
    return data;
  },
  async getManagerHome(storeId?: string): Promise<HomeDashboardOverview> {
    const { data } = await axiosClient.get<HomeDashboardOverview>('/home-dashboard/manager', { params: { storeId } });
    return data;
  },
  async getConsultantHome(): Promise<HomeDashboardOverview> {
    const { data } = await axiosClient.get<HomeDashboardOverview>('/home-dashboard/consultant');
    return data;
  },
};
