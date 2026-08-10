import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CrmModule } from '../crm/crm.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutlookConnection, OutlookConnectionSchema } from '../outlook/schemas/outlook-connection.schema';
import { UsersModule } from '../users/users.module';
import { EmailFollowUpReminder, EmailFollowUpReminderSchema } from './schemas/email-follow-up-reminder.schema';
import { EmailIntelligenceItem, EmailIntelligenceItemSchema } from './schemas/email-intelligence-item.schema';
import { CustomerTimelineController } from './customer-timeline.controller';
import { EmailIntelligenceController } from './email-intelligence.controller';
import { EmailIntelligencePollerService } from './email-intelligence-poller.service';
import { EmailIntelligenceService } from './email-intelligence.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmailIntelligenceItem.name, schema: EmailIntelligenceItemSchema },
      { name: EmailFollowUpReminder.name, schema: EmailFollowUpReminderSchema },
      // Read-only reuse of OutlookModule's schema class (not a DI export) —
      // the poller only ever needs `find({isActive:true})`, no OutlookService
      // method exists for "every connected mailbox org-wide" so this is
      // simpler than adding one there for a single call site.
      { name: OutlookConnection.name, schema: OutlookConnectionSchema },
    ]),
    // A single forced-tool-choice analyze_email call can legitimately exceed
    // 30s (confirmed live — a real regenerate call timed out at exactly
    // 30000ms with no error from python-agent/Anthropic, just NestJS giving
    // up too early; strict:true's grammar-constrained sampling, added in
    // Phase 17, plausibly adds some latency on top of the model's normal
    // response time). 90s gives real headroom without being unbounded.
    HttpModule.register({ timeout: 90_000 }),
    AuthModule,
    UsersModule,
    // One-directional: EmailIntelligenceModule -> CrmModule, never the
    // reverse — same shape as TimelineModule's documented pattern elsewhere.
    CrmModule,
    NotificationsModule,
  ],
  controllers: [EmailIntelligenceController, CustomerTimelineController],
  providers: [EmailIntelligenceService, EmailIntelligencePollerService],
  // Phase 16: EmailIntelligenceService.list() (self-scoped) is consumed by
  // the new HomeDashboardModule, which sits above both this module and
  // CrmModule — safe since HomeDashboardModule imports both but neither of
  // them imports it back.
  exports: [EmailIntelligenceService],
})
export class EmailIntelligenceModule {}
