import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CustomerActivityService } from '../crm/customer-activity.service';
import { QuotePaymentsService } from '../crm/quote-payments.service';
import { BiQuoteFilters, QuotesService } from '../crm/quotes.service';

@Injectable()
export class CustomerQuotePaymentService {
  constructor(
    private quotesService: QuotesService,
    private quotePaymentsService: QuotePaymentsService,
    private customerActivityService: CustomerActivityService,
  ) {}

  getSummary(organizationId: string, start: Date, end: Date, filters: BiQuoteFilters) {
    return this.quotesService.getBiSummary(organizationId, start, end, filters);
  }

  listQuotes(organizationId: string, start: Date, end: Date, filters: BiQuoteFilters, page: number, pageSize: number) {
    return this.quotesService.listForBi(organizationId, start, end, filters, page, pageSize);
  }

  // Per-customer detail — reuses CustomerActivityService's existing
  // BusinessGroup identity (getRelationshipView/getPersonalRelationshipView)
  // rather than inventing a second one, then overlays each quote with its
  // own real payment history so the detail modal shows accepted/rejected/
  // pending quotes AND paid/outstanding amounts for the same business in one
  // call. `personal:true` (consultant tier) mirrors getPersonalRelationshipView's
  // own precedent — self-scoped, no owner/admin-style store override.
  async getCustomerDetail(caller: JwtPayload, businessKey: string, storeConstraint?: string, personal?: boolean) {
    const relationship = personal
      ? await this.customerActivityService.getPersonalRelationshipView(caller, businessKey)
      : await this.customerActivityService.getRelationshipView(caller, businessKey, storeConstraint);
    const quoteIds = relationship.quotes.map((q) => q.id);
    const paymentsByQuote = await this.quotePaymentsService.listPaymentsForQuotes(caller.organizationId, quoteIds);

    const quotes = relationship.quotes.map((q) => {
      const payments = paymentsByQuote.get(q.id) ?? [];
      const paidAmount = payments.filter((p) => !p.voided).reduce((sum, p) => sum + p.amount, 0);
      return {
        ...q,
        paidAmount,
        outstandingAmount: q.quoteAmount - paidAmount,
        payments: payments.map((p) => ({
          id: p._id.toString(),
          amount: p.amount,
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
          reference: p.reference,
          voided: p.voided,
        })),
      };
    });

    return { ...relationship, quotes };
  }
}
