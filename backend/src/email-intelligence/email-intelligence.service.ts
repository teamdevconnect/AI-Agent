import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { correlateSingleEmail, EmailCorrelationContext } from '../crm/customer-grouping.util';
import { periodToDateRange } from '../common/period.util';
import { classifyEmailDeterministically } from './email-preclassification.util';
import { CustomerActivityService, TodaysEmail } from '../crm/customer-activity.service';
import { QuotesService } from '../crm/quotes.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import {
  EmailFollowUpReminder,
  EmailFollowUpReminderDocument,
} from './schemas/email-follow-up-reminder.schema';
import { EmailIntelligenceItem, EmailIntelligenceItemDocument } from './schemas/email-intelligence-item.schema';

const DUPLICATE_KEY_ERROR = 11000;
const EMAIL_HISTORY_LIMIT = 50;
const RECENT_SENTIMENT_WINDOW_DAYS = 30;
const FOLLOW_UP_DEFAULT_DAYS = 3;

// Same allow-list as frontend/src/services/emailIntelligenceService.ts's
// RELEVANT_EMAIL_INTENTS (Phase 16's off-plan noise-filter fix) — the
// vendor/customer/enquiry-type intents a salesperson actually acts on, vs.
// payment/purchase_order/refund/internal/spam/other noise. Deliberately an
// allow-list, not an exclude-list, so a new intent value added later
// defaults to excluded from "business mail" analytics until deliberately
// added here. Phase 19's email activity widget uses this to analyze real
// business mail only, never every message a connected mailbox receives.
const RELEVANT_EMAIL_INTENTS = [
  'vendor', 'existing_customer', 'new_enquiry', 'quotation_request', 'price_negotiation',
  'complaint', 'technical_support', 'escalation', 'meeting_request',
];

const RELEVANT_INTENT_LABELS: Record<string, string> = {
  vendor: 'Vendor',
  existing_customer: 'Existing Customer',
  new_enquiry: 'New Enquiry',
  quotation_request: 'Quotation Request',
  price_negotiation: 'Price Negotiation',
  complaint: 'Complaint',
  technical_support: 'Technical Support',
  escalation: 'Escalation',
  meeting_request: 'Meeting Request',
};

type RelationshipView = Awaited<ReturnType<CustomerActivityService['getRelationshipView']>>;

const DRAFTABLE_INTENT_LABELS: Record<string, string> = {
  new_enquiry: 'New enquiry',
  existing_customer: 'Existing customer',
  quotation_request: 'Quotation request',
  price_negotiation: 'Price negotiation',
  complaint: 'Complaint',
  technical_support: 'Support request',
  meeting_request: 'Meeting request',
};

function intentLabel(intent: string): string {
  return DRAFTABLE_INTENT_LABELS[intent] ?? intent.replace(/_/g, ' ');
}

@Injectable()
export class EmailIntelligenceService {
  private readonly logger = new Logger(EmailIntelligenceService.name);
  private readonly pythonAgentUrl: string;

  constructor(
    @InjectModel(EmailIntelligenceItem.name) private itemModel: Model<EmailIntelligenceItemDocument>,
    @InjectModel(EmailFollowUpReminder.name) private followUpModel: Model<EmailFollowUpReminderDocument>,
    private notificationsService: NotificationsService,
    private customerActivityService: CustomerActivityService,
    private quotesService: QuotesService,
    private usersService: UsersService,
    private http: HttpService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.pythonAgentUrl = this.config.get<string>('pythonAgentUrl') ?? 'http://localhost:8000';
  }

  async itemExists(userId: string, externalMessageId: string): Promise<boolean> {
    return !!(await this.itemModel.exists({ userId, externalMessageId }));
  }

  // Phase 21 follow-up — a read-only dry-run of the same two deterministic
  // gates analyzeAndCreate/regenerate apply below (Phase 17 Layer 1 self-send
  // + Phase 18 Layer 0 pre-filter), used by EmailIntelligenceSyncService's
  // previewSync to count how many "new" items would actually spend an LLM
  // call before anything runs. Deliberately NOT a refactor of those two
  // already-verified methods to share this — the persisted-field shape
  // differs per gate and isn't needed here, only the boolean answer, so
  // mirroring these two simple conditions is a smaller, safer footprint than
  // restructuring production-critical branching logic.
  wouldSkipLlmAnalysis(email: { from: string; subject: string; preview: string }, mailboxEmail: string): boolean {
    if (email.from.trim().toLowerCase() === mailboxEmail.trim().toLowerCase()) return true;
    return !!classifyEmailDeterministically({ from: email.from, subject: email.subject, preview: email.preview });
  }

