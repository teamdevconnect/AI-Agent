import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinanceDocument, FinanceDocumentDocument } from './schemas/finance-document.schema';
import { FinanceOverviewQueryDto } from './dto/finance-overview-query.dto';
import { buildFinanceMatchStage } from './finance-filter.util';

const VENDOR_BREAKDOWN_CAP = 8;
const RECENT_DOCUMENTS_LIMIT = 10;

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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

interface StatusCountValue {
  _id: string;
  count: number;
  value: number;
}

export interface Breakdown {
  totalCount: number;
  taggedCount: number;
  coveragePct: number;
  breakdown: { key: string; count: number; value: number }[];
}

@Injectable()
export class FinanceDashboardService {
  constructor(@InjectModel(FinanceDocument.name) private documentModel: Model<FinanceDocumentDocument>) {}

  async getOverview(organizationId: string, filters: FinanceOverviewQueryDto) {
    const months = filters.months ?? 6;
    const upcomingDueDays = filters.upcomingDueDays ?? 30;
    const match = buildFinanceMatchStage(organizationId, filters);
    const matchNoDate = buildFinanceMatchStage(organizationId, filters, { includeDateRange: false });

    const [
      statusRows,
      pendingPayments,
      upcomingDuePayments,
      monthlyExpenseTrend,
      vendorSpending,
      categorySpending,
      microsoftSubscriptionCosts,
      deliveryShippingCosts,
      taxBreakdown,
      paymentMethodBreakdown,
      recentDocuments,
      reviewQueueCount,
    ] = await Promise.all([
      this.documentModel
        .aggregate<StatusCountValue>([
          { $match: match },
          { $group: { _id: '$paymentStatus', count: { $sum: 1 }, value: { $sum: '$paymentAmount' } } },
        ])
        .exec(),
      // Pending Payments: awaiting settlement (pending or overdue), matches the filtered scope.
      this.documentModel
        .aggregate<{ _id: null; count: number; value: number }>([
          { $match: { ...match, paymentStatus: { $in: ['pending', 'overdue'] } } },
          { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$paymentAmount' } } },
        ])
        .exec()
        // $group always returns an `_id` field (here always null, the
        // grouping key) alongside count/value — stripped explicitly so it
        // never leaks into the API response.
        .then((rows) => (rows[0] ? { count: rows[0].count, value: rows[0].value } : { count: 0, value: 0 })),
      // Upcoming Due Payments: computed live from dueDate vs. today, not
      // trusted from a possibly-stale stored paymentStatus (see Phase 10a
      // plan notes) — excludes the date-range filter since this window is
      // independently defined by upcomingDueDays.
      this.documentModel
        .aggregate<{ _id: null; count: number; value: number }>([
          {
            $match: {
              ...matchNoDate,
              paymentStatus: { $ne: 'paid' },
              dueDate: { $gte: todayStamp(), $lte: daysFromNow(upcomingDueDays) },
            },
          },
          { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$paymentAmount' } } },
        ])
        .exec()
        .then((rows) => (rows[0] ? { count: rows[0].count, value: rows[0].value } : { count: 0, value: 0 })),
      this.getMonthlyExpenseTrend(matchNoDate, months),
      this.getBreakdown(match, 'vendorName', VENDOR_BREAKDOWN_CAP),
      this.getBreakdown(match, 'expenseCategory'),
      this.getSubscriptionCosts(match),
      this.documentModel
        .aggregate<{ _id: null; count: number; value: number }>([
          { $match: match },
          { $group: { _id: null, count: { $sum: { $cond: [{ $gt: ['$deliveryCharges', 0] }, 1, 0] } }, value: { $sum: '$deliveryCharges' } } },
        ])
        .exec()
        .then((rows) => (rows[0] ? { count: rows[0].count, value: rows[0].value } : { count: 0, value: 0 })),
      this.getTaxBreakdown(match),
      this.getBreakdown(match, 'paymentMethod'),
      this.documentModel.find(match).sort({ createdAt: -1 }).limit(RECENT_DOCUMENTS_LIMIT).exec(),
      this.documentModel.countDocuments({ ...match, reviewStatus: 'needs_review' }).exec(),
    ]);

    const byStatus = new Map(statusRows.map((r) => [r._id, r]));
    const paidCount = byStatus.get('paid')?.count ?? 0;
    const paidValue = byStatus.get('paid')?.value ?? 0;
    const partiallyPaidValue = byStatus.get('partially_paid')?.value ?? 0;
    const partiallyPaidCount = byStatus.get('partially_paid')?.count ?? 0;
    const allCount = statusRows.reduce((sum, r) => sum + r.count, 0);
    const allValue = statusRows.reduce((sum, r) => sum + r.value, 0);

    return {
      period: currentPeriod(),
      filtersApplied: filters,
      summary: {
        // Total value of every vendor payment document in scope, any status.
        totalVendorPayments: { count: allCount, value: allValue },
        // Money that has actually left the business (paid + partially paid)
        // — a genuinely different number from the raw total above.
        totalExpenses: { count: paidCount + partiallyPaidCount, value: paidValue + partiallyPaidValue },
        paymentsMade: { count: paidCount, value: paidValue },
        pendingPayments,
        upcomingDuePayments,
      },
      monthlyExpenseTrend,
      vendorSpending,
      categorySpending,
      microsoftSubscriptionCosts,
      deliveryShippingCosts,
      taxBreakdown,
      paymentMethodBreakdown,
      recentDocuments,
      reviewQueueCount,
      aiInsight: this.buildFinanceInsight(byStatus.get('overdue')?.count ?? 0, upcomingDuePayments.count, reviewQueueCount),
    };
  }

  private async getMonthlyExpenseTrend(matchNoDate: Record<string, unknown>, months: number) {
    const periods = lastNPeriods(months);
    const rows = await this.documentModel
      .aggregate<{ _id: string; amount: number }>([
        {
          $match: {
            ...matchNoDate,
            invoiceDate: { $gte: `${periods[0]}-01`, $lte: `${periods[periods.length - 1]}-31` },
          },
        },
        { $group: { _id: { $substrCP: ['$invoiceDate', 0, 7] }, amount: { $sum: '$paymentAmount' } } },
      ])
      .exec();
    const byPeriod = new Map(rows.map((r) => [r._id, r.amount]));
    return periods.map((period) => ({ period, amount: byPeriod.get(period) ?? 0 }));
  }

  // Reused for Vendor-wise Spending, Category-wise Spending, Payment Method
  // Breakdown — coverage always surfaced (taggedCount vs. totalCount), never
  // implying 100% coverage for these manual/AI-tagged dimensions. Same
  // pattern as crm/deal-performance-dashboard.service.ts's getBreakdown.
  private async getBreakdown(match: Record<string, unknown>, field: 'vendorName' | 'expenseCategory' | 'paymentMethod', cap?: number): Promise<Breakdown> {
    const taggedMatch = { ...match, [field]: { $exists: true, $nin: [null, ''] } };
    const [totalCount, taggedCount, rows] = await Promise.all([
      this.documentModel.countDocuments(match).exec(),
      this.documentModel.countDocuments(taggedMatch).exec(),
      this.documentModel
        .aggregate<{ _id: string; count: number; value: number }>([
          { $match: taggedMatch },
          { $group: { _id: `$${field}`, count: { $sum: 1 }, value: { $sum: '$paymentAmount' } } },
          { $sort: { value: -1 } },
        ])
        .exec(),
    ]);

    let breakdown = rows.map((r) => ({ key: r._id, count: r.count, value: r.value }));
    if (cap && breakdown.length > cap) {
      const kept = breakdown.slice(0, cap);
      const rest = breakdown.slice(cap);
      const other = rest.reduce((acc, r) => ({ key: 'Other', count: acc.count + r.count, value: acc.value + r.value }), {
        key: 'Other',
        count: 0,
        value: 0,
      });
      breakdown = [...kept, other];
    }

    return {
      totalCount,
      taggedCount,
      coveragePct: totalCount > 0 ? Math.round((taggedCount / totalCount) * 1000) / 10 : 0,
      breakdown,
    };
  }

  private async getSubscriptionCosts(match: Record<string, unknown>) {
    const subscriptionMatch = { ...match, isSubscriptionPayment: true };
    const [summary, providerBreakdown] = await Promise.all([
      this.documentModel
        .aggregate<{ count: number; value: number }>([
          { $match: subscriptionMatch },
          { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$subscriptionCharges' } } },
        ])
        .exec()
        .then((rows) => rows[0] ?? { count: 0, value: 0 }),
      this.documentModel
        .aggregate<{ _id: string; count: number; value: number }>([
          { $match: { ...subscriptionMatch, subscriptionProvider: { $exists: true, $nin: [null, ''] } } },
          { $group: { _id: '$subscriptionProvider', count: { $sum: 1 }, value: { $sum: '$subscriptionCharges' } } },
          { $sort: { value: -1 } },
        ])
        .exec(),
    ]);

    // Microsoft-specific slice of the subscription breakdown, matched
    // case-insensitively against the free-text provider name (azure/365/m365
    // are all Microsoft products a rep might type differently).
    const microsoftRows = providerBreakdown.filter((r) => /microsoft|azure|365|m365/i.test(r._id));
    const microsoftTotal = microsoftRows.reduce((sum, r) => sum + r.value, 0);
    const microsoftCount = microsoftRows.reduce((sum, r) => sum + r.count, 0);

    return {
      totalCount: summary.count,
      totalAmount: summary.value,
      microsoftCount,
      microsoftAmount: microsoftTotal,
      breakdown: providerBreakdown.map((r) => ({ key: r._id, count: r.count, value: r.value })),
    };
  }

  private async getTaxBreakdown(match: Record<string, unknown>): Promise<Breakdown> {
    const totalCount = await this.documentModel.countDocuments(match).exec();
    const rows = await this.documentModel
      .aggregate<{ gst: number; vat: number; other: number; taggedCount: number }>([
        { $match: match },
        {
          $group: {
            _id: null,
            gst: { $sum: { $ifNull: ['$taxDetails.gstAmount', 0] } },
            vat: { $sum: { $ifNull: ['$taxDetails.vatAmount', 0] } },
            other: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: [{ $ifNull: ['$taxDetails.gstAmount', 0] }, 0] }, { $eq: [{ $ifNull: ['$taxDetails.vatAmount', 0] }, 0] }] },
                  { $ifNull: ['$taxAmount', 0] },
                  0,
                ],
              },
            },
            taggedCount: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$taxAmount', 0] }, 0] }, 1, 0] } },
          },
        },
      ])
      .exec();
    const totals = rows[0] ?? { gst: 0, vat: 0, other: 0, taggedCount: 0 };
    const breakdown = [
      { key: 'GST', count: 0, value: totals.gst },
      { key: 'VAT', count: 0, value: totals.vat },
      { key: 'Other', count: 0, value: totals.other },
    ].filter((b) => b.value > 0);

    return {
      totalCount,
      taggedCount: totals.taggedCount,
      coveragePct: totalCount > 0 ? Math.round((totals.taggedCount / totalCount) * 1000) / 10 : 0,
      breakdown,
    };
  }

  // Deterministic, rule-based text from numbers already computed — not an
  // LLM call on a dashboard endpoint that may poll every 60s. The one
  // confirmed house convention for "AI insight" text everywhere in this app
  // (business-dashboard.service.ts's buildOwnerInsight, deal-performance's
  // aiInsight). A genuine on-demand LLM summary is Phase 10b's job.
  private buildFinanceInsight(overdueCount: number, upcomingDueCount: number, reviewQueueCount: number): string {
    if (overdueCount > 0) return `${overdueCount} payment(s) are overdue and need attention.`;
    if (upcomingDueCount > 0) return `${upcomingDueCount} payment(s) are due in the coming period.`;
    if (reviewQueueCount > 0) return `${reviewQueueCount} document(s) are awaiting review.`;
    return 'No overdue or upcoming payments — finances are on track.';
  }
}
