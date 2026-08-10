import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Deal, DealDocument } from '../crm/schemas/deal.schema';
import { Quote, QuoteDocument } from '../crm/schemas/quote.schema';
import { UsersService } from '../users/users.service';
import { Invoice, InvoiceDocument } from './schemas/invoice.schema';
import { RoyaltyRuleDocument } from './schemas/royalty-rule.schema';
import { RoyaltyRulesService } from './royalty-rules.service';

export interface RoyaltyReportDealLine {
  dealId: string;
  customerName: string;
  businessNameSource: 'quote_client_details' | 'deal_name';
  quoteNumber?: string;
  dealStatus: 'open' | 'won' | 'lost';
  value: number;
  closingDate?: string;
  createdDate: string;
}

export interface RoyaltyReportInvoiceLine {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  quoteNumber?: string;
  invoiceDate: string;
  createdDate: string;
  previousValue?: number;
  currentValue: number;
  exTaxValue: number;
  eligibleValue: number;
  royalty: number;
  invoiceStatus: string;
  voidStatus: boolean;
}

// "Work In Progress" here means real, still-open pipeline — quotes in the
// range that haven't (yet) been accepted, per clientApprovalStatus, the
// exact same match already backing totalNotAcceptedQuotes. Quote has no
// tax field anywhere in this codebase (native or externally synced) — `tax`
// stays null rather than a fabricated figure; quoteAmount is shown as-is
// under "Quote Total (Ex Tax)" since there's nothing to subtract from it.
export interface RoyaltyReportWipQuoteLine {
  quoteId: string;
  quoteNumber?: string;
  customerName: string;
  createdDate: string;
  quoteTotalExTax: number;
  tax: number | null;
}

export interface RoyaltyReportLineSummary {
  totalRecords: number;
  totalSalesExTax: number;
}

// "Group By" breakdown — mirrors the reference report's "Sales per
// Customer/User" grouping radios, applied to royalty due instead of raw
// sales. Built from the same won-deal lines the Executive Summary's
// grossRevenue is computed from (never a second, independently-computed
// revenue figure), with royalty applied per group at the same effective
// (sliding-tier-aware) rate used everywhere else in this service —
// deliberately pre-cap, matching every other per-line royalty figure here.
export interface RoyaltyReportGroupRow {
  groupKey: string;
  groupLabel: string;
  totalSalesExTax: number;
  percentOfSales: number;
  royaltyDue: number;
}

export interface RoyaltyReportSummary {
  dateFrom: string;
  dateTo: string;
  scope: { level: 'org' | 'store'; storeId?: string };
  royaltyRule: {
    royaltyPercentage: number;
    capType: string;
    capValue?: number;
    effectiveDate: Date;
  } | null;
  totalQuotes: number;
  totalNotAcceptedQuotes: number;
  totalDeals: number;
  totalInvoices: number;
  totalVoidInvoices: number;
  valueOfVoidedInvoices: number;
  workInProgressValue: number;
  grossRevenue: number;
  eligibleRevenue: number;
  royaltyFeeBeforeCap: number;
  totalDue: number;
  effectiveRoyaltyPct: number | null;
  adminFeeAmount: number | null;
  techFeeAmount: number | null;
  marketingFeeAmount: number | null;
  dataSourceNote: string;
  // Itemized line data for the same [dateFrom, dateTo] range — "the deal
  // data" and "the invoice data" the executive summary's counts/sums are
  // aggregated from, with customer name/quote number/invoice number
  // resolved for each row. Not row-capped: a royalty report's date range is
  // inherently bounded to what one franchise location does in a period
  // (tens of records in practice), not a large export.
  deals: RoyaltyReportDealLine[];
  dealsSummary: RoyaltyReportLineSummary;
  invoices: RoyaltyReportInvoiceLine[];
  invoicesSummary: RoyaltyReportLineSummary;
  wipQuotes: RoyaltyReportWipQuoteLine[];
  wipQuotesSummary: RoyaltyReportLineSummary;
  // Present only when a groupBy was requested.
  groupBy: 'salesperson' | 'customer' | null;
  groupedBreakdown: RoyaltyReportGroupRow[];
}

