import { axiosClient } from '@/api/axiosClient';

export interface TimelineEvent {
  _id: string;
  organizationId: string;
  storeId?: string;
  userId?: string;
  type: string;
  title: string;
  description?: string;
  sourceType: string;
  sourceId?: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

// The real, complete TimelineEvent.type vocabulary — confirmed by grepping
// every TimelineService.record(...) call site in the backend (Phase 15),
// not guessed. Used to drive TimelinePage's type filter.
export const TIMELINE_EVENT_TYPE_OPTIONS = [
  { value: 'daily_report_generated', label: 'Report generated' },
  { value: 'daily_report_missed', label: 'Report missed' },
  { value: 'task_completed', label: 'Task completed' },
  { value: 'achievement_unlocked', label: 'Achievement unlocked' },
  { value: 'customer_activity_summary_generated', label: 'Customer activity summary generated' },
  { value: 'customer_activity_personal_summary_generated', label: 'Personal customer activity summary generated' },
  { value: 'finance_summary_generated', label: 'Finance summary generated' },
];

export const timelineService = {
  async list(params?: {
    storeId?: string;
    userId?: string;
    type?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<TimelineEvent[]> {
    const { data } = await axiosClient.get<TimelineEvent[]>('/timeline', { params });
    return data;
  },
};
