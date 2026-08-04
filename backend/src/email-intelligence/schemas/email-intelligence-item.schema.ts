import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmailIntelligenceItemDocument = EmailIntelligenceItem & Document<Types.ObjectId>;

@Schema({ _id: false })
export class MatchedQuoteSummary {
  @Prop() quoteNumber?: string;
  @Prop() quoteName?: string;
  @Prop({ required: true }) quoteAmount: number;
  @Prop({ required: true }) currency: string;
  @Prop({ required: true }) quoteStatus: string;
}
const MatchedQuoteSummarySchema = SchemaFactory.createForClass(MatchedQuoteSummary);

@Schema({ _id: false })
export class MatchedBusinessSummary {
  @Prop({ default: 0 }) openDealCount: number;
  @Prop({ default: 0 }) wonDealCount: number;
  // Never a cost/margin/discount field — Phase 14b explicitly defers
  // quotation pricing intelligence (no real cost/margin data exists yet).
  @Prop({ type: [MatchedQuoteSummarySchema], default: [] }) previousQuotes: MatchedQuoteSummary[];
}
const MatchedBusinessSummarySchema = SchemaFactory.createForClass(MatchedBusinessSummary);

// Phase 14b — one row per analyzed inbound email, scoped to the mailbox
// owner (userId) alone; there is no org-wide oversight view in this pass
// (see plan notes). organizationId/createdAt index below is unused by any
// endpoint today but costs nothing to add now for a future oversight view.
@Schema({ timestamps: true, collection: 'email_intelligence_items' })
export class EmailIntelligenceItem {
  @Prop({ required: true, index: true })
  organizationId: string;

  // Mailbox owner / assigned salesperson — the self-scope key every read/
  // write in this feature filters on.
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  mailboxEmail: string;

  // ---- raw message, captured once at ingest — regenerate reuses these,
  // never re-fetches from Graph ----
  @Prop({ required: true })
  externalMessageId: string;

  @Prop({ required: true, index: true })
  receivedAt: Date;

  @Prop({ default: '' })
  subject: string;

  @Prop({ required: true })
  fromAddress: string;

  @Prop({ type: [String], default: [] })
  toAddresses: string[];

  @Prop({ default: '' })
  bodyPreview: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ default: 'normal' })
  importance: string;

  // ---- CRM correlation ----
  @Prop({ enum: ['exact', 'domain', 'fuzzy', 'none'], default: 'none' })
  matchConfidence: 'exact' | 'domain' | 'fuzzy' | 'none';

  // Raw matched email/domain string for 'exact'/'domain' tiers, or the real
  // group key for 'fuzzy' — see EmailMatch's own doc comment. NOT reliable
  // as a join key back to a BusinessGroup for exact/domain matches — use
  // resolvedGroupKey below for that (Phase 14c's Customer Timeline).
  @Prop()
  matchedBusinessKey?: string;

  @Prop()
  matchedBusinessName?: string;

  // Always a real, resolvable BusinessGroup.key when one exists, regardless
  // of confidence tier — the correct field to query on when joining email
  // history back to a specific business (see customer-grouping.util.ts's
  // EmailMatch.resolvedGroupKey and Phase 14c's Customer Timeline).
  @Prop({ index: true })
  resolvedGroupKey?: string;

  @Prop({ type: MatchedBusinessSummarySchema })
  matchedBusinessSummary?: MatchedBusinessSummary;

  // ---- AI classification — real Mongoose enums, a genuinely fixed/
  // structural vocabulary (drives the queue's filter tabs), same reasoning
  // as FinanceDocument.paymentStatus. ----
  @Prop({
    required: true,
    index: true,
    enum: [
      'new_enquiry', 'existing_customer', 'quotation_request', 'price_negotiation', 'complaint',
      'technical_support', 'payment', 'purchase_order', 'vendor', 'refund', 'meeting_request',
      'escalation', 'internal', 'spam', 'other',
    ],
  })
  intent: string;

  @Prop({ required: true, enum: ['low', 'medium', 'high', 'urgent'] })
  priority: string;

  @Prop({ required: true, enum: ['low', 'medium', 'high', 'urgent'] })
  urgency: string;

  @Prop({ required: true, enum: ['positive', 'neutral', 'negative', 'frustrated'] })
  sentiment: string;

  @Prop({ required: true })
  recommendedAction: string;

  @Prop({ required: true })
  shouldDraft: boolean;

  @Prop()
  draftReply?: string;

  @Prop()
  draftReasoning?: string;

  // ---- approval-queue lifecycle — approved is terminal, no "un-approve"
  // path. Sending (Phase 14d) is a separate, explicit action layered on top
  // of an already-approved item — see sentAt/sendError below — not a status
  // value of its own, since "approved but not yet sent" and "approved and
  // sent" both need reject/regenerate to stay blocked identically. ----
  @Prop({ enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true })
  status: 'pending' | 'approved' | 'rejected';

  @Prop()
  finalDraftReply?: string;

  @Prop({ default: false })
  wasEdited: boolean;

  @Prop()
  approvedAt?: Date;

  @Prop()
  approvedBy?: string;

  // ---- Phase 14d — real sending, layered on top of an approved item ----
  // Set only on a real, successful Microsoft Graph reply dispatch. Absence
  // (with status === 'approved') means "approved but not yet sent" — the
  // Send action is still available. A one-way flag — there is no un-send.
  @Prop()
  sentAt?: Date;

  // Set on a failed send attempt (e.g. insufficient scope on a
  // not-yet-reconnected account, or a stale message id) so the failure is
  // visible and the item stays retryable rather than stuck silently.
  // Cleared on the next successful send.
  @Prop()
  sendError?: string;

  @Prop()
  rejectedAt?: Date;

  @Prop()
  rejectedBy?: string;

  @Prop()
  rejectionReason?: string;

  @Prop({ default: 0 })
  regeneratedCount: number;

  @Prop()
  lastRegeneratedAt?: Date;

  // ---- LLM audit trail — same convention as CustomerActivitySummary's
  // deterministicInput/result pair. ----
  @Prop({ type: Object, required: true })
  deterministicInput: Record<string, unknown>;

  @Prop({ type: Object, required: true })
  result: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

export const EmailIntelligenceItemSchema = SchemaFactory.createForClass(EmailIntelligenceItem);
// The entire dedup mechanism for the scheduled poller — no separate
// watermark/cursor collection needed (see poller service's own comment).
EmailIntelligenceItemSchema.index({ userId: 1, externalMessageId: 1 }, { unique: true });
EmailIntelligenceItemSchema.index({ userId: 1, status: 1, receivedAt: -1 });
EmailIntelligenceItemSchema.index({ organizationId: 1, createdAt: -1 });
