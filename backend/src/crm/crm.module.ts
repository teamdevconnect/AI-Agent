import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { TimelineModule } from '../timeline/timeline.module';
import { UsersModule } from '../users/users.module';
import { Account, AccountSchema } from './schemas/account.schema';
import { Contact, ContactSchema } from './schemas/contact.schema';
import { CustomerActivitySummary, CustomerActivitySummarySchema } from './schemas/customer-activity-summary.schema';
import {
  CustomerActivityPersonalSummary,
  CustomerActivityPersonalSummarySchema,
} from './schemas/customer-activity-personal-summary.schema';
import { Deal, DealSchema } from './schemas/deal.schema';
import { DealPerformancePreset, DealPerformancePresetSchema } from './schemas/deal-performance-preset.schema';
import { Note, NoteSchema } from './schemas/note.schema';
import { Quote, QuoteSchema } from './schemas/quote.schema';
import { QuoteCounter, QuoteCounterSchema } from './schemas/quote-counter.schema';
import { SalesTarget, SalesTargetSchema } from './schemas/sales-target.schema';
import { Tag, TagSchema } from './schemas/tag.schema';
import { BusinessDashboardController } from './business-dashboard.controller';
import { BusinessDashboardService } from './business-dashboard.service';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CustomerActivityController } from './customer-activity.controller';
import { CustomerActivityService } from './customer-activity.service';
import { DealPerformanceDashboardController } from './deal-performance-dashboard.controller';
import { DealPerformanceDashboardService } from './deal-performance-dashboard.service';
import { DealPerformancePresetController } from './deal-performance-preset.controller';
import { DealPerformancePresetService } from './deal-performance-preset.service';
import { DealsController } from './deals.controller';
import { DealsExportService } from './deals-export.service';
import { DealsService } from './deals.service';
import { SalesAnalyticsService } from './sales-analytics.service';
import { SalesTargetController } from './sales-target.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contact.name, schema: ContactSchema },
      { name: Account.name, schema: AccountSchema },
      { name: Deal.name, schema: DealSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: Note.name, schema: NoteSchema },
      { name: Tag.name, schema: TagSchema },
      { name: SalesTarget.name, schema: SalesTargetSchema },
      { name: DealPerformancePreset.name, schema: DealPerformancePresetSchema },
      { name: QuoteCounter.name, schema: QuoteCounterSchema },
      { name: CustomerActivitySummary.name, schema: CustomerActivitySummarySchema },
      { name: CustomerActivityPersonalSummary.name, schema: CustomerActivityPersonalSummarySchema },
    ]),
    DashboardModule,
    OrganizationsModule,
    UsersModule,
    AuthModule,
    // Phase 11's Customer Activity summary generation writes a Timeline
    // event on every LLM-generated summary — one-directional import,
    // TimelineModule never imports CrmModule back (see TimelineModule's
    // own comment on why this stays safe from circularity).
    TimelineModule,
    // Calendar reads for teamCalendar/todaysMeetings, and Phase 11's
    // today's-emails + on-demand LLM summary calls, all drive a python-agent
    // round-trip. 60s (not the calendar-only 30s this used to be) — the LLM
    // summary call can retry once internally, same generous timeout as
    // finance.module.ts uses for its own extraction calls.
    HttpModule.register({ timeout: 60_000 }),
  ],
  controllers: [
    CrmController,
    SalesTargetController,
    BusinessDashboardController,
    DealsController,
    DealPerformanceDashboardController,
    DealPerformancePresetController,
    CustomerActivityController,
  ],
  providers: [
    CrmService,
    SalesAnalyticsService,
    BusinessDashboardService,
    DealsService,
    DealsExportService,
    DealPerformanceDashboardService,
    DealPerformancePresetService,
    CustomerActivityService,
  ],
})
export class CrmModule {}
