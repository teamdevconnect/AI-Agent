import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuoteCounterDocument = QuoteCounter & Document<Types.ObjectId>;

// One doc per org, incremented atomically via findOneAndUpdate({$inc}) —
// backs QuotesService's native "Q-0001"-style quoteNumber generation.
// Synced quotes (from an external CRM) never touch this counter; they get
// their quoteNumber from the external record's own ticket_number instead
// (see python-agent/app/integrations/crm_mongo_sync.py).
@Schema({ timestamps: true, collection: 'crm_quote_counters' })
export class QuoteCounter {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ default: 0 })
  seq: number;
}

export const QuoteCounterSchema = SchemaFactory.createForClass(QuoteCounter);
QuoteCounterSchema.index({ organizationId: 1 }, { unique: true });
