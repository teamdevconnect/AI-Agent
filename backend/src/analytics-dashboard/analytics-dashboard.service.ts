import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { currentPeriod, periodToDateRange } from '../common/period.util';
import { CustomerActivityService } from '../crm/customer-activity.service';
import { DealPerformanceDashboardService } from '../crm/deal-performance-dashboard.service';
import { Deal, DealDocument } from '../crm/schemas/deal.schema';
import { Quote, QuoteDocument } from '../crm/schemas/quote.schema';
import { SalesAnalyticsService } from '../crm/sales-analytics.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { EmailIntelligenceService } from '../email-intelligence/email-intelligence.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { AnalyticsDashboardOverview, ScopeInfo } from './analytics-dashboard.types';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Phase 19 — Unified Analytics Dashboard. A hybrid aggregator matching
// business-dashboard.service.ts's own precedent: reuse sibling services
// where a correct implementation already exists (achievement/forecast,
// consultant performance, revenue trend), inject Deal/Quote models directly
// only for the two genuinely new groupby queries (deal split, quote
// acceptance) that don't belong in any existing service.
@Injectable()
export class AnalyticsDashboardService {
  constructor(
    @InjectModel(Deal.name) private dealModel: Model<DealDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    private salesAnalyticsService: SalesAnalyticsService,
    private dealPerformanceDashboardService: DealPerformanceDashboardService,
    private customerActivityService: CustomerActivityService,
    private emailIntelligenceService: EmailIntelligenceService,
    private dashboardService: DashboardService,
    private organizationsService: OrganizationsService,
  ) {}

