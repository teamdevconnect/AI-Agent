import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Deal, DealDocument } from './schemas/deal.schema';
import { Quote, QuoteDocument } from './schemas/quote.schema';
import { QuoteCounter, QuoteCounterDocument } from './schemas/quote-counter.schema';

export interface CreateDraftQuoteInput {
  dealId?: string;
  businessName: string;
  contactEmail?: string;
  requestedItems?: string;
  createdBy: string;
}

export interface ListQuotesFilter {
  dateFrom?: string;
  dateTo?: string;
  clientApprovalStatus?: string;
  page?: number;
  pageSize?: number;
}

// Phase 14e — the first real writer for QuoteCounter (landed dormant in
// Phase 11, never given logic). Only ever creates an honest, unpriced draft
// shell — quoteAmount is always 0 and never fabricated, matching this
// codebase's one unbroken "never invent a figure" convention.
@Injectable()
export class QuotesService {
  constructor(
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(QuoteCounter.name) private counterModel: Model<QuoteCounterDocument>,
    @InjectModel(Deal.name) private dealModel: Model<DealDocument>,
  ) {}

  // Phase 19 — Unified Analytics Dashboard's quote drill-down. Quote has no
  // storeId/ownerId of its own — store/personal scoping joins through the
  // linked Deal's own storeId/ownerId, same "resolve scoped deal ids first,
  // then match dealId $in" approach customer-activity.service.ts already
  // uses for its own personal-scope quote filtering. A quote with no dealId
  // can never be attributed to one specific store/consultant, so it's
  // correctly excluded once either constraint is set — never silently
  // included, matching that same established precedent.
  async listFiltered(
    organizationId: string,
    query: ListQuotesFilter,
    storeConstraint?: string,
    ownerConstraint?: string,
  ): Promise<{ items: QuoteDocument[]; total: number; page: number; pageSize: number }> {
    const match: FilterQuery<Quote> = { organizationId };

    if (query.dateFrom || query.dateTo) {
      match.createdAt = {
        ...(query.dateFrom ? { $gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { $lte: new Date(new Date(query.dateTo).setHours(23, 59, 59, 999)) } : {}),
      };
    }
    // Same boolean split the analytics-dashboard's quote-acceptance donut
    // uses ($eq: ['$clientApprovalStatus', 'approved']) — 'not-approved'
    // means "everything else", not one specific literal string, so the
    // drill-down list's total always matches the donut's own count exactly.
    if (query.clientApprovalStatus === 'approved') match.clientApprovalStatus = 'approved';
    else if (query.clientApprovalStatus === 'not-approved') match.clientApprovalStatus = { $ne: 'approved' };

    if (storeConstraint || ownerConstraint) {
      const dealMatch: FilterQuery<Deal> = {
        organizationId,
        ...(storeConstraint ? { storeId: storeConstraint } : {}),
        ...(ownerConstraint ? { ownerId: ownerConstraint } : {}),
      };
      const deals = await this.dealModel.find(dealMatch).select({ _id: 1 }).exec();
      match.dealId = { $in: deals.map((d) => d._id.toString()) };
    }

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);
    const [items, total] = await Promise.all([
      this.quoteModel
        .find(match)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.quoteModel.countDocuments(match).exec(),
    ]);
    return { items, total, page, pageSize };
  }

  async createDraftQuote(organizationId: string, input: CreateDraftQuoteInput): Promise<QuoteDocument> {
    const quoteNumber = await this.nextQuoteNumber(organizationId);
    return this.quoteModel.create({
      organizationId,
      dealId: input.dealId,
      quoteName: input.requestedItems ? input.requestedItems.slice(0, 120) : `Draft quote for ${input.businessName}`,
      quoteStatus: 'draft',
      quoteAmount: 0,
      currency: 'INR',
      quoteOwner: input.createdBy,
      quoteNumber,
      clientDetails: { companyName: input.businessName, email: input.contactEmail },
      requestNotes: input.requestedItems,
    });
  }

  private async nextQuoteNumber(organizationId: string): Promise<string> {
    const counter = await this.counterModel
      .findOneAndUpdate({ organizationId }, { $inc: { seq: 1 } }, { upsert: true, new: true })
      .exec();
    return `Q-${String(counter.seq).padStart(4, '0')}`;
  }
}
