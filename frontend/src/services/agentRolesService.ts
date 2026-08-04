import { axiosClient } from '@/api/axiosClient';

export interface AgentRoleKpi {
  name: string;
  description: string;
}

export interface AgentRole {
  _id?: string; // absent for builtin personas
  slug: string;
  name: string;
  department?: string;
  description: string;
  responsibilities?: string[];
  dailyTasks?: string[];
  weeklyTasks?: string[];
  kpis?: AgentRoleKpi[];
  systemPrompt?: string;
  sourceDocumentName?: string;
  status: 'draft' | 'active';
  avatarColor: string;
  builtin: boolean;
  // Chat @mention visibility (Phase 6) — both empty/absent means visible
  // org-wide, same as every role created before this existed.
  assignedDepartments?: string[];
  assignedUserIds?: string[];
  // Which registered tools this persona may call — empty/absent means
  // unrestricted (see backend/src/agent-roles/schemas/agent-role.schema.ts).
  allowedTools?: string[];
  // Unset (or null, while editing) = the existing message-length/round-based heuristic.
  modelTier?: 'fast' | 'standard' | null;
}

export type UpdateAgentRolePayload = Partial<
  Pick<
    AgentRole,
    | 'name'
    | 'department'
    | 'description'
    | 'responsibilities'
    | 'dailyTasks'
    | 'weeklyTasks'
    | 'kpis'
    | 'systemPrompt'
    | 'status'
    | 'assignedDepartments'
    | 'assignedUserIds'
    | 'allowedTools'
  >
> & {
  // null explicitly clears back to "Default (auto)" — omitting the field
  // entirely (undefined) means "don't touch", same convention as every
  // other optional field in this app's PATCH payloads.
  modelTier?: 'fast' | 'standard' | null;
};

export const agentRolesService = {
  async list(): Promise<AgentRole[]> {
    const { data } = await axiosClient.get<AgentRole[]>('/agent-roles');
    return data;
  },

  async generate(file: File): Promise<AgentRole> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await axiosClient.post<AgentRole>('/agent-roles/generate', form);
    return data;
  },

  async update(id: string, patch: UpdateAgentRolePayload): Promise<AgentRole> {
    const { data } = await axiosClient.patch<AgentRole>(`/agent-roles/${id}`, patch);
    return data;
  },

  async remove(id: string): Promise<void> {
    await axiosClient.delete(`/agent-roles/${id}`);
  },
};
