import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Deal, DealDocument } from '../crm/schemas/deal.schema';
import { Quote, QuoteDocument } from '../crm/schemas/quote.schema';
import { QuotePaymentsService } from '../crm/quote-payments.service';
import { FinanceDocument, FinanceDocumentDocument } from '../finance/schemas/finance-document.schema';
import { Vendor, VendorDocument } from '../vendors/schemas/vendor.schema';
import { VendorQuote, VendorQuoteDocument } from '../vendors/schemas/vendor-quote.schema';

export interface VendorProfitabilityFilters {
  vendorId?: string[];
}

export interface VendorProfitabilityRow {
  dealId: string;
  dealName?: string;
  vendorNames: string[];
  vendorCost: number;
  vendorCostCurrency: string;
  customerRevenue: number;
  customerRevenueCurrency: string;
  customerPaid: number;
  grossProfit: number | null;
  grossMarginPct: number | null;
  currencyMismatch: boolean;
  vendorQuoteCount: number;
  quoteCount: number;
}

// Section 5 — Accounts Receivable & Vendor Profitability Analysis. Per-
// transaction row keyed by dealId, per the plan: Vendor Quote -> Vendor
// Payment (paid/partially_paid FinanceDocument only — never count a pending
// vendor invoice as real cost) -> Customer Quote (quoteAmount = revenue) ->
// Gross Profit. No Net Profit field (no overhead/commission/royalty-fee
// deduction model exists anywhere in this app — shipping that would be
// fabricating a number, not reporting one).
//
// Every FinanceDocument/Quote/VendorQuote is unset for dealId/vendorRef on
// every pre-existing record (no backfill path — see finance-document.schema.ts's
// own comment), so this will show a small/near-empty dataset until users
// link new records going forward. coveragePct is always surfaced, never
// silently implied as complete.
@Injectable()
export class VendorProfitabilityService {
  private readonly pythonAgentUrl: string;

  constructor(
    @InjectModel(FinanceDocument.name) private financeDocumentModel: Model<FinanceDocumentDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(Deal.name) private dealModel: Model<DealDocument>,
    @InjectModel(Vendor.name) private vendorModel: Model<VendorDocument>,
    @InjectModel(VendorQuote.name) private vendorQuoteModel: Model<VendorQuoteDocument>,
    private quotePaymentsService: QuotePaymentsService,
    private http: HttpService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.pythonAgentUrl = this.config.get<string>('pythonAgentUrl') ?? 'http://localhost:8000';
  }

