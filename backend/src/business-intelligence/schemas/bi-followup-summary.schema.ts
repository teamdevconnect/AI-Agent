import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BiFollowupSummaryDocument = BiFollowupSummary & Document<Types.ObjectId>;

// Identical shape to finance/schemas/finance-summary.schema.ts — same
// on-demand-cached-LLM-result convention, one cache doc per org per day.
// Vendor Profitability's AI-compare has no equivalent cache schema — it's
// scoped to whatever filter combination the user is currently viewing, not
// a fixed daily org-wide snapshot, so nothing to key a cache by.
@Schema({ timestamps: true, collection: 'bi_followup_summaries' })
export class BiFollowupSummary {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  date: string;

  @Prop({ required: true })
  requestedByUserId: string;

  @Prop({ type: Object, required: true })
  deterministicInput: Record<string, unknown>;

  @Prop({ type: Object, required: true })
  result: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

export const BiFollowupSummarySchema = SchemaFactory.createForClass(BiFollowupSummary);
BiFollowupSummarySchema.index({ organizationId: 1, date: 1 }, { unique: true });
