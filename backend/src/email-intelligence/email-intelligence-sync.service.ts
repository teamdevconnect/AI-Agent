import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { AgentExecution, AgentExecutionDocument } from '../command-center/schemas/agent-execution.schema';
import { CustomerActivityService, TodaysEmail } from '../crm/customer-activity.service';
import { OutlookConnection, OutlookConnectionDocument } from '../outlook/schemas/outlook-connection.schema';
import { UsersService } from '../users/users.service';
import { EmailSyncJob, EmailSyncJobDocument } from './schemas/email-sync-job.schema';
import { EmailIntelligenceService } from './email-intelligence.service';

export interface SyncMailboxResult {
  connected: boolean;
  scannedCount: number;
  newItemsCount: number;
}

// Phase 21 follow-up — a genuinely richer response, no longer the same
// shape as SyncMailboxResult: breaks "new" down into what's already stored,
// what the deterministic gates would auto-skip (no LLM cost), and what
// would actually spend a real AI call, plus a real (not guessed) token
// estimate once history exists.
export interface SyncPreviewResult {
  connected: boolean;
  scannedCount: number;
  alreadyAnalyzedCount: number;
  autoSkippedCount: number;
  willAnalyzeCount: number;
  estimatedInputTokens: number | null;
  estimatedOutputTokens: number | null;
  estimatedBasis: 'historical_average' | 'no_history';
  lastSyncedAt: string | null;
}

export interface ProviderHealthStatus {
  provider: 'anthropic' | 'groq';
  status: 'available' | 'degraded' | 'unknown';
  lastCheckedAt: string | null;
  lastError: string | null;
}

// How many recent real email_analyze calls to average over for the token
// estimate — small enough to react to a recent shift (e.g. longer threads),
// large enough not to be thrown off by one unusually long/short email.
const HISTORY_SAMPLE_SIZE = 20;

// On-demand only — deliberately NOT a @Cron job. This used to run every 3
// minutes in the background for every connected mailbox org-wide, which was
// the single largest automatic LLM cost driver in the app (confirmed live:
// 56 real Claude calls from this one feature alone, running whether or not
// anyone was using the app). Replaced with a button-triggered sync scoped to
// the calling user's own mailbox — nothing in this file runs unless a user
// hits "Sync Inbox" (see EmailIntelligenceController's POST /sync route).
// A generous rolling lookback (not a persisted watermark/cursor) is what
// makes repeated clicks safe and cheap: EmailIntelligenceItem's unique index
// on {userId, externalMessageId} means re-scanning the same window twice
// only costs one exists() check per already-seen message, never a second LLM
// call — same self-healing property the old cron relied on, just sized for
// "clicked once in a while" instead of "runs every 3 minutes."
const SYNC_LOOKBACK_HOURS = 24;

@Injectable()
export class EmailIntelligenceSyncService {
  private readonly logger = new Logger(EmailIntelligenceSyncService.name);
  private readonly pythonAgentUrl: string;

  constructor(
    @InjectModel(OutlookConnection.name) private connectionModel: Model<OutlookConnectionDocument>,
    @InjectModel(EmailSyncJob.name) private syncJobModel: Model<EmailSyncJobDocument>,
    @InjectModel(AgentExecution.name) private agentExecutionModel: Model<AgentExecutionDocument>,
    private usersService: UsersService,
    private customerActivityService: CustomerActivityService,
    private emailIntelligenceService: EmailIntelligenceService,
    private http: HttpService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.pythonAgentUrl = this.config.get<string>('pythonAgentUrl') ?? 'http://localhost:8000';
  }

