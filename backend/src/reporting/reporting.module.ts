import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { Deal, DealSchema } from '../crm/schemas/deal.schema';
import { Quote, QuoteSchema } from '../crm/schemas/quote.schema';
import { Invoice, InvoiceSchema } from '../royalty/schemas/invoice.schema';
import { ReportingController } from './reporting.controller';
import { SalesReportService } from './sales-report.service';
import { GrossMarginReportService } from './gross-margin-report.service';

// Home for the "Reporting" hub's non-Royalty report types (Sales, Gross
// Margin). Royalty itself stays in RoyaltyModule/its own /royalty/report
// endpoint, unchanged — this module's controller composes it into one page
// only on the frontend. Deal/Quote/Invoice re-registered read-only here,
// same "second module re-registers the schema rather than importing the
// owning module" precedent RoyaltyModule/EmailIntelligenceModule already
// established.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Deal.name, schema: DealSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
    AuthModule,
    UsersModule,
  ],
  controllers: [ReportingController],
  providers: [SalesReportService, GrossMarginReportService],
})
export class ReportingModule {}
