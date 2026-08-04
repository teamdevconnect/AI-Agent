import { axiosClient } from '@/api/axiosClient';

export type TriggerType = 'schedule' | 'event' | 'manual';

export interface WorkflowDefinition {
  _id: string;
  organizationId: string;
  name: string;
  workflowName: string;
  triggerType: TriggerType;
  schedule?: string;
  eventType?: string;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
}

export interface AvailableWorkflow {
  name: string;
  description: string;
}

export interface WorkflowExecution {
  _id: string;
  workflowDefinitionId: string;
  workflowName: string;
  triggeredBy: TriggerType;
  status: 'success' | 'failed';
  output?: string;
  error?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface CreateWorkflowDefinitionPayload {
  name: string;
  workflowName: string;
  triggerType: TriggerType;
  schedule?: string;
  eventType?: string;
  enabled?: boolean;
}

export type UpdateWorkflowDefinitionPayload = Partial<CreateWorkflowDefinitionPayload>;

export const workflowsService = {
  async list(): Promise<WorkflowDefinition[]> {
    const { data } = await axiosClient.get<WorkflowDefinition[]>('/workflows');
    return data;
  },

  async listAvailable(): Promise<AvailableWorkflow[]> {
    const { data } = await axiosClient.get<AvailableWorkflow[]>('/workflows/available');
    return data;
  },

  async create(payload: CreateWorkflowDefinitionPayload): Promise<WorkflowDefinition> {
    const { data } = await axiosClient.post<WorkflowDefinition>('/workflows', payload);
    return data;
  },

  async update(id: string, patch: UpdateWorkflowDefinitionPayload): Promise<WorkflowDefinition> {
    const { data } = await axiosClient.patch<WorkflowDefinition>(`/workflows/${id}`, patch);
    return data;
  },

  async remove(id: string): Promise<void> {
    await axiosClient.delete(`/workflows/${id}`);
  },

  async runNow(id: string): Promise<{ enqueued: boolean }> {
    const { data } = await axiosClient.post<{ enqueued: boolean }>(`/workflows/${id}/run`);
    return data;
  },

  async listExecutions(id: string): Promise<WorkflowExecution[]> {
    const { data } = await axiosClient.get<WorkflowExecution[]>(`/workflows/${id}/executions`);
    return data;
  },
};
