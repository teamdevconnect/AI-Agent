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

export const timelineService = {
  async list(params?: { storeId?: string; userId?: string; type?: string; limit?: number }): Promise<TimelineEvent[]> {
    const { data } = await axiosClient.get<TimelineEvent[]>('/timeline', { params });
    return data;
  },
};
