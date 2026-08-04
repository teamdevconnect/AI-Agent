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

export const organizationsService = {
  async listStores(): Promise<Store[]> {
    const { data } = await axiosClient.get<Store[]>('/organizations/stores');
    return data;
  },
};
