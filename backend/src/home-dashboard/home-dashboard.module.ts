import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CrmModule } from '../crm/crm.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { EmailIntelligenceModule } from '../email-intelligence/email-intelligence.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { OutlookConnection, OutlookConnectionSchema } from '../outlook/schemas/outlook-connection.schema';
import { TimelineModule } from '../timeline/timeline.module';
import { HomeDashboardController } from './home-dashboard.controller';
import { HomeDashboardService } from './home-dashboard.service';

// Phase 16 — sits above CrmModule and EmailIntelligenceModule (the only
// place that can safely depend on both without creating a cycle:
// EmailIntelligenceModule -> CrmModule is one-directional and this module
// isn't imported back by either). Read-only reuse of the OutlookConnection
// schema class (not a DI export) — same precedent EmailIntelligenceModule
// itself already established for the identical "is this user's mailbox
// connected" question.
@Module({
  imports: [
    MongooseModule.forFeature([{ name: OutlookConnection.name, schema: OutlookConnectionSchema }]),
    AuthModule,
    OrganizationsModule,
    CrmModule,
    DashboardModule,
    TimelineModule,
    EmailIntelligenceModule,
  ],
  controllers: [HomeDashboardController],
  providers: [HomeDashboardService],
})
export class HomeDashboardModule {}
