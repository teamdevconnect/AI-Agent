import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VendorDocument = Vendor & Document<Types.ObjectId>;

// The master vendor record — what didn't exist anywhere in this app before
// Business Intelligence's Vendor Profitability module. FinanceDocument's own
// vendorName/vendorId stay as free-text AI-extraction output (untouched);
// this is the real, human-managed entity a VendorQuote and a
// FinanceDocument.vendorRef both point at.
@Schema({ timestamps: true, collection: 'vendors' })
export class Vendor {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  contactName?: string;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;

  // Free text, vocabulary enforced at the DTO layer — same "no schema
  // migration for a new category" convention as Deal.leadSource/product.
  @Prop()
  category?: string;

  @Prop()
  address?: string;

  // GSTIN/VAT/etc — free text, jurisdiction-agnostic.
  @Prop()
  taxId?: string;

  // Same embedded shape as FinanceDocument.bankDetails — kept identical so a
  // future "prefill from this vendor's last payment" convenience never has
  // to reconcile two different shapes.
  @Prop({ type: Object })
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifscOrSwift?: string;
    accountHolderName?: string;
  };

  @Prop({ enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';

  @Prop()
  notes?: string;

  @Prop({ required: true })
  createdBy: string;
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);
// Non-unique — vendor names can legitimately collide (two different
// businesses sharing a common name); this is a search/list index, not an
// identity constraint.
VendorSchema.index({ organizationId: 1, name: 1 });
