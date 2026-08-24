import { axiosClient } from '@/api/axiosClient';

// Cross-org platform_admin management — backend/src/users/admin-users.controller.ts,
// @Roles('platform_admin') only. Bootstrapping the FIRST platform_admin is
// still a manual DB step; this only lets an existing one manage subsequent ones.
export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  roles: string[];
  active: boolean;
}

export interface PagedUsers {
  items: AdminUserRow[];
  total: number;
  page: number;
  limit: number;
}

export const adminUsersService = {
  async listPlatformAdmins(params?: { search?: string; page?: number; limit?: number }): Promise<PagedUsers> {
    const { data } = await axiosClient.get<PagedUsers>('/users/admin/platform-admins', { params });
    return data;
  },

  async searchCandidates(search: string): Promise<AdminUserRow[]> {
    const { data } = await axiosClient.get<AdminUserRow[]>('/users/admin/platform-admins/search-candidates', { params: { search } });
    return data;
  },

  async grant(userId: string): Promise<AdminUserRow> {
    const { data } = await axiosClient.post<AdminUserRow>(`/users/admin/platform-admins/${userId}/grant`);
    return data;
  },

  async revoke(userId: string): Promise<AdminUserRow> {
    const { data } = await axiosClient.post<AdminUserRow>(`/users/admin/platform-admins/${userId}/revoke`);
    return data;
  },
};