  async getOverview(caller: JwtPayload, scope: ScopeInfo, period: string = currentPeriod()): Promise<AnalyticsDashboardOverview> {
    const organizationId = caller.organizationId;
    const scopeId = scope.level === 'store' ? scope.storeId : scope.level === 'user' ? scope.userId : undefined;

    // Real user-reported bug, fixed here: this used to filter deals by
    // expectedClosingDate (a forecast concept — "when will this revenue
    // land") for widgets 2/4/5/7 (deal split, leaderboard, work breakdown,
    // won/lost bar) — but those widgets are about "what did I create/work
    // on this period," not "what's forecast to close this period." A deal
    // created today with an expectedClosingDate next month was invisible to
    // "this month" filtering, which reads as broken, not as intended
    // forecast behavior. Fixed by matching createdAt instead, same field
    // Quote's own acceptance widget already correctly uses below — never
    // expectedClosingDate for "did I touch this record this period" framing.
    // achievement/revenueTrend (widgets 3/8) deliberately keep using
    // SalesAnalyticsService's existing expectedClosingDate-based target/
    // forecast math below, unchanged — that's a genuinely different
    // question ("revenue expected to land this month against target"),
    // pre-existing, established business logic this fix does not touch.
    const { start, end } = periodToDateRange(period);
    const dealMatch: Record<string, unknown> = {
      organizationId,
      createdAt: { $gte: start, $lt: end },
      ...(scope.level === 'store' && scope.storeId ? { storeId: scope.storeId } : {}),
      ...(scope.level === 'user' && scope.userId ? { ownerId: scope.userId } : {}),
    };
    const quoteDateMatch: Record<string, unknown> = { organizationId, createdAt: { $gte: start, $lt: end } };
    // Quote has no storeId/ownerId of its own — scope via the linked Deal's
    // own storeId/ownerId, same join-through-deals approach
    // quotes.service.ts's listFiltered uses. This resolution is deliberately
    // separate from dealMatch above (both are now createdAt-scoped, but
    // independently — a quote's linked deal can legitimately belong to this
    // store/owner even if that deal itself was created outside this period,
    // so scoping must not reuse the period-filtered deal set).
    if (scope.level === 'store' || scope.level === 'user') {
      const scopeDealMatch: Record<string, unknown> = {
        organizationId,
        ...(scope.level === 'store' && scope.storeId ? { storeId: scope.storeId } : {}),
        ...(scope.level === 'user' && scope.userId ? { ownerId: scope.userId } : {}),
      };
      const scopedDeals = await this.dealModel.find(scopeDealMatch).select({ _id: 1 }).exec();
      quoteDateMatch.dealId = { $in: scopedDeals.map((d) => d._id.toString()) };
    }

    const [
      dealRows,
      quoteRows,
      achievement,
      workforceOverview,
      consultantRows,
      revenueTrend,
      emailStats,
      customerBreakdown,
      storeName,
    ] = await Promise.all([
      this.dealModel
        .aggregate<{ _id: string; count: number; value: number }>([
          { $match: dealMatch },
          { $group: { _id: '$dealStatus', count: { $sum: 1 }, value: { $sum: '$monetaryValue' } } },
        ])
        .exec(),
      this.quoteModel
        .aggregate<{ _id: boolean; count: number; value: number }>([
          { $match: quoteDateMatch },
          { $group: { _id: { $eq: ['$clientApprovalStatus', 'approved'] }, count: { $sum: 1 }, value: { $sum: '$quoteAmount' } } },
        ])
        .exec(),
      this.salesAnalyticsService.getAchievement(organizationId, scope.level, scopeId, period),
      this.dashboardService.getOverview(caller),
      this.dealPerformanceDashboardService.getConsultantPerformance(
        organizationId,
        dealMatch,
        scope.level === 'store' ? scope.storeId : undefined,
        undefined,
      ),
      this.dealPerformanceDashboardService.getRevenueProgress(organizationId, scope.level, scopeId, 6),
      this.emailIntelligenceService.getMonthlyStats(
        organizationId,
        period,
        scope.level === 'store' ? scope.storeId : undefined,
        scope.level === 'user' ? scope.userId : undefined,
      ),
      this.customerActivityService.getMonthlyCustomerBreakdown(
        organizationId,
        period,
        scope.level === 'store' ? scope.storeId : undefined,
        scope.level === 'user' ? scope.userId : undefined,
      ),
      scope.level === 'store' && scope.storeId ? this.resolveStoreName(organizationId, scope.storeId) : Promise.resolve(undefined),
    ]);

    const byStatus = new Map(dealRows.map((r) => [r._id, r]));
    const wonCount = byStatus.get('won')?.count ?? 0;
    const lostCount = byStatus.get('lost')?.count ?? 0;
    const openCount = byStatus.get('open')?.count ?? 0;
    const wonValue = byStatus.get('won')?.value ?? 0;
    const lostValue = byStatus.get('lost')?.value ?? 0;
    const openValue = byStatus.get('open')?.value ?? 0;

    const accepted = quoteRows.find((r) => r._id === true);
    const notAccepted = quoteRows.find((r) => r._id === false);

    const overdueRatio =
      workforceOverview.stats.totalTasks > 0 ? workforceOverview.stats.overdueCount / workforceOverview.stats.totalTasks : 0;
    const achievementCapped = Math.min(achievement.achievementPct ?? 0, 100);
    // Same weighted composite as business-dashboard.service.ts's Owner
    // businessHealthScore (60% achievement, 40% follow-up health) — kept
    // identical across all three roles rather than making it owner-only;
    // dashboardService.getOverview(caller) already scopes itself down for
    // non-owner callers via chatService.listAgents' own role branching.
    const businessHealthScore = Math.round(achievementCapped * 0.6 + (1 - overdueRatio) * 100 * 0.4);

    // getConsultantPerformance always zero-fills the full roster in scope;
    // for a 'user' scope the roster isn't store-narrowed (dealMatch already
    // restricted the underlying deals to this one ownerId), so post-filter
    // to the caller's own row rather than adding a third scoping param to an
    // already-tested method.
    const scopedConsultantRows =
      scope.level === 'user' && scope.userId ? consultantRows.filter((r) => r.userId === scope.userId) : consultantRows;

    const employeeLeaderboard = scopedConsultantRows
      .map((r) => ({ userId: r.userId, userName: r.userName, revenue: r.wonValue, wonCount: r.wonCount }))
      .sort((a, b) => b.revenue - a.revenue);

    const workBreakdown = scopedConsultantRows.map((r) => ({
      userId: r.userId,
      userName: r.userName,
      wonCount: r.wonCount,
      lostCount: r.lostCount,
      openCount: r.openCount,
      conversionRate: r.conversionRate,
    }));

    return {
      period,
      scope: { level: scope.level, storeId: scope.storeId, storeName, userId: scope.userId },
      emailActivity: emailStats,
      deals: { wonCount, lostCount, openCount, wonValue, lostValue, openValue },
      revenue: { ...achievement, businessHealthScore },
      employeeLeaderboard,
      workBreakdown,
      quotes: {
        acceptedCount: accepted?.count ?? 0,
        acceptedValue: accepted?.value ?? 0,
        notAcceptedCount: notAccepted?.count ?? 0,
        notAcceptedValue: notAccepted?.value ?? 0,
      },
      revenueTrend,
      customers: customerBreakdown,
      aiInsight: this.buildInsight(achievement.achievementPct, wonCount, lostCount, openCount, emailStats.missedCount),
    };
  }

  // Deterministic, rule-based text from numbers already computed — never a
  // live LLM call on a dashboard endpoint, matching the one unbroken
  // convention every "AI Insight" in this app already follows.
  private buildInsight(
    achievementPct: number | null,
    wonCount: number,
    lostCount: number,
    openCount: number,
    missedCount: number,
  ): string {
    if (achievementPct !== null && achievementPct < 50) {
      return `Only ${round1(achievementPct)}% of this month's target achieved so far — review the open pipeline for deals that can be accelerated.`;
    }
    if (missedCount > 0) {
      return `${missedCount} email(s) have gone unanswered for over 24 hours — these are the fastest wins to catch up on.`;
    }
    if (lostCount > wonCount && lostCount > 0) {
      return `More deals were lost (${lostCount}) than won (${wonCount}) this month — worth reviewing recent lost-deal reasons for a pattern.`;
    }
    if (openCount > 0) {
      return `${openCount} deal(s) are currently open this month — keep an eye on the ones nearing their expected close date.`;
    }
    return 'Performance is on track — no urgent items flagged for this period.';
  }

  private async resolveStoreName(organizationId: string, storeId: string): Promise<string | undefined> {
    const stores = await this.organizationsService.listStores(organizationId);
    return stores.find((s) => s._id.toString() === storeId)?.name;
  }
}
