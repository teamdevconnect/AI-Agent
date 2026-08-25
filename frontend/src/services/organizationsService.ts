import { axiosClient } from '@/api/axiosClient';

export interface Store {
  _id: string;
  organizationId: string;
  name: string;
  address?: string;
  openingTime: string;
  closingTime: string;
  timezone: string;
}

export interface NotificationPolicy {
  emailEnabled: boolean;
  pushEnabled: boolean;
}

export const organizationsService = {
  async listStores(): Promise<Store[]> {
    const { data } = await axiosClient.get<Store[]>('/organizations/stores');
    return data;
  },

  async getNotificationPolicy(): Promise<NotificationPolicy> {
    const { data } = await axiosClient.get<NotificationPolicy>('/organizations/notification-policy');
    return data;
  },

  async updateNotificationPolicy(patch: Partial<NotificationPolicy>): Promise<NotificationPolicy> {
    const { data } = await axiosClient.put<NotificationPolicy>('/organizations/notification-policy', patch);
    return data;
  },
};
