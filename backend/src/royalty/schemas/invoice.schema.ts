import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InvoiceDocument = Invoice & Document<Types.ObjectId>;

// Mirrors QuoteClientDetails exactly, for the same reason: a clean
// company/contact name + email is the best real correlation/display source
// available, whether the invoice was auto-drafted from a Quote (which
// carries its own real clientDetails) or entered manually.
@Schema({ _id: false })
export class InvoiceClientDetails {
  @Prop()
  companyName?: string;

  @Prop()
  contactName?: string;

  @Prop({ index: true })
  email?: string;

  @Prop()
  phone?: string;
}
const InvoiceClientDetailsSchema = SchemaFactory.createForClass(InvoiceClientDetails);

// Invoice is a genuinely new concept in this codebase — no native schema, no
// external-CRM sync, and Quote (a pre-payment estimate) can't serve as a
// proxy. Comes into existence two ways only (source): 'auto_from_quote' —
// drafted the moment a Quote's clientApprovalStatus flips to 'approved' (see
// python-agent/app/integrations/crm_mongo_sync.py's sync_quotes_for_org) —
// or 'manual' — created directly through this app's own UI.
//
// invoiceStatus is a single 3-value lifecycle, deliberately NOT split into a
// second paymentStatus field — the Royalty Report spec treats "invoiced" and
// "paid" as points on one lifecycle, not two independent axes (unlike
// Quote's genuinely-independent quoteStatus/clientApprovalStatus). This also
// yields a clean partition for the future report's three sections: Invoiced
// Jobs = invoiceStatus in [invoiced, paid] and not void; Work In Progress =
// invoiceStatus = draft and not void; Voided Jobs = voidStatus = true
// regardless of invoiceStatus.
@Schema({ timestamps: true, collection: 'royalty_invoices' })
export class Invoice {
  @Prop({ required: true, index: true })
  organizationId: string;

  // Branch — this app already treats one Store as one Branch everywhere
  // else (see organizations/schemas/store.schema.ts), reused directly.
  @Prop({ index: true })
  storeId?: string;

  // Unvalidated free-text refs, matching Deal.contactId/Deal.accountId's own
  // no-FK-validation precedent — no cross-collection existence check is
  // enforced anywhere else in this codebase either.
  @Prop({ index: true })
  dealId?: string;

  @Prop({ index: true })
  quoteId?: string;

  // Server-generated sequential "INV-0001", via InvoiceCounter — always
  // present on every creation path (manual or auto-drafted), so a plain
  // unique index (not a partial one) is correct here, unlike Quote's own
  // quoteNumber which can genuinely be absent for some synced quotes.
  @Prop({ required: true, index: true })
  invoiceNumber: string;

  @Prop({ type: InvoiceClientDetailsSchema })
  clientDetails?: InvoiceClientDetails;

  // = the linked Deal's ownerId at creation time for an auto-drafted
  // invoice, or user-picked for a manual one — the "Sales Person" filter.
  @Prop({ index: true })
  salespersonId?: string;

  @Prop({ required: true, index: true })
  invoiceDate: Date;

  // Three flat Number fields, not an embedded revision array — the
  // minimal shape satisfying the report spec's literal "Previous Value"/
  // "Updated Value" columns (singular, not a full history) without
  // building the generic field-level audit-log system this codebase has
  // explicitly never had (see Deal/Quote's own destructive-$set updates).
  // originalValue is kept distinct from previousValue because after a 2nd
  // edit, previousValue no longer reflects the true starting value.
  @Prop({ required: true, default: 0 })
  originalValue: number;

  @Prop()
  previousValue?: number;

  @Prop({ required: true, default: 0 })
  currentValue: number;

  // The Royalty Formula Engine's "excluded items" — left genuinely unset
  // (never defaulted to 0 or guessed) until a human enters a real figure,
  // matching this codebase's "never fabricate a financial figure"
  // convention (see FinanceDocument's own missingFields philosophy).
  @Prop()
  taxAmount?: number;

  @Prop()
  shippingAmount?: number;

  @Prop()
  discountAmount?: number;

  // Manually entered, never fabricated — the one real cost figure anywhere
  // in this codebase. Left genuinely unset until a human enters it (same
  // "never default to 0 or guess" idiom as taxAmount/shippingAmount above),
  // since an absent cost and a zero cost mean very different things for
  // Gross Margin reporting (see reporting/gross-margin-report.service.ts,
  // which only ever includes an invoice in a margin computation once this
  // field is actually present).
  @Prop()
  costAmount?: number;

  @Prop({ default: 'INR' })
  currency: string;

  @Prop({ enum: ['draft', 'invoiced', 'paid'], default: 'draft', index: true })
  invoiceStatus: 'draft' | 'invoiced' | 'paid';

  // Independent of invoiceStatus — a paid invoice can still be voided.
  // voidReason is captured only via a dedicated void action, never a
  // generic field edit, same "capture only on status transition" idiom as
  // Deal.lostReason.
  @Prop({ default: false, index: true })
  voidStatus: boolean;

  @Prop()
  voidDate?: Date;

  @Prop()
  voidReason?: string;

  @Prop({ enum: ['auto_from_quote', 'manual'], required: true })
  source: 'auto_from_quote' | 'manual';

  // User id for a manual create; 'system:crm-sync' for an auto-drafted one.
  @Prop({ required: true })
  createdBy: string;

  // Managed automatically by { timestamps: true } above — declared (not
  // @Prop()'d) purely so TypeScript knows these exist, same convention
  // every other schema in this codebase uses.
  createdAt: Date;
  updatedAt: Date;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

InvoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });

// Hard idempotency guard against double-drafting an invoice for the same
// Quote — belt-and-suspenders on top of the sync job's own transition-only
// trigger, since a duplicated invoice directly inflates a real royalty-due
// dollar figure. partialFilterExpression, not sparse: true — the same
// twice-previously-found bug class on a compound unique index where
// organizationId is never absent (see deal.schema.ts's own comment).
InvoiceSchema.index(
  { organizationId: 1, quoteId: 1 },
  { unique: true, partialFilterExpression: { quoteId: { $exists: true } } },
);

InvoiceSchema.index({ organizationId: 1, invoiceDate: -1 });
