import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CrmModule } from '../crm/crm.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutlookConnection, OutlookConnectionSchema } from '../outlook/schemas/outlook-connection.schema';
import { UsersModule } from '../users/users.module';
import { EmailIntelligenceItem, EmailIntelligenceItemSchema } from './schemas/email-intelligence-item.schema';
import { CustomerTimelineController } from './customer-timeline.controller';
import { EmailIntelligenceController } from './email-intelligence.controller';
import { EmailIntelligencePollerService } from './email-intelligence-poller.service';
import { EmailIntelligenceService } from './email-intelligence.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmailIntelligenceItem.name, schema: EmailIntelligenceItemSchema },
      // Read-only reuse of OutlookModule's schema class (not a DI export) —
      // the poller only ever needs `find({isActive:true})`, no OutlookService
      // method exists for "every connected mailbox org-wide" so this is
      // simpler than adding one there for a single call site.
      { name: OutlookConnection.name, schema: OutlookConnectionSchema },
    ]),
    HttpModule.register({ timeout: 30_000 }),
    AuthModule,
    UsersModule,
    // One-directional: EmailIntelligenceModule -> CrmModule, never the
    // reverse — same shape as TimelineModule's documented pattern elsewhere.
    CrmModule,
    NotificationsModule,
  ],
  controllers: [EmailIntelligenceController, CustomerTimelineController],
  providers: [EmailIntelligenceService, EmailIntelligencePollerService],
})
export class EmailIntelligenceModule {}
