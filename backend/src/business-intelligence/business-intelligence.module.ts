import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CrmModule } from '../crm/crm.module';
import { Deal, DealSchema } from '../crm/schemas/deal.schema';
import { Quote, QuoteSchema } from '../crm/schemas/quote.schema';
import { DashboardModule } from '../dashboard/dashboard.module';
import { EmailIntelligenceModule } from '../email-intelligence/email-intelligence.module';
import { EmailIntelligenceItem, EmailIntelligenceItemSchema } from '../email-intelligence/schemas/email-intelligence-item.schema';
import { FinanceModule } from '../finance/finance.module';
import { FinanceDocument, FinanceDocumentSchema } from '../finance/schemas/finance-document.schema';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RoyaltyModule } from '../royalty/royalty.module';
import { TimelineModule } from '../timeline/timeline.module';
import { UsersModule } from '../users/users.module';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { VendorQuote, VendorQuoteSchema } from '../vendors/schemas/vendor-quote.schema';
import { VendorsModule } from '../vendors/vendors.module';
import { AiFollowupSummaryController } from './ai-followup-summary.controller';
import { AiFollowupSummaryService } from './ai-followup-summary.service';
import { BusinessIntelligenceController } from './business-intelligence.controller';
import { CustomerQuotePaymentController } from './customer-quote-payment.controller';
import { CustomerQuotePaymentService } from './customer-quote-payment.service';
import { EmailAnalyticsController } from './email-analytics.controller';
import { EmailAnalyticsExportService } from './email-analytics-export.service';
import { EmployeeProductivityController } from './employee-productivity.controller';
import { EmployeeProductivityService } from './employee-productivity.service';
import { EnquiryConversionController } from './enquiry-conversion.controller';
import { EnquiryConversionService } from './enquiry-conversion.service';
import { VendorProfitabilityController } from './vendor-profitability.controller';
import { VendorProfitabilityService } from './vendor-profitability.service';
import { BiFollowupSummary, BiFollowupSummarySchema } from './schemas/bi-followup-summary.schema';

// Sits above CrmModule/EmailIntelligenceModule/FinanceModule/RoyaltyModule/
// VendorsModule — none of which import it back, zero cycle risk, same
// proven shape as AnalyticsDashboardModule (which already sits above both
// CrmModule and EmailIntelligenceModule together, confirmed working).
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BiFollowupSummary.name, schema: BiFollowupSummarySchema },
      // Read-only reuse of EmailIntelligenceModule's/CrmModule's own schema
      // classes for EnquiryConversionService's direct join query — same
      // "second module re-registers the schema" precedent crm.module.ts's
      // own EmailIntelligenceItem reuse already establishes.
      { name: EmailIntelligenceItem.name, schema: EmailIntelligenceItemSchema },
      { name: Quote.name, schema: QuoteSchema },
      // Vendor Profitability's own per-transaction join, same read-only
      // reuse idiom.
      { name: Deal.name, schema: DealSchema },
      { name: FinanceDocument.name, schema: FinanceDocumentSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: VendorQuote.name, schema: VendorQuoteSchema },
    ]),
    AuthModule,
    UsersModule,
    OrganizationsModule,
    DashboardModule,
    CrmModule,
    EmailIntelligenceModule,
    FinanceModule,
    RoyaltyModule,
    VendorsModule,
    // AiFollowupSummaryService writes a Timeline event on every LLM-generated
    // summary — same one-directional import as crm.module.ts/finance.module.ts's
    // identical addition, safe from circularity (TimelineModule never imports
    // any of its consumers back).
    TimelineModule,
    // Matches EmailIntelligenceModule's own LLM-call timeout — the AI
    // Follow-Up Summary and Vendor Profitability AI-compare controllers
    // (added in later phases) both make a python-agent round trip.
    HttpModule.register({ timeout: 90_000 }),
  ],
  controllers: [
    BusinessIntelligenceController,
    EmailAnalyticsController,
    EmployeeProductivityController,
    CustomerQuotePaymentController,
    EnquiryConversionController,
    VendorProfitabilityController,
    AiFollowupSummaryController,
  ],
  providers: [
    EmailAnalyticsExportService,
    EmployeeProductivityService,
    CustomerQuotePaymentService,
    EnquiryConversionService,
    VendorProfitabilityService,
    AiFollowupSummaryService,
  ],
})
export class BusinessIntelligenceModule {}