// Computes a royalty report automatically from real, already-existing CRM
// data (won-deal revenue) — the explicit alternative to requiring manual
// Invoice entry before a report can be generated. Phase 20a's InvoicesService/
// manual CRUD still exists and this report still counts/uses real Invoice
// records when they exist (via the auto-draft-from-approved-quote hook), but
// Deal revenue is the primary, always-populated source: for the real
// production org, `royalty_invoices` is empty (no quote has transitioned to
// 'approved' since that hook shipped) while `crm_deals` already has real
// won revenue across several months. Eligible Revenue therefore currently
// equals Gross Revenue (no Deal-level tax/shipping/discount breakdown
// exists to subtract) — flagged plainly via `dataSourceNote` rather than
// silently implying Invoice-level precision that isn't actually being
// applied yet.
//
// Revenue is attributed to the [dateFrom, dateTo] range the same way
// SalesAnalyticsService.getAchievement() attributes it to a period —
// against Deal.expectedClosingDate, this app's one established convention
// for "which date does this deal's revenue count toward" (see that
// method's own docstring). expectedClosingDate is a plain "YYYY-MM-DD"
// string field, not a Date — a direct $gte/$lte string comparison against
// two YYYY-MM-DD strings is correct (ISO-format strings sort lexicographically
// in the same order as their dates), matching how the rest of this app
// already treats that field. Quote/Invoice use their own real Date fields
// (createdAt/invoiceDate) directly, with dateTo pushed to end-of-day so a
// date-only value doesn't mean midnight and silently exclude that day.
@Injectable()
export class RoyaltyReportService {
  constructor(
    @InjectModel(Deal.name) private dealModel: Model<DealDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    private royaltyRulesService: RoyaltyRulesService,
    private usersService: UsersService,
  ) {}

