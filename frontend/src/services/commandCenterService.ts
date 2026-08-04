import { axiosClient } from '@/api/axiosClient';

export interface ProviderUsage {
  provider: string;
  count: number;
  cost: number;
}

export interface CostTrendPoint {
  date: string;
  cost: number;
  count: number;
}

export interface CommandCenterSummary {
  days: number;
  totalCalls: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  errorRatePct: number;
  byProvider: ProviderUsage[];
  costTrend: CostTrendPoint[];
}

export interface AgentExecution {
  _id: string;
  organizationId?: string;
  userId?: string;
  conversationId?: string;
  kind: 'llm' | 'tool';
  name: string;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number | null;
  latencyMs: number;
  success: boolean;
  error?: string;
  occurredAt: string;
}

export interface ConversationStats {
  messages: number;
  tokensUsed: number;
  avgResponseTimeMs: number;
  cost: number;
}

export const commandCenterService = {
  async getSummary(days?: number): Promise<CommandCenterSummary> {
    const { data } = await axiosClient.get<CommandCenterSummary>('/command-center/summary', { params: { days } });
    return data;
  },

  async listExecutions(params?: {
    kind?: 'llm' | 'tool';
    provider?: string;
    success?: boolean;
    limit?: number;
  }): Promise<AgentExecution[]> {
    const { data } = await axiosClient.get<AgentExecution[]>('/command-center/executions', { params });
    return data;
  },

  async getConversationStats(conversationId: string): Promise<ConversationStats> {
    const { data } = await axiosClient.get<ConversationStats>(`/command-center/conversations/${conversationId}/stats`);
    return data;
  },
};
