import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { EmailCorrelationContext } from '../crm/customer-grouping.util';
import { CustomerActivityService } from '../crm/customer-activity.service';
import { Quote, QuoteDocument } from '../crm/schemas/quote.schema';
import { EmailIntelligenceItem, EmailIntelligenceItemDocument } from '../email-intelligence/schemas/email-intelligence-item.schema';
import { UsersService } from '../users/users.service';

const ENQUIRY_INTENTS = ['new_enquiry', 'quotation_request'];
// A quote created before the enquiry, or long after it, isn't a plausible
// match for THIS enquiry — bounds the inferred-match fallback so a stale
// unrelated quote can never get credited to an unrelated email.
const INFERRED_MATCH_WINDOW_DAYS = 30;

export interface EnquiryConversionRow {
  emailItemId: string;
  subject: string;
  fromAddress: string;
  matchedBusinessName?: string;
  receivedAt: Date;
  userId: string;
  matchType: 'exact' | 'inferred' | 'unmatched';
  quote?: {
    id: string;
    quoteNumber?: string;
    quoteAmount: number;
    currency: string;
    clientApprovalStatus: string;
    quoteStatus: string;
    createdAt: Date;
  };
}

// Section 4 — Email Enquiry -> Quote Conversion Tracking. Two matching
// tiers, always reported separately (never blended into one "conversion
// rate"): exact (post-sourceEmailIntelligenceItemId, a real FK) and
// inferred (best-effort, for every enquiry email that predates that field —
// see quote.schema.ts's own comment on historical coverage).
@Injectable()
export class EnquiryConversionService {
  constructor(
    @InjectModel(EmailIntelligenceItem.name) private itemModel: Model<EmailIntelligenceItemDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    private customerActivityService: CustomerActivityService,
    private usersService: UsersService,
  ) {}

  async getOverview(
    organizationId: string,
    start: Date,
    end: Date,
    filters: { employeeId?: string[]; storeId?: string[] },
  ): Promise<{ rows: EnquiryConversionRow[]; exactCount: number; inferredCount: number; unmatchedCount: number }> {
    const userIdFilter = await this.resolveUserIdFilter(organizationId, filters);
    const match: FilterQuery<EmailIntelligenceItem> = {
      organizationId,
      intent: { $in: ENQUIRY_INTENTS },
      receivedAt: { $gte: start, $lt: end },
      ...(userIdFilter ? { userId: { $in: userIdFilter } } : {}),
    };
    const items = await this.itemModel.find(match).sort({ receivedAt: -1 }).exec();
    if (items.length === 0) return { rows: [], exactCount: 0, inferredCount: 0, unmatchedCount: 0 };

    const itemIds = items.map((i) => i._id.toString());
    const exactQuotes = await this.quoteModel.find({ organizationId, sourceEmailIntelligenceItemId: { $in: itemIds } }).exec();
    const exactByItemId = new Map(exactQuotes.map((q) => [q.sourceEmailIntelligenceItemId!, q]));

    // Only pays for the org-wide correlation context (the same one
    // EmailIntelligenceSyncService's own poller builds) when at least one
    // item actually needs the inferred fallback — free for an org fully on
    // the new exact-FK path.
    const needsInferred = items.some((i) => !exactByItemId.has(i._id.toString()));
    const context = needsInferred ? await this.customerActivityService.gatherCorrelationContext(organizationId) : null;

    let exactCount = 0;
    let inferredCount = 0;
    let unmatchedCount = 0;
    const rows: EnquiryConversionRow[] = items.map((item) => {
      const itemId = item._id.toString();
      const exactQuote = exactByItemId.get(itemId);
      if (exactQuote) {
        exactCount += 1;
        return this.toRow(item, exactQuote, 'exact');
      }

      const inferredQuote = context ? this.findInferredMatch(item, context) : undefined;
      if (inferredQuote) {
        inferredCount += 1;
        return this.toRow(item, inferredQuote, 'inferred');
      }

      unmatchedCount += 1;
      return this.toRow(item, undefined, 'unmatched');
    });

    return { rows, exactCount, inferredCount, unmatchedCount };
  }

  // Reuses CustomerActivityService's existing BusinessGroup resolution
  // (never a second grouping implementation) via the item's own
  // resolvedGroupKey; falls back to a direct clientDetails.email match
  // (the plan's own literal heuristic) only for items with no resolved
  // group at all (e.g. fuzzy-confidence-only correlation).
  private findInferredMatch(item: EmailIntelligenceItemDocument, context: EmailCorrelationContext): QuoteDocument | undefined {
    let candidates: QuoteDocument[] = item.resolvedGroupKey ? (context.groups.get(item.resolvedGroupKey)?.quotes ?? []) : [];

    if (candidates.length === 0) {
      const fromEmail = item.fromAddress.trim().toLowerCase();
      candidates = [...context.groups.values()].flatMap((g) =>
        g.quotes.filter((q) => q.clientDetails?.email?.trim().toLowerCase() === fromEmail),
      );
    }
    if (candidates.length === 0) return undefined;

    const windowMs = INFERRED_MATCH_WINDOW_DAYS * 86_400_000;
    const receivedMs = item.receivedAt.getTime();
    let best: QuoteDocument | undefined;
    let bestDelta = Infinity;
    for (const q of candidates) {
      if (!q.createdAt) continue;
      const delta = new Date(q.createdAt).getTime() - receivedMs;
      if (delta < 0 || delta > windowMs) continue;
      if (delta < bestDelta) {
        best = q;
        bestDelta = delta;
      }
    }
    return best;
  }

  private toRow(
    item: EmailIntelligenceItemDocument,
    quote: QuoteDocument | undefined,
    matchType: 'exact' | 'inferred' | 'unmatched',
  ): EnquiryConversionRow {
    return {
      emailItemId: item._id.toString(),
      subject: item.subject,
      fromAddress: item.fromAddress,
      matchedBusinessName: item.matchedBusinessName,
      receivedAt: item.receivedAt,
      userId: item.userId,
      matchType,
      quote: quote
        ? {
            id: quote._id.toString(),
            quoteNumber: quote.quoteNumber,
            quoteAmount: quote.quoteAmount,
            currency: quote.currency,
            clientApprovalStatus: quote.clientApprovalStatus,
            quoteStatus: quote.quoteStatus,
            createdAt: quote.createdAt,
          }
        : undefined,
    };
  }

  private async resolveUserIdFilter(
    organizationId: string,
    filters: { employeeId?: string[]; storeId?: string[] },
  ): Promise<string[] | undefined> {
    if (filters.employeeId?.length) return filters.employeeId;
    if (filters.storeId?.length) {
      const users = await this.usersService.findAll(organizationId);
      return users.filter((u) => u.storeId && filters.storeId!.includes(u.storeId)).map((u) => u._id.toString());
    }
    return undefined;
  }
}
