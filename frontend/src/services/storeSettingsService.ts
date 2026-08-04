import { axiosClient } from '@/api/axiosClient';

export interface StoreSettings {
  openingTime: string; // "HH:mm", 24-hour
  closingTime: string;
  timezone: string; // IANA zone, e.g. "Asia/Kolkata"
}

export const storeSettingsService = {
  async getSettings(): Promise<StoreSettings> {
    const { data } = await axiosClient.get<StoreSettings>('/store-settings');
    return data;
  },

  async updateSettings(settings: StoreSettings): Promise<StoreSettings> {
    const { data } = await axiosClient.put<StoreSettings>('/store-settings', settings);
    return data;
  },
};