  // Stateless, on-demand only — no cache (unlike AiFollowupSummaryService's
  // daily snapshot), scoped to whatever filtered rows the caller is
  // currently viewing. Takes the already-computed rows directly (never
  // recomputes them) so the AI commentary can never disagree with the
  // deterministic numbers already on screen.
  async requestAiComparison(caller: JwtPayload, rows: VendorProfitabilityRow[]): Promise<Record<string, unknown>> {
    const token = this.jwt.sign({ sub: caller.sub, organizationId: caller.organizationId }, { expiresIn: '5m' });
    const payload = {
      transactions: rows
        .filter((r) => !r.currencyMismatch)
        .map((r) => ({
          dealId: r.dealId,
          dealName: r.dealName,
          vendorCost: r.vendorCost,
          customerRevenue: r.customerRevenue,
          grossProfit: r.grossProfit,
          grossMarginPct: r.grossMarginPct,
        })),
    };
    const { data } = await firstValueFrom(
      this.http.post<Record<string, unknown>>(`${this.pythonAgentUrl}/business-intelligence/vendor-profitability/compare`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    return data;
  }

  async getOverview(
    organizationId: string,
    start: Date,
    end: Date,
    filters: VendorProfitabilityFilters,
  ): Promise<{
    rows: VendorProfitabilityRow[];
    totals: { customerRevenue: number; vendorCost: number; grossProfit: number; grossMarginPct: number | null };
    coveragePct: number | null;
    currencyMismatchCount: number;
  }> {
    // Vendor cost recognition event — a paid/partially_paid vendor invoice
    // is what actually happened "in range", not a still-pending one (which
    // may never be paid, or paid in a different period).
    const financeMatch: FilterQuery<FinanceDocument> = {
      organizationId,
      dealId: { $exists: true, $ne: null },
      paymentStatus: { $in: ['paid', 'partially_paid'] },
      createdAt: { $gte: start, $lt: end },
    };
    if (filters.vendorId?.length) financeMatch.vendorRef = { $in: filters.vendorId };

    const [financeDocs, allFinanceDocsInRange] = await Promise.all([
      this.financeDocumentModel.find(financeMatch).exec(),
      this.financeDocumentModel
        .find({ organizationId, dealId: { $exists: true, $ne: null }, createdAt: { $gte: start, $lt: end } })
        .select({ dealId: 1 })
        .exec(),
    ]);

    const dealIds = [...new Set(financeDocs.map((d) => d.dealId!))];
    // Deal-count-based, not document-count-based — a deal with several
    // vendor invoices (some pending, one paid) must not silently deflate
    // this percentage just because it has more raw documents than deals.
    const totalDealsAnyStatus = new Set(allFinanceDocsInRange.map((d) => d.dealId!)).size;
    if (dealIds.length === 0) {
      return {
        rows: [],
        totals: { customerRevenue: 0, vendorCost: 0, grossProfit: 0, grossMarginPct: null },
        coveragePct: totalDealsAnyStatus > 0 ? 0 : null,
        currencyMismatchCount: 0,
      };
    }

    const [quotes, vendorQuotes, vendors, deals] = await Promise.all([
      this.quoteModel.find({ organizationId, dealId: { $in: dealIds } }).exec(),
      this.vendorQuoteModel.find({ organizationId, dealId: { $in: dealIds } }).exec(),
      this.vendorModel.find({ organizationId }).exec(),
      this.dealModel.find({ organizationId, _id: { $in: dealIds } }).select({ name: 1 }).exec(),
    ]);

    const vendorNameById = new Map(vendors.map((v) => [v._id.toString(), v.name]));
    const dealNameById = new Map(deals.map((d) => [d._id.toString(), d.name]));
    const paymentsByQuote = await this.quotePaymentsService.listPaymentsForQuotes(
      organizationId,
      quotes.map((q) => q._id.toString()),
    );

    const financeByDeal = this.groupBy(financeDocs, (f) => f.dealId!);
    const quotesByDeal = this.groupBy(quotes, (q) => q.dealId!);
    const vendorQuotesByDeal = this.groupBy(vendorQuotes, (vq) => vq.dealId!);

    let currencyMismatchCount = 0;
    const rows: VendorProfitabilityRow[] = dealIds.map((dealId) => {
      const financeForDeal = financeByDeal.get(dealId) ?? [];
      const quotesForDeal = quotesByDeal.get(dealId) ?? [];
      const vendorQuotesForDeal = vendorQuotesByDeal.get(dealId) ?? [];

      const vendorCost = financeForDeal.reduce((sum, f) => sum + f.paymentAmount, 0);
      const vendorCostCurrency = financeForDeal[0]?.currency ?? 'INR';
      const vendorCurrenciesMatch = financeForDeal.every((f) => f.currency === vendorCostCurrency);

      const customerRevenue = quotesForDeal.reduce((sum, q) => sum + q.quoteAmount, 0);
      const customerRevenueCurrency = quotesForDeal[0]?.currency ?? vendorCostCurrency;
      const revenueCurrenciesMatch = quotesForDeal.every((q) => q.currency === customerRevenueCurrency);

      const customerPaid = quotesForDeal.reduce((sum, q) => {
        const payments = paymentsByQuote.get(q._id.toString()) ?? [];
        return sum + payments.filter((p) => !p.voided).reduce((s, p) => s + p.amount, 0);
      }, 0);

      const currencyMismatch = !vendorCurrenciesMatch || !revenueCurrenciesMatch || (quotesForDeal.length > 0 && vendorCostCurrency !== customerRevenueCurrency);
      if (currencyMismatch) currencyMismatchCount += 1;

      const grossProfit = currencyMismatch ? null : customerRevenue - vendorCost;
      const grossMarginPct = grossProfit !== null && customerRevenue > 0 ? Math.round((grossProfit / customerRevenue) * 1000) / 10 : null;

      const vendorNames = [...new Set(vendorQuotesForDeal.map((vq) => vendorNameById.get(vq.vendorId) ?? 'Unknown vendor'))];
      if (vendorNames.length === 0 && financeForDeal.some((f) => f.vendorRef)) {
        for (const f of financeForDeal) {
          if (f.vendorRef && vendorNameById.has(f.vendorRef)) vendorNames.push(vendorNameById.get(f.vendorRef)!);
        }
      }

      return {
        dealId,
        dealName: dealNameById.get(dealId),
        vendorNames: [...new Set(vendorNames)],
        vendorCost,
        vendorCostCurrency,
        customerRevenue,
        customerRevenueCurrency,
        customerPaid,
        grossProfit,
        grossMarginPct,
        currencyMismatch,
        vendorQuoteCount: vendorQuotesForDeal.length,
        quoteCount: quotesForDeal.length,
      };
    });

    // Only rows with both a real linked vendor cost and a real customer
    // quote count toward aggregate totals — a deal with vendor cost but no
    // quote yet is real data (shown in the row list) but can't honestly
    // contribute to a profit total with no revenue side.
    const countable = rows.filter((r) => !r.currencyMismatch && r.quoteCount > 0);
    const totalRevenue = countable.reduce((sum, r) => sum + r.customerRevenue, 0);
    const totalVendorCost = countable.reduce((sum, r) => sum + r.vendorCost, 0);
    const totalGrossProfit = totalRevenue - totalVendorCost;

    return {
      rows: rows.sort((a, b) => (b.grossProfit ?? 0) - (a.grossProfit ?? 0)),
      totals: {
        customerRevenue: totalRevenue,
        vendorCost: totalVendorCost,
        grossProfit: totalGrossProfit,
        grossMarginPct: totalRevenue > 0 ? Math.round((totalGrossProfit / totalRevenue) * 1000) / 10 : null,
      },
      coveragePct: totalDealsAnyStatus > 0 ? Math.round((dealIds.length / totalDealsAnyStatus) * 1000) / 10 : null,
      currencyMismatchCount,
    };
  }

  private groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const key = keyFn(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }
}
