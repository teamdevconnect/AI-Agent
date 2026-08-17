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
  // Agent Builder Phase 1 — outcome-shaped ("what success means"), distinct
  // from responsibilities/dailyTasks/weeklyTasks below (task-shaped).
  goals?: string[];
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

type AgentRoleConfigFields = Pick<
  AgentRole,
  | 'name'
  | 'department'
  | 'description'
  | 'goals'
  | 'responsibilities'
  | 'dailyTasks'
  | 'weeklyTasks'
  | 'kpis'
  | 'systemPrompt'
  | 'assignedDepartments'
  | 'assignedUserIds'
  | 'allowedTools'
>;

export type UpdateAgentRolePayload = Partial<AgentRoleConfigFields> & {
  status?: 'draft' | 'active';
  // null explicitly clears back to "Default (auto)" — omitting the field
  // entirely (undefined) means "don't touch", same convention as every
  // other optional field in this app's PATCH payloads.
  modelTier?: 'fast' | 'standard' | null;
};

// Agent Builder Phase 1 — Manual and Template methods (Template just
// pre-fills this same shape client-side from a constant before submitting).
// Always creates as a draft server-side, same "review before activating"
// step every creation method goes through.
export type CreateAgentRolePayload = Partial<AgentRoleConfigFields> &
  Pick<AgentRoleConfigFields, 'name' | 'systemPrompt'> & {
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

  // Agent Builder Phase 1 — Describe method: same structured-review flow as
  // generate() above, sourced from a short typed description instead of a
  // file.
  async generateFromDescription(description: string): Promise<AgentRole> {
    const { data } = await axiosClient.post<AgentRole>('/agent-roles/generate-from-description', { description });
    return data;
  },

  // Agent Builder Phase 1 — Manual/Template methods: no AI call, no file.
  async create(payload: CreateAgentRolePayload): Promise<AgentRole> {
    const { data } = await axiosClient.post<AgentRole>('/agent-roles', payload);
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
