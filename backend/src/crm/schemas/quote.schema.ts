import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuoteDocument = Quote & Document<Types.ObjectId>;

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
}

export const QuoteSchema = SchemaFactory.createForClass(Quote);
