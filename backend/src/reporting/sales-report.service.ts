import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Deal, DealDocument } from '../crm/schemas/deal.schema';
import { Quote, QuoteDocument } from '../crm/schemas/quote.schema';
import { UsersService } from '../users/users.service';

export interface SalesReportGroupRow {
  groupKey: string;
  groupLabel: string;
  totalSalesExTax: number;
  percentOfSales: number;
}

export interface SalesReportSummary {
  dateFrom: string;
  dateTo: string;
  groupBy: 'customer' | 'user' | 'quoteOwner';
  totalSalesForPeriod: number;
  groups: SalesReportGroupRow[];
  dataSourceNote: string;
}

// Mirrors the reference product's "Sales Report" (grouped Total Sales +
// % of Sales by Customer/User/Quote Owner) — built on the exact same
// won-deal revenue this app already computes everywhere else (see
// SalesAnalyticsService.getAchievement(), RoyaltyReportService), never a
// second, independently-defined "sales" figure. No Decoration-vs-Product
// split (the reference shows one) — this app has no per-line-item product/
// decoration cost breakdown anywhere, so that split isn't shown rather than
// fabricated; "Total Sales for Period" is the one real, honest figure.
// "(Ex Tax)" in every label matches the reference's own terminology, not a
// literal tax subtraction — Deal has no tax field to subtract (unlike
// Invoice, which does — see RoyaltyReportService's own exTaxValue).
@Injectable()
export class SalesReportService {
  constructor(
    @InjectModel(Deal.name) private dealModel: Model<DealDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    private usersService: UsersService,
  ) {}

  async generate(
    organizationId: string,
    dateFrom: string,
    dateTo: string,
    groupBy: 'customer' | 'user' | 'quoteOwner',
    storeConstraint?: string,
  ): Promise<SalesReportSummary> {
    const dealMatch: Record<string, unknown> = {
      organizationId,
      dealStatus: 'won',
      expectedClosingDate: { $gte: dateFrom, $lte: dateTo },
      ...(storeConstraint ? { storeId: storeConstraint } : {}),
    };
    const deals = await this.dealModel.find(dealMatch).exec();
    const totalSalesForPeriod = round2(deals.reduce((sum, d) => sum + d.monetaryValue, 0));

    let groups: SalesReportGroupRow[];
    if (groupBy === 'user') {
      const users = await this.usersService.findAll(organizationId);
      const nameById = new Map(users.map((u) => [u._id.toString(), u.name]));
      groups = this.groupByKey(deals, totalSalesForPeriod, (d) => d.ownerId ?? '__unassigned__', (key) =>
        key === '__unassigned__' ? 'Unassigned' : (nameById.get(key) ?? 'Unknown user'),
      );
    } else if (groupBy === 'quoteOwner') {
      const quoteOwnerByDealId = await this.resolveQuoteField(organizationId, deals, (q) => q.quoteOwner);
      const ownerIds = [...new Set([...quoteOwnerByDealId.values()])];
      const users = ownerIds.length ? await this.usersService.findAll(organizationId) : [];
      const nameById = new Map(users.map((u) => [u._id.toString(), u.name]));
      groups = this.groupByKey(
        deals,
        totalSalesForPeriod,
        (d) => quoteOwnerByDealId.get(d._id.toString()) ?? '__none__',
        (key) => (key === '__none__' ? 'No Quote Owner' : (nameById.get(key) ?? key)),
      );
    } else {
      const customerByDealId = await this.resolveQuoteField(organizationId, deals, (q) => q.clientDetails?.companyName);
      groups = this.groupByKey(
        deals,
        totalSalesForPeriod,
        (d) => customerByDealId.get(d._id.toString()) ?? d.name,
        (key) => key,
      );
    }

    const baseNote =
      'Computed from won-deal revenue for this period. This system has no per-line-item product/decoration cost breakdown, so — unlike the reference report — only one combined "Total Sales" figure is shown, not a Product/Decoration split.';
    // Real, confirmed-live limitation, not guessed: Quote.quoteOwner stores
    // the external CRM's own raw owner id (its "name" was never captured at
    // sync time — see crm_mongo_sync.py), which doesn't match any native
    // User._id. Grouping by it can only show that raw id, not a resolved
    // name, for externally-synced quotes — flagged here rather than
    // silently showing an unlabeled id with no explanation.
    const quoteOwnerCaveat =
      ' Note: "Quote Owner" groups by the value stored on each quote — for quotes synced from the external CRM this is that system\'s own raw owner id, which may not resolve to a name here.';

    return {
      dateFrom,
      dateTo,
      groupBy,
      totalSalesForPeriod,
      groups,
      dataSourceNote: groupBy === 'quoteOwner' ? baseNote + quoteOwnerCaveat : baseNote,
    };
  }

  // Resolves one field off each deal's latest linked Quote (customer name,
  // quote owner id) in a single batch query — not N+1.
  private async resolveQuoteField(
    organizationId: string,
    deals: DealDocument[],
    pick: (q: QuoteDocument) => string | undefined,
  ): Promise<Map<string, string>> {
    const dealIds = deals.map((d) => d._id.toString());
    if (!dealIds.length) return new Map();
    const quotes = await this.quoteModel
      .find({ organizationId, dealId: { $in: dealIds } })
      .sort({ createdAt: -1 })
      .exec();
    const map = new Map<string, string>();
    for (const q of quotes) {
      if (!q.dealId || map.has(q.dealId)) continue;
      const value = pick(q);
      if (value) map.set(q.dealId, value);
    }
    return map;
  }

  private groupByKey(
    deals: DealDocument[],
    totalSalesForPeriod: number,
    keyFn: (d: DealDocument) => string,
    labelFn: (key: string) => string,
  ): SalesReportGroupRow[] {
    const sums = new Map<string, number>();
    for (const d of deals) {
      const key = keyFn(d);
      sums.set(key, (sums.get(key) ?? 0) + d.monetaryValue);
    }
    const rows = [...sums.entries()].map(([key, value]) => ({
      groupKey: key,
      groupLabel: labelFn(key),
      totalSalesExTax: round2(value),
      percentOfSales: totalSalesForPeriod > 0 ? Math.round((value / totalSalesForPeriod) * 1000) / 10 : 0,
    }));
    rows.sort((a, b) => b.totalSalesExTax - a.totalSalesExTax);
    return rows;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