  // Correlates the email, calls python-agent for classification+draft,
  // persists the result, and notifies the mailbox owner. Called by the
  // scheduled poller (new emails) and by regenerate() (re-running analysis
  // on an already-stored email, no Graph re-fetch).
  async analyzeAndCreate(
    organizationId: string,
    userId: string,
    mailboxEmail: string,
    email: TodaysEmail,
    context: EmailCorrelationContext,
  ): Promise<EmailIntelligenceItemDocument | null> {
    const { correlation, matchedBusinessSummary } = this.correlate(email, context);

    const baseFields = {
      organizationId,
      userId,
      mailboxEmail,
      externalMessageId: email.id,
      receivedAt: new Date(email.receivedAt),
      subject: email.subject,
      fromAddress: email.from,
      toAddresses: email.to,
      bodyPreview: email.preview,
      isRead: email.isRead,
      importance: email.importance,
      matchConfidence: correlation?.matchConfidence ?? 'none',
      matchedBusinessKey: correlation?.matchedBusinessKey,
      matchedBusinessName: correlation?.matchedBusinessName,
      resolvedGroupKey: correlation?.resolvedGroupKey ?? undefined,
      matchedBusinessSummary,
    };

    try {
      // Phase 17, Layer 1 — deterministic pre-gate, before any LLM call. A
      // message sent FROM our own mailbox is never something we owe a reply
      // to; skip the (costly) LLM call entirely rather than asking the model
      // to work this out from raw from/to text, which is exactly what
      // produced customer/vendor-voiced drafts before this fix.
      if (email.from.trim().toLowerCase() === mailboxEmail.trim().toLowerCase()) {
        return await this.itemModel.create({
          ...baseFields,
          intent: 'internal',
          priority: 'low',
          urgency: 'low',
          sentiment: 'neutral',
          recommendedAction: 'No action needed — this message was sent from your own mailbox.',
          shouldDraft: false,
          fromRole: 'internal',
          aiStatus: 'no_reply_needed',
          expectedNextAction: 'awaiting_customer',
          reason: 'This message was sent from your own connected mailbox — no reply needed.',
          deterministicInput: { skippedLlmCall: true, reasonForSkip: 'fromAddress matches mailboxEmail' },
          result: {},
        });
      }

      // Deterministic pre-filter — bounce/auto-reply/marketing mail never
      // needs an LLM call to know it needs no reply. Skips straight to
      // persistence, same shape/reasoning as the Layer 1 gate above.
      const preFilterMatch = classifyEmailDeterministically({ from: email.from, subject: email.subject, preview: email.preview });
      if (preFilterMatch) {
        return await this.itemModel.create({
          ...baseFields,
          intent: 'other',
          priority: 'low',
          urgency: 'low',
          sentiment: 'neutral',
          recommendedAction: preFilterMatch.reason,
          shouldDraft: false,
          fromRole: 'external_other',
          aiStatus: 'no_reply_needed',
          expectedNextAction: 'no_action_required',
          reason: preFilterMatch.reason,
          deterministicInput: { skippedLlmCall: true, reasonForSkip: `deterministic pre-filter: ${preFilterMatch.ruleName}` },
          result: {},
        });
      }

      const salesperson = await this.usersService.findById(userId);
      const deterministicInput = this.buildAnalysisPayload(email, correlation, matchedBusinessSummary, mailboxEmail, salesperson?.name);
      const result = await this.callAnalyze(organizationId, userId, deterministicInput);
      const decision = this.applyPerspectiveValidation(email.id, email.from, result.intent as string, result);

      const created = await this.itemModel.create({
        ...baseFields,
        intent: result.intent,
        priority: result.priority,
        urgency: result.urgency,
        sentiment: result.sentiment,
        recommendedAction: result.recommendedAction,
        shouldDraft: decision.shouldDraftFinal,
        draftReply: decision.draftReply,
        draftReasoning: result.draftReasoning ?? undefined,
        fromRole: decision.fromRole,
        aiStatus: decision.aiStatus,
        expectedNextAction: decision.expectedNextAction,
        reason: decision.reason,
        deterministicInput,
        result,
      });

      await this.notificationsService.create(
        userId,
        {
          kind: 'system',
          title: `New ${intentLabel(result.intent as string).toLowerCase()} email needs review`,
          description: `${email.subject || '(no subject)'} — ${result.priority} priority`,
          source: 'email-intelligence',
        },
        organizationId,
      );

      return created;
    } catch (err) {
      // A concurrent poll tick already inserted this exact message — not a
      // real failure, the unique index is the authoritative dedup guard.
      if ((err as { code?: number }).code === DUPLICATE_KEY_ERROR) return null;
      throw err;
    }
  }

  private deriveFromRole(intent: string): 'customer' | 'vendor' | 'external_other' {
    if (intent === 'vendor') return 'vendor';
    const customerIntents = new Set([
      'new_enquiry', 'existing_customer', 'quotation_request', 'price_negotiation',
      'complaint', 'technical_support', 'escalation', 'meeting_request',
    ]);
    return customerIntents.has(intent) ? 'customer' : 'external_other';
  }

