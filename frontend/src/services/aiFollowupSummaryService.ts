import { axiosClient } from '@/api/axiosClient';

export interface FollowUpReminder {
  _id: string;
  organizationId: string;
  userId: string;
  emailIntelligenceItemId: string;
  businessName?: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'done' | 'dismissed';
  createdAt: string;
  updatedAt: string;
}

export interface FollowupSummaryResult {
  todaysPriorities: { title: string; rationale: string; relatedId: string | null; relatedType: string }[];
  overdueFollowUps: { followUpId: string; note: string }[];
  highPriorityCustomers: { businessName: string; businessKey: string | null; reason: string }[];
  recommendedActions: string[];
  aiSummary: string;
  generatedAt: string;
}

export interface FollowupOverview {
  followUpReminders: FollowUpReminder[];
  aiGeneratedSummary: FollowupSummaryResult | null;
}

export const aiFollowupSummaryService = {
  async getOverview(): Promise<FollowupOverview> {
    const { data } = await axiosClient.get<FollowupOverview>('/business-intelligence/ai-followup-summary');
    return data;
  },

  async generate(regenerate: boolean): Promise<{ summary: FollowupSummaryResult; cached: boolean }> {
    const { data } = await axiosClient.post<{ summary: FollowupSummaryResult; cached: boolean }>(
      '/business-intelligence/ai-followup-summary/generate',
      { regenerate },
    );
    return data;
  },
};
