import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { Account, AccountSchema } from './schemas/account.schema';
import { Contact, ContactSchema } from './schemas/contact.schema';
import { Deal, DealSchema } from './schemas/deal.schema';
import { DealPerformancePreset, DealPerformancePresetSchema } from './schemas/deal-performance-preset.schema';
import { Note, NoteSchema } from './schemas/note.schema';
import { Quote, QuoteSchema } from './schemas/quote.schema';
import { SalesTarget, SalesTargetSchema } from './schemas/sales-target.schema';
import { Tag, TagSchema } from './schemas/tag.schema';
import { BusinessDashboardController } from './business-dashboard.controller';
import { BusinessDashboardService } from './business-dashboard.service';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
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
    ]),
    DashboardModule,
    OrganizationsModule,
    UsersModule,
    AuthModule,
    // Calendar reads for teamCalendar/todaysMeetings drive the full
    // Outlook Graph round-trip (via python-agent), same generous timeout
    // as dashboard.module.ts's own relay.
    HttpModule.register({ timeout: 30_000 }),
  ],
  controllers: [
    CrmController,
    SalesTargetController,
    BusinessDashboardController,
    DealsController,
    DealPerformanceDashboardController,
    DealPerformancePresetController,
  ],
  providers: [
    CrmService,
    SalesAnalyticsService,
    BusinessDashboardService,
    DealsService,
    DealsExportService,
    DealPerformanceDashboardService,
    DealPerformancePresetService,
  ],
})
export class CrmModule {}
