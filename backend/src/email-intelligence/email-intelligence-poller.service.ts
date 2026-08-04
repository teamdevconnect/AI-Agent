import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { CustomerActivityService, TodaysEmail } from '../crm/customer-activity.service';
import { EmailCorrelationContext } from '../crm/customer-grouping.util';
import { OutlookConnection, OutlookConnectionDocument } from '../outlook/schemas/outlook-connection.schema';
import { UsersService } from '../users/users.service';
import { EmailIntelligenceService } from './email-intelligence.service';

// Generous margin over the 3-minute cadence below — a missed tick or brief
// downtime can never silently skip an email, since every tick re-requests
// this whole window. Self-healing by design: no watermark/cursor to desync,
// the unique index on EmailIntelligenceItem is what makes re-requesting the
// same messages across overlapping ticks safe and cheap (one exists() check
// per already-seen message, no re-analysis).
const LOOKBACK_WINDOW_MINUTES = 20;

@Injectable()
export class EmailIntelligencePollerService {
  private readonly logger = new Logger(EmailIntelligencePollerService.name);
  private readonly pythonAgentUrl: string;
  // Pure efficiency, not correctness — the unique index is the real
  // dedup guard. A genuinely multi-instance deployment would want a Mongo
  // atomic-claim upgrade (like OrganizationsService.claimMorningRun), not
  // built here — flagged as a known limitation, not fixed in this pass.
  private isPolling = false;

  constructor(
    @InjectModel(OutlookConnection.name) private connectionModel: Model<OutlookConnectionDocument>,
    private usersService: UsersService,
    private customerActivityService: CustomerActivityService,
    private emailIntelligenceService: EmailIntelligenceService,
    private http: HttpService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.pythonAgentUrl = this.config.get<string>('pythonAgentUrl') ?? 'http://localhost:8000';
  }

  @Cron('*/3 * * * *')
  async pollAllMailboxes(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      // Sorted oldest-first so the dedup below (one analysis per real
      // mailbox, not per connecting user) consistently attributes a shared
      // inbox to whoever connected it first — confirmed live that the same
      // physical mailbox can be connected by several team members
      // independently (e.g. a shared team enquiry inbox), and analyzing it
      // once per connection would multiply both AI cost and duplicate
      // notifications for the exact same email.
      const connections = await this.connectionModel.find({ isActive: true }).sort({ createdAt: 1 }).exec();
      const byOrg = new Map<string, { userId: string; email: string }[]>();
      const seenMailboxByOrg = new Map<string, Set<string>>();
      for (const c of connections) {
        const user = await this.usersService.findById(c.userId).catch(() => null);
        if (!user) continue; // deleted user — skip silently

        const seen = seenMailboxByOrg.get(user.organizationId) ?? new Set<string>();
        const mailboxKey = c.email.toLowerCase();
        if (seen.has(mailboxKey)) continue; // same inbox already claimed by an earlier connection
        seen.add(mailboxKey);
        seenMailboxByOrg.set(user.organizationId, seen);

        const list = byOrg.get(user.organizationId) ?? [];
        list.push({ userId: c.userId, email: c.email });
        byOrg.set(user.organizationId, list);
      }

      for (const [organizationId, mailboxes] of byOrg) {
        let context: EmailCorrelationContext;
        try {
          context = await this.customerActivityService.gatherCorrelationContext(organizationId);
        } catch (err) {
          this.logger.error(`Correlation context failed for org ${organizationId}: ${(err as Error).message}`);
          continue;
        }
        for (const mailbox of mailboxes) {
          await this.pollOneMailbox(organizationId, mailbox, context).catch((err: Error) =>
            this.logger.error(`Poll failed for ${mailbox.email}: ${err.message}`),
          );
        }
      }
    } finally {
      this.isPolling = false;
    }
  }

  private async pollOneMailbox(
    organizationId: string,
    mailbox: { userId: string; email: string },
    context: EmailCorrelationContext,
  ): Promise<void> {
    const since = new Date(Date.now() - LOOKBACK_WINDOW_MINUTES * 60_000).toISOString();
    const token = this.jwt.sign({ sub: mailbox.userId }, { expiresIn: '5m' });
    const { data } = await firstValueFrom(
      this.http.get<{ connected: boolean; emails: TodaysEmail[] }>(`${this.pythonAgentUrl}/outlook/messages-since`, {
        params: { since },
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    if (!data.connected) return;

    for (const email of data.emails) {
      const exists = await this.emailIntelligenceService.itemExists(mailbox.userId, email.id);
      if (exists) continue;
      await this.emailIntelligenceService
        .analyzeAndCreate(organizationId, mailbox.userId, mailbox.email, email, context)
        .catch((err: Error) => this.logger.error(`Analysis failed for message ${email.id}: ${err.message}`));
    }
  }
}