  // Phase 17, Layer 2 — never trust the model's own shouldDraft blindly.
  // draftWrittenFromOurPerspective is the model's explicit, forced self-check
  // (see EMAIL_INTENT_TOOL/EMAIL_INTENT_SYSTEM_PROMPT); if it drafted a reply
  // but flagged doubt about perspective, the draft is discarded here — never
  // shown as ready — and the failure is logged for debugging, matching the
  // reported bug's exact "do not generate the draft, log the issue" ask.
  private applyPerspectiveValidation(
    itemIdForLog: string,
    fromAddress: string,
    intent: string,
    result: Record<string, unknown>,
  ): {
    fromRole: 'customer' | 'vendor' | 'external_other';
    shouldDraftFinal: boolean;
    draftReply: string | undefined;
    aiStatus: 'draft_ready' | 'no_reply_needed' | 'validation_failed';
    expectedNextAction: 'company_reply' | 'no_action_required';
    reason: string;
  } {
    const fromRole = this.deriveFromRole(intent);
    const llmShouldDraft = !!result.shouldDraft;
    // EMAIL_INTENT_TOOL now sets strict:true, which guarantees this key is
    // always present (never silently omitted — the exact failure mode a live
    // test caught before strict mode was added). With presence guaranteed,
    // requiring an explicit true is the correct, fully-closed check — a
    // missing/null/false value all correctly fail the draft rather than
    // defaulting to "ok".
    const perspectiveOk = result.draftWrittenFromOurPerspective === true;

    if (llmShouldDraft && !perspectiveOk) {
      this.logger.warn(
        `Draft perspective self-check failed for email ${itemIdForLog} (from ${fromAddress}) — discarding generated draft.`,
      );
      return {
        fromRole,
        shouldDraftFinal: false,
        draftReply: undefined,
        aiStatus: 'validation_failed',
        expectedNextAction: 'no_action_required',
        reason: 'The AI drafted a reply but failed its own perspective self-check — discarded for manual review.',
      };
    }

    const shouldDraftFinal = llmShouldDraft && perspectiveOk;
    return {
      fromRole,
      shouldDraftFinal,
      draftReply: shouldDraftFinal ? ((result.draftReply as string) ?? undefined) : undefined,
      aiStatus: shouldDraftFinal ? 'draft_ready' : 'no_reply_needed',
      expectedNextAction: shouldDraftFinal ? 'company_reply' : 'no_action_required',
      reason: (result.draftReasoning as string) || (result.recommendedAction as string) || '',
    };
  }

  private correlate(email: TodaysEmail, context: EmailCorrelationContext) {
    const match = correlateSingleEmail({ from: email.from, to: email.to, subject: email.subject }, context);
    if (!match) return { correlation: null, matchedBusinessSummary: undefined };

    const group = match.resolvedGroupKey ? context.groups.get(match.resolvedGroupKey) : undefined;
    if (!group) return { correlation: match, matchedBusinessSummary: undefined };

    return {
      correlation: match,
      matchedBusinessSummary: {
        openDealCount: group.deals.filter((d) => d.dealStatus === 'open').length,
        wonDealCount: group.deals.filter((d) => d.dealStatus === 'won').length,
        // Real previous quotes only — never a cost/margin/discount number,
        // none exist anywhere on Quote today (Phase 14b explicitly defers
        // quotation pricing intelligence).
        previousQuotes: group.quotes.slice(0, 10).map((q) => ({
          quoteNumber: q.quoteNumber,
          quoteName: q.quoteName,
          quoteAmount: q.quoteAmount,
          currency: q.currency,
          quoteStatus: q.quoteStatus,
        })),
      },
    };
  }

  private buildAnalysisPayload(
    email: TodaysEmail,
    correlation: ReturnType<typeof correlateSingleEmail>,
    matchedBusinessSummary: ReturnType<EmailIntelligenceService['correlate']>['matchedBusinessSummary'],
    mailboxEmail: string,
    salespersonName?: string,
  ) {
    return {
      // Phase 17 — the single missing signal that let drafts get written in
      // the wrong voice: without this, the model had no way to know which
      // address is "us" versus the external party. Never remove without a
      // new correctness pass (see EMAIL_INTENT_SYSTEM_PROMPT's own comment).
      ourEmail: mailboxEmail,
      // Real first name of the mailbox owner, when known — lets the draft
      // sign off as an actual person ("Best, Sanjay") instead of a generic
      // business-name signature, part of making drafts read as human-written.
      ourName: salespersonName || null,
      email: {
        subject: email.subject,
        from: email.from,
        to: email.to,
        preview: email.preview,
        isRead: email.isRead,
        importance: email.importance,
      },
      correlation: {
        matchConfidence: correlation?.matchConfidence ?? 'none',
        matchedBusinessName: correlation?.matchedBusinessName ?? null,
      },
      businessContext: matchedBusinessSummary ?? null,
    };
  }

