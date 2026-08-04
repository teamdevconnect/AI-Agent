import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { correlateSingleEmail, EmailCorrelationContext } from '../crm/customer-grouping.util';
import { CustomerActivityService, TodaysEmail } from '../crm/customer-activity.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailIntelligenceItem, EmailIntelligenceItemDocument } from './schemas/email-intelligence-item.schema';

const DUPLICATE_KEY_ERROR = 11000;
const EMAIL_HISTORY_LIMIT = 50;
const RECENT_SENTIMENT_WINDOW_DAYS = 30;

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
    private notificationsService: NotificationsService,
    private customerActivityService: CustomerActivityService,
    private http: HttpService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.pythonAgentUrl = this.config.get<string>('pythonAgentUrl') ?? 'http://localhost:8000';
  }

  async itemExists(userId: string, externalMessageId: string): Promise<boolean> {
    return !!(await this.itemModel.exists({ userId, externalMessageId }));
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
    const deterministicInput = this.buildAnalysisPayload(email, correlation, matchedBusinessSummary);
    const result = await this.callAnalyze(organizationId, userId, deterministicInput);

    try {
      const created = await this.itemModel.create({
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
        intent: result.intent,
        priority: result.priority,
        urgency: result.urgency,
        sentiment: result.sentiment,
        recommendedAction: result.recommendedAction,
        shouldDraft: result.shouldDraft,
        draftReply: result.draftReply ?? undefined,
        draftReasoning: result.draftReasoning ?? undefined,
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
  ) {
    return {
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

  list(userId: string, status?: 'pending' | 'approved' | 'rejected') {
    return this.itemModel
      .find({ userId, ...(status ? { status } : {}) })
      .sort({ receivedAt: -1 })
      .limit(100)
      .exec();
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
    return item;
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
    const deterministicInput = this.buildAnalysisPayload(email, correlation, matchedBusinessSummary);
    const result = await this.callAnalyze(item.organizationId, userId, deterministicInput);

    item.matchConfidence = correlation?.matchConfidence ?? 'none';
    item.matchedBusinessKey = correlation?.matchedBusinessKey;
    item.matchedBusinessName = correlation?.matchedBusinessName;
    item.resolvedGroupKey = correlation?.resolvedGroupKey ?? undefined;
    item.matchedBusinessSummary = matchedBusinessSummary;
    item.intent = result.intent as string;
    item.priority = result.priority as string;
    item.urgency = result.urgency as string;
    item.sentiment = result.sentiment as string;
    item.recommendedAction = result.recommendedAction as string;
    item.shouldDraft = result.shouldDraft as boolean;
    item.draftReply = (result.draftReply as string) ?? undefined;
    item.draftReasoning = (result.draftReasoning as string) ?? undefined;
    item.deterministicInput = deterministicInput;
    item.result = result;
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
