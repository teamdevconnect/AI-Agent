import { axiosClient } from '@/api/axiosClient';
import type { AppNotification } from '@/services/mock/fixtures/notifications';

export interface BackendNotification {
  _id: string;
  kind: AppNotification['kind'];
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
  source?: string;
  entityType?: AppNotification['entityType'];
  entityId?: string;
}

export function toNotification(n: BackendNotification): AppNotification {
  return {
    id: n._id,
    kind: n.kind,
    title: n.title,
    description: n.description,
    timestamp: n.createdAt,
    read: n.read,
    source: n.source,
    entityType: n.entityType,
    entityId: n.entityId,
  };
}

export interface NotificationPreferences {
  desktopPush: boolean;
  mobilePush: boolean;
  email: boolean;
  orgPolicy: { emailEnabled: boolean; pushEnabled: boolean };
}

export const notificationsService = {
  async list(): Promise<AppNotification[]> {
    const { data } = await axiosClient.get<BackendNotification[]>('/notifications');
    return data.map(toNotification);
  },

  async markRead(id: string): Promise<void> {
    await axiosClient.post(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await axiosClient.post('/notifications/read-all');
  },

  async getPreferences(): Promise<NotificationPreferences> {
    const { data } = await axiosClient.get<NotificationPreferences>('/notifications/preferences');
    return data;
  },

  async updatePreferences(patch: Partial<Pick<NotificationPreferences, 'desktopPush' | 'mobilePush' | 'email'>>): Promise<NotificationPreferences> {
    const { data } = await axiosClient.put<NotificationPreferences>('/notifications/preferences', patch);
    return data;
  },
};
