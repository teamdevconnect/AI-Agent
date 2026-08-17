import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VendorQuoteDocument = VendorQuote & Document<Types.ObjectId>;

// "What a vendor quoted, before we ever paid them" — the piece that never
// existed anywhere in this app: FinanceDocument only ever captured the
// final paid/payable invoice, post-hoc, with no record of what was quoted
// beforehand or what it was quoted for. dealId/quoteId link this to the
// customer transaction it's sourcing cost for — Vendor Profitability's
// per-transaction comparison (VendorQuote -> FinanceDocument payment ->
// customer Quote) is only possible once these links exist.
@Schema({ timestamps: true, collection: 'vendor_quotes' })
export class VendorQuote {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  vendorId: string;

  // Neither required at the schema level — a vendor quote can exist before
  // a customer deal/quote is even decided (shopping vendor prices ahead of
  // a sale), so this link is populated once it's actually known.
  @Prop({ index: true })
  dealId?: string;

  @Prop({ index: true })
  quoteId?: string;

  @Prop()
  vendorReferenceNumber?: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  quotedAmount: number;

  @Prop({ default: 'INR' })
  currency: string;

  @Prop({ required: true })
  quoteDate: string;

  @Prop()
  validUntil?: string;

  @Prop({ enum: ['pending', 'accepted', 'rejected', 'expired'], default: 'pending' })
  status: 'pending' | 'accepted' | 'rejected' | 'expired';

  @Prop()
  acceptedAt?: Date;

  @Prop({ required: true })
  createdBy: string;
}

export const VendorQuoteSchema = SchemaFactory.createForClass(VendorQuote);
VendorQuoteSchema.index({ organizationId: 1, vendorId: 1 });
VendorQuoteSchema.index({ organizationId: 1, dealId: 1 });
VendorQuoteSchema.index({ organizationId: 1, quoteId: 1 });