  // Cheap, LLM-free — same connection/lookback/fetch as syncMyMailbox but
  // stops short of ever calling analyzeAndCreate. Deliberately skips
  // gatherCorrelationContext too (only needed to build analyzeAndCreate's
  // context, not to count), so this is meaningfully cheaper than a real
  // sync, not just "the loop minus the LLM call". Phase 21 follow-up: also
  // dry-runs the same deterministic skip gates the real sync applies (via
  // wouldSkipLlmAnalysis), so "will analyze" reflects what will actually
  // happen, not just "not seen before" — and pulls a real historical-average
  // token estimate rather than ever guessing one.
  async previewSync(userId: string): Promise<SyncPreviewResult> {
    const notConnected: SyncPreviewResult = {
      connected: false,
      scannedCount: 0,
      alreadyAnalyzedCount: 0,
      autoSkippedCount: 0,
      willAnalyzeCount: 0,
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
      estimatedBasis: 'no_history',
      lastSyncedAt: null,
    };
    const user = await this.usersService.findById(userId);
    const connection = await this.connectionModel.findOne({ userId, isActive: true }).exec();
    if (!user || !connection) return notConnected;

    const since = new Date(Date.now() - SYNC_LOOKBACK_HOURS * 60 * 60_000).toISOString();
    const token = this.jwt.sign({ sub: userId }, { expiresIn: '5m' });
    const { data } = await firstValueFrom(
      this.http.get<{ connected: boolean; emails: TodaysEmail[] }>(`${this.pythonAgentUrl}/outlook/messages-since`, {
        params: { since },
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    if (!data.connected) return notConnected;

    let alreadyAnalyzedCount = 0;
    let autoSkippedCount = 0;
    let willAnalyzeCount = 0;
    for (const email of data.emails) {
      const exists = await this.emailIntelligenceService.itemExists(userId, email.id);
      if (exists) {
        alreadyAnalyzedCount += 1;
        continue;
      }
      if (this.emailIntelligenceService.wouldSkipLlmAnalysis(email, connection.email)) {
        autoSkippedCount += 1;
      } else {
        willAnalyzeCount += 1;
      }
    }

    const [estimate, lastJob] = await Promise.all([
      this.estimateTokenUsage(user.organizationId, willAnalyzeCount),
      this.syncJobModel.findOne({ userId }).sort({ createdAt: -1 }).exec(),
    ]);

    return {
      connected: true,
      scannedCount: data.emails.length,
      alreadyAnalyzedCount,
      autoSkippedCount,
      willAnalyzeCount,
      estimatedInputTokens: estimate.inputTokens,
      estimatedOutputTokens: estimate.outputTokens,
      estimatedBasis: estimate.basis,
      lastSyncedAt: lastJob?.completedAt?.toISOString() ?? null,
    };
  }

  // Averages real token counts from this org's own recent, successful
  // email_analyze calls (see anthropic_client.py's Phase 21 follow-up
  // tracing addition) — never a flat guessed constant. No history yet
  // (a fresh org, or before that tracing shipped) means an honest "we don't
  // know yet" rather than a fabricated number.
  private async estimateTokenUsage(
    organizationId: string,
    willAnalyzeCount: number,
  ): Promise<{ inputTokens: number | null; outputTokens: number | null; basis: 'historical_average' | 'no_history' }> {
    if (willAnalyzeCount === 0) return { inputTokens: 0, outputTokens: 0, basis: 'no_history' };

    const recent = await this.agentExecutionModel
      .find({ organizationId, name: 'email_analyze', success: true })
      .sort({ occurredAt: -1 })
      .limit(HISTORY_SAMPLE_SIZE)
      .exec();
    if (recent.length === 0) return { inputTokens: null, outputTokens: null, basis: 'no_history' };

    const avgInput = recent.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0) / recent.length;
    const avgOutput = recent.reduce((sum, r) => sum + (r.outputTokens ?? 0), 0) / recent.length;
    return {
      inputTokens: Math.round(avgInput * willAnalyzeCount),
      outputTokens: Math.round(avgOutput * willAnalyzeCount),
      basis: 'historical_average',
    };
  }

  // Derived from this org's own real recent call telemetry, never a live
  // ping (no extra cost, always available) — the most recent llm-kind
  // execution per provider tells us whether the last real attempt succeeded.
  // 'unknown' (not "available") when no history exists yet, so an untested
  // provider is never presented as confirmed healthy.
  async getProviderHealth(organizationId: string): Promise<ProviderHealthStatus[]> {
    const providers: ('anthropic' | 'groq')[] = ['anthropic', 'groq'];
    return Promise.all(
      providers.map(async (provider) => {
        const latest = await this.agentExecutionModel
          .findOne({ organizationId, provider, kind: 'llm' })
          .sort({ occurredAt: -1 })
          .exec();
        if (!latest) return { provider, status: 'unknown' as const, lastCheckedAt: null, lastError: null };
        return {
          provider,
          status: latest.success ? ('available' as const) : ('degraded' as const),
          lastCheckedAt: latest.occurredAt?.toISOString() ?? null,
          lastError: latest.success ? null : (latest.error ?? null),
        };
      }),
    );
  }

  // Scoped to exactly one user's own connected mailbox — matches this
  // module's established self-scoped-only stance (no org-wide oversight
  // view, see the controller's own class comment). If several teammates
  // share one physical inbox, only whichever of them actually owns the
  // active OutlookConnection record can sync it — same attribution rule the
  // old cron's mailbox-dedup fix already established, just exercised one
  // click at a time instead of silently in the background.
  async syncMyMailbox(userId: string): Promise<SyncMailboxResult> {
    const startedAt = new Date();
    const user = await this.usersService.findById(userId);
    const connection = await this.connectionModel.findOne({ userId, isActive: true }).exec();
    if (!user || !connection) return { connected: false, scannedCount: 0, newItemsCount: 0 };

    try {
      const since = new Date(Date.now() - SYNC_LOOKBACK_HOURS * 60 * 60_000).toISOString();
      const token = this.jwt.sign({ sub: userId }, { expiresIn: '5m' });
      const { data } = await firstValueFrom(
        this.http.get<{ connected: boolean; emails: TodaysEmail[] }>(`${this.pythonAgentUrl}/outlook/messages-since`, {
          params: { since },
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      if (!data.connected) return { connected: false, scannedCount: 0, newItemsCount: 0 };

      const context = await this.customerActivityService.gatherCorrelationContext(user.organizationId);

      let newItemsCount = 0;
      let succeededCount = 0;
      let failedCount = 0;
      for (const email of data.emails) {
        const exists = await this.emailIntelligenceService.itemExists(userId, email.id);
        if (exists) continue;
        newItemsCount += 1;
        try {
          await this.emailIntelligenceService.analyzeAndCreate(user.organizationId, userId, connection.email, email, context);
          succeededCount += 1;
        } catch (err) {
          failedCount += 1;
          this.logger.error(`Analysis failed for message ${email.id}: ${(err as Error).message}`);
        }
      }

      const result = { connected: true, scannedCount: data.emails.length, newItemsCount };
      await this.persistSyncJob({
        organizationId: user.organizationId,
        userId,
        // 'completed_with_errors' whenever any item failed — including the
        // all-failed case (e.g. a real Anthropic outage) — so the sync
        // history never misreports a run with real failures as clean.
        status: failedCount > 0 ? 'completed_with_errors' : 'completed',
        scannedCount: result.scannedCount,
        newItemsCount,
        succeededCount,
        failedCount,
        startedAt,
      });
      return result;
    } catch (err) {
      // The real sync operation itself failed (e.g. python-agent unreachable,
      // gatherCorrelationContext threw) — best-effort log a 'failed' job doc,
      // then re-throw the ORIGINAL error unchanged. A failure inside
      // persistSyncJob must never replace/mask the real failure the caller
      // needs to see.
      await this.persistSyncJob({
        organizationId: user.organizationId,
        userId,
        status: 'failed',
        scannedCount: 0,
        newItemsCount: 0,
        succeededCount: 0,
        failedCount: 0,
        startedAt,
      });
      throw err;
    }
  }

  // Best-effort only — never allowed to throw into a caller that already has
  // a real result (success or failure) to return. Awaited (not fire-and-
  // forget) so a GET /sync/jobs call immediately after a sync is guaranteed
  // to see the just-finished job, unlike a detached .catch() write.
  private async persistSyncJob(fields: {
    organizationId: string;
    userId: string;
    status: 'completed' | 'completed_with_errors' | 'failed';
    scannedCount: number;
    newItemsCount: number;
    succeededCount: number;
    failedCount: number;
    startedAt: Date;
  }): Promise<void> {
    try {
      await this.syncJobModel.create({ ...fields, triggeredBy: 'user', completedAt: new Date() });
    } catch (err) {
      this.logger.error(`Failed to persist sync job record: ${(err as Error).message}`);
    }
  }

  // Recent sync history for the caller's own mailbox — self-scoped, matches
  // every other read on this module.
  async listRecentSyncJobs(userId: string, limit = 20): Promise<EmailSyncJobDocument[]> {
    return this.syncJobModel.find({ userId }).sort({ createdAt: -1 }).limit(limit).exec();
  }
}
