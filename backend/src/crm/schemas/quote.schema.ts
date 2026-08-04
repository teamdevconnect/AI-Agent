import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuoteDocument = Quote & Document<Types.ObjectId>;

// Nested, not flattened — mirrors Finance's taxDetails/bankDetails
// convention. Populated only for synced quotes (from the external CRM's
// own client_details blob, confirmed live to carry a clean company_name +
// a real contact email — a materially better business-name/correlation
// source than deriving one from Deal.name). Left entirely unset for
// natively created quotes.
@Schema({ _id: false })
export class QuoteClientDetails {
  @Prop()
  companyName?: string;

  @Prop()
  contactName?: string;

  @Prop({ index: true })
  email?: string;

  @Prop()
  phone?: string;
}
const QuoteClientDetailsSchema = SchemaFactory.createForClass(QuoteClientDetails);

// quoteStatus (internal lifecycle) and clientApprovalStatus (client-facing
// approval state) are separate, independent axes — matches crm_quote_tool's
// existing vocabulary.
@Schema({ timestamps: true, collection: 'crm_quotes' })
export class Quote {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ index: true })
  dealId?: string;

  @Prop()
  quoteName?: string;

  @Prop({ default: 'draft' })
  quoteStatus: string;

  @Prop({ default: 'pending' })
  clientApprovalStatus: string;

  @Prop({ default: 0 })
  quoteAmount: number;

  @Prop({ default: 'USD' })
  currency: string;

  @Prop()
  expirationDate?: string;

  @Prop()
  quoteOwner?: string;

  // Set only for quotes mirrored in from an org's connected external CRM
  // (see python-agent/app/integrations/crm_mongo_sync.py's sync_quotes_for_org)
  // — the external record's own id, so re-syncing updates the same document
  // instead of duplicating it. Absent for quotes created natively.
  @Prop()
  externalId?: string;

  // The one consistent "quote number" shown everywhere a quote is displayed.
  // Synced quotes: backfilled 1:1 from the external CRM's ticket_number.
  // Natively created quotes: auto-generated sequential "Q-0001" via
  // QuotesService's per-org counter. Left unset (never fabricated) if a
  // synced record has no ticket_number.
  @Prop({ index: true })
  quoteNumber?: string;

  @Prop({ type: QuoteClientDetailsSchema })
  clientDetails?: QuoteClientDetails;

  // See deal.schema.ts's identical field for why this exists — synced
  // quotes need change-aware activity tracking distinct from Mongoose's
  // updatedAt, which raw-pymongo sync writes never touch.
  @Prop()
  lastActivityAt?: Date;

  // Managed automatically by { timestamps: true } above — see deal.schema.ts's
  // identical comment.
  createdAt: Date;
  updatedAt: Date;
}

export const QuoteSchema = SchemaFactory.createForClass(Quote);
// Same partialFilterExpression pattern as Deal's index — see deal.schema.ts's
// comment for why `sparse: true` alone is wrong for a compound unique index.
QuoteSchema.index(
  { organizationId: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $exists: true } } },
);