  private async callAnalyze(organizationId: string, userId: string, payload: Record<string, unknown>) {
    const token = this.jwt.sign({ sub: userId, organizationId }, { expiresIn: '5m' });
    const { data } = await firstValueFrom(
      this.http.post<Record<string, unknown>>(`${this.pythonAgentUrl}/email-intelligence/analyze`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    return data;
  }

  // Phase 19 — Unified Analytics Dashboard's email activity widget, reworked
  // twice after live feedback: (1) restricted to RELEVANT_EMAIL_INTENTS —
  // "business mail" only, same allow-list the AI Email Inbox's own
  // "Relevant" tab already filters to, never spam/internal/bounce noise;
  // (2) generalized from a locked calendar-month period to an arbitrary
  // [start, end) Date range, since email activity is naturally a daily-
  // rolling concept ("how many did I send today") unlike the rest of this
  // dashboard's inherently-monthly revenue/target concepts — this widget
  // gets its own independent day-based filter on the frontend, decoupled
  // from the page's month picker. sentCount is scoped by sentAt falling in
  // range (replies actually dispatched); missedCount/newEnquiryCount/
  // byIntent are scoped by receivedAt falling in range. "Missed" = still
  // status:'pending' more than 24h after receivedAt — status:'pending'
  // alone already implies sentAt is unset (send() requires
  // status==='approved' first).
  async getActivityStats(
    organizationId: string,
    start: Date,
    end: Date,
    storeConstraint?: string,
    personalConstraint?: string,
  ): Promise<{
    totalRelevantCount: number;
    sentCount: number;
    missedCount: number;
    newEnquiryCount: number;
    byIntent: { intent: string; label: string; receivedCount: number; sentCount: number }[];
  }> {
    const userFilter = await this.resolveMonthlyUserFilter(organizationId, storeConstraint, personalConstraint);

    // receivedRows analyzes the inbox side (what arrived, by category);
    // sentRows analyzes the "sent box" the same way — replies actually
    // dispatched in this range, by the category of the item they answered.
    // sentAt reflects when a reply went out, independent of when its
    // original email was received, so a category's sentCount can include
    // items received before this range but replied to within it — the
    // honest, real meaning of "analyze the sent box for this window".
    const [sentCount, missedCount, receivedRows, sentRows] = await Promise.all([
      this.itemModel.countDocuments(this.buildActivityKindMatch(organizationId, 'sent', start, end, userFilter)).exec(),
      this.itemModel.countDocuments(this.buildActivityKindMatch(organizationId, 'missed', start, end, userFilter)).exec(),
      this.itemModel
        .aggregate<{ _id: string; count: number }>([
          {
            $match: {
              organizationId,
              ...userFilter,
              intent: { $in: RELEVANT_EMAIL_INTENTS },
              receivedAt: { $gte: start, $lt: end },
            },
          },
          { $group: { _id: '$intent', count: { $sum: 1 } } },
        ])
        .exec(),
      this.itemModel
        .aggregate<{ _id: string; count: number }>([
          {
            $match: {
              organizationId,
              ...userFilter,
              intent: { $in: RELEVANT_EMAIL_INTENTS },
              sentAt: { $gte: start, $lt: end },
            },
          },
          { $group: { _id: '$intent', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    const receivedByIntent = new Map(receivedRows.map((r) => [r._id, r.count]));
    const sentByIntent = new Map(sentRows.map((r) => [r._id, r.count]));
    // Zero-filled across every relevant intent (never just the ones with a
    // hit) — same "list every known category, never fabricate/hide a row"
    // convention this app's other breakdown widgets already follow.
    const byIntent = RELEVANT_EMAIL_INTENTS.map((intent) => ({
      intent,
      label: RELEVANT_INTENT_LABELS[intent],
      receivedCount: receivedByIntent.get(intent) ?? 0,
      sentCount: sentByIntent.get(intent) ?? 0,
    }));
    const totalRelevantCount = byIntent.reduce((sum, r) => sum + r.receivedCount, 0);
    const newEnquiryCount = receivedByIntent.get('new_enquiry') ?? 0;

    return { totalRelevantCount, sentCount, missedCount, newEnquiryCount, byIntent };
  }

  // Back-compat convenience for callers that still think in calendar months
  // (AnalyticsDashboardService's composite overview) — converts to a range
  // and delegates, so the two never compute this differently.
  async getMonthlyStats(organizationId: string, period: string, storeConstraint?: string, personalConstraint?: string) {
    const { start, end } = periodToDateRange(period);
    return this.getActivityStats(organizationId, start, end, storeConstraint, personalConstraint);
  }

  // Phase 19 — the Unified Analytics Dashboard's email drill-down. Reuses
  // the exact same match-building logic getActivityStats' counts already
  // use (via the shared buildActivityKindMatch helper below), so the
  // drill-down list can never drift out of sync with the stat tile's own
  // number. kind:'intent' drills into one specific relevant intent bucket
  // (pass intent:'new_enquiry' for the New Enquiries headline stat too).
  async listActivity(
    organizationId: string,
    kind: 'sent' | 'missed' | 'intent',
    start: Date,
    end: Date,
    storeConstraint?: string,
    personalConstraint?: string,
    intent?: string,
  ): Promise<EmailIntelligenceItemDocument[]> {
    const userFilter = await this.resolveMonthlyUserFilter(organizationId, storeConstraint, personalConstraint);
    return this.itemModel
      .find(this.buildActivityKindMatch(organizationId, kind, start, end, userFilter, intent))
      .sort({ receivedAt: -1 })
      .limit(200)
      .exec();
  }

  private async resolveMonthlyUserFilter(
    organizationId: string,
    storeConstraint?: string,
    personalConstraint?: string,
  ): Promise<Record<string, unknown>> {
    let userIds: string[] | undefined;
    if (personalConstraint) {
      userIds = [personalConstraint];
    } else if (storeConstraint) {
      const users = await this.usersService.findAll(organizationId);
      userIds = users.filter((u) => u.storeId === storeConstraint).map((u) => u._id.toString());
    }
    return userIds ? { userId: { $in: userIds } } : {};
  }

  // sentCount/missedCount/byIntent's exact definitions, factored out so
  // getActivityStats (counts) and listActivity (drill-down records) can
  // never disagree. Both 'sent' and 'missed' are restricted to RELEVANT_
  // EMAIL_INTENTS — business mail only, matching the widget's whole point.
  private buildActivityKindMatch(
    organizationId: string,
    kind: 'sent' | 'missed' | 'intent',
    start: Date,
    end: Date,
    userFilter: Record<string, unknown>,
    intent?: string,
  ): Record<string, unknown> {
    // An explicit single intent narrows 'sent' to one category's sent-box
    // drill-down (e.g. "Vendor emails replied to this range"); otherwise
    // every relevant category, matching the headline sentCount stat.
    const relevantFilter = {
      intent: intent && RELEVANT_EMAIL_INTENTS.includes(intent) ? intent : { $in: RELEVANT_EMAIL_INTENTS },
    };
    if (kind === 'sent') {
      return { organizationId, ...userFilter, ...relevantFilter, sentAt: { $gte: start, $lt: end } };
    }
    if (kind === 'missed') {
      const missedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return {
        organizationId,
        ...userFilter,
        ...relevantFilter,
        status: 'pending',
        receivedAt: { $gte: start, $lt: end, $lte: missedCutoff },
      };
    }
    return {
      organizationId,
      ...userFilter,
      intent: intent && RELEVANT_EMAIL_INTENTS.includes(intent) ? intent : { $in: RELEVANT_EMAIL_INTENTS },
      receivedAt: { $gte: start, $lt: end },
    };
  }

  list(userId: string, status?: 'pending' | 'approved' | 'rejected', from?: string, to?: string) {
    const query: Record<string, unknown> = { userId, ...(status ? { status } : {}) };
    // receivedAt is a real Date field (unlike TimelineEvent.occurredAt's
    // plain string) — `to` must be pushed to the end of that calendar day,
    // otherwise a date-only value (e.g. "2026-08-05" from DateRangeControl)
    // means midnight and silently excludes that entire day's own emails.
    if (from || to) {
      query.receivedAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(new Date(to).setHours(23, 59, 59, 999)) } : {}),
      };
    }
    return this.itemModel.find(query).sort({ receivedAt: -1 }).limit(100).exec();
  }

  async getOne(userId: string, id: string): Promise<EmailIntelligenceItemDocument> {
    const item = await this.itemModel.findOne({ _id: id, userId }).exec();
    if (!item) throw new NotFoundException('Email intelligence item not found');
    return item;
  }

  async approve(userId: string, id: string, finalDraftReply?: string): Promise<EmailIntelligenceItemDocument> {
    const item = await this.getOne(userId, id);
    const resolvedFinal = item.shouldDraft ? (finalDraftReply?.trim() || item.draftReply) : undefined;
    item.finalDraftReply = resolvedFinal;
    item.wasEdited = !!resolvedFinal && resolvedFinal !== item.draftReply;
    item.status = 'approved';
    item.approvedAt = new Date();
    item.approvedBy = userId;
    await item.save();
    return item;
  }

  // Phase 14d — the explicit, separate action that actually dispatches an
  // approved draft. Never called as a side effect of approve() — the
  // frontend requires its own confirmation step before calling this.
  async send(userId: string, id: string): Promise<EmailIntelligenceItemDocument> {
    const item = await this.getOne(userId, id);
    if (item.status !== 'approved') throw new BadRequestException('Item must be approved before it can be sent');
    if (item.sentAt) throw new BadRequestException('This item has already been sent');
    if (!item.finalDraftReply) throw new BadRequestException('No draft text to send');

    const token = this.jwt.sign({ sub: userId }, { expiresIn: '5m' });
    try {
      await firstValueFrom(
        this.http.post(
          `${this.pythonAgentUrl}/outlook/send-reply`,
          { messageId: item.externalMessageId, comment: item.finalDraftReply },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
    } catch (err) {
      const message = (err as { response?: { data?: { detail?: string } }; message?: string }).response?.data?.detail ?? (err as Error).message;
      item.sendError = message;
      await item.save();
      throw new BadRequestException(`Failed to send reply: ${message}`);
    }

    item.sentAt = new Date();
    item.sendError = undefined;
    await item.save();

    // Phase 14e — best-effort enrichment on top of an already-completed
    // action, never a transaction: a failure here must not roll back the
    // already-sent email or fail this response. Each internal step also
    // self-catches, this is a final safety net only.
    this.runPostSendActions(item).catch((err) =>
      this.logger.error(`Post-send actions failed for ${item._id.toString()}: ${(err as Error).message}`),
    );

    return item;
  }

  // ---- Phase 14e — Post-Send Actions: CRM update, manager notification,
  // follow-up reminder, native draft Quote creation ----

  private async runPostSendActions(item: EmailIntelligenceItemDocument): Promise<void> {
    const salesperson = await this.usersService.findById(item.userId);
    if (!salesperson) return;

    let dealId: string | undefined;
    if (item.resolvedGroupKey) {
      try {
        const touch = await this.customerActivityService.touchBusinessActivity(item.organizationId, item.resolvedGroupKey);
        dealId = touch.dealId;
      } catch (err) {
        this.logger.error(`CRM activity touch failed for ${item._id.toString()}: ${(err as Error).message}`);
      }
    }

    try {
      await this.notifyManagers(item.organizationId, salesperson, item);
    } catch (err) {
      this.logger.error(`Manager notification failed for ${item._id.toString()}: ${(err as Error).message}`);
    }

    try {
      await this.createFollowUpReminder(item);
    } catch (err) {
      this.logger.error(`Follow-up reminder creation failed for ${item._id.toString()}: ${(err as Error).message}`);
    }

    if (item.intent === 'quotation_request') {
      try {
        await this.createDraftQuoteFromItem(item, dealId);
      } catch (err) {
        this.logger.error(`Draft quote creation failed for ${item._id.toString()}: ${(err as Error).message}`);
      }
    }
  }

  // Mirrors finance-documents.service.ts's notifyAndEnqueue() exactly: role
  // filter, Promise.allSettled, fire-and-forget error handling. Falls back
  // to owner/admin when the salesperson's store has no manager — a
  // zero-manager store is a real, confirmed-possible case, not an edge case
  // to ignore. Never notifies the salesperson about their own send (they
  // already got the original review-queue notification).
  private async notifyManagers(organizationId: string, salesperson: UserDocument, item: EmailIntelligenceItemDocument): Promise<void> {
    const users = await this.usersService.findAll(organizationId);
    const salespersonId = salesperson._id.toString();

    let targets = users.filter(
      (u) => u._id.toString() !== salespersonId && u.roles.includes('manager') && u.storeId === salesperson.storeId,
    );
    if (targets.length === 0) {
      targets = users.filter((u) => u._id.toString() !== salespersonId && (u.roles.includes('owner') || u.roles.includes('admin')));
    }

    const businessLabel = item.matchedBusinessName ?? item.fromAddress;
    await Promise.allSettled(
      targets.map((u) =>
        this.notificationsService.create(
          u._id.toString(),
          {
            kind: 'system',
            title: `Reply sent to ${businessLabel}`,
            description: item.subject || '(no subject)',
            source: 'email-intelligence-manager-notify',
          },
          organizationId,
        ),
      ),
    );
  }

  private async createFollowUpReminder(item: EmailIntelligenceItemDocument): Promise<void> {
    await this.followUpModel.create({
      organizationId: item.organizationId,
      userId: item.userId,
      emailIntelligenceItemId: item._id.toString(),
      businessName: item.matchedBusinessName,
      title: `Follow up: ${item.subject || '(no subject)'}`,
      dueDate: new Date(Date.now() + FOLLOW_UP_DEFAULT_DAYS * 86_400_000),
      status: 'pending',
    });
  }

  // Only called for intent === 'quotation_request'. requestedItems comes
  // from analyze_email's own result (python-agent, never invented — see
  // EMAIL_INTENT_TOOL's system prompt) and may be absent; the created Quote
  // is always an honest, unpriced draft shell (quoteAmount: 0) regardless.
  private async createDraftQuoteFromItem(item: EmailIntelligenceItemDocument, dealId?: string): Promise<void> {
    const requestedItems = (item.result as Record<string, unknown> | undefined)?.requestedItems as string | undefined;
    await this.quotesService.createDraftQuote(item.organizationId, {
      dealId,
      businessName: item.matchedBusinessName ?? item.fromAddress,
      contactEmail: item.fromAddress,
      requestedItems: requestedItems ?? undefined,
      createdBy: item.userId,
    });
  }

  listFollowUps(userId: string) {
    return this.followUpModel.find({ userId, status: 'pending' }).sort({ dueDate: 1 }).exec();
  }

  async markFollowUpDone(userId: string, id: string): Promise<EmailFollowUpReminderDocument> {
    const reminder = await this.followUpModel.findOne({ _id: id, userId }).exec();
    if (!reminder) throw new NotFoundException('Follow-up reminder not found');
    reminder.status = 'done';
    await reminder.save();
    return reminder;
  }

  async reject(userId: string, id: string, reason?: string): Promise<EmailIntelligenceItemDocument> {
    const item = await this.getOne(userId, id);
    if (item.status === 'approved') throw new BadRequestException('Cannot reject an already-approved item');
    item.status = 'rejected';
    item.rejectedAt = new Date();
    item.rejectedBy = userId;
    item.rejectionReason = reason;
    await item.save();
    return item;
  }

  async regenerate(userId: string, id: string, context: EmailCorrelationContext): Promise<EmailIntelligenceItemDocument> {
    const item = await this.getOne(userId, id);
    if (item.status === 'approved') throw new BadRequestException('Cannot regenerate an already-approved item');

    const email: TodaysEmail = {
      id: item.externalMessageId,
      subject: item.subject,
      from: item.fromAddress,
      to: item.toAddresses,
      receivedAt: item.receivedAt.toISOString(),
      preview: item.bodyPreview,
      isRead: item.isRead,
      importance: item.importance,
    };
    const { correlation, matchedBusinessSummary } = this.correlate(email, context);

    item.matchConfidence = correlation?.matchConfidence ?? 'none';
    item.matchedBusinessKey = correlation?.matchedBusinessKey;
    item.matchedBusinessName = correlation?.matchedBusinessName;
    item.resolvedGroupKey = correlation?.resolvedGroupKey ?? undefined;
    item.matchedBusinessSummary = matchedBusinessSummary;

    const preFilterMatch = classifyEmailDeterministically({ from: email.from, subject: email.subject, preview: email.preview });

    // Phase 17, Layer 1 — same deterministic pre-gate as analyzeAndCreate.
    if (item.fromAddress.trim().toLowerCase() === item.mailboxEmail.trim().toLowerCase()) {
      item.intent = 'internal';
      item.priority = 'low';
      item.urgency = 'low';
      item.sentiment = 'neutral';
      item.recommendedAction = 'No action needed — this message was sent from your own mailbox.';
      item.shouldDraft = false;
      item.draftReply = undefined;
      item.draftReasoning = undefined;
      item.fromRole = 'internal';
      item.aiStatus = 'no_reply_needed';
      item.expectedNextAction = 'awaiting_customer';
      item.reason = 'This message was sent from your own connected mailbox — no reply needed.';
      item.deterministicInput = { skippedLlmCall: true, reasonForSkip: 'fromAddress matches mailboxEmail' };
      item.result = {};
    } else if (preFilterMatch) {
      // Deterministic pre-filter — applied here too so a manual "regenerate"
      // on an already-stored bounce/auto-reply/marketing message doesn't
      // burn an LLM call either.
      item.intent = 'other';
      item.priority = 'low';
      item.urgency = 'low';
      item.sentiment = 'neutral';
      item.recommendedAction = preFilterMatch.reason;
      item.shouldDraft = false;
      item.draftReply = undefined;
      item.draftReasoning = undefined;
      item.fromRole = 'external_other';
      item.aiStatus = 'no_reply_needed';
      item.expectedNextAction = 'no_action_required';
      item.reason = preFilterMatch.reason;
      item.deterministicInput = { skippedLlmCall: true, reasonForSkip: `deterministic pre-filter: ${preFilterMatch.ruleName}` };
      item.result = {};
    } else {
      const salesperson = await this.usersService.findById(userId);
      const deterministicInput = this.buildAnalysisPayload(email, correlation, matchedBusinessSummary, item.mailboxEmail, salesperson?.name);
      const result = await this.callAnalyze(item.organizationId, userId, deterministicInput);
      const decision = this.applyPerspectiveValidation(item._id.toString(), email.from, result.intent as string, result);

      item.intent = result.intent as string;
      item.priority = result.priority as string;
      item.urgency = result.urgency as string;
      item.sentiment = result.sentiment as string;
      item.recommendedAction = result.recommendedAction as string;
      item.shouldDraft = decision.shouldDraftFinal;
      item.draftReply = decision.draftReply;
      item.draftReasoning = (result.draftReasoning as string) ?? undefined;
      item.fromRole = decision.fromRole;
      item.aiStatus = decision.aiStatus;
      item.expectedNextAction = decision.expectedNextAction;
      item.reason = decision.reason;
      item.deterministicInput = deterministicInput;
      item.result = result;
    }

    item.regeneratedCount += 1;
    item.lastRegeneratedAt = new Date();
    if (item.status === 'rejected') item.status = 'pending';
    await item.save();
    return item;
  }

  // ---- Phase 14c — Customer Timeline + Risk Score ----
  //
  // Lives here (not on CustomerActivityService) because it needs both CRM
  // data (via the unchanged, already-verified getRelationshipView/
  // getPersonalRelationshipView, called as a black box) AND this module's
  // own EmailIntelligenceItem history — CrmModule cannot depend on this
  // module without creating a cycle, since this module already depends on
  // CrmModule (one-directional, established in Phase 14b).

  async getCustomerTimeline(caller: JwtPayload, businessKey: string, storeConstraint?: string) {
    const relationship = await this.customerActivityService.getRelationshipView(caller, businessKey, storeConstraint);
    return this.enrichWithTimeline(caller.organizationId, businessKey, relationship);
  }

  // Consultant-only, self-scoped — mirrors getPersonalRelationshipView's
  // own precedent (no owner/admin override to view a specific consultant's feed).
  async getPersonalCustomerTimeline(caller: JwtPayload, businessKey: string) {
    const relationship = await this.customerActivityService.getPersonalRelationshipView(caller, businessKey);
    return this.enrichWithTimeline(caller.organizationId, businessKey, relationship);
  }

  private async enrichWithTimeline(organizationId: string, businessKey: string, relationship: RelationshipView) {
    // Org-wide, not filtered by userId — a customer relationship spans
    // whichever employee's mailbox happened to handle each message, not one
    // person's inbox. Queried on resolvedGroupKey, NOT matchedBusinessKey —
    // see the schema's own comment for why the latter is unreliable as a
    // join key for exact/domain-confidence matches.
    const emailHistory = await this.itemModel
      .find({ organizationId, resolvedGroupKey: businessKey })
      .sort({ receivedAt: -1 })
      .limit(EMAIL_HISTORY_LIMIT)
      .exec();

    const lifetimeValue = relationship.deals.filter((d) => d.dealStatus === 'won').reduce((sum, d) => sum + d.monetaryValue, 0);
    const { score: riskScore, label: riskLabel } = this.computeRiskScore(relationship, emailHistory);
    const timeline = this.buildTimeline(relationship, emailHistory);

    return { ...relationship, emailHistory, lifetimeValue, riskScore, riskLabel, timeline };
  }

  // Cheap deterministic weighted composite — an MVP heuristic to give one
  // at-a-glance number, matching business-dashboard.service.ts's
  // businessHealthScore convention exactly, not a model.
  private computeRiskScore(
    relationship: RelationshipView,
    emailHistory: EmailIntelligenceItemDocument[],
  ): { score: number; label: string } {
    let score = 100;

    const activityTimestamps = [
      ...relationship.deals.map((d) => d.createdAt),
      ...relationship.quotes.map((q) => q.createdAt),
      ...emailHistory.map((e) => e.receivedAt),
    ]
      .filter((d): d is Date => !!d)
      .map((d) => new Date(d).getTime());
    const daysSinceActivity = activityTimestamps.length
      ? Math.floor((Date.now() - Math.max(...activityTimestamps)) / 86_400_000)
      : Infinity;

    if (daysSinceActivity > 30) score -= 30;
    else if (daysSinceActivity > 14) score -= 15;

    if (relationship.deals.some((d) => d.dealStatus === 'lost')) score -= 15;

    const recentCutoff = Date.now() - RECENT_SENTIMENT_WINDOW_DAYS * 86_400_000;
    const hasRecentNegativeSentiment = emailHistory.some(
      (e) => new Date(e.receivedAt).getTime() >= recentCutoff && (e.sentiment === 'negative' || e.sentiment === 'frustrated'),
    );
    if (hasRecentNegativeSentiment) score -= 20;

    const hasUnresolvedComplaint = emailHistory.some(
      (e) => (e.intent === 'complaint' || e.intent === 'escalation') && e.status === 'pending',
    );
    if (hasUnresolvedComplaint) score -= 20;

    score = Math.max(0, Math.min(100, score));
    const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Attention' : 'At Risk';
    return { score, label };
  }

  // Merges deals/quotes (created dates) and email history into one
  // chronological feed, newest first.
  private buildTimeline(relationship: RelationshipView, emailHistory: EmailIntelligenceItemDocument[]) {
    const entries: { type: string; date: string; title: string; description: string }[] = [];

    for (const d of relationship.deals) {
      if (!d.createdAt) continue;
      entries.push({
        type: 'deal_created',
        date: new Date(d.createdAt).toISOString(),
        title: `Deal created: ${d.name}`,
        description: `${d.dealStatus} · ${d.monetaryValue}`,
      });
    }
    for (const q of relationship.quotes) {
      if (!q.createdAt) continue;
      entries.push({
        type: 'quote_created',
        date: new Date(q.createdAt).toISOString(),
        title: q.quoteNumber ? `Quote #${q.quoteNumber} created` : 'Quote created',
        description: `${q.quoteStatus} · ${q.quoteAmount} ${q.currency}`,
      });
    }
    for (const e of emailHistory) {
      entries.push({
        type: 'email',
        date: e.receivedAt.toISOString(),
        title: e.subject || '(no subject)',
        description: `${e.intent} · ${e.sentiment}`,
      });
    }

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}
