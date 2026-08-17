import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AgentExecution, AgentExecutionDocument } from '../command-center/schemas/agent-execution.schema';
import { CommandCenterService } from '../command-center/command-center.service';
import { Organization, OrganizationDocument } from '../organizations/schemas/organization.schema';
import { PricingService } from './pricing.service';
import { PaymentRecord, PaymentRecordDocument } from './schemas/payment-record.schema';
import { WalletTransaction, WalletTransactionDocument } from './schemas/wallet-transaction.schema';

export interface AdminOverview {
  days: number;
  revenueUsd: number;
  providerCostUsd: number;
  grossProfitUsd: number;
  realizedMarginPct: number;
  creditsSold: number;
  creditsUsed: number;
  totalAiRequests: number;
}

/**
 * Haive-internal-only aggregation — everything here is gated by
 * @Roles('platform_admin') in billing-admin.controller.ts and must never be
 * reachable through a customer-facing route. Joins WalletTransaction +
 * PaymentRecord against agent_executions at query time; nothing here is
 * denormalized back onto agent_executions itself.
 */
@Injectable()
export class BillingAdminService {
  constructor(
    @InjectModel(WalletTransaction.name) private transactionModel: Model<WalletTransactionDocument>,
    @InjectModel(PaymentRecord.name) private paymentRecordModel: Model<PaymentRecordDocument>,
    @InjectModel(AgentExecution.name) private executionModel: Model<AgentExecutionDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    private commandCenter: CommandCenterService,
    private pricing: PricingService,
    private config: ConfigService,
  ) {}

  async getOverview(days = 30): Promise<AdminOverview> {
    const since = new Date(Date.now() - days * 86_400_000);

    const [revenueRows, costRows] = await Promise.all([
      this.transactionModel
        .aggregate<{ credits: number }>([
          { $match: { type: { $in: ['PURCHASE', 'AUTO_RECHARGE'] }, createdAt: { $gte: since } } },
          { $group: { _id: null, credits: { $sum: '$amountCredits' } } },
        ])
        .exec(),
      this.executionModel
        .aggregate<{ costUsd: number; count: number }>([
          { $match: { kind: 'llm', occurredAt: { $gte: since } } },
          { $group: { _id: null, costUsd: { $sum: { $ifNull: ['$costUsd', 0] } }, count: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    const usageRows = await this.transactionModel
      .aggregate<{ credits: number }>([
        { $match: { type: 'AI_USAGE', createdAt: { $gte: since } } },
        { $group: { _id: null, credits: { $sum: { $abs: '$amountCredits' } } } },
      ])
      .exec();

    const creditsSold = revenueRows[0]?.credits ?? 0;
    const creditsUsed = usageRows[0]?.credits ?? 0;
    const revenueUsd = this.pricing.creditsToUsd(creditsSold);
    const providerCostUsd = costRows[0]?.costUsd ?? 0;
    const grossProfitUsd = revenueUsd - providerCostUsd;
    const realizedMarginPct = revenueUsd > 0 ? Math.round((grossProfitUsd / revenueUsd) * 1000) / 10 : 0;

    return {
      days,
      revenueUsd,
      providerCostUsd,
      grossProfitUsd,
      realizedMarginPct,
      creditsSold,
      creditsUsed,
      totalAiRequests: costRows[0]?.count ?? 0,
    };
  }

  /** Per-org breakdown — reuses CommandCenterService.getSummary() for the
   * provider-cost side rather than re-deriving that aggregation. */
  async getOrganizationBreakdown(days = 30) {
    const orgs = await this.orgModel.find({}, { name: 1, slug: 1 }).exec();
    const results = await Promise.all(
      orgs.map(async (org) => {
        const organizationId = org._id.toString();
        const [summary, revenueRows] = await Promise.all([
          this.commandCenter.getSummary(organizationId, days),
          this.transactionModel
            .aggregate<{ credits: number }>([
              {
                $match: {
                  organizationId,
                  type: { $in: ['PURCHASE', 'AUTO_RECHARGE'] },
                  createdAt: { $gte: new Date(Date.now() - days * 86_400_000) },
                },
              },
              { $group: { _id: null, credits: { $sum: '$amountCredits' } } },
            ])
            .exec(),
        ]);
        const revenueUsd = this.pricing.creditsToUsd(revenueRows[0]?.credits ?? 0);
        const providerCostUsd = summary.totalCost;
        return {
          organizationId,
          name: org.name,
          slug: org.slug,
          revenueUsd,
          providerCostUsd,
          grossProfitUsd: revenueUsd - providerCostUsd,
          totalRequests: summary.totalCalls,
        };
      }),
    );
    return results;
  }

  listTransactions(filters: { organizationId?: string; type?: string; limit?: number }) {
    const query: Record<string, unknown> = {};
    if (filters.organizationId) query.organizationId = filters.organizationId;
    if (filters.type) query.type = filters.type;
    return this.transactionModel.find(query).sort({ createdAt: -1 }).limit(filters.limit ?? 100).exec();
  }

  listPayments(filters: { organizationId?: string; status?: string; limit?: number }) {
    const query: Record<string, unknown> = {};
    if (filters.organizationId) query.organizationId = filters.organizationId;
    if (filters.status) query.status = filters.status;
    return this.paymentRecordModel.find(query).sort({ createdAt: -1 }).limit(filters.limit ?? 100).exec();
  }
}
