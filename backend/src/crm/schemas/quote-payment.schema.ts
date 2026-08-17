import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuotePaymentDocument = QuotePayment & Document<Types.ObjectId>;

// Real, itemized customer-payment history against a Quote — the piece that
// makes Accounts Receivable auditable rather than a bare running total.
// Owned by CrmModule (the Quote it belongs to lives here), not the Royalty
// Invoice model — Invoice is scoped as a royalty-fee calculator and is
// confirmed dormant in production (no live auto-create trigger), so it's
// the wrong foundation for a feature that needs to work today.
@Schema({ timestamps: true, collection: 'crm_quote_payments' })
export class QuotePayment {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  quoteId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  paymentDate: string;

  // Free text, vocabulary enforced at the DTO layer — same convention as
  // FinanceDocument.paymentMethod.
  @Prop()
  paymentMethod?: string;

  @Prop()
  reference?: string;

  @Prop({ required: true })
  recordedBy: string;

  // Corrections never hard-delete a financial record — same ethos as
  // Royalty Invoice.voidStatus. A voided payment is excluded from
  // Quote.paidAmount's recompute but stays in the audit trail.
  @Prop({ default: false })
  voided: boolean;

  @Prop()
  voidedAt?: Date;

  @Prop()
  voidedBy?: string;

  @Prop()
  voidReason?: string;
}

export const QuotePaymentSchema = SchemaFactory.createForClass(QuotePayment);
QuotePaymentSchema.index({ organizationId: 1, quoteId: 1 });
QuotePaymentSchema.index({ organizationId: 1, paymentDate: 1 });
