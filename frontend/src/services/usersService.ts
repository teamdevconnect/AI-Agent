import { axiosClient } from '@/api/axiosClient';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  assignedAgentId?: string;
  active: boolean;
}

export interface CreateUserPayload {
  email: string;
  name: string;
  role: 'admin' | 'agent_user' | 'user';
  assignedAgentId?: string;
}

export interface CreateUserResult {
  user: AdminUser;
  tempPassword: string;
}

export interface UpdateUserPayload {
  role?: 'admin' | 'agent_user' | 'user';
  assignedAgentId?: string;
  active?: boolean;
}

export const usersService = {
  async list(): Promise<AdminUser[]> {
    const { data } = await axiosClient.get<AdminUser[]>('/users');
    return data;
  },

  async create(payload: CreateUserPayload): Promise<CreateUserResult> {
    const { data } = await axiosClient.post<CreateUserResult>('/users', payload);
    return data;
  },

  async update(id: string, patch: UpdateUserPayload): Promise<AdminUser> {
    const { data } = await axiosClient.patch<AdminUser>(`/users/${id}`, patch);
    return data;
  },

  async remove(id: string): Promise<void> {
    await axiosClient.delete(`/users/${id}`);
  },
};
