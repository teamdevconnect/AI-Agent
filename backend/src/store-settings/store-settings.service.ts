import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { ChatService } from '../chat/chat.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { UsersService } from '../users/users.service';
import { StoreSettings, StoreSettingsDocument } from './schemas/store-settings.schema';

const MORNING_AGENT_ID = 'store_manager';
const MORNING_PROMPT =
  "Generate today's to-do list: analyze CRM and Outlook, identify new enquiries and any that haven't received a follow-up, and list concrete priorities for today.";

const EOD_AGENT_ID = 'store_manager';
const EOD_PROMPT =
  'Generate an end-of-day report: summarize what was completed today, outstanding follow-ups, and anything that needs attention tomorrow.';

// Schema default only applies to newly-created documents — a StoreSettings
// doc persisted before the `timezone` field existed reads back as undefined,
// which would silently fall back to Intl's "use the host's local zone"
// behavior and reintroduce the original bug. Same fallback value as the
// schema default, applied at read time so old documents are covered too.
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

// Both scheduled reports are authored by Store Manager (operationally-framed
// daily check-ins fit that role for both morning and evening) — Sales
// Consultant stays available for live chat but isn't the automatic author
// of these two, a deliberate choice.

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// Wall-clock minutes-since-midnight in `tz`, NOT the server process's local
// timezone (that's what broke the trigger window when this runs anywhere
// other than IST, e.g. a container defaulting to UTC). `hour: '2-digit'`
// under `hour12: false` can format midnight as "24" in some ICU builds —
// normalized away with `% 24`.
function nowMinutesInZone(tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

@Injectable()
export class StoreSettingsService {
  private readonly logger = new Logger(StoreSettingsService.name);

  constructor(
    @InjectModel(StoreSettings.name) private settingsModel: Model<StoreSettingsDocument>,
    private chatService: ChatService,
    private dashboardService: DashboardService,
    private usersService: UsersService,
  ) {}

  getSettings() {
    return this.getOrCreateSettings();
  }

  updateSettings(patch: { openingTime?: string; closingTime?: string; timezone?: string }) {
    return this.settingsModel.findOneAndUpdate({}, patch, { upsert: true, new: true }).exec();
  }

  /** Bypasses the trigger window/dedupe check — the manual testing/ops hook
   * exposed via POST /store-settings/run-now. */
  runNow(type: 'morning' | 'eod') {
    const now = new Date().toLocaleDateString();
    if (type === 'eod') return this.runForAllUsers(EOD_AGENT_ID, 'eod', EOD_PROMPT, `EOD report — ${now}`);
    return this.runForAllUsers(MORNING_AGENT_ID, 'morning', MORNING_PROMPT, `Morning to-do — ${now}`);
  }

  // A fixed-cadence checker (re-reads current config every tick) rather
  // than dynamically rescheduling a cron job when store hours change —
  // mirrors business_sync.py's fixed-interval-rereads-config pattern from
  // the python-agent side. A 30-minute trigger window absorbs this 10-minute
  // poll cadence, so a tick landing slightly off-schedule can't skip the day.
  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkAndRunDailyJobs() {
    const settings = await this.getOrCreateSettings();
    const today = todayStamp();
    const now = new Date();
    const nowMin = nowMinutesInZone(settings.timezone || DEFAULT_TIMEZONE);

    const openMin = toMinutes(settings.openingTime);
    if (nowMin >= openMin - 30 && nowMin <= openMin && settings.lastMorningRunDate !== today) {
      await this.runForAllUsers(MORNING_AGENT_ID, 'morning', MORNING_PROMPT, `Morning to-do — ${now.toLocaleDateString()}`);
      await this.settingsModel.updateOne({ _id: settings._id }, { lastMorningRunDate: today }).exec();
    }

    const closeMin = toMinutes(settings.closingTime);
    if (nowMin >= closeMin && nowMin <= closeMin + 30 && settings.lastEodRunDate !== today) {
      await this.runForAllUsers(EOD_AGENT_ID, 'eod', EOD_PROMPT, `EOD report — ${now.toLocaleDateString()}`);
      await this.settingsModel.updateOne({ _id: settings._id }, { lastEodRunDate: today }).exec();
    }
  }

  private async getOrCreateSettings(): Promise<StoreSettingsDocument> {
    const existing = await this.settingsModel.findOne().exec();
    if (existing) {
      // Backfill for documents persisted before `timezone` existed — schema
      // defaults only apply on create, and both the cron trigger and the
      // Settings UI need a real value here, not undefined.
      if (!existing.timezone) {
        existing.timezone = DEFAULT_TIMEZONE;
        await existing.save();
      }
      return existing;
    }
    return this.settingsModel.create({});
  }

  private async runForAllUsers(agentId: string, reportType: 'morning' | 'eod', promptText: string, title: string) {
    const userIds = await this.usersService.findAllIds();
    const settled = await Promise.allSettled(
      userIds.map((userId) => this.chatService.generateSystemConversation(userId, agentId, promptText, title)),
    );
    settled.forEach((r, i) => {
      if (r.status === 'rejected') {
        this.logger.error(`Scheduled report failed for user ${userIds[i]}: ${(r.reason as Error).message}`);
      }
    });

    const successes = settled
      .map((r, i) => ({ r, userId: userIds[i] }))
      .filter((x) => x.r.status === 'fulfilled')
      .map((x) => ({ value: (x.r as PromiseFulfilledResult<{ conversationId: string; reply: string }>).value, userId: x.userId }));

    // Exactly one structured DailyReport per (agentId, reportType, date) —
    // not one per user. The first successful user (earliest-created,
    // findAllIds()'s natural order) is only the audit-trail owner
    // (sourceConversationId/sourceUserId) here — the report's actual
    // content comes from dashboardService's own CrewAI-backed generation
    // (independent of any user's plain chat reply, and higher-quality for
    // it), not from chosen.value.reply. A failure here must never break the
    // per-user fan-out above.
    if (successes.length > 0) {
      const chosen = successes[0];
      await this.dashboardService
        .recordDailyReport({
          agentId,
          reportType,
          date: todayStamp(),
          conversationId: chosen.value.conversationId,
          userId: chosen.userId,
        })
        .catch((err: Error) => this.logger.error(`Failed to generate ${reportType} report: ${err.message}`));
    }

    return { usersNotified: successes.length, totalUsers: userIds.length };
  }
}
