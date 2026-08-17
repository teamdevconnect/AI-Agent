import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Deal, DealDocument } from '../crm/schemas/deal.schema';
import { QuotesService } from '../crm/quotes.service';
import { EmailIntelligenceService } from '../email-intelligence/email-intelligence.service';
import { TimelineService } from '../timeline/timeline.service';
import { BiFollowupSummary, BiFollowupSummaryDocument } from './schemas/bi-followup-summary.schema';

const OVERDUE_DEALS_LIMIT = 20;

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// Section 6 — AI Due-Date & Follow-Up Summary. Directly modeled on
// finance-summary.service.ts's own generate/cache/regenerate shape (cache
// keyed by {organizationId, date}, regenerate flag, bridge-JWT, Timeline
// event) — see this file's own header note for why the underlying LLM call
// itself is NOT modeled on FinanceSummaryService's (older, untraced)
// python-agent call.
@Injectable()
export class AiFollowupSummaryService {
  private readonly logger = new Logger(AiFollowupSummaryService.name);
  private readonly pythonAgentUrl: string;

  constructor(
    @InjectModel(BiFollowupSummary.name) private summaryModel: Model<BiFollowupSummaryDocument>,
    @InjectModel(Deal.name) private dealModel: Model<DealDocument>,
    private emailIntelligenceService: EmailIntelligenceService,
    private quotesService: QuotesService,
    private timelineService: TimelineService,
    private http: HttpService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.pythonAgentUrl = this.config.get<string>('pythonAgentUrl') ?? 'http://localhost:8000';
  }

  async getCachedSummary(organizationId: string, dateStr: string) {
    const doc = await this.summaryModel.findOne({ organizationId, date: dateStr }).exec();
    return doc ? { ...doc.result, generatedAt: doc.updatedAt } : null;
  }

  async generateSummary(caller: JwtPayload, regenerate: boolean) {
    const dateStr = todayStamp();

    if (!regenerate) {
      const existing = await this.summaryModel.findOne({ organizationId: caller.organizationId, date: dateStr }).exec();
      if (existing) return { summary: { ...existing.result, generatedAt: existing.updatedAt }, cached: true };
    }

    const deterministicInput = await this.gatherDeterministicInput(caller.organizationId);
    let result: Record<string, unknown>;
    try {
      const token = this.jwt.sign({ sub: caller.sub, organizationId: caller.organizationId }, { expiresIn: '5m' });
      const { data } = await firstValueFrom(
        this.http.post<Record<string, unknown>>(`${this.pythonAgentUrl}/business-intelligence/followups/analyze`, deterministicInput, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      result = data;
    } catch (err) {
      this.logger.error(`Follow-up priorities LLM analysis failed: ${(err as Error).message}`);
      throw err;
    }

    const saved = await this.summaryModel
      .findOneAndUpdate(
        { organizationId: caller.organizationId, date: dateStr },
        { $set: { organizationId: caller.organizationId, date: dateStr, requestedByUserId: caller.sub, deterministicInput, result } },
        { upsert: true, new: true },
      )
      .exec();

    await this.timelineService.record({
      organizationId: caller.organizationId,
      userId: caller.sub,
      type: 'bi_followup_summary_generated',
      title: "AI summary generated for today's follow-up priorities",
      sourceType: 'business_intelligence',
      sourceId: saved._id.toString(),
    });

    return { summary: { ...result, generatedAt: saved.updatedAt }, cached: false };
  }

  // Org-wide, unfiltered real data — no date-range filter dimension, same
  // as FinanceSummaryService's own gatherDeterministicInput. The raw
  // followUpReminders list is returned separately by the controller too
  // (always shown directly, regardless of AI generation state — see
  // listFollowUpsForOrg's own comment).
  private async gatherDeterministicInput(organizationId: string) {
    const today = todayStamp();
    const [followUpReminders, overdueQuotes, overdueDeals, highRiskCustomers] = await Promise.all([
      this.emailIntelligenceService.listFollowUpsForOrg(organizationId),
      this.quotesService.listOverdueForOrg(organizationId),
      this.dealModel
        .find({ organizationId, dealStatus: 'open', expectedClosingDate: { $lt: today } })
        .sort({ expectedClosingDate: 1 })
        .limit(OVERDUE_DEALS_LIMIT)
        .exec(),
      this.emailIntelligenceService.getHighRiskCustomers(organizationId),
    ]);

    return {
      date: today,
      followUpReminders: followUpReminders.map((f) => ({
        id: f._id.toString(),
        businessName: f.businessName,
        title: f.title,
        dueDate: f.dueDate.toISOString().slice(0, 10),
      })),
      overdueQuotes,
      overdueDeals: overdueDeals.map((d) => ({
        dealId: d._id.toString(),
        name: d.name,
        expectedClosingDate: d.expectedClosingDate,
        monetaryValue: d.monetaryValue,
      })),
      highRiskCustomers,
    };
  }
}
