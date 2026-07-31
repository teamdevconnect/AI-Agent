import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contact, ContactDocument } from './schemas/contact.schema';
import { Deal, DealDocument } from './schemas/deal.schema';
import { UsersService } from '../users/users.service';
import { SalesAnalyticsService } from './sales-analytics.service';
import { DealPerformanceOverviewQueryDto } from './dto/deal-performance-overview-query.dto';
import { buildDealMatchStage } from './deal-filter.util';

const SALES_ROLES = new Set(['manager', 'consultant']);
const PRODUCT_BREAKDOWN_CAP = 8;

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

function lastNPeriods(n: number): string[] {
  const periods: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return periods;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

interface StatusCountValue {
  _id: string;
  count: number;
  value: number;
}

export interface Breakdown {
  totalCount: number;
  taggedCount: number;
  coveragePct: number;
  breakdown: { key: string; count: number; value: number; wonCount?: number }[];
}

@Injectable()
export class DealPerformanceDashboardService {
  constructor(
    @InjectModel(Deal.name) private dealModel: Model<DealDocument>,
    @InjectModel(Contact.name) private contactModel: Model<ContactDocument>,
    private usersService: UsersService,
    private salesAnalyticsService: SalesAnalyticsService,
  ) {}

  async getOverview(organizationId: string, filters: DealPerformanceOverviewQueryDto, storeConstraint?: string) {
    const months = filters.months ?? 6;
    const match = buildDealMatchStage(organizationId, filters, storeConstraint);
    const matchNoDate = buildDealMatchStage(organizationId, filters, storeConstraint, { includeDateRange: false });

    // Achievement/revenueProgress need a single scope — derived from the
    // caller's store constraint (manager) or an unambiguous single-store
    // filter (owner/admin narrowing to one store); anything broader falls
    // back to the org-wide target, never a client-supplied scope.
    const scopeStoreId = storeConstraint ?? (filters.storeId?.length === 1 ? filters.storeId[0] : undefined);
    const scope: 'org' | 'store' = scopeStoreId ? 'store' : 'org';

    const [
      summaryRows,
      wonLostRows,
      pipelineRows,
      untaggedStageCount,
      funnelRows,
      achievement,
      revenueProgress,
      consultantPerformance,
      leadSourcePerformance,
      productPerformance,
      geographicDistribution,
      customerAcquisitionTrend,
    ] = await Promise.all([
      this.dealModel
        .aggregate<StatusCountValue>([
          { $match: match },
          { $group: { _id: '$dealStatus', count: { $sum: 1 }, value: { $sum: '$monetaryValue' } } },
        ])
        .exec(),
      this.getWonLostTrend(matchNoDate, months),
      this.dealModel
        .aggregate<StatusCountValue>([
          { $match: { ...matchNoDate, dealStatus: 'open', stageId: { $exists: true, $nin: [null, ''] } } },
          { $group: { _id: '$stageId', count: { $sum: 1 }, value: { $sum: '$monetaryValue' } } },
          { $sort: { count: -1 } },
        ])
        .exec(),
      this.dealModel
        .countDocuments({ ...matchNoDate, dealStatus: 'open', $or: [{ stageId: { $exists: false } }, { stageId: null }, { stageId: '' }] })
        .exec(),
      this.dealModel
        .aggregate<{ _id: string; count: number }>([
          { $match: { ...match, stageId: { $exists: true, $nin: [null, ''] } } },
          { $group: { _id: '$stageId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .exec(),
      this.salesAnalyticsService.getAchievement(organizationId, scope, scopeStoreId, currentPeriod()),
      this.getRevenueProgress(organizationId, scope, scopeStoreId, Math.min(months, 6)),
      this.getConsultantPerformance(organizationId, match, storeConstraint, filters.storeId),
      this.getBreakdown(match, 'leadSource'),
      this.getBreakdown(match, 'product', PRODUCT_BREAKDOWN_CAP),
      this.getBreakdown(match, 'region'),
      this.getCustomerAcquisitionTrend(organizationId, storeConstraint ?? filters.storeId?.[0], months),
    ]);

    const byStatus = new Map(summaryRows.map((r) => [r._id, r]));
    const wonCount = byStatus.get('won')?.count ?? 0;
    const lostCount = byStatus.get('lost')?.count ?? 0;
    const openCount = byStatus.get('open')?.count ?? 0;
    const wonValue = byStatus.get('won')?.value ?? 0;
    const lostValue = byStatus.get('lost')?.value ?? 0;
    const openValue = byStatus.get('open')?.value ?? 0;
    const totalDeals = wonCount + lostCount + openCount;

    return {
      filtersApplied: filters,
      summary: {
        totalDeals,
        wonCount,
        lostCount,
        openCount,
        wonValue,
        lostValue,
        openValue,
        // Matches business-dashboard.service.ts's existing Manager Overview
        // definition (won ÷ all deals incl. open) so the same metric label
        // never means two different things across dashboards.
        conversionRate: totalDeals > 0 ? round1((wonCount / totalDeals) * 100) : null,
        winRate: wonCount + lostCount > 0 ? round1((wonCount / (wonCount + lostCount)) * 100) : null,
        avgWonDealSize: wonCount > 0 ? Math.round((wonValue / wonCount) * 100) / 100 : null,
      },
      wonLostTrend: wonLostRows,
      pipelineByStage: pipelineRows.map((r) => ({ stageId: r._id, count: r.count, value: r.value })),
      untaggedStageCount,
      achievement,
      revenueProgress,
      conversionFunnel: funnelRows.map((r) => ({ stageId: r._id, count: r.count })),
      conversionFunnelNote:
        'Approximate — ordered by current deal volume per stage; this CRM has no confirmed stage sequence yet.',
      consultantPerformance,
      leadSourcePerformance,
      productPerformance,
      geographicDistribution,
      customerAcquisitionTrend,
    };
  }

  private async getWonLostTrend(matchNoDate: Record<string, unknown>, months: number) {
    const periods = lastNPeriods(months);
    const rows = await this.dealModel
      .aggregate<{ _id: { period: string; status: string }; count: number; value: number }>([
        {
          $match: {
            ...matchNoDate,
            dealStatus: { $in: ['won', 'lost'] },
            expectedClosingDate: { $gte: `${periods[0]}-01`, $lte: `${periods[periods.length - 1]}-31` },
          },
        },
        {
          $group: {
            _id: { period: { $substrCP: ['$expectedClosingDate', 0, 7] }, status: '$dealStatus' },
            count: { $sum: 1 },
            value: { $sum: '$monetaryValue' },
          },
        },
      ])
      .exec();

    const byPeriod = new Map(periods.map((p) => [p, { wonCount: 0, wonValue: 0, lostCount: 0, lostValue: 0 }]));
    for (const r of rows) {
      const bucket = byPeriod.get(r._id.period);
      if (!bucket) continue;
      if (r._id.status === 'won') {
        bucket.wonCount = r.count;
        bucket.wonValue = r.value;
      } else {
        bucket.lostCount = r.count;
        bucket.lostValue = r.value;
      }
    }
    return periods.map((period) => ({ period, ...byPeriod.get(period)! }));
  }

  private async getRevenueProgress(organizationId: string, scope: 'org' | 'store', scopeId: string | undefined, months: number) {
    const periods = lastNPeriods(months);
    return Promise.all(
      periods.map(async (period) => {
        const a = await this.salesAnalyticsService.getAchievement(organizationId, scope, scopeId, period);
        return { period, achieved: a.achieved, targetAmount: a.targetAmount, achievementPct: a.achievementPct };
      }),
    );
  }

  // Employee-driven, same "real data only" principle as
  // business-dashboard.service.ts's buildEmployeeLeaderboard: every current
  // manager/consultant in scope is listed (zero-filled if they have no
  // deals in this filter set); a revenue row whose ownerId doesn't match any
  // current employee is never rendered as a fake row.
  private async getConsultantPerformance(
    organizationId: string,
    match: Record<string, unknown>,
    storeConstraint: string | undefined,
    storeFilter: string[] | undefined,
  ) {
    const scopeStoreIds = storeConstraint ? [storeConstraint] : storeFilter;

    const [users, rows] = await Promise.all([
      this.usersService.findAll(organizationId),
      this.dealModel
        .aggregate<{ _id: { ownerId: string; status: string }; count: number; value: number }>([
          { $match: { ...match, ownerId: { $exists: true, $ne: null } } },
          { $group: { _id: { ownerId: '$ownerId', status: '$dealStatus' }, count: { $sum: 1 }, value: { $sum: '$monetaryValue' } } },
        ])
        .exec(),
    ]);

    const employees = users.filter(
      (u) => u.roles.some((r) => SALES_ROLES.has(r)) && (!scopeStoreIds?.length || (u.storeId && scopeStoreIds.includes(u.storeId))),
    );

    const byOwner = new Map<string, { wonCount: number; lostCount: number; openCount: number; wonValue: number }>();
    for (const r of rows) {
      const entry = byOwner.get(r._id.ownerId) ?? { wonCount: 0, lostCount: 0, openCount: 0, wonValue: 0 };
      if (r._id.status === 'won') {
        entry.wonCount = r.count;
        entry.wonValue = r.value;
      } else if (r._id.status === 'lost') {
        entry.lostCount = r.count;
      } else {
        entry.openCount = r.count;
      }
      byOwner.set(r._id.ownerId, entry);
    }

    return employees
      .map((u) => {
        const id = u._id.toString();
        const stats = byOwner.get(id) ?? { wonCount: 0, lostCount: 0, openCount: 0, wonValue: 0 };
        const total = stats.wonCount + stats.lostCount + stats.openCount;
        return {
          userId: id,
          userName: u.name,
          wonCount: stats.wonCount,
          lostCount: stats.lostCount,
          openCount: stats.openCount,
          wonValue: stats.wonValue,
          conversionRate: total > 0 ? round1((stats.wonCount / total) * 100) : null,
          winRate: stats.wonCount + stats.lostCount > 0 ? round1((stats.wonCount / (stats.wonCount + stats.lostCount)) * 100) : null,
          avgDealSize: stats.wonCount > 0 ? Math.round((stats.wonValue / stats.wonCount) * 100) / 100 : null,
        };
      })
      .sort((a, b) => b.wonValue - a.wonValue);
  }

  // Coverage is always surfaced alongside the breakdown (taggedCount vs.
  // totalCount) — these dimensions are manual-entry-only (see deal.schema.ts
  // Phase 9a comment), so most orgs will start with low/zero coverage. That's
  // an honest starting state, not a bug, and must never be silently implied
  // as "100% of deals."
  private async getBreakdown(match: Record<string, unknown>, field: 'leadSource' | 'product' | 'region', cap?: number): Promise<Breakdown> {
    const taggedMatch = { ...match, [field]: { $exists: true, $nin: [null, ''] } };
    const [totalCount, taggedCount, rows] = await Promise.all([
      this.dealModel.countDocuments(match).exec(),
      this.dealModel.countDocuments(taggedMatch).exec(),
      this.dealModel
        .aggregate<{ _id: string; count: number; value: number; wonCount: number }>([
          { $match: taggedMatch },
          {
            $group: {
              _id: `$${field}`,
              count: { $sum: 1 },
              value: { $sum: '$monetaryValue' },
              wonCount: { $sum: { $cond: [{ $eq: ['$dealStatus', 'won'] }, 1, 0] } },
            },
          },
          { $sort: { count: -1 } },
        ])
        .exec(),
    ]);

    let breakdown = rows.map((r) => ({ key: r._id, count: r.count, value: r.value, wonCount: r.wonCount }));
    if (cap && breakdown.length > cap) {
      const kept = breakdown.slice(0, cap);
      const rest = breakdown.slice(cap);
      const other = rest.reduce(
        (acc, r) => ({ key: 'Other', count: acc.count + r.count, value: acc.value + r.value, wonCount: acc.wonCount + (r.wonCount ?? 0) }),
        { key: 'Other', count: 0, value: 0, wonCount: 0 },
      );
      breakdown = [...kept, other];
    }

    return {
      totalCount,
      taggedCount,
      coveragePct: totalCount > 0 ? round1((taggedCount / totalCount) * 100) : 0,
      breakdown,
    };
  }

  // Caveat, deliberately not fixed this pass: Contact has no leadSource/
  // product/customerType/region/dealStatus of its own, so this trend only
  // respects org + store scoping, not the deal-level filters above.
  private async getCustomerAcquisitionTrend(organizationId: string, storeId: string | undefined, months: number) {
    const periods = lastNPeriods(months);
    const rows = await this.contactModel
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            organizationId,
            ...(storeId ? { storeId } : {}),
            createdAt: { $gte: new Date(`${periods[0]}-01T00:00:00.000Z`) },
          },
        },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      ])
      .exec();
    const byPeriod = new Map(rows.map((r) => [r._id, r.count]));
    return periods.map((period) => ({ period, newContacts: byPeriod.get(period) ?? 0 }));
  }
}