  async generateReport(
    organizationId: string,
    dateFrom: string,
    dateTo: string,
    storeConstraint?: string,
    groupBy?: 'salesperson' | 'customer',
  ): Promise<RoyaltyReportSummary> {
    const rangeStart = new Date(dateFrom);
    const rangeEnd = new Date(new Date(dateTo).setHours(23, 59, 59, 999));

    const dealMatch: Record<string, unknown> = {
      organizationId,
      expectedClosingDate: { $gte: dateFrom, $lte: dateTo },
      ...(storeConstraint ? { storeId: storeConstraint } : {}),
    };
    const wonDealMatch = { ...dealMatch, dealStatus: 'won' };
    const openDealMatch = { ...dealMatch, dealStatus: 'open' };

    const quoteMatch: Record<string, unknown> = { organizationId, createdAt: { $gte: rangeStart, $lte: rangeEnd } };
    // Quote has no storeId of its own — store-scoping resolves through the
    // linked Deal, same "resolve scoped deal ids first, then match dealId
    // $in" approach quotes.service.ts/customer-activity.service.ts already
    // use for their own personal/store-scoped quote queries.
    if (storeConstraint) {
      const scopedDeals = await this.dealModel.find({ organizationId, storeId: storeConstraint }).select({ _id: 1 }).exec();
      quoteMatch.dealId = { $in: scopedDeals.map((d) => d._id.toString()) };
    }

    const invoiceMatch: Record<string, unknown> = {
      organizationId,
      invoiceDate: { $gte: rangeStart, $lte: rangeEnd },
      ...(storeConstraint ? { storeId: storeConstraint } : {}),
    };
    const voidInvoiceMatch = { ...invoiceMatch, voidStatus: true };

    const notAcceptedQuoteMatch = { ...quoteMatch, clientApprovalStatus: { $ne: 'approved' } };

    const [rule, grossRevenue, workInProgressValue, totalQuotes, totalDeals, totalInvoices, voidAgg, dealDocs, invoiceDocs, wipQuoteDocs] =
      await Promise.all([
        this.royaltyRulesService.getEffectiveRule(organizationId, rangeEnd),
        this.sumDealValue(wonDealMatch),
        this.sumDealValue(openDealMatch),
        this.quoteModel.countDocuments(quoteMatch).exec(),
        this.dealModel.countDocuments(dealMatch).exec(),
        this.invoiceModel.countDocuments(invoiceMatch).exec(),
        this.invoiceModel
          .aggregate<{ count: number; value: number }>([
            { $match: voidInvoiceMatch },
            { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$currentValue' } } },
          ])
          .exec()
          .then((rows) => rows[0] ?? { count: 0, value: 0 }),
        this.dealModel.find(dealMatch).sort({ expectedClosingDate: -1 }).exec(),
        this.invoiceModel.find(invoiceMatch).sort({ invoiceDate: -1 }).exec(),
        this.quoteModel.find(notAcceptedQuoteMatch).sort({ createdAt: -1 }).exec(),
      ]);
    const totalNotAcceptedQuotes = wipQuoteDocs.length;

    const { dealLines, invoiceLines } = await this.buildLineItems(organizationId, dealDocs, invoiceDocs, rule);
    const groupedBreakdown = groupBy
      ? await this.buildGroupedBreakdown(organizationId, dealDocs, dealLines, rule, groupBy)
      : [];
    const wipQuotes: RoyaltyReportWipQuoteLine[] = wipQuoteDocs.map((q) => ({
      quoteId: q._id.toString(),
      quoteNumber: q.quoteNumber,
      customerName: q.clientDetails?.companyName || q.quoteName || '—',
      createdDate: q.createdAt.toISOString().slice(0, 10),
      quoteTotalExTax: q.quoteAmount,
      tax: null,
    }));

    // No Deal-level tax/shipping/discount breakdown exists — Eligible
    // Revenue is Gross Revenue until real Invoice records (which do carry
    // that breakdown) become the majority data source for a period.
    const eligibleRevenue = grossRevenue;

    let royaltyFeeBeforeCap = 0;
    let totalDue = 0;
    let adminFeeAmount: number | null = null;
    let techFeeAmount: number | null = null;
    let marketingFeeAmount: number | null = null;

    if (rule) {
      let effectivePct = rule.royaltyPercentage;
      // Sliding scale: single-bracket (the revenue level selects one tier,
      // whose rate applies to the whole amount) — the simpler of the two
      // interpretations flagged as an open question in Phase 20a's plan;
      // not yet confirmed with the user, so flagged here too, not silently
      // assumed to be authoritative.
      if (rule.capType === 'sliding' && rule.slidingTiers.length > 0) {
        const tier = rule.slidingTiers.find(
          (t) => eligibleRevenue >= t.fromValue && (t.toValue === undefined || eligibleRevenue < t.toValue),
        );
        if (tier) effectivePct = tier.percentage;
      }
      royaltyFeeBeforeCap = round2(eligibleRevenue * (effectivePct / 100));

      totalDue = royaltyFeeBeforeCap;
      // Minimum cap = floor (MAX), Maximum cap = ceiling (MIN) — the
      // mathematically correct direction, not the spec's own literal
      // MIN(...)-for-both text (flagged as a likely spec error in Phase
      // 20a's plan, applied here as the corrected version pending explicit
      // user confirmation).
      if (rule.capType === 'min' && rule.capValue !== undefined) totalDue = Math.max(royaltyFeeBeforeCap, rule.capValue);
      if (rule.capType === 'max' && rule.capValue !== undefined) totalDue = Math.min(royaltyFeeBeforeCap, rule.capValue);

      if (rule.adminFeePercentage) adminFeeAmount = round2(eligibleRevenue * (rule.adminFeePercentage / 100));
      if (rule.techFeePercentage) techFeeAmount = round2(eligibleRevenue * (rule.techFeePercentage / 100));
      if (rule.marketingFeePercentage) marketingFeeAmount = round2(eligibleRevenue * (rule.marketingFeePercentage / 100));
    }

    return {
      dateFrom,
      dateTo,
      scope: storeConstraint ? { level: 'store', storeId: storeConstraint } : { level: 'org' },
      royaltyRule: rule
        ? {
            royaltyPercentage: rule.royaltyPercentage,
            capType: rule.capType,
            capValue: rule.capValue,
            effectiveDate: rule.effectiveDate,
          }
        : null,
      totalQuotes,
      totalNotAcceptedQuotes,
      totalDeals,
      totalInvoices,
      totalVoidInvoices: voidAgg.count,
      valueOfVoidedInvoices: voidAgg.value,
      workInProgressValue,
      grossRevenue,
      eligibleRevenue,
      royaltyFeeBeforeCap,
      totalDue,
      effectiveRoyaltyPct: eligibleRevenue > 0 ? Math.round((totalDue / eligibleRevenue) * 1000) / 10 : null,
      adminFeeAmount,
      techFeeAmount,
      marketingFeeAmount,
      dataSourceNote:
        totalInvoices > 0
          ? 'Computed from won-deal revenue plus real invoice records for this period.'
          : "Computed from won-deal revenue for this period — no invoice records exist yet for this period, so tax/shipping/discount exclusions and void tracking aren't reflected. An invoice is created automatically once a quote is marked approved.",
      deals: dealLines,
      dealsSummary: { totalRecords: dealLines.length, totalSalesExTax: round2(dealLines.reduce((s, d) => s + d.value, 0)) },
      invoices: invoiceLines,
      invoicesSummary: {
        totalRecords: invoiceLines.length,
        totalSalesExTax: round2(invoiceLines.reduce((s, i) => s + i.exTaxValue, 0)),
      },
      wipQuotes,
      wipQuotesSummary: {
        totalRecords: wipQuotes.length,
        totalSalesExTax: round2(wipQuotes.reduce((s, q) => s + q.quoteTotalExTax, 0)),
      },
      groupBy: groupBy ?? null,
      groupedBreakdown,
    };
  }

  // Groups the same won-deal lines the Executive Summary's grossRevenue is
  // built from — never a second, independently-defined revenue figure.
  // dealDocs/dealLines are the same array in the same order (dealLines is
  // mapped 1:1 from dealDocs in buildLineItems), so zipping them by index
  // is safe and avoids re-resolving customer names a second time.
  private async buildGroupedBreakdown(
    organizationId: string,
    dealDocs: DealDocument[],
    dealLines: RoyaltyReportDealLine[],
    rule: RoyaltyRuleDocument | null,
    groupBy: 'salesperson' | 'customer',
  ): Promise<RoyaltyReportGroupRow[]> {
    const wonIndexes = dealDocs.map((d, i) => (d.dealStatus === 'won' ? i : -1)).filter((i) => i >= 0);
    if (wonIndexes.length === 0) return [];

    let nameById = new Map<string, string>();
    if (groupBy === 'salesperson') {
      const users = await this.usersService.findAll(organizationId);
      nameById = new Map(users.map((u) => [u._id.toString(), u.name]));
    }

    const keyFor = (i: number): string =>
      groupBy === 'salesperson' ? (dealDocs[i].ownerId ?? '__unassigned__') : dealLines[i].customerName;
    const labelFor = (key: string): string =>
      groupBy === 'salesperson' ? (key === '__unassigned__' ? 'Unassigned' : (nameById.get(key) ?? 'Unknown user')) : key;

    const totalWonValue = wonIndexes.reduce((s, i) => s + dealDocs[i].monetaryValue, 0);
    const sums = new Map<string, number>();
    for (const i of wonIndexes) {
      const key = keyFor(i);
      sums.set(key, (sums.get(key) ?? 0) + dealDocs[i].monetaryValue);
    }

    const rows = [...sums.entries()].map(([key, value]) => {
      const { royalty } = this.computeLineEligibleAndRoyalty({ currentValue: value }, rule);
      return {
        groupKey: key,
        groupLabel: labelFor(key),
        totalSalesExTax: round2(value),
        percentOfSales: totalWonValue > 0 ? Math.round((value / totalWonValue) * 1000) / 10 : 0,
        royaltyDue: royalty,
      };
    });
    rows.sort((a, b) => b.totalSalesExTax - a.totalSalesExTax);
    return rows;
  }

  private async sumDealValue(match: Record<string, unknown>): Promise<number> {
    const rows = await this.dealModel
      .aggregate<{ total: number }>([{ $match: match }, { $group: { _id: null, total: { $sum: '$monetaryValue' } } }])
      .exec();
    return rows[0]?.total ?? 0;
  }

  // Resolves customer name / quote number for each Deal/Invoice row in one
  // batch (not N+1) — one query for Quotes linked to any of the matched
  // Deals (for Deal rows' quote number + a real customer name when
  // available), one for Quotes referenced by any of the matched Invoices'
  // quoteId (for Invoice rows' quote number + a customer-name fallback).
  private async buildLineItems(
    organizationId: string,
    dealDocs: DealDocument[],
    invoiceDocs: InvoiceDocument[],
    rule: RoyaltyRuleDocument | null,
  ): Promise<{ dealLines: RoyaltyReportDealLine[]; invoiceLines: RoyaltyReportInvoiceLine[] }> {
    const dealIds = dealDocs.map((d) => d._id.toString());
    const invoiceQuoteIds = [...new Set(invoiceDocs.map((i) => i.quoteId).filter((id): id is string => !!id))];

    const [quotesForDeals, quotesForInvoices] = await Promise.all([
      dealIds.length
        ? this.quoteModel.find({ organizationId, dealId: { $in: dealIds } }).sort({ createdAt: -1 }).exec()
        : Promise.resolve([]),
      invoiceQuoteIds.length
        ? this.quoteModel.find({ organizationId, _id: { $in: invoiceQuoteIds } }).exec()
        : Promise.resolve([]),
    ]);

    // First match per dealId wins — quotesForDeals is already sorted
    // newest-first, so a deal with several quotes shows its latest one.
    const latestQuoteByDealId = new Map<string, QuoteDocument>();
    for (const q of quotesForDeals) {
      if (q.dealId && !latestQuoteByDealId.has(q.dealId)) latestQuoteByDealId.set(q.dealId, q);
    }
    const quoteById = new Map(quotesForInvoices.map((q) => [q._id.toString(), q]));

    const dealLines: RoyaltyReportDealLine[] = dealDocs.map((d) => {
      const linkedQuote = latestQuoteByDealId.get(d._id.toString());
      const quoteCustomerName = linkedQuote?.clientDetails?.companyName;
      return {
        dealId: d._id.toString(),
        customerName: quoteCustomerName || d.name,
        businessNameSource: quoteCustomerName ? 'quote_client_details' : 'deal_name',
        quoteNumber: linkedQuote?.quoteNumber,
        dealStatus: d.dealStatus,
        value: d.monetaryValue,
        closingDate: d.expectedClosingDate,
        createdDate: d.createdAt.toISOString().slice(0, 10),
      };
    });

    const invoiceLines: RoyaltyReportInvoiceLine[] = invoiceDocs.map((inv) => {
      const linkedQuote = inv.quoteId ? quoteById.get(inv.quoteId) : undefined;
      const { eligibleValue, royalty } = this.computeLineEligibleAndRoyalty(inv, rule);
      return {
        invoiceId: inv._id.toString(),
        invoiceNumber: inv.invoiceNumber,
        customerName:
          inv.clientDetails?.companyName || inv.clientDetails?.contactName || linkedQuote?.clientDetails?.companyName || '—',
        quoteNumber: linkedQuote?.quoteNumber,
        invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
        createdDate: inv.createdAt.toISOString().slice(0, 10),
        previousValue: inv.previousValue,
        currentValue: inv.currentValue,
        // "Total Sales (Ex Tax)" — strictly tax-only, distinct from
        // eligibleValue (which also excludes shipping/discount when the
        // rule configures it) since the user asked for this as its own
        // metric, not a restatement of the royalty-eligible figure.
        exTaxValue: round2(inv.currentValue - (inv.taxAmount ?? 0)),
        eligibleValue,
        royalty,
        invoiceStatus: inv.invoiceStatus,
        voidStatus: inv.voidStatus,
      };
    });

    return { dealLines, invoiceLines };
  }

  // Per-line Eligible Value/Royalty — Updated Value minus whichever
  // excluded items the effective rule configures, times the effective
  // royalty %. Deliberately does NOT apply the cap here (matches the
  // report spec's own structure: Section 1's per-invoice "Royalty" column
  // is pre-cap; the cap is a Total Due-level concept, computed once in
  // generateReport, not per line).
  private computeLineEligibleAndRoyalty(
    inv: Pick<InvoiceDocument, 'currentValue' | 'taxAmount' | 'shippingAmount' | 'discountAmount'>,
    rule: RoyaltyRuleDocument | null,
  ): { eligibleValue: number; royalty: number } {
    if (!rule) return { eligibleValue: round2(inv.currentValue), royalty: 0 };

    let eligibleValue = inv.currentValue;
    if (rule.excludeTax && inv.taxAmount) eligibleValue -= inv.taxAmount;
    if (rule.excludeShipping && inv.shippingAmount) eligibleValue -= inv.shippingAmount;
    if (rule.excludeDiscount && inv.discountAmount) eligibleValue -= inv.discountAmount;
    eligibleValue = Math.max(eligibleValue, 0);

    let effectivePct = rule.royaltyPercentage;
    if (rule.capType === 'sliding' && rule.slidingTiers.length > 0) {
      const tier = rule.slidingTiers.find(
        (t) => eligibleValue >= t.fromValue && (t.toValue === undefined || eligibleValue < t.toValue),
      );
      if (tier) effectivePct = tier.percentage;
    }

    return { eligibleValue: round2(eligibleValue), royalty: round2(eligibleValue * (effectivePct / 100)) };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
