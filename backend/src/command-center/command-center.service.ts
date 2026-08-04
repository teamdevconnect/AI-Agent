import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AgentExecution, AgentExecutionDocument } from './schemas/agent-execution.schema';

export interface ListExecutionsFilters {
  kind?: 'llm' | 'tool';
  provider?: 'anthropic' | 'groq';
  success?: boolean;
  conversationId?: string;
  limit?: number;
}

@Injectable()
export class CommandCenterService {
  constructor(@InjectModel(AgentExecution.name) private executionModel: Model<AgentExecutionDocument>) {}

  listExecutions(organizationId: string, filters: ListExecutionsFilters) {
    const query: Record<string, unknown> = { organizationId };
    if (filters.kind) query.kind = filters.kind;
    if (filters.provider) query.provider = filters.provider;
    if (filters.success !== undefined) query.success = filters.success;
    if (filters.conversationId) query.conversationId = filters.conversationId;
    return this.executionModel
      .find(query)
      .sort({ occurredAt: -1 })
      .limit(filters.limit ?? 100)
      .exec();
  }

  async getSummary(organizationId: string, days = 7) {
    const since = new Date(Date.now() - days * 86_400_000);
    const baseMatch = { organizationId, occurredAt: { $gte: since } };

    const [totalsRows, byProviderRows, costTrendRows] = await Promise.all([
      this.executionModel
        .aggregate<{
          totalCalls: number;
          totalCost: number;
          totalInputTokens: number;
          totalOutputTokens: number;
          errorCount: number;
        }>([
          { $match: baseMatch },
          {
            $group: {
              _id: null,
              totalCalls: { $sum: 1 },
              totalCost: { $sum: { $ifNull: ['$costUsd', 0] } },
              totalInputTokens: { $sum: { $ifNull: ['$inputTokens', 0] } },
              totalOutputTokens: { $sum: { $ifNull: ['$outputTokens', 0] } },
              errorCount: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } },
            },
          },
        ])
        .exec(),
      this.executionModel
        .aggregate<{ _id: string | null; count: number; cost: number }>([
          { $match: { ...baseMatch, kind: 'llm' } },
          { $group: { _id: '$provider', count: { $sum: 1 }, cost: { $sum: { $ifNull: ['$costUsd', 0] } } } },
        ])
        .exec(),
      this.executionModel
        .aggregate<{ _id: string; cost: number; count: number }>([
          { $match: baseMatch },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt' } },
              cost: { $sum: { $ifNull: ['$costUsd', 0] } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .exec(),
    ]);

    const totals = totalsRows[0] ?? {
      totalCalls: 0,
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      errorCount: 0,
    };

    return {
      days,
      totalCalls: totals.totalCalls,
      totalCost: totals.totalCost,
      totalInputTokens: totals.totalInputTokens,
      totalOutputTokens: totals.totalOutputTokens,
      errorRatePct: totals.totalCalls > 0 ? Math.round((totals.errorCount / totals.totalCalls) * 1000) / 10 : 0,
      byProvider: byProviderRows.map((p) => ({ provider: p._id ?? 'unknown', count: p.count, cost: p.cost })),
      costTrend: costTrendRows.map((c) => ({ date: c._id, cost: c.cost, count: c.count })),
    };
  }

  async getConversationStats(organizationId: string, userId: string, conversationId: string) {
    const rows = await this.executionModel
      .aggregate<{ messages: number; tokensUsed: number; avgResponseTimeMs: number; cost: number }>([
        { $match: { organizationId, userId, conversationId, kind: 'llm' } },
        {
          $group: {
            _id: null,
            messages: { $sum: 1 },
            tokensUsed: { $sum: { $add: [{ $ifNull: ['$inputTokens', 0] }, { $ifNull: ['$outputTokens', 0] }] } },
            avgResponseTimeMs: { $avg: '$latencyMs' },
            cost: { $sum: { $ifNull: ['$costUsd', 0] } },
          },
        },
      ])
      .exec();

    const row = rows[0];
    return {
      messages: row?.messages ?? 0,
      tokensUsed: row?.tokensUsed ?? 0,
      avgResponseTimeMs: row?.avgResponseTimeMs ? Math.round(row.avgResponseTimeMs) : 0,
      cost: row?.cost ?? 0,
    };
  }
}
